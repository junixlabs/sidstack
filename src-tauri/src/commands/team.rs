use crate::team_manager::{
    SharedTeamManager, CreateTeamInput, TeamSummary, TeamData,
    MemberWithState, RecoveryContext,
};
use crate::team_storage::{
    TeamStatus, MemberStatus, MemberTaskInfo, TerminalSessionInfo, RecoveryEvent,
};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Error response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamError {
    pub error: String,
}

impl TeamError {
    pub fn new(msg: &str) -> Self {
        Self { error: msg.to_string() }
    }
}

// ===== Team CRUD Commands =====

/// Create a new team
#[tauri::command]
pub async fn team_create(
    state: State<'_, SharedTeamManager>,
    input: CreateTeamInput,
) -> Result<TeamData, TeamError> {
    let mut manager = state.lock().await;
    manager.create_team(input)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// List teams for a project
#[tauri::command]
pub async fn team_list(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    status: Option<String>,
) -> Result<Vec<TeamSummary>, TeamError> {
    let manager = state.lock().await;
    let status_filter = status.and_then(|s| match s.as_str() {
        "active" => Some(TeamStatus::Active),
        "paused" => Some(TeamStatus::Paused),
        "archived" => Some(TeamStatus::Archived),
        _ => None,
    });
    manager.list_teams(&project_path, status_filter)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Get a team by ID
#[tauri::command]
pub async fn team_get(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
) -> Result<TeamData, TeamError> {
    let mut manager = state.lock().await;
    manager.get_team(&project_path, &team_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Update team settings
#[tauri::command]
pub async fn team_update(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    name: Option<String>,
    auto_recovery: Option<bool>,
    max_recovery_attempts: Option<u32>,
) -> Result<TeamData, TeamError> {
    let mut manager = state.lock().await;
    manager.update_team(&project_path, &team_id, name, auto_recovery, max_recovery_attempts)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Archive a team
#[tauri::command]
pub async fn team_archive(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.archive_team(&project_path, &team_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

// ===== Member Commands =====

/// Add a member to a team
#[tauri::command]
pub async fn team_add_member(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    role: String,
    agent_type: String,
) -> Result<crate::team_storage::TeamMemberConfig, TeamError> {
    let mut manager = state.lock().await;
    manager.add_member(&project_path, &team_id, role, agent_type)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Remove a member from a team
#[tauri::command]
pub async fn team_remove_member(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.remove_member(&project_path, &team_id, &member_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Update member session info
#[tauri::command]
pub async fn team_update_member_session(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
    terminal_id: Option<String>,
    claude_session_id: Option<String>,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.update_member_session(&project_path, &team_id, &member_id, terminal_id, claude_session_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Update member status
#[tauri::command]
pub async fn team_update_member_status(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
    status: String,
) -> Result<(), TeamError> {
    let status = match status.as_str() {
        "active" => MemberStatus::Active,
        "idle" => MemberStatus::Idle,
        "failed" => MemberStatus::Failed,
        "recovering" => MemberStatus::Recovering,
        "paused" => MemberStatus::Paused,
        _ => return Err(TeamError::new(&format!("Invalid status: {}", status))),
    };

    let mut manager = state.lock().await;
    manager.update_member_status(&project_path, &team_id, &member_id, status)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Update member task assignment
#[tauri::command]
pub async fn team_update_member_task(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
    task_id: Option<String>,
    spec_id: Option<String>,
    phase: Option<String>,
    progress: Option<u32>,
) -> Result<(), TeamError> {
    let task_info = if let (Some(tid), Some(p)) = (task_id, phase) {
        Some(MemberTaskInfo {
            task_id: tid,
            spec_id,
            phase: p,
            progress: progress.unwrap_or(0),
        })
    } else {
        None
    };

    let mut manager = state.lock().await;
    manager.update_member_task(&project_path, &team_id, &member_id, task_info)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Get members with their current state
#[tauri::command]
pub async fn team_get_members(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
) -> Result<Vec<MemberWithState>, TeamError> {
    let mut manager = state.lock().await;
    manager.get_members_with_state(&project_path, &team_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

// ===== Team Lifecycle Commands =====

/// Pause a team
#[tauri::command]
pub async fn team_pause(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    terminal_sessions: Vec<TerminalSessionInfo>,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.pause_team(&project_path, &team_id, terminal_sessions)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Resume a paused team
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResumeTeamResult {
    pub team: TeamData,
    pub session_info: Option<crate::team_storage::SessionInfo>,
}

#[tauri::command]
pub async fn team_resume(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
) -> Result<ResumeTeamResult, TeamError> {
    let mut manager = state.lock().await;
    let (team, session_info) = manager.resume_team(&project_path, &team_id)
        .map_err(|e| TeamError::new(&e.to_string()))?;
    Ok(ResumeTeamResult { team, session_info })
}

// ===== Recovery Commands =====

/// Report member failure
#[tauri::command]
pub async fn team_report_member_failure(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
    reason: String,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.report_member_failure(&project_path, &team_id, &member_id, &reason)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Create replacement member for recovery
#[tauri::command]
pub async fn team_create_replacement(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    failed_member_id: String,
) -> Result<crate::team_storage::TeamMemberConfig, TeamError> {
    let mut manager = state.lock().await;
    manager.create_replacement_member(&project_path, &team_id, &failed_member_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Get recovery context for a member
#[tauri::command]
pub async fn team_get_recovery_context(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
) -> Result<RecoveryContext, TeamError> {
    let manager = state.lock().await;
    manager.build_recovery_context(&project_path, &team_id, &member_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Get recovery history
#[tauri::command]
pub async fn team_get_recovery_history(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    limit: Option<usize>,
) -> Result<Vec<RecoveryEvent>, TeamError> {
    let manager = state.lock().await;
    manager.get_recovery_history(&project_path, &team_id, limit.unwrap_or(20))
        .map_err(|e| TeamError::new(&e.to_string()))
}

/// Record heartbeat for a member
#[tauri::command]
pub async fn team_member_heartbeat(
    state: State<'_, SharedTeamManager>,
    project_path: String,
    team_id: String,
    member_id: String,
) -> Result<(), TeamError> {
    let mut manager = state.lock().await;
    manager.record_heartbeat(&project_path, &team_id, &member_id)
        .map_err(|e| TeamError::new(&e.to_string()))
}
