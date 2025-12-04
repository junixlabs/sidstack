#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

/// Team member configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMemberConfig {
    pub id: String,
    pub role: String,             // "orchestrator", "dev", "qa", etc.
    pub agent_type: String,       // Template: "dev-agent", "qa-agent"

    // Current session (if active)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terminal_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_session_id: Option<String>,

    // Task assignment
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_spec_id: Option<String>,

    // Recovery tracking
    #[serde(default)]
    pub failure_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_failure: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovered_from: Option<String>,
}

impl TeamMemberConfig {
    pub fn new(role: String, agent_type: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            role,
            agent_type,
            terminal_id: None,
            claude_session_id: None,
            current_task_id: None,
            current_spec_id: None,
            failure_count: 0,
            last_failure: None,
            recovered_from: None,
        }
    }
}

/// Team configuration stored in team.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamConfig {
    pub id: String,
    pub name: String,
    pub project_path: String,
    pub created_at: DateTime<Utc>,
    pub created_by: String,       // "user" or "orchestrator"

    // Members
    pub orchestrator: TeamMemberConfig,
    pub workers: Vec<TeamMemberConfig>,

    // Settings
    #[serde(default = "default_auto_recovery")]
    pub auto_recovery: bool,
    #[serde(default = "default_max_recovery_attempts")]
    pub max_recovery_attempts: u32,
    #[serde(default = "default_recovery_delay_ms")]
    pub recovery_delay_ms: u64,

    // Metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
}

fn default_auto_recovery() -> bool { true }
fn default_max_recovery_attempts() -> u32 { 3 }
fn default_recovery_delay_ms() -> u64 { 5000 }

/// Team status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum TeamStatus {
    Active,
    Paused,
    Archived,
}

/// Member state in team state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberState {
    pub status: MemberStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terminal_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_task: Option<MemberTaskInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_heartbeat: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum MemberStatus {
    Active,
    Idle,
    Failed,
    Recovering,
    Paused,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberTaskInfo {
    pub task_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec_id: Option<String>,
    pub phase: String,
    pub progress: u32,
}

/// Session info for resume
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionInfo {
    pub saved_at: DateTime<Utc>,
    pub terminals: Vec<TerminalSessionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalSessionInfo {
    pub member_id: String,
    pub terminal_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub claude_session_id: Option<String>,
    pub cwd: String,
}

/// Team state stored in state.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamState {
    pub team_id: String,
    pub status: TeamStatus,
    pub last_active: DateTime<Utc>,
    pub members: HashMap<String, MemberState>,
    #[serde(default)]
    pub active_specs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_info: Option<SessionInfo>,
}

impl TeamState {
    pub fn new(team_id: String) -> Self {
        Self {
            team_id,
            status: TeamStatus::Active,
            last_active: Utc::now(),
            members: HashMap::new(),
            active_specs: Vec::new(),
            session_info: None,
        }
    }
}

/// Recovery event in history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryEvent {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub failed_member_id: String,
    pub failed_member_role: String,
    pub replacement_member_id: String,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spec_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub task_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recovery_context: Option<RecoveryContextSummary>,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryContextSummary {
    pub progress: u32,
    pub artifacts: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_step: Option<String>,
}

/// Team history stored in history.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamHistory {
    pub team_id: String,
    pub events: Vec<RecoveryEvent>,
}

impl TeamHistory {
    pub fn new(team_id: String) -> Self {
        Self {
            team_id,
            events: Vec::new(),
        }
    }
}

/// Team index entry for teams.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamIndexEntry {
    pub id: String,
    pub name: String,
    pub status: TeamStatus,
    pub last_active: DateTime<Utc>,
    pub member_count: usize,
}

/// Team index stored in teams.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamIndex {
    pub project_path: String,
    pub project_hash: String,
    pub teams: Vec<TeamIndexEntry>,
}

impl TeamIndex {
    pub fn new(project_path: String, project_hash: String) -> Self {
        Self {
            project_path,
            project_hash,
            teams: Vec::new(),
        }
    }
}

