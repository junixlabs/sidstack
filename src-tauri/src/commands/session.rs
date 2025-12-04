//! Session tracking commands for frontend

use crate::session_tracker::{SharedSessionTracker, TrackedSession};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub session_id: String,
    pub pid: u32,
    pub terminal_id: Option<String>,
    pub role: Option<String>,
    pub cwd: String,
    pub started_at: String,
}

impl From<TrackedSession> for SessionInfo {
    fn from(s: TrackedSession) -> Self {
        Self {
            session_id: s.session_id,
            pid: s.pid,
            terminal_id: s.terminal_id,
            role: s.role,
            cwd: s.cwd,
            started_at: s.started_at.to_rfc3339(),
        }
    }
}

/// Track a new agent session
#[tauri::command]
pub fn session_track(
    tracker: State<'_, SharedSessionTracker>,
    session_id: String,
    pid: u32,
    terminal_id: Option<String>,
    role: Option<String>,
    cwd: String,
) -> Result<(), String> {
    let mut tracker = tracker.lock().map_err(|e| e.to_string())?;
    tracker.add_session(session_id, pid, terminal_id, role, cwd);
    Ok(())
}

/// Untrack a session (when terminated)
#[tauri::command]
pub fn session_untrack(
    tracker: State<'_, SharedSessionTracker>,
    session_id: String,
) -> Result<(), String> {
    let mut tracker = tracker.lock().map_err(|e| e.to_string())?;
    tracker.remove_session(&session_id);
    Ok(())
}

/// List all tracked sessions
#[tauri::command]
pub fn session_list(
    tracker: State<'_, SharedSessionTracker>,
) -> Result<Vec<SessionInfo>, String> {
    let tracker = tracker.lock().map_err(|e| e.to_string())?;
    Ok(tracker.list_sessions().into_iter().map(SessionInfo::from).collect())
}

/// Get a specific session
#[tauri::command]
pub fn session_get(
    tracker: State<'_, SharedSessionTracker>,
    session_id: String,
) -> Result<Option<SessionInfo>, String> {
    let tracker = tracker.lock().map_err(|e| e.to_string())?;
    Ok(tracker.get_session(&session_id).cloned().map(SessionInfo::from))
}

/// Force cleanup any orphaned sessions
#[tauri::command]
pub fn session_cleanup_orphaned(
    tracker: State<'_, SharedSessionTracker>,
) -> Result<Vec<String>, String> {
    let mut tracker = tracker.lock().map_err(|e| e.to_string())?;
    Ok(tracker.cleanup_orphaned())
}
