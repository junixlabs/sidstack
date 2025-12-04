//! Recovery Watchdog
//!
//! Monitors agent health and triggers automatic recovery when failures are detected.
//! Detects: terminal closure, stale heartbeats, and failure patterns in output.

#![allow(dead_code)]

use crate::team_manager::SharedTeamManager;
use crate::team_storage::{MemberStatus, RecoveryContextSummary};
use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio::time;

/// Watchdog configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WatchdogConfig {
    /// Health check interval in seconds
    pub check_interval_secs: u64,
    /// Heartbeat timeout in seconds (mark stale after this)
    pub heartbeat_timeout_secs: u64,
    /// Delay before triggering recovery in milliseconds
    pub recovery_delay_ms: u64,
    /// Whether watchdog is enabled
    pub enabled: bool,
}

impl Default for WatchdogConfig {
    fn default() -> Self {
        Self {
            check_interval_secs: 30,
            heartbeat_timeout_secs: 120,
            recovery_delay_ms: 5000,
            enabled: true,
        }
    }
}

/// Health status for a member
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberHealth {
    pub member_id: String,
    pub team_id: String,
    pub is_healthy: bool,
    pub last_heartbeat: Option<DateTime<Utc>>,
    pub terminal_alive: bool,
    pub failure_detected: bool,
    pub failure_reason: Option<String>,
}

/// Recovery event emitted to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryNotification {
    pub team_id: String,
    pub failed_member_id: String,
    pub failed_member_role: String,
    pub replacement_member_id: Option<String>,
    pub reason: String,
    pub timestamp: DateTime<Utc>,
    pub success: bool,
}

/// Commands for the watchdog
pub enum WatchdogCommand {
    StartMonitoring { team_id: String, project_path: String },
    StopMonitoring { team_id: String },
    TriggerRecovery { team_id: String, member_id: String, reason: String },
    UpdateConfig(WatchdogConfig),
    Shutdown,
}

/// Watchdog state for a monitored team
struct MonitoredTeam {
    project_path: String,
    last_check: DateTime<Utc>,
    pending_recoveries: HashMap<String, DateTime<Utc>>, // member_id -> scheduled_time
}

/// Recovery Watchdog implementation
pub struct RecoveryWatchdog {
    config: WatchdogConfig,
    team_manager: SharedTeamManager,
    monitored_teams: HashMap<String, MonitoredTeam>,
    command_tx: Option<mpsc::Sender<WatchdogCommand>>,
}

impl RecoveryWatchdog {
    pub fn new(team_manager: SharedTeamManager) -> Self {
        Self {
            config: WatchdogConfig::default(),
            team_manager,
            monitored_teams: HashMap::new(),
            command_tx: None,
        }
    }

    /// Start the watchdog background task
    pub fn start(self, app_handle: AppHandle) -> mpsc::Sender<WatchdogCommand> {
        let (tx, rx) = mpsc::channel::<WatchdogCommand>(100);
        let watchdog = Arc::new(RwLock::new(self));

        // Spawn background task
        tokio::spawn(async move {
            run_watchdog_loop(watchdog, rx, app_handle).await;
        });

        tx
    }

    /// Check health of all monitored teams
    async fn check_health(&mut self) -> Vec<MemberHealth> {
        let mut all_health = Vec::new();

        for (team_id, monitored) in &self.monitored_teams {
            let mut manager = self.team_manager.lock().await;
            if let Ok(team) = manager.get_members_with_state(&monitored.project_path, team_id) {
                for member in team {
                    let is_stale = member.status == MemberStatus::Active
                        && self.is_heartbeat_stale(&member.id);

                    let health = MemberHealth {
                        member_id: member.id.clone(),
                        team_id: team_id.clone(),
                        is_healthy: member.status != MemberStatus::Failed && !is_stale,
                        last_heartbeat: None, // Would come from actual heartbeat tracking
                        terminal_alive: member.terminal_id.is_some(),
                        failure_detected: member.status == MemberStatus::Failed || is_stale,
                        failure_reason: if member.status == MemberStatus::Failed {
                            Some("Agent reported failure".to_string())
                        } else if is_stale {
                            Some("Heartbeat timeout".to_string())
                        } else {
                            None
                        },
                    };

                    all_health.push(health);
                }
            }
            drop(manager);
        }

        all_health
    }

    /// Check if a member's heartbeat is stale
    fn is_heartbeat_stale(&self, _member_id: &str) -> bool {
        // Would check against actual heartbeat timestamps
        // For now, return false (assume healthy)
        false
    }

    /// Schedule recovery for a member
    fn schedule_recovery(&mut self, team_id: &str, member_id: &str) {
        if let Some(monitored) = self.monitored_teams.get_mut(team_id) {
            let recovery_time = Utc::now() + Duration::milliseconds(self.config.recovery_delay_ms as i64);
            monitored.pending_recoveries.insert(member_id.to_string(), recovery_time);
        }
    }

    /// Execute pending recoveries
    async fn execute_pending_recoveries(&mut self, app_handle: &AppHandle) {
        let now = Utc::now();
        let mut recoveries_to_execute = Vec::new();

        // Collect recoveries that are due
        for (team_id, monitored) in &mut self.monitored_teams {
            let due_recoveries: Vec<String> = monitored.pending_recoveries
                .iter()
                .filter(|(_, scheduled)| **scheduled <= now)
                .map(|(member_id, _)| member_id.clone())
                .collect();

            for member_id in due_recoveries {
                monitored.pending_recoveries.remove(&member_id);
                recoveries_to_execute.push((
                    team_id.clone(),
                    monitored.project_path.clone(),
                    member_id,
                ));
            }
        }

        // Execute recoveries
        for (team_id, project_path, member_id) in recoveries_to_execute {
            self.trigger_recovery(&team_id, &project_path, &member_id, "Scheduled recovery", app_handle).await;
        }
    }