/// Team storage error
#[derive(Debug)]
pub enum TeamStorageError {
    IoError(std::io::Error),
    JsonError(serde_json::Error),
    TeamNotFound(String),
    TeamAlreadyExists(String),
    InvalidPath(String),
}

impl std::fmt::Display for TeamStorageError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TeamStorageError::IoError(e) => write!(f, "IO error: {}", e),
            TeamStorageError::JsonError(e) => write!(f, "JSON error: {}", e),
            TeamStorageError::TeamNotFound(id) => write!(f, "Team not found: {}", id),
            TeamStorageError::TeamAlreadyExists(name) => write!(f, "Team already exists: {}", name),
            TeamStorageError::InvalidPath(p) => write!(f, "Invalid path: {}", p),
        }
    }
}

impl From<std::io::Error> for TeamStorageError {
    fn from(e: std::io::Error) -> Self {
        TeamStorageError::IoError(e)
    }
}

impl From<serde_json::Error> for TeamStorageError {
    fn from(e: serde_json::Error) -> Self {
        TeamStorageError::JsonError(e)
    }
}

/// Team storage for persisting team data
pub struct TeamStorage {
    base_dir: PathBuf,
}

impl TeamStorage {
    /// Create new TeamStorage with base directory
    pub fn new() -> Result<Self, TeamStorageError> {
        let home = dirs::home_dir().ok_or_else(|| {
            TeamStorageError::InvalidPath("Could not find home directory".to_string())
        })?;
        let base_dir = home.join(".sidstack").join("teams");
        fs::create_dir_all(&base_dir)?;
        Ok(Self { base_dir })
    }

    /// Get project hash from path
    pub fn hash_project_path(project_path: &str) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        let mut hasher = DefaultHasher::new();
        project_path.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Get project directory
    fn project_dir(&self, project_path: &str) -> PathBuf {
        let hash = Self::hash_project_path(project_path);
        self.base_dir.join(&hash)
    }

    /// Get team directory
    fn team_dir(&self, project_path: &str, team_id: &str) -> PathBuf {
        self.project_dir(project_path).join(team_id)
    }

