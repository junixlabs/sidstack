//! Session persistence for role-to-Claude-session mapping
//!
//! Enables Agent Manager to save and resume Claude Code sessions by role.
//! Uses a simple JSON file at ~/.sidstack/agent-manager/role-sessions.json

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Information about a Claude Code session
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    /// Claude session UUID (e.g., "714fd722-ba77-4484-b7ff-723ac0ecce11")
    pub session_id: String,
    /// Optional session name if renamed with /rename
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_name: Option<String>,
    /// ISO timestamp of last activity
    pub last_active: String,
}

/// Mapping of roles to their Claude Code sessions
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoleSessionMapping {
    /// Project path (e.g., "/Users/x/tools/sidstack")
    pub project_path: String,
    /// ISO timestamp when saved
    pub saved_at: String,
    /// Role name to session info mapping
    pub roles: HashMap<String, SessionInfo>,
}

/// Get the storage path for role-sessions.json
fn get_storage_path() -> PathBuf {
    let home = dirs::home_dir().expect("No home directory found");
    home.join(".sidstack/agent-manager/role-sessions.json")
}

/// Save role-session mapping to disk
///
/// Creates the directory structure if it doesn't exist.
pub fn save_role_sessions(mapping: &RoleSessionMapping) -> Result<(), String> {
    let path = get_storage_path();

    // Ensure directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let json =
        serde_json::to_string_pretty(mapping).map_err(|e| format!("Failed to serialize: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Load role-session mapping from disk
///
/// Returns None if the file doesn't exist.
pub fn load_role_sessions() -> Result<Option<RoleSessionMapping>, String> {
    let path = get_storage_path();

    if !path.exists() {
        return Ok(None);
    }

    let json = fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))?;

    let mapping: RoleSessionMapping =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(Some(mapping))
}

/// Clear saved role-session mapping
///
/// Removes the role-sessions.json file if it exists.
pub fn clear_role_sessions() -> Result<(), String> {
    let path = get_storage_path();

    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_info_serialization() {
        let info = SessionInfo {
            session_id: "abc-123".to_string(),
            session_name: Some("orchestrator".to_string()),
            last_active: "2024-12-20T15:30:00Z".to_string(),
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("sessionId"));
        assert!(json.contains("abc-123"));
    }

    #[test]
    fn test_role_session_mapping_serialization() {
        let mut roles = HashMap::new();
        roles.insert(
            "orchestrator".to_string(),
            SessionInfo {
                session_id: "abc-123".to_string(),
                session_name: None,
                last_active: "2024-12-20T15:30:00Z".to_string(),
            },
        );

        let mapping = RoleSessionMapping {
            project_path: "/test/project".to_string(),
            saved_at: "2024-12-20T15:30:00Z".to_string(),
            roles,
        };

        let json = serde_json::to_string_pretty(&mapping).unwrap();
        assert!(json.contains("projectPath"));
        assert!(json.contains("orchestrator"));
    }
}
