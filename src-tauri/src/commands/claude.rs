//! Claude CLI Commands
//!
//! Tauri commands for managing Claude processes with stream-json output.
//! Supports both one-shot mode (-p) and persistent streaming sessions.

use crate::claude_process::{ClaudeProcessInfo, ProcessStatus, SharedClaudeProcessManager};
use crate::session_tracker::SharedSessionTracker;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

/// Options for spawning a Claude process (one-shot mode)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnOptions {
    pub role: String,
    pub working_dir: String,
    pub prompt: Option<String>,
    pub session_id: Option<String>,
    pub max_turns: Option<u32>,
}

/// Options for spawning a persistent Claude session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpawnSessionOptions {
    pub role: String,
    pub working_dir: String,
    pub prompt: Option<String>,
    /// Terminal ID this session is running in (for event routing)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terminal_id: Option<String>,
    /// Claude session ID to resume (uses --resume flag)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resume_session_id: Option<String>,
}

/// Spawn a new Claude process with stream-json output
#[tauri::command]
pub async fn claude_spawn(
    options: SpawnOptions,
    app: AppHandle,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<ClaudeProcessInfo, String> {
    let manager = state.lock().await;
    manager
        .spawn(
            options.role,
            options.working_dir,
            options.prompt,
            options.session_id,
            options.max_turns,
            app,
        )
        .await
}

/// Get information about a Claude process
#[tauri::command]
pub async fn claude_get_process(
    process_id: String,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<Option<ClaudeProcessInfo>, String> {
    let manager = state.lock().await;
    Ok(manager.get(&process_id).await)
}

/// List all Claude processes
#[tauri::command]
pub async fn claude_list_processes(
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<Vec<ClaudeProcessInfo>, String> {
    let manager = state.lock().await;
    Ok(manager.list().await)
}

/// Terminate a Claude process
#[tauri::command]
pub async fn claude_terminate(
    process_id: String,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager.terminate(&process_id).await
}

/// Update Claude process status (internal use)
#[tauri::command]
pub async fn claude_update_status(
    process_id: String,
    status: ProcessStatus,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager.update_status(&process_id, status).await;
    Ok(())
}

// =============================================================================
// Persistent Session Commands (for multi-turn conversations)
// =============================================================================

/// Spawn a persistent Claude session
/// Uses --input-format stream-json --output-format stream-json
/// Keeps stdin open for subsequent messages via claude_send_input
#[tauri::command]
pub async fn claude_spawn_session(
    options: SpawnSessionOptions,
    app: AppHandle,
    state: State<'_, SharedClaudeProcessManager>,
    tracker: State<'_, SharedSessionTracker>,
) -> Result<ClaudeProcessInfo, String> {
    let manager = state.lock().await;
    let result = manager
        .spawn_session(
            options.role.clone(),
            options.working_dir.clone(),
            options.prompt,
            options.terminal_id.clone(),
            options.resume_session_id,
            app,
        )
        .await?;

    // Track the session for orphan cleanup
    if let Ok(mut tracker) = tracker.lock() {
        tracker.add_session(
            result.id.clone(),
            result.pid,
            options.terminal_id,
            Some(options.role),
            options.working_dir,
        );
    }

    Ok(result)
}

/// Send input to a persistent Claude session
/// Formats as NDJSON and writes to session's stdin
#[tauri::command]
pub async fn claude_send_input(
    session_id: String,
    input: String,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<(), String> {
    let manager = state.lock().await;
    manager.send_input(&session_id, &input).await
}

/// Check if a persistent session exists
#[tauri::command]
pub async fn claude_has_session(
    session_id: String,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<bool, String> {
    let manager = state.lock().await;
    Ok(manager.has_session(&session_id).await)
}

/// Get information about a persistent session
#[tauri::command]
pub async fn claude_get_session(
    session_id: String,
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<Option<ClaudeProcessInfo>, String> {
    let manager = state.lock().await;
    Ok(manager.get_session(&session_id).await)
}

/// List all persistent sessions
#[tauri::command]
pub async fn claude_list_sessions(
    state: State<'_, SharedClaudeProcessManager>,
) -> Result<Vec<ClaudeProcessInfo>, String> {
    let manager = state.lock().await;
    Ok(manager.list_sessions().await)
}

/// Terminate a persistent session
/// Closes stdin and kills the process
#[tauri::command]
pub async fn claude_terminate_session(
    session_id: String,
    state: State<'_, SharedClaudeProcessManager>,
    tracker: State<'_, SharedSessionTracker>,
) -> Result<(), String> {
    let manager = state.lock().await;
    let result = manager.terminate_session(&session_id).await;

    // Untrack the session
    if let Ok(mut tracker) = tracker.lock() {
        tracker.remove_session(&session_id);
    }

    result
}
