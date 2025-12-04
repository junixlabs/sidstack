#![allow(dead_code)]

use crate::team_storage::{
    TeamConfig, TeamMemberConfig, TeamState, TeamStatus,
    TeamStorage, TeamStorageError,
    MemberState, MemberStatus, MemberTaskInfo,
    RecoveryEvent, RecoveryContextSummary,
    SessionInfo, TerminalSessionInfo,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

/// Team manager error
#[derive(Debug)]
pub enum TeamManagerError {
    StorageError(TeamStorageError),
    MemberNotFound(String),
    InvalidOperation(String),
}

impl std::fmt::Display for TeamManagerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TeamManagerError::StorageError(e) => write!(f, "Storage error: {}", e),
            TeamManagerError::MemberNotFound(id) => write!(f, "Member not found: {}", id),
            TeamManagerError::InvalidOperation(msg) => write!(f, "Invalid operation: {}", msg),
        }
    }
}

impl From<TeamStorageError> for TeamManagerError {
    fn from(e: TeamStorageError) -> Self {
        TeamManagerError::StorageError(e)
    }
}

/// Input for creating a team
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTeamInput {
    pub name: String,
    pub project_path: String,
    #[serde(default = "default_auto_recovery")]
    pub auto_recovery: bool,
    #[serde(default = "default_max_recovery_attempts")]
    pub max_recovery_attempts: u32,
    #[serde(default)]
    pub members: Vec<MemberInput>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

fn default_auto_recovery() -> bool { true }
fn default_max_recovery_attempts() -> u32 { 3 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberInput {
    pub role: String,
    pub agent_type: String,
}

/// Team summary for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamSummary {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub status: TeamStatus,
    pub member_count: usize,
    pub last_active: String,
    pub auto_recovery: bool,
}

/// Full team data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamData {
    pub config: TeamConfig,
    pub state: TeamState,
}

/// Member with session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberWithState {
    pub id: String,
    pub role: String,
    pub agent_type: String,
    pub status: MemberStatus,
    pub terminal_id: Option<String>,
    pub claude_session_id: Option<String>,
    pub current_task: Option<MemberTaskInfo>,
    pub failure_count: u32,
}

/// Recovery context for spawning replacement agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryContext {
    pub spec_id: Option<String>,
    pub task_id: Option<String>,
    pub phase: Option<String>,
    pub progress: u32,
    pub completed_steps: Vec<String>,
    pub current_step: Option<String>,
    pub artifacts: Vec<String>,
    pub resume_instructions: String,
}

/// Team manager for handling team operations
pub struct TeamManager {
    storage: TeamStorage,
    // Cache active teams in memory
    active_teams: HashMap<String, TeamData>,
}

impl TeamManager {
    pub fn new() -> Result<Self, TeamManagerError> {
        Ok(Self {
            storage: TeamStorage::new()?,
            active_teams: HashMap::new(),
        })
    }

    // ===== Team CRUD Operations =====

    /// Create a new team
    pub fn create_team(&mut self, input: CreateTeamInput) -> Result<TeamData, TeamManagerError> {
        // Create orchestrator member
        let orchestrator = TeamMemberConfig::new("orchestrator".to_string(), "orchestrator".to_string());

        // Create worker members
        let workers: Vec<TeamMemberConfig> = input.members
            .iter()
            .map(|m| TeamMemberConfig::new(m.role.clone(), m.agent_type.clone()))
            .collect();

        let config = TeamConfig {
            id: Uuid::new_v4().to_string(),
            name: input.name,
            project_path: input.project_path.clone(),
            created_at: Utc::now(),
            created_by: "user".to_string(),
            orchestrator,
            workers,
            auto_recovery: input.auto_recovery,
            max_recovery_attempts: input.max_recovery_attempts,
            recovery_delay_ms: 5000,
            description: input.description,
            tags: Vec::new(),
        };

        let config = self.storage.create_team(config)?;
        let state = self.storage.load_state(&input.project_path, &config.id)?;

        let team_data = TeamData { config: config.clone(), state };
        self.active_teams.insert(config.id.clone(), team_data.clone());

        Ok(team_data)
    }

