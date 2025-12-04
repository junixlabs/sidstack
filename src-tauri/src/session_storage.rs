//! Session Storage Module
//!
//! Handles persistence of terminal session data including:
//! - Session metadata (role, status, timestamps)
//! - Terminal output logs
//! - Session lifecycle management

use chrono::{DateTime, Duration, Utc};
use serde::{Deserialize, Serialize};
use std::collections::hash_map::DefaultHasher;
use std::fs::{self, File, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

// ============================================================================
// Types
// ============================================================================

/// Session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Active,
    Saved,
    Archived,
}

/// Session metadata stored in JSON
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionMeta {
    pub session_id: String,
    pub project_path: String,
    pub project_hash: String,
    pub role: Option<String>,
    pub display_name: Option<String>,
    pub claude_session_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_active_at: DateTime<Utc>,
    pub status: SessionStatus,
    pub log_size_bytes: u64,
}

// ============================================================================
// Path Helpers
// ============================================================================

/// Get the base sessions directory
/// ~/.sidstack/agent-manager/sessions/
pub fn sessions_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".sidstack")
        .join("agent-manager")
        .join("sessions")
}

/// Hash project path to create a safe directory name
pub fn hash_project(project_path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    project_path.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

/// Get the directory for a specific project's sessions
fn project_sessions_dir(project_path: &str) -> PathBuf {
    sessions_dir().join(hash_project(project_path))
}

/// Get the log file path for a session
fn log_file_path(project_path: &str, session_id: &str) -> PathBuf {
    project_sessions_dir(project_path).join(format!("{}.log", session_id))
}

/// Get the metadata file path for a session
fn meta_file_path(project_path: &str, session_id: &str) -> PathBuf {
    project_sessions_dir(project_path).join(format!("{}.meta.json", session_id))
}

/// Ensure the session directory exists
fn ensure_session_dir(project_path: &str) -> Result<(), String> {
    let dir = project_sessions_dir(project_path);
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create session directory: {}", e))
}

// ============================================================================
// Log File Operations
// ============================================================================

/// Append output to the session log file
/// Each line is prefixed with ISO timestamp
pub fn append_output(project_path: &str, session_id: &str, data: &str) -> Result<(), String> {
    ensure_session_dir(project_path)?;

    let path = log_file_path(project_path, session_id);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open log file: {}", e))?;

    let timestamp = Utc::now().to_rfc3339();

    for line in data.lines() {
        writeln!(file, "[{}] {}", timestamp, line)
            .map_err(|e| format!("Failed to write to log: {}", e))?;
    }

    // Update metadata with new log size
    if let Ok(metadata) = fs::metadata(&path) {
        let _ = update_log_size(project_path, session_id, metadata.len());
    }

    Ok(())
}

/// Load the last N lines from a session log
pub fn load_output(project_path: &str, session_id: &str, lines: usize) -> Result<Vec<String>, String> {
    let path = log_file_path(project_path, session_id);

    if !path.exists() {
        return Ok(Vec::new());
    }

    let file = File::open(&path).map_err(|e| format!("Failed to open log file: {}", e))?;
    let reader = BufReader::new(file);

    // Read all lines into a buffer
    let all_lines: Vec<String> = reader
        .lines()
        .filter_map(Result::ok)
        .collect();

    // Return last N lines
    let start = if all_lines.len() > lines {
        all_lines.len() - lines
    } else {
        0
    };

    Ok(all_lines[start..].to_vec())
}

/// Update the log size in metadata
fn update_log_size(project_path: &str, session_id: &str, size: u64) -> Result<(), String> {
    if let Some(mut meta) = get_session_meta(project_path, session_id)? {
        meta.log_size_bytes = size;
        meta.last_active_at = Utc::now();
        save_session_meta(&meta)?;
    }
    Ok(())
}

// ============================================================================
// Metadata Operations
// ============================================================================

/// Get session metadata
pub fn get_session_meta(project_path: &str, session_id: &str) -> Result<Option<SessionMeta>, String> {
    let path = meta_file_path(project_path, session_id);

    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read metadata: {}", e))?;

    let meta: SessionMeta = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse metadata: {}", e))?;

    Ok(Some(meta))
}

/// Save session metadata
pub fn save_session_meta(meta: &SessionMeta) -> Result<(), String> {
    ensure_session_dir(&meta.project_path)?;

    let path = meta_file_path(&meta.project_path, &meta.session_id);
    let content = serde_json::to_string_pretty(meta)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;

    fs::write(&path, content).map_err(|e| format!("Failed to write metadata: {}", e))
}

/// Create a new session
pub fn create_session(
    session_id: String,
    project_path: String,
    role: Option<String>,
    claude_session_id: Option<String>,
) -> Result<SessionMeta, String> {
    let now = Utc::now();
    let meta = SessionMeta {
        session_id,
        project_hash: hash_project(&project_path),
        project_path,
        role,
        display_name: None,
        claude_session_id,
        created_at: now,
        last_active_at: now,
        status: SessionStatus::Active,
        log_size_bytes: 0,
    };

    save_session_meta(&meta)?;
    Ok(meta)
}

/// Update session status
pub fn update_session_status(
    project_path: &str,
    session_id: &str,
    status: SessionStatus,
) -> Result<(), String> {
    if let Some(mut meta) = get_session_meta(project_path, session_id)? {
        meta.status = status;
        meta.last_active_at = Utc::now();
        save_session_meta(&meta)?;
    }
    Ok(())
}

/// Rename a session (update display name)
pub fn rename_session(
    project_path: &str,
    session_id: &str,
    display_name: String,
) -> Result<(), String> {
    if let Some(mut meta) = get_session_meta(project_path, session_id)? {
        meta.display_name = Some(display_name);
        meta.last_active_at = Utc::now();
        save_session_meta(&meta)?;
    }
    Ok(())
}

/// Update session role (orchestrator, dev, qa, etc.)
/// Creates a new session if it doesn't exist (upsert behavior)
pub fn update_session_role(
    project_path: &str,
    session_id: &str,
    role: String,
) -> Result<(), String> {
    if let Some(mut meta) = get_session_meta(project_path, session_id)? {
        // Session exists - update it
        meta.role = Some(role);
        meta.last_active_at = Utc::now();
        save_session_meta(&meta)?;
    } else {
        // Session doesn't exist - create it with the role
        create_session(
            session_id.to_string(),
            project_path.to_string(),
            Some(role),
            None,
        )?;
    }
    Ok(())
}

/// Update Claude session ID for a session
/// This is called when we receive system.init event from Claude with the real session_id
pub fn update_session_claude_id(
    project_path: &str,
    session_id: &str,
    claude_session_id: String,
) -> Result<(), String> {
    if let Some(mut meta) = get_session_meta(project_path, session_id)? {
        meta.claude_session_id = Some(claude_session_id);
        meta.last_active_at = Utc::now();
        save_session_meta(&meta)?;
    }
    Ok(())
}

/// List all sessions for a project
pub fn list_sessions(project_path: &str) -> Result<Vec<SessionMeta>, String> {
    let dir = project_sessions_dir(project_path);

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.extension().map_or(false, |ext| ext == "json") {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(meta) = serde_json::from_str::<SessionMeta>(&content) {
                    sessions.push(meta);
                }
            }
        }
    }

    // Sort by last active time, most recent first
    sessions.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));

    Ok(sessions)
}