    /// Ensure project directory exists
    fn ensure_project_dir(&self, project_path: &str) -> Result<PathBuf, TeamStorageError> {
        let dir = self.project_dir(project_path);
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// Ensure team directory exists
    fn ensure_team_dir(&self, project_path: &str, team_id: &str) -> Result<PathBuf, TeamStorageError> {
        let dir = self.team_dir(project_path, team_id);
        fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    // ===== Team Index Operations =====

    /// Load team index for a project
    pub fn load_index(&self, project_path: &str) -> Result<TeamIndex, TeamStorageError> {
        let index_path = self.project_dir(project_path).join("teams.json");
        if index_path.exists() {
            let content = fs::read_to_string(&index_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(TeamIndex::new(
                project_path.to_string(),
                Self::hash_project_path(project_path),
            ))
        }
    }

    /// Save team index
    pub fn save_index(&self, project_path: &str, index: &TeamIndex) -> Result<(), TeamStorageError> {
        self.ensure_project_dir(project_path)?;
        let index_path = self.project_dir(project_path).join("teams.json");
        let content = serde_json::to_string_pretty(index)?;
        fs::write(index_path, content)?;
        Ok(())
    }

    /// Update index entry
    pub fn update_index_entry(&self, project_path: &str, entry: TeamIndexEntry) -> Result<(), TeamStorageError> {
        let mut index = self.load_index(project_path)?;
        if let Some(existing) = index.teams.iter_mut().find(|t| t.id == entry.id) {
            *existing = entry;
        } else {
            index.teams.push(entry);
        }
        self.save_index(project_path, &index)
    }

    /// Remove from index
    pub fn remove_from_index(&self, project_path: &str, team_id: &str) -> Result<(), TeamStorageError> {
        let mut index = self.load_index(project_path)?;
        index.teams.retain(|t| t.id != team_id);
        self.save_index(project_path, &index)
    }

    // ===== Team Config Operations =====

    /// Save team config
    pub fn save_config(&self, config: &TeamConfig) -> Result<(), TeamStorageError> {
        let team_dir = self.ensure_team_dir(&config.project_path, &config.id)?;
        let config_path = team_dir.join("team.json");
        let content = serde_json::to_string_pretty(config)?;
        fs::write(config_path, content)?;

        // Update index
        let entry = TeamIndexEntry {
            id: config.id.clone(),
            name: config.name.clone(),
            status: TeamStatus::Active,
            last_active: Utc::now(),
            member_count: 1 + config.workers.len(),
        };
        self.update_index_entry(&config.project_path, entry)?;

        Ok(())
    }

    /// Load team config
    pub fn load_config(&self, project_path: &str, team_id: &str) -> Result<TeamConfig, TeamStorageError> {
        let config_path = self.team_dir(project_path, team_id).join("team.json");
        if config_path.exists() {
            let content = fs::read_to_string(&config_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Err(TeamStorageError::TeamNotFound(team_id.to_string()))
        }
    }

    // ===== Team State Operations =====

    /// Save team state
    pub fn save_state(&self, project_path: &str, state: &TeamState) -> Result<(), TeamStorageError> {
        let team_dir = self.ensure_team_dir(project_path, &state.team_id)?;
        let state_path = team_dir.join("state.json");
        let content = serde_json::to_string_pretty(state)?;
        fs::write(state_path, content)?;

        // Update index status
        let mut index = self.load_index(project_path)?;
        if let Some(entry) = index.teams.iter_mut().find(|t| t.id == state.team_id) {
            entry.status = state.status.clone();
            entry.last_active = state.last_active;
        }
        self.save_index(project_path, &index)?;

        Ok(())
    }

    /// Load team state
    pub fn load_state(&self, project_path: &str, team_id: &str) -> Result<TeamState, TeamStorageError> {
        let state_path = self.team_dir(project_path, team_id).join("state.json");
        if state_path.exists() {
            let content = fs::read_to_string(&state_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(TeamState::new(team_id.to_string()))
        }
    }

    // ===== Team History Operations =====

    /// Save team history
    pub fn save_history(&self, project_path: &str, history: &TeamHistory) -> Result<(), TeamStorageError> {
        let team_dir = self.ensure_team_dir(project_path, &history.team_id)?;
        let history_path = team_dir.join("history.json");
        let content = serde_json::to_string_pretty(history)?;
        fs::write(history_path, content)?;
        Ok(())
    }

    /// Load team history
    pub fn load_history(&self, project_path: &str, team_id: &str) -> Result<TeamHistory, TeamStorageError> {
        let history_path = self.team_dir(project_path, team_id).join("history.json");
        if history_path.exists() {
            let content = fs::read_to_string(&history_path)?;
            Ok(serde_json::from_str(&content)?)
        } else {
            Ok(TeamHistory::new(team_id.to_string()))
        }
    }

    /// Add recovery event to history
    pub fn add_recovery_event(&self, project_path: &str, team_id: &str, event: RecoveryEvent) -> Result<(), TeamStorageError> {
        let mut history = self.load_history(project_path, team_id)?;
        history.events.insert(0, event); // Newest first
        // Keep only last 100 events
        history.events.truncate(100);
        self.save_history(project_path, &history)
    }

    // ===== Team CRUD Operations =====

    /// Create a new team
    pub fn create_team(&self, config: TeamConfig) -> Result<TeamConfig, TeamStorageError> {
        // Check if team with same name exists
        let index = self.load_index(&config.project_path)?;
        if index.teams.iter().any(|t| t.name == config.name) {
            return Err(TeamStorageError::TeamAlreadyExists(config.name.clone()));
        }

        // Save config
        self.save_config(&config)?;

        // Initialize state
        let mut state = TeamState::new(config.id.clone());
        state.members.insert(config.orchestrator.id.clone(), MemberState {
            status: MemberStatus::Active,
            terminal_id: config.orchestrator.terminal_id.clone(),
            claude_session_id: config.orchestrator.claude_session_id.clone(),
            current_task: None,
            last_heartbeat: Some(Utc::now()),
        });
        for worker in &config.workers {
            state.members.insert(worker.id.clone(), MemberState {
                status: MemberStatus::Idle,
                terminal_id: worker.terminal_id.clone(),
                claude_session_id: worker.claude_session_id.clone(),
                current_task: None,
                last_heartbeat: Some(Utc::now()),
            });
        }
        self.save_state(&config.project_path, &state)?;

        // Initialize history
        let history = TeamHistory::new(config.id.clone());
        self.save_history(&config.project_path, &history)?;

        Ok(config)
    }

    /// List teams for a project
    pub fn list_teams(&self, project_path: &str, status_filter: Option<TeamStatus>) -> Result<Vec<TeamIndexEntry>, TeamStorageError> {
        let index = self.load_index(project_path)?;
        let teams = if let Some(status) = status_filter {
            index.teams.into_iter().filter(|t| t.status == status).collect()
        } else {
            index.teams
        };
        Ok(teams)
    }

    /// Get full team data
    pub fn get_team(&self, project_path: &str, team_id: &str) -> Result<(TeamConfig, TeamState), TeamStorageError> {
        let config = self.load_config(project_path, team_id)?;
        let state = self.load_state(project_path, team_id)?;
        Ok((config, state))
    }

    /// Archive a team
    pub fn archive_team(&self, project_path: &str, team_id: &str) -> Result<(), TeamStorageError> {
        let mut state = self.load_state(project_path, team_id)?;
        state.status = TeamStatus::Archived;
        state.last_active = Utc::now();
        self.save_state(project_path, &state)
    }

    /// Delete a team (removes all files)
    pub fn delete_team(&self, project_path: &str, team_id: &str) -> Result<(), TeamStorageError> {
        let team_dir = self.team_dir(project_path, team_id);
        if team_dir.exists() {
            fs::remove_dir_all(&team_dir)?;
        }
        self.remove_from_index(project_path, team_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn create_test_storage() -> TeamStorage {
        TeamStorage::new().unwrap()
    }

    fn create_test_config(project_path: &str) -> TeamConfig {
        TeamConfig {
            id: Uuid::new_v4().to_string(),
            name: "test-team".to_string(),
            project_path: project_path.to_string(),
            created_at: Utc::now(),
            created_by: "user".to_string(),
            orchestrator: TeamMemberConfig::new("orchestrator".to_string(), "orchestrator".to_string()),
            workers: vec![
                TeamMemberConfig::new("dev".to_string(), "dev-agent".to_string()),
            ],
            auto_recovery: true,
            max_recovery_attempts: 3,
            recovery_delay_ms: 5000,
            description: None,
            tags: Vec::new(),
        }
    }

    #[test]
    fn test_hash_project_path() {
        let hash1 = TeamStorage::hash_project_path("/path/to/project");
        let hash2 = TeamStorage::hash_project_path("/path/to/project");
        let hash3 = TeamStorage::hash_project_path("/different/path");

        assert_eq!(hash1, hash2);
        assert_ne!(hash1, hash3);
    }

    #[test]
    fn test_team_member_config_new() {
        let member = TeamMemberConfig::new("dev".to_string(), "dev-agent".to_string());
        assert!(!member.id.is_empty());
        assert_eq!(member.role, "dev");
        assert_eq!(member.agent_type, "dev-agent");
        assert_eq!(member.failure_count, 0);
    }

    #[test]
    fn test_team_state_new() {
        let state = TeamState::new("team-123".to_string());
        assert_eq!(state.team_id, "team-123");
        assert_eq!(state.status, TeamStatus::Active);
        assert!(state.members.is_empty());
    }
}