    /// List teams for a project
    pub fn list_teams(&self, project_path: &str, status_filter: Option<TeamStatus>) -> Result<Vec<TeamSummary>, TeamManagerError> {
        let entries = self.storage.list_teams(project_path, status_filter)?;

        let summaries: Vec<TeamSummary> = entries.into_iter().map(|e| {
            // Try to load full config for more details
            let auto_recovery = self.storage.load_config(project_path, &e.id)
                .map(|c| c.auto_recovery)
                .unwrap_or(true);

            TeamSummary {
                id: e.id,
                name: e.name,
                project_path: project_path.to_string(),
                status: e.status,
                member_count: e.member_count,
                last_active: e.last_active.to_rfc3339(),
                auto_recovery,
            }
        }).collect();

        Ok(summaries)
    }

    /// Get a team by ID
    pub fn get_team(&mut self, project_path: &str, team_id: &str) -> Result<TeamData, TeamManagerError> {
        // Check cache first
        if let Some(team) = self.active_teams.get(team_id) {
            return Ok(team.clone());
        }

        // Load from storage
        let (config, state) = self.storage.get_team(project_path, team_id)?;
        let team_data = TeamData { config, state };

        // Cache if active
        if team_data.state.status == TeamStatus::Active {
            self.active_teams.insert(team_id.to_string(), team_data.clone());
        }

        Ok(team_data)
    }

    /// Update team settings
    pub fn update_team(
        &mut self,
        project_path: &str,
        team_id: &str,
        name: Option<String>,
        auto_recovery: Option<bool>,
        max_recovery_attempts: Option<u32>,
    ) -> Result<TeamData, TeamManagerError> {
        let (mut config, state) = self.storage.get_team(project_path, team_id)?;

        if let Some(n) = name {
            config.name = n;
        }
        if let Some(ar) = auto_recovery {
            config.auto_recovery = ar;
        }
        if let Some(mra) = max_recovery_attempts {
            config.max_recovery_attempts = mra;
        }

        self.storage.save_config(&config)?;

        let team_data = TeamData { config, state };
        self.active_teams.insert(team_id.to_string(), team_data.clone());

        Ok(team_data)
    }

    /// Archive a team
    pub fn archive_team(&mut self, project_path: &str, team_id: &str) -> Result<(), TeamManagerError> {
        self.storage.archive_team(project_path, team_id)?;
        self.active_teams.remove(team_id);
        Ok(())
    }

    // ===== Member Operations =====

    /// Add a member to a team
    pub fn add_member(
        &mut self,
        project_path: &str,
        team_id: &str,
        role: String,
        agent_type: String,
    ) -> Result<TeamMemberConfig, TeamManagerError> {
        let (mut config, mut state) = self.storage.get_team(project_path, team_id)?;

        let member = TeamMemberConfig::new(role, agent_type);

        // Add to config
        config.workers.push(member.clone());
        self.storage.save_config(&config)?;

        // Add to state
        state.members.insert(member.id.clone(), MemberState {
            status: MemberStatus::Idle,
            terminal_id: None,
            claude_session_id: None,
            current_task: None,
            last_heartbeat: Some(Utc::now()),
        });
        self.storage.save_state(project_path, &state)?;

        // Update cache
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(member)
    }