/// List all sessions across all projects
pub fn list_all_sessions() -> Result<Vec<SessionMeta>, String> {
    let base_dir = sessions_dir();

    if !base_dir.exists() {
        return Ok(Vec::new());
    }

    let mut all_sessions = Vec::new();

    let entries = fs::read_dir(&base_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            // Read all .meta.json files in this project directory
            if let Ok(files) = fs::read_dir(&path) {
                for file in files.filter_map(Result::ok) {
                    let file_path = file.path();
                    if file_path.extension().map_or(false, |ext| ext == "json") {
                        if let Ok(content) = fs::read_to_string(&file_path) {
                            if let Ok(meta) = serde_json::from_str::<SessionMeta>(&content) {
                                all_sessions.push(meta);
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort by last active time, most recent first
    all_sessions.sort_by(|a, b| b.last_active_at.cmp(&a.last_active_at));

    Ok(all_sessions)
}

/// Delete a session and optionally its logs
pub fn delete_session(
    project_path: &str,
    session_id: &str,
    delete_logs: bool,
) -> Result<(), String> {
    let meta_path = meta_file_path(project_path, session_id);
    let log_path = log_file_path(project_path, session_id);

    // Delete metadata
    if meta_path.exists() {
        fs::remove_file(&meta_path)
            .map_err(|e| format!("Failed to delete metadata: {}", e))?;
    }

    // Delete log if requested
    if delete_logs && log_path.exists() {
        fs::remove_file(&log_path)
            .map_err(|e| format!("Failed to delete log: {}", e))?;
    }

    Ok(())
}

/// Export session as markdown
pub fn export_session(project_path: &str, session_id: &str) -> Result<String, String> {
    let meta = get_session_meta(project_path, session_id)?
        .ok_or_else(|| "Session not found".to_string())?;

    let logs = load_output(project_path, session_id, usize::MAX)?;

    let mut md = String::new();

    // Header
    md.push_str(&format!("# Session: {}\n\n", meta.display_name.as_ref().unwrap_or(&meta.session_id)));

    // Metadata
    md.push_str("## Metadata\n\n");
    md.push_str(&format!("- **Session ID:** {}\n", meta.session_id));
    md.push_str(&format!("- **Project:** {}\n", meta.project_path));
    if let Some(role) = &meta.role {
        md.push_str(&format!("- **Role:** {}\n", role));
    }
    if let Some(claude_id) = &meta.claude_session_id {
        md.push_str(&format!("- **Claude Session:** {}\n", claude_id));
    }
    md.push_str(&format!("- **Created:** {}\n", meta.created_at));
    md.push_str(&format!("- **Last Active:** {}\n", meta.last_active_at));
    md.push_str(&format!("- **Status:** {:?}\n", meta.status));
    md.push_str("\n");

    // Output log
    md.push_str("## Terminal Output\n\n");
    md.push_str("```\n");
    for line in logs {
        md.push_str(&line);
        md.push('\n');
    }
    md.push_str("```\n");

    Ok(md)
}

/// Cleanup old sessions
/// Returns the number of sessions deleted
pub fn cleanup_old_sessions(days: u32) -> Result<u32, String> {
    let base_dir = sessions_dir();

    if !base_dir.exists() {
        return Ok(0);
    }

    let cutoff = Utc::now() - Duration::days(days as i64);
    let mut deleted_count = 0;

    let entries = fs::read_dir(&base_dir)
        .map_err(|e| format!("Failed to read sessions directory: {}", e))?;

    for entry in entries.filter_map(Result::ok) {
        let path = entry.path();
        if path.is_dir() {
            if let Ok(files) = fs::read_dir(&path) {
                for file in files.filter_map(Result::ok) {
                    let file_path = file.path();
                    if file_path.extension().map_or(false, |ext| ext == "json") {
                        if let Ok(content) = fs::read_to_string(&file_path) {
                            if let Ok(meta) = serde_json::from_str::<SessionMeta>(&content) {
                                // Only cleanup saved/archived sessions, not active ones
                                if meta.status != SessionStatus::Active && meta.last_active_at < cutoff {
                                    let _ = delete_session(&meta.project_path, &meta.session_id, true);
                                    deleted_count += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(deleted_count)
}

// ============================================================================
// Tauri Commands
// ============================================================================

/// Tauri command: List sessions for a project
#[tauri::command]
pub fn session_storage_list(project_path: Option<String>) -> Result<Vec<SessionMeta>, String> {
    match project_path {
        Some(path) => list_sessions(&path),
        None => list_all_sessions(),
    }
}

/// Tauri command: Get session metadata
#[tauri::command]
pub fn session_storage_get(
    project_path: String,
    session_id: String,
) -> Result<Option<SessionMeta>, String> {
    get_session_meta(&project_path, &session_id)
}

/// Tauri command: Create a new session
#[tauri::command]
pub fn session_storage_create(
    session_id: String,
    project_path: String,
    role: Option<String>,
    claude_session_id: Option<String>,
) -> Result<SessionMeta, String> {
    create_session(session_id, project_path, role, claude_session_id)
}

/// Tauri command: Rename session
#[tauri::command]
pub fn session_storage_rename(
    project_path: String,
    session_id: String,
    display_name: String,
) -> Result<(), String> {
    rename_session(&project_path, &session_id, display_name)
}

/// Tauri command: Delete session
#[tauri::command]
pub fn session_storage_delete(
    project_path: String,
    session_id: String,
    delete_logs: bool,
) -> Result<(), String> {
    delete_session(&project_path, &session_id, delete_logs)
}

/// Tauri command: Update session status
#[tauri::command]
pub fn session_storage_update_status(
    project_path: String,
    session_id: String,
    status: SessionStatus,
) -> Result<(), String> {
    update_session_status(&project_path, &session_id, status)
}

/// Tauri command: Update session role
#[tauri::command]
pub fn session_storage_update_role(
    project_path: String,
    session_id: String,
    role: String,
) -> Result<(), String> {
    update_session_role(&project_path, &session_id, role)
}

/// Tauri command: Update Claude session ID
/// Called when we receive system.init event from Claude with the real session_id
#[tauri::command]
pub fn session_storage_update_claude_id(
    project_path: String,
    session_id: String,
    claude_session_id: String,
) -> Result<(), String> {
    update_session_claude_id(&project_path, &session_id, claude_session_id)
}

/// Tauri command: Export session as markdown
#[tauri::command]
pub fn session_storage_export(
    project_path: String,
    session_id: String,
) -> Result<String, String> {
    export_session(&project_path, &session_id)
}

/// Tauri command: Load output from session log
#[tauri::command]
pub fn session_storage_load_output(
    project_path: String,
    session_id: String,
    lines: usize,
) -> Result<Vec<String>, String> {
    load_output(&project_path, &session_id, lines)
}

/// Tauri command: Append output to session log
#[tauri::command]
pub fn session_storage_append_output(
    project_path: String,
    session_id: String,
    data: String,
) -> Result<(), String> {
    append_output(&project_path, &session_id, &data)
}

/// Tauri command: Cleanup old sessions
#[tauri::command]
pub fn session_storage_cleanup(days: u32) -> Result<u32, String> {
    cleanup_old_sessions(days)
}
