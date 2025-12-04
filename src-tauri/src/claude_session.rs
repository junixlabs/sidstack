//! Claude Session Discovery
//!
//! Discovers and extracts Claude Code session IDs from ~/.claude/projects/
//! for enabling session resume functionality.

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::{DateTime, Utc};

/// Claude session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub session_id: String,
    pub project_path: String,
    pub session_file: PathBuf,
    pub last_modified: DateTime<Utc>,
}

/// Error types for session discovery
#[derive(Debug)]
pub enum SessionDiscoveryError {
    IoError(std::io::Error),
    JsonError(serde_json::Error),
    NotFound(String),
}

impl std::fmt::Display for SessionDiscoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SessionDiscoveryError::IoError(e) => write!(f, "IO error: {}", e),
            SessionDiscoveryError::JsonError(e) => write!(f, "JSON error: {}", e),
            SessionDiscoveryError::NotFound(msg) => write!(f, "Not found: {}", msg),
        }
    }
}

impl From<std::io::Error> for SessionDiscoveryError {
    fn from(e: std::io::Error) -> Self {
        SessionDiscoveryError::IoError(e)
    }
}

impl From<serde_json::Error> for SessionDiscoveryError {
    fn from(e: serde_json::Error) -> Self {
        SessionDiscoveryError::JsonError(e)
    }
}

/// Claude session data structure (from ~/.claude/projects/{hash}/.claude_session)
#[derive(Debug, Deserialize)]
struct ClaudeSessionFile {
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    #[serde(rename = "projectPath")]
    project_path: Option<String>,
}

/// Claude projects.json structure
#[derive(Debug, Deserialize)]
struct ClaudeProjectsIndex {
    projects: HashMap<String, ClaudeProjectEntry>,
}

#[derive(Debug, Deserialize)]
struct ClaudeProjectEntry {
    path: String,
    #[serde(rename = "lastAccessed")]
    last_accessed: Option<String>,
}

/// Get the Claude config directory
fn get_claude_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude"))
}

/// Discover all Claude sessions
pub fn discover_all_sessions() -> Result<Vec<ClaudeSession>, SessionDiscoveryError> {
    let claude_dir = get_claude_dir()
        .ok_or_else(|| SessionDiscoveryError::NotFound("Home directory not found".to_string()))?;

    let projects_dir = claude_dir.join("projects");
    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut sessions = Vec::new();

    // Iterate through project directories
    for entry in fs::read_dir(&projects_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            // Look for .claude_session file
            let session_file = path.join(".claude_session");
            if session_file.exists() {
                if let Ok(session) = read_session_file(&session_file) {
                    sessions.push(session);
                }
            }
        }
    }

    // Sort by last modified (newest first)
    sessions.sort_by(|a, b| b.last_modified.cmp(&a.last_modified));

    Ok(sessions)
}

/// Find sessions for a specific project path
pub fn find_sessions_for_project(project_path: &str) -> Result<Vec<ClaudeSession>, SessionDiscoveryError> {
    let all_sessions = discover_all_sessions()?;

    let matching: Vec<ClaudeSession> = all_sessions
        .into_iter()
        .filter(|s| s.project_path == project_path || s.project_path.ends_with(project_path))
        .collect();

    Ok(matching)
}

/// Find the most recent session for a project
pub fn find_latest_session(project_path: &str) -> Result<Option<ClaudeSession>, SessionDiscoveryError> {
    let sessions = find_sessions_for_project(project_path)?;
    Ok(sessions.into_iter().next())
}

/// Get session by ID
pub fn get_session_by_id(session_id: &str) -> Result<Option<ClaudeSession>, SessionDiscoveryError> {
    let all_sessions = discover_all_sessions()?;
    Ok(all_sessions.into_iter().find(|s| s.session_id == session_id))
}

/// Read a single session file
fn read_session_file(path: &Path) -> Result<ClaudeSession, SessionDiscoveryError> {
    let content = fs::read_to_string(path)?;
    let session_data: ClaudeSessionFile = serde_json::from_str(&content)?;

    let metadata = fs::metadata(path)?;
    let modified: DateTime<Utc> = metadata.modified()
        .map(|t| t.into())
        .unwrap_or_else(|_| Utc::now());

    let session_id = session_data.session_id
        .ok_or_else(|| SessionDiscoveryError::NotFound("Session ID not found in file".to_string()))?;

    let project_path = session_data.project_path
        .unwrap_or_else(|| "unknown".to_string());

    Ok(ClaudeSession {
        session_id,
        project_path,
        session_file: path.to_path_buf(),
        last_modified: modified,
    })
}

/// Map terminal working directories to potential Claude sessions
pub fn map_terminals_to_sessions(
    terminal_cwds: &[(String, String)], // (terminal_id, cwd)
) -> HashMap<String, Option<ClaudeSession>> {
    let mut result = HashMap::new();

    for (terminal_id, cwd) in terminal_cwds {
        let session = find_latest_session(cwd).ok().flatten();
        result.insert(terminal_id.clone(), session);
    }

    result
}

/// Check if a session is still valid (file exists and is recent)
pub fn is_session_valid(session_id: &str, max_age_hours: u64) -> bool {
    if let Ok(Some(session)) = get_session_by_id(session_id) {
        let age = Utc::now().signed_duration_since(session.last_modified);
        age.num_hours() < max_age_hours as i64
    } else {
        false
    }
}

/// Build resume command for Claude CLI
pub fn build_resume_command(session_id: &str) -> String {
    format!("claude --resume {}", session_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_claude_dir() {
        let dir = get_claude_dir();
        assert!(dir.is_some());
    }

    #[test]
    fn test_discover_sessions() {
        // This test may not find sessions in CI, but shouldn't error
        let result = discover_all_sessions();
        assert!(result.is_ok());
    }
}