    /// Remove a member from a team
    pub fn remove_member(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
    ) -> Result<(), TeamManagerError> {
        let (mut config, mut state) = self.storage.get_team(project_path, team_id)?;

        // Cannot remove orchestrator
        if config.orchestrator.id == member_id {
            return Err(TeamManagerError::InvalidOperation(
                "Cannot remove orchestrator from team".to_string()
            ));
        }

        // Remove from config
        config.workers.retain(|w| w.id != member_id);
        self.storage.save_config(&config)?;

        // Remove from state
        state.members.remove(member_id);
        self.storage.save_state(project_path, &state)?;

        // Update cache
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    /// Update member session info
    pub fn update_member_session(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
        terminal_id: Option<String>,
        claude_session_id: Option<String>,
    ) -> Result<(), TeamManagerError> {
        let (config, mut state) = self.storage.get_team(project_path, team_id)?;

        if let Some(member_state) = state.members.get_mut(member_id) {
            if terminal_id.is_some() {
                member_state.terminal_id = terminal_id;
            }
            if claude_session_id.is_some() {
                member_state.claude_session_id = claude_session_id;
            }
            member_state.last_heartbeat = Some(Utc::now());
        } else {
            return Err(TeamManagerError::MemberNotFound(member_id.to_string()));
        }

        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    /// Update member status
    pub fn update_member_status(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
        status: MemberStatus,
    ) -> Result<(), TeamManagerError> {
        let (config, mut state) = self.storage.get_team(project_path, team_id)?;

        if let Some(member_state) = state.members.get_mut(member_id) {
            member_state.status = status;
            member_state.last_heartbeat = Some(Utc::now());
        } else {
            return Err(TeamManagerError::MemberNotFound(member_id.to_string()));
        }

        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    /// Update member task assignment
    pub fn update_member_task(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
        task_info: Option<MemberTaskInfo>,
    ) -> Result<(), TeamManagerError> {
        let (config, mut state) = self.storage.get_team(project_path, team_id)?;

        if let Some(member_state) = state.members.get_mut(member_id) {
            member_state.current_task = task_info.clone();
            member_state.last_heartbeat = Some(Utc::now());

            // Update active specs list
            if let Some(task) = &task_info {
                if let Some(spec_id) = &task.spec_id {
                    if !state.active_specs.contains(spec_id) {
                        state.active_specs.push(spec_id.clone());
                    }
                }
            }
        } else {
            return Err(TeamManagerError::MemberNotFound(member_id.to_string()));
        }

        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    /// Record member heartbeat
    pub fn record_heartbeat(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
    ) -> Result<(), TeamManagerError> {
        let (config, mut state) = self.storage.get_team(project_path, team_id)?;

        if let Some(member_state) = state.members.get_mut(member_id) {
            member_state.last_heartbeat = Some(Utc::now());
        } else {
            return Err(TeamManagerError::MemberNotFound(member_id.to_string()));
        }

        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    // ===== Team Lifecycle =====

    /// Pause a team (save state for resume)
    pub fn pause_team(
        &mut self,
        project_path: &str,
        team_id: &str,
        terminal_sessions: Vec<TerminalSessionInfo>,
    ) -> Result<(), TeamManagerError> {
        let (_config, mut state) = self.storage.get_team(project_path, team_id)?;

        // Update all member statuses to paused
        for member_state in state.members.values_mut() {
            member_state.status = MemberStatus::Paused;
        }

        // Save session info for resume
        state.session_info = Some(SessionInfo {
            saved_at: Utc::now(),
            terminals: terminal_sessions,
        });

        state.status = TeamStatus::Paused;
        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.remove(team_id);

        Ok(())
    }

    /// Resume a paused team
    pub fn resume_team(
        &mut self,
        project_path: &str,
        team_id: &str,
    ) -> Result<(TeamData, Option<SessionInfo>), TeamManagerError> {
        let (config, mut state) = self.storage.get_team(project_path, team_id)?;

        if state.status != TeamStatus::Paused {
            return Err(TeamManagerError::InvalidOperation(
                format!("Team is not paused, status: {:?}", state.status)
            ));
        }

        // Get session info before clearing
        let session_info = state.session_info.take();

        // Update all member statuses
        for member_state in state.members.values_mut() {
            member_state.status = MemberStatus::Idle;
            member_state.terminal_id = None;
            member_state.claude_session_id = None;
        }

        state.status = TeamStatus::Active;
        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;

        let team_data = TeamData { config, state };
        self.active_teams.insert(team_id.to_string(), team_data.clone());

        Ok((team_data, session_info))
    }

    // ===== Recovery Operations =====

    /// Report member failure
    pub fn report_member_failure(
        &mut self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
        _reason: &str,
    ) -> Result<(), TeamManagerError> {
        let (mut config, mut state) = self.storage.get_team(project_path, team_id)?;

        // Update member in config
        let member = if config.orchestrator.id == member_id {
            Some(&mut config.orchestrator)
        } else {
            config.workers.iter_mut().find(|w| w.id == member_id)
        };

        if let Some(member) = member {
            member.failure_count += 1;
            member.last_failure = Some(Utc::now());
        } else {
            return Err(TeamManagerError::MemberNotFound(member_id.to_string()));
        }

        self.storage.save_config(&config)?;

        // Update state
        if let Some(member_state) = state.members.get_mut(member_id) {
            member_state.status = MemberStatus::Failed;
        }

        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(())
    }

    /// Create replacement member for recovery
    pub fn create_replacement_member(
        &mut self,
        project_path: &str,
        team_id: &str,
        failed_member_id: &str,
    ) -> Result<TeamMemberConfig, TeamManagerError> {
        let (mut config, mut state) = self.storage.get_team(project_path, team_id)?;

        // Find failed member
        let failed_member = if config.orchestrator.id == failed_member_id {
            Some(config.orchestrator.clone())
        } else {
            config.workers.iter().find(|w| w.id == failed_member_id).cloned()
        };

        let failed_member = failed_member.ok_or_else(|| {
            TeamManagerError::MemberNotFound(failed_member_id.to_string())
        })?;

        // Create replacement
        let mut replacement = TeamMemberConfig::new(
            failed_member.role.clone(),
            failed_member.agent_type.clone(),
        );
        replacement.recovered_from = Some(failed_member_id.to_string());
        replacement.current_task_id = failed_member.current_task_id.clone();
        replacement.current_spec_id = failed_member.current_spec_id.clone();

        // Update config - replace failed member
        if config.orchestrator.id == failed_member_id {
            config.orchestrator = replacement.clone();
        } else {
            if let Some(idx) = config.workers.iter().position(|w| w.id == failed_member_id) {
                config.workers[idx] = replacement.clone();
            }
        }

        self.storage.save_config(&config)?;

        // Update state
        let failed_state = state.members.remove(failed_member_id);
        state.members.insert(replacement.id.clone(), MemberState {
            status: MemberStatus::Recovering,
            terminal_id: None,
            claude_session_id: None,
            current_task: failed_state.and_then(|s| s.current_task),
            last_heartbeat: Some(Utc::now()),
        });

        state.last_active = Utc::now();
        self.storage.save_state(project_path, &state)?;
        self.active_teams.insert(team_id.to_string(), TeamData { config, state });

        Ok(replacement)
    }

    /// Record recovery event
    pub fn record_recovery_event(
        &mut self,
        project_path: &str,
        team_id: &str,
        failed_member_id: &str,
        failed_member_role: &str,
        replacement_member_id: &str,
        reason: &str,
        context: Option<RecoveryContextSummary>,
        success: bool,
    ) -> Result<(), TeamManagerError> {
        let state = self.storage.load_state(project_path, team_id)?;
        let failed_state = state.members.get(failed_member_id);

        let event = RecoveryEvent {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            failed_member_id: failed_member_id.to_string(),
            failed_member_role: failed_member_role.to_string(),
            replacement_member_id: replacement_member_id.to_string(),
            reason: reason.to_string(),
            spec_id: failed_state.and_then(|s| s.current_task.as_ref().and_then(|t| t.spec_id.clone())),
            task_id: failed_state.and_then(|s| s.current_task.as_ref().map(|t| t.task_id.clone())),
            recovery_context: context,
            success,
        };

        self.storage.add_recovery_event(project_path, team_id, event)?;

        Ok(())
    }

    /// Get recovery history
    pub fn get_recovery_history(
        &self,
        project_path: &str,
        team_id: &str,
        limit: usize,
    ) -> Result<Vec<RecoveryEvent>, TeamManagerError> {
        let history = self.storage.load_history(project_path, team_id)?;
        let events: Vec<RecoveryEvent> = history.events.into_iter().take(limit).collect();
        Ok(events)
    }

    /// Get members with state
    pub fn get_members_with_state(
        &mut self,
        project_path: &str,
        team_id: &str,
    ) -> Result<Vec<MemberWithState>, TeamManagerError> {
        let (config, state) = self.storage.get_team(project_path, team_id)?;

        let mut members = Vec::new();

        // Add orchestrator
        let orch_state = state.members.get(&config.orchestrator.id);
        members.push(MemberWithState {
            id: config.orchestrator.id.clone(),
            role: config.orchestrator.role.clone(),
            agent_type: config.orchestrator.agent_type.clone(),
            status: orch_state.map(|s| s.status.clone()).unwrap_or(MemberStatus::Idle),
            terminal_id: orch_state.and_then(|s| s.terminal_id.clone()),
            claude_session_id: orch_state.and_then(|s| s.claude_session_id.clone()),
            current_task: orch_state.and_then(|s| s.current_task.clone()),
            failure_count: config.orchestrator.failure_count,
        });

        // Add workers
        for worker in &config.workers {
            let worker_state = state.members.get(&worker.id);
            members.push(MemberWithState {
                id: worker.id.clone(),
                role: worker.role.clone(),
                agent_type: worker.agent_type.clone(),
                status: worker_state.map(|s| s.status.clone()).unwrap_or(MemberStatus::Idle),
                terminal_id: worker_state.and_then(|s| s.terminal_id.clone()),
                claude_session_id: worker_state.and_then(|s| s.claude_session_id.clone()),
                current_task: worker_state.and_then(|s| s.current_task.clone()),
                failure_count: worker.failure_count,
            });
        }

        Ok(members)
    }

    /// Build recovery context for a failed member
    pub fn build_recovery_context(
        &self,
        project_path: &str,
        team_id: &str,
        member_id: &str,
    ) -> Result<RecoveryContext, TeamManagerError> {
        let state = self.storage.load_state(project_path, team_id)?;
        let member_state = state.members.get(member_id)
            .ok_or_else(|| TeamManagerError::MemberNotFound(member_id.to_string()))?;

        let (spec_id, task_id, phase, progress) = if let Some(task) = &member_state.current_task {
            (task.spec_id.clone(), Some(task.task_id.clone()), Some(task.phase.clone()), task.progress)
        } else {
            (None, None, None, 0)
        };

        // Build resume instructions
        let resume_instructions = if let Some(ref spec) = spec_id {
            format!(
                "You are replacing a failed agent. Continue work on spec '{}' from {}% progress. \
                 Review existing artifacts before proceeding.",
                spec, progress
            )
        } else {
            "You are replacing a failed agent. Check for pending tasks and continue work.".to_string()
        };

        Ok(RecoveryContext {
            spec_id,
            task_id,
            phase,
            progress,
            completed_steps: Vec::new(), // Would be populated from progress reports
            current_step: None,
            artifacts: Vec::new(), // Would be populated from graph query
            resume_instructions,
        })
    }
}

/// Shared state wrapper for Tauri
pub type SharedTeamManager = Arc<Mutex<TeamManager>>;

pub fn create_team_manager() -> Result<SharedTeamManager, TeamManagerError> {
    Ok(Arc::new(Mutex::new(TeamManager::new()?)))
}