    /// Trigger recovery for a specific member
    async fn trigger_recovery(
        &mut self,
        team_id: &str,
        project_path: &str,
        member_id: &str,
        reason: &str,
        app_handle: &AppHandle,
    ) {
        let mut manager = self.team_manager.lock().await;

        // Get team to check recovery settings
        let team = match manager.get_team(project_path, team_id) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("Failed to get team for recovery: {}", e);
                return;
            }
        };

        // Check if auto-recovery is enabled
        if !team.config.auto_recovery {
            return;
        }

        // Check max recovery attempts
        let member = team.config.workers.iter()
            .find(|w| w.id == member_id)
            .or_else(|| if team.config.orchestrator.id == member_id {
                Some(&team.config.orchestrator)
            } else {
                None
            });

        if let Some(member) = member {
            if member.failure_count >= team.config.max_recovery_attempts {
                eprintln!("Max recovery attempts reached for member {}", member_id);
                return;
            }
        }

        // Report failure
        if let Err(e) = manager.report_member_failure(project_path, team_id, member_id, reason) {
            eprintln!("Failed to report member failure: {}", e);
            return;
        }

        // Get recovery context before creating replacement
        let context = manager.build_recovery_context(project_path, team_id, member_id).ok();
        let context_summary = context.as_ref().map(|c| RecoveryContextSummary {
            progress: c.progress,
            artifacts: c.artifacts.clone(),
            current_step: c.current_step.clone(),
        });

        // Create replacement
        let replacement = match manager.create_replacement_member(project_path, team_id, member_id) {
            Ok(r) => r,
            Err(e) => {
                eprintln!("Failed to create replacement member: {}", e);
                // Record failed recovery
                let _ = manager.record_recovery_event(
                    project_path,
                    team_id,
                    member_id,
                    "unknown",
                    "none",
                    reason,
                    context_summary,
                    false,
                );
                return;
            }
        };

        // Record successful recovery
        let _ = manager.record_recovery_event(
            project_path,
            team_id,
            member_id,
            &replacement.role,
            &replacement.id,
            reason,
            context_summary.clone(),
            true,
        );

        drop(manager);

        // Emit recovery notification to frontend
        let notification = RecoveryNotification {
            team_id: team_id.to_string(),
            failed_member_id: member_id.to_string(),
            failed_member_role: replacement.role.clone(),
            replacement_member_id: Some(replacement.id.clone()),
            reason: reason.to_string(),
            timestamp: Utc::now(),
            success: true,
        };

        let _ = app_handle.emit("recovery-event", &notification);
    }
}

/// Main watchdog loop
async fn run_watchdog_loop(
    watchdog: Arc<RwLock<RecoveryWatchdog>>,
    mut rx: mpsc::Receiver<WatchdogCommand>,
    app_handle: AppHandle,
) {
    let check_interval = {
        let wd = watchdog.read().await;
        wd.config.check_interval_secs
    };

    let mut interval = time::interval(time::Duration::from_secs(check_interval));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                let mut wd = watchdog.write().await;
                if wd.config.enabled {
                    // Check health
                    let health_reports = wd.check_health().await;

                    // Schedule recoveries for unhealthy members
                    for health in health_reports {
                        if health.failure_detected && health.failure_reason.is_some() {
                            wd.schedule_recovery(&health.team_id, &health.member_id);
                        }
                    }

                    // Execute pending recoveries
                    wd.execute_pending_recoveries(&app_handle).await;
                }
            }

            Some(cmd) = rx.recv() => {
                match cmd {
                    WatchdogCommand::StartMonitoring { team_id, project_path } => {
                        let mut wd = watchdog.write().await;
                        wd.monitored_teams.insert(team_id, MonitoredTeam {
                            project_path,
                            last_check: Utc::now(),
                            pending_recoveries: HashMap::new(),
                        });
                    }

                    WatchdogCommand::StopMonitoring { team_id } => {
                        let mut wd = watchdog.write().await;
                        wd.monitored_teams.remove(&team_id);
                    }

                    WatchdogCommand::TriggerRecovery { team_id, member_id, reason } => {
                        let mut wd = watchdog.write().await;
                        if let Some(monitored) = wd.monitored_teams.get(&team_id) {
                            let project_path = monitored.project_path.clone();
                            wd.trigger_recovery(&team_id, &project_path, &member_id, &reason, &app_handle).await;
                        }
                    }

                    WatchdogCommand::UpdateConfig(config) => {
                        let mut wd = watchdog.write().await;
                        wd.config = config;
                    }

                    WatchdogCommand::Shutdown => {
                        break;
                    }
                }
            }
        }
    }
}

/// Shared watchdog state
pub type SharedWatchdog = Arc<Mutex<Option<mpsc::Sender<WatchdogCommand>>>>;

/// Create shared watchdog sender
pub fn create_watchdog_handle() -> SharedWatchdog {
    Arc::new(Mutex::new(None))
}

/// Start watchdog and store sender
pub async fn start_watchdog(
    handle: SharedWatchdog,
    team_manager: SharedTeamManager,
    app_handle: AppHandle,
) {
    let watchdog = RecoveryWatchdog::new(team_manager);
    let sender = watchdog.start(app_handle);

    let mut guard = handle.lock().await;
    *guard = Some(sender);
}

/// Send command to watchdog
pub async fn send_watchdog_command(handle: &SharedWatchdog, cmd: WatchdogCommand) -> bool {
    let guard = handle.lock().await;
    if let Some(ref sender) = *guard {
        sender.send(cmd).await.is_ok()
    } else {
        false
    }
}
