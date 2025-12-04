#![allow(dead_code)]

/**
 * Agent Coordinator Module
 *
 * Coordinates multiple Claude processes, handles message routing,
 * and implements the orchestrator-worker pattern for multi-agent collaboration.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::{RwLock, broadcast};
use tauri::{AppHandle, Emitter};

/// Agent role in the coordination system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum AgentRole {
    Orchestrator,
    Worker,
    Reviewer,
    Specialist(String), // legacy compat for specialty strings
}

/// Agent coordination status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CoordinationStatus {
    Idle,
    Working,
    WaitingForInput,
    WaitingForDependency,
    Blocked,
    Completed,
    Error,
}

/// Message priority for the coordination queue
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum MessagePriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

/// Agent message for inter-agent communication
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub id: String,
    pub from_agent: String,
    pub to_agent: Option<String>, // None = broadcast
    pub priority: MessagePriority,
    pub content: MessageContent,
    pub timestamp: u64,
    pub correlation_id: Option<String>, // For request-response pairing
}

/// Message content types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MessageContent {
    /// Task delegation from orchestrator to worker
    TaskDelegation {
        task_id: String,
        description: String,
        context: Vec<String>,
        dependencies: Vec<String>,
    },
    /// Task result from worker to orchestrator
    TaskResult {
        task_id: String,
        success: bool,
        output: String,
        artifacts: Vec<String>,
    },
    /// Progress update
    ProgressUpdate {
        task_id: String,
        progress: u8, // 0-100
        current_step: String,
    },
    /// Status change notification
    StatusChange {
        status: CoordinationStatus,
        reason: Option<String>,
    },
    /// Request for clarification
    Clarification {
        question: String,
        options: Option<Vec<String>>,
    },
    /// Response to clarification
    ClarificationResponse {
        answer: String,
    },
    /// Blocker report
    Blocker {
        task_id: String,
        blocker_type: String,
        description: String,
        blocked_by: Option<String>,
    },
    /// Ping for health check
    Ping,
    /// Pong response
    Pong,
    /// Custom message
    Custom {
        action: String,
        payload: serde_json::Value,
    },
}

/// Coordinated agent state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoordinatedAgent {
    pub id: String,
    pub role: AgentRole,
    pub status: CoordinationStatus,
    pub current_task: Option<String>,
    pub progress: u8,
    pub last_activity: u64,
    pub health_score: u8, // 0-100
}

/// Agent Coordinator manages multi-agent communication
pub struct AgentCoordinator {
    agents: RwLock<HashMap<String, CoordinatedAgent>>,
    message_queue: RwLock<Vec<AgentMessage>>,
    message_tx: broadcast::Sender<AgentMessage>,
    orchestrator_id: RwLock<Option<String>>,
    max_concurrent_workers: usize,
}

impl AgentCoordinator {
    pub fn new(max_concurrent_workers: usize) -> Self {
        let (message_tx, _) = broadcast::channel(1000);
        Self {
            agents: RwLock::new(HashMap::new()),
            message_queue: RwLock::new(Vec::new()),
            message_tx,
            orchestrator_id: RwLock::new(None),
            max_concurrent_workers,
        }
    }

    /// Register an agent with the coordinator
    pub async fn register_agent(
        &self,
        agent_id: String,
        role: AgentRole,
    ) -> Result<(), String> {
        let mut agents = self.agents.write().await;

        // Check orchestrator constraint
        if role == AgentRole::Orchestrator {
            let orchestrator = self.orchestrator_id.read().await;
            if orchestrator.is_some() {
                return Err("Only one orchestrator allowed".to_string());
            }
            drop(orchestrator);
            *self.orchestrator_id.write().await = Some(agent_id.clone());
        }

        // Check worker limit
        if matches!(role, AgentRole::Worker | AgentRole::Specialist(_)) {
            let worker_count = agents
                .values()
                .filter(|a| matches!(a.role, AgentRole::Worker | AgentRole::Specialist(_)))
                .count();
            if worker_count >= self.max_concurrent_workers {
                return Err(format!(
                    "Maximum concurrent workers ({}) reached",
                    self.max_concurrent_workers
                ));
            }
        }

        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        agents.insert(
            agent_id.clone(),
            CoordinatedAgent {
                id: agent_id,
                role,
                status: CoordinationStatus::Idle,
                current_task: None,
                progress: 0,
                last_activity: now,
                health_score: 100,
            },
        );

        Ok(())
    }

    /// Unregister an agent
    pub async fn unregister_agent(&self, agent_id: &str) -> Result<(), String> {
        let mut agents = self.agents.write().await;

        if let Some(agent) = agents.remove(agent_id) {
            if agent.role == AgentRole::Orchestrator {
                *self.orchestrator_id.write().await = None;
            }
            Ok(())
        } else {
            Err(format!("Agent {} not found", agent_id))
        }
    }

    /// Send a message to an agent or broadcast
    pub async fn send_message(&self, message: AgentMessage) -> Result<(), String> {
        // Add to queue for persistence/recovery
        {
            let mut queue = self.message_queue.write().await;
            queue.push(message.clone());

            // Keep queue size manageable (last 1000 messages)
            if queue.len() > 1000 {
                queue.drain(0..100);
            }
        }

        // Broadcast to all listeners
        self.message_tx
            .send(message)
            .map_err(|e| e.to_string())?;

        Ok(())
    }

    /// Subscribe to messages for a specific agent
    pub fn subscribe(&self) -> broadcast::Receiver<AgentMessage> {
        self.message_tx.subscribe()
    }

    /// Update agent status
    pub async fn update_agent_status(
        &self,
        agent_id: &str,
        status: CoordinationStatus,
        current_task: Option<String>,
        progress: Option<u8>,
    ) -> Result<(), String> {
        let mut agents = self.agents.write().await;

        if let Some(agent) = agents.get_mut(agent_id) {
            agent.status = status;
            agent.current_task = current_task;
            if let Some(p) = progress {
                agent.progress = p;
            }
            agent.last_activity = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
            Ok(())
        } else {
            Err(format!("Agent {} not found", agent_id))
        }
    }

    /// Get agent info
    pub async fn get_agent(&self, agent_id: &str) -> Option<CoordinatedAgent> {
        let agents = self.agents.read().await;
        agents.get(agent_id).cloned()
    }

    /// List all agents
    pub async fn list_agents(&self) -> Vec<CoordinatedAgent> {
        let agents = self.agents.read().await;
        agents.values().cloned().collect()
    }

    /// Get orchestrator ID
    pub async fn get_orchestrator_id(&self) -> Option<String> {
        self.orchestrator_id.read().await.clone()
    }

    /// Get idle workers
    pub async fn get_idle_workers(&self) -> Vec<CoordinatedAgent> {
        let agents = self.agents.read().await;
        agents
            .values()
            .filter(|a| {
                matches!(a.role, AgentRole::Worker | AgentRole::Specialist(_))
                    && a.status == CoordinationStatus::Idle
            })
            .cloned()
            .collect()
    }

    /// Check for stale agents (no activity for threshold)
    pub async fn get_stale_agents(&self, threshold_secs: u64) -> Vec<CoordinatedAgent> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let agents = self.agents.read().await;
        agents
            .values()
            .filter(|a| now - a.last_activity > threshold_secs)
            .cloned()
            .collect()
    }

    /// Delegate task from orchestrator to best available worker
    pub async fn delegate_task(
        &self,
        task_id: String,
        description: String,
        context: Vec<String>,
        dependencies: Vec<String>,
        preferred_specialist: Option<String>,
    ) -> Result<String, String> {
        let orchestrator_id = self
            .get_orchestrator_id()
            .await
            .ok_or("No orchestrator registered")?;

        // Find best worker
        let agents = self.agents.read().await;
        let worker = if let Some(ref specialist_type) = preferred_specialist {
            // Look for specific specialist
            agents
                .values()
                .find(|a| {
                    matches!(&a.role, AgentRole::Specialist(s) if s == specialist_type)
                        && a.status == CoordinationStatus::Idle
                })
        } else {
            // Any idle worker
            agents.values().find(|a| {
                matches!(a.role, AgentRole::Worker | AgentRole::Specialist(_))
                    && a.status == CoordinationStatus::Idle
            })
        };

        let worker = worker.ok_or("No available workers")?;
        let worker_id = worker.id.clone();
        drop(agents);

        // Update worker status
        self.update_agent_status(
            &worker_id,
            CoordinationStatus::Working,
            Some(task_id.clone()),
            Some(0),
        )
        .await?;

        // Send task delegation message
        let message = AgentMessage {
            id: uuid::Uuid::new_v4().to_string(),
            from_agent: orchestrator_id,
            to_agent: Some(worker_id.clone()),
            priority: MessagePriority::Normal,
            content: MessageContent::TaskDelegation {
                task_id,
                description,
                context,
                dependencies,
            },
            timestamp: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            correlation_id: None,
        };

        self.send_message(message).await?;

        Ok(worker_id)
    }

    /// Health check - update health scores and detect issues
    pub async fn health_check(&self) -> Vec<(String, u8, String)> {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        let mut agents = self.agents.write().await;
        let mut issues = Vec::new();

        for agent in agents.values_mut() {
            let idle_time = now - agent.last_activity;

            // Degrade health score based on idle time and status
            if idle_time > 300 && agent.status == CoordinationStatus::Working {
                // 5 mins without activity while "working"
                agent.health_score = agent.health_score.saturating_sub(20);
                issues.push((
                    agent.id.clone(),
                    agent.health_score,
                    "Potentially stuck - no activity while working".to_string(),
                ));
            } else if idle_time > 600 {
                // 10 mins without any activity
                agent.health_score = agent.health_score.saturating_sub(10);
                issues.push((
                    agent.id.clone(),
                    agent.health_score,
                    "Stale - no recent activity".to_string(),
                ));
            } else if agent.status == CoordinationStatus::Blocked {
                agent.health_score = agent.health_score.saturating_sub(5);
                issues.push((
                    agent.id.clone(),
                    agent.health_score,
                    "Agent is blocked".to_string(),
                ));
            } else {
                // Recover health over time
                agent.health_score = (agent.health_score + 5).min(100);
            }
        }

        issues
    }
}

/// Shared coordinator state for Tauri
pub type SharedAgentCoordinator = Arc<AgentCoordinator>;

/// Create shared coordinator instance
pub fn create_coordinator(max_workers: usize) -> SharedAgentCoordinator {
    Arc::new(AgentCoordinator::new(max_workers))
}

// =============================================================================
// Tauri Commands
// =============================================================================

/// Register an agent with the coordinator
#[tauri::command]
pub async fn coordinator_register_agent(
    agent_id: String,
    role: String,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<(), String> {
    let role = match role.as_str() {
        "orchestrator" => AgentRole::Orchestrator,
        "worker" => AgentRole::Worker,
        "reviewer" | "review" => AgentRole::Reviewer,
        _ => AgentRole::Specialist(role),
    };

    state.register_agent(agent_id, role).await
}

/// Unregister an agent
#[tauri::command]
pub async fn coordinator_unregister_agent(
    agent_id: String,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<(), String> {
    state.unregister_agent(&agent_id).await
}

/// Send a message through the coordinator
#[tauri::command]
pub async fn coordinator_send_message(
    from_agent: String,
    to_agent: Option<String>,
    priority: String,
    content_type: String,
    content_data: serde_json::Value,
    app: AppHandle,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<String, String> {
    let priority = match priority.as_str() {
        "low" => MessagePriority::Low,
        "high" => MessagePriority::High,
        "urgent" => MessagePriority::Urgent,
        _ => MessagePriority::Normal,
    };

    let content = match content_type.as_str() {
        "task_delegation" => MessageContent::TaskDelegation {
            task_id: content_data["task_id"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            description: content_data["description"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            context: content_data["context"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
            dependencies: content_data["dependencies"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
        },
        "task_result" => MessageContent::TaskResult {
            task_id: content_data["task_id"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            success: content_data["success"].as_bool().unwrap_or(false),
            output: content_data["output"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            artifacts: content_data["artifacts"]
                .as_array()
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                })
                .unwrap_or_default(),
        },
        "progress_update" => MessageContent::ProgressUpdate {
            task_id: content_data["task_id"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
            progress: content_data["progress"].as_u64().unwrap_or(0) as u8,
            current_step: content_data["current_step"]
                .as_str()
                .unwrap_or_default()
                .to_string(),
        },
        "ping" => MessageContent::Ping,
        "pong" => MessageContent::Pong,
        _ => MessageContent::Custom {
            action: content_type,
            payload: content_data,
        },
    };

    let message_id = uuid::Uuid::new_v4().to_string();
    let message = AgentMessage {
        id: message_id.clone(),
        from_agent,
        to_agent: to_agent.clone(),
        priority,
        content,
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        correlation_id: None,
    };

    // Emit to frontend
    let _ = app.emit("coordinator-message", &message);

    state.send_message(message).await?;

    Ok(message_id)
}

/// Update agent coordination status
#[tauri::command]
pub async fn coordinator_update_status(
    agent_id: String,
    status: String,
    current_task: Option<String>,
    progress: Option<u8>,
    app: AppHandle,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<(), String> {
    let status = match status.as_str() {
        "idle" => CoordinationStatus::Idle,
        "working" => CoordinationStatus::Working,
        "waiting_for_input" => CoordinationStatus::WaitingForInput,
        "waiting_for_dependency" => CoordinationStatus::WaitingForDependency,
        "blocked" => CoordinationStatus::Blocked,
        "completed" => CoordinationStatus::Completed,
        "error" => CoordinationStatus::Error,
        _ => CoordinationStatus::Idle,
    };

    state
        .update_agent_status(&agent_id, status.clone(), current_task.clone(), progress)
        .await?;

    // Emit status update to frontend
    if let Some(agent) = state.get_agent(&agent_id).await {
        let _ = app.emit("coordinator-agent-status", &agent);
    }

    Ok(())
}

/// Get agent info
#[tauri::command]
pub async fn coordinator_get_agent(
    agent_id: String,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<Option<CoordinatedAgent>, String> {
    Ok(state.get_agent(&agent_id).await)
}

/// List all coordinated agents
#[tauri::command]
pub async fn coordinator_list_agents(
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<Vec<CoordinatedAgent>, String> {
    Ok(state.list_agents().await)
}

/// Delegate a task to available worker
#[tauri::command]
pub async fn coordinator_delegate_task(
    task_id: String,
    description: String,
    context: Vec<String>,
    dependencies: Vec<String>,
    preferred_specialist: Option<String>,
    app: AppHandle,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<String, String> {
    let worker_id = state
        .delegate_task(task_id.clone(), description, context, dependencies, preferred_specialist)
        .await?;

    // Emit task delegation event
    let _ = app.emit(
        "coordinator-task-delegated",
        serde_json::json!({
            "task_id": task_id,
            "worker_id": worker_id
        }),
    );

    Ok(worker_id)
}

/// Get orchestrator ID
#[tauri::command]
pub async fn coordinator_get_orchestrator(
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<Option<String>, String> {
    Ok(state.get_orchestrator_id().await)
}

/// Get idle workers
#[tauri::command]
pub async fn coordinator_get_idle_workers(
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<Vec<CoordinatedAgent>, String> {
    Ok(state.get_idle_workers().await)
}

/// Run health check
#[tauri::command]
pub async fn coordinator_health_check(
    app: AppHandle,
    state: tauri::State<'_, SharedAgentCoordinator>,
) -> Result<Vec<(String, u8, String)>, String> {
    let issues = state.health_check().await;

    // Emit health check results
    if !issues.is_empty() {
        let _ = app.emit("coordinator-health-issues", &issues);
    }

    Ok(issues)
}
