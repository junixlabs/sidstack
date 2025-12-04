//! Workspace Session Persistence
//!
//! Stores terminal sessions per workspace (project folder) in `.sidstack/` directory.
//! Enables session restore when user reopens the app.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

const SIDSTACK_DIR: &str = ".sidstack";
const WORKSPACE_FILE: &str = "workspace.json";
const SESSIONS_FILE: &str = "sessions.json";
const HISTORY_DIR: &str = "history";

/// Workspace configuration stored in workspace.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub version: String,
    pub name: String,
    pub created_at: String,
    pub last_opened: String,
}

/// A single terminal tab session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionTab {
    pub id: String,
    /// Block ID for PTY persistence - reuse when switching back to workspace
    #[serde(rename = "blockId")]
    pub block_id: Option<String>,
    #[serde(rename = "type")]
    pub tab_type: String, // "terminal"
    pub cwd: String,
    pub title: String,
    #[serde(default)]
    pub pinned: bool,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
}

/// Session state stored in sessions.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionState {
    pub version: String,
    pub tabs: Vec<SessionTab>,
    pub active_tab_id: Option<String>,
    pub last_saved: String,
}

impl Default for SessionState {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            tabs: Vec::new(),
            active_tab_id: None,
            last_saved: chrono::Utc::now().to_rfc3339(),
        }
    }
}

/// Get .sidstack directory path for a workspace
fn get_sidstack_dir(workspace_path: &str) -> PathBuf {
    Path::new(workspace_path).join(SIDSTACK_DIR)
}

/// Get history directory path
fn get_history_dir(workspace_path: &str) -> PathBuf {
    get_sidstack_dir(workspace_path).join(HISTORY_DIR)
}

/// Check if workspace is initialized
#[tauri::command]
pub fn workspace_exists(workspace_path: String) -> Result<bool, String> {
    let workspace_file = get_sidstack_dir(&workspace_path).join(WORKSPACE_FILE);
    Ok(workspace_file.exists())
}

/// Initialize workspace with .sidstack directory
/// Also adds .sidstack/ to .gitignore if it exists
#[tauri::command]
pub fn workspace_init(workspace_path: String, name: String) -> Result<WorkspaceConfig, String> {
    let sidstack_dir = get_sidstack_dir(&workspace_path);
    let history_dir = get_history_dir(&workspace_path);

    // Create directories
    fs::create_dir_all(&history_dir)
        .map_err(|e| format!("Failed to create .sidstack directory: {}", e))?;

    // Create workspace.json
    let now = chrono::Utc::now().to_rfc3339();
    let config = WorkspaceConfig {
        version: "1.0".to_string(),
        name,
        created_at: now.clone(),
        last_opened: now,
    };

    let workspace_file = sidstack_dir.join(WORKSPACE_FILE);
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize workspace config: {}", e))?;
    fs::write(&workspace_file, json)
        .map_err(|e| format!("Failed to write workspace.json: {}", e))?;

    // Create empty sessions.json
    let sessions = SessionState::default();
    let sessions_file = sidstack_dir.join(SESSIONS_FILE);
    let sessions_json = serde_json::to_string_pretty(&sessions)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;
    fs::write(&sessions_file, sessions_json)
        .map_err(|e| format!("Failed to write sessions.json: {}", e))?;

    // Add .sidstack/ to .gitignore
    add_to_gitignore(&workspace_path)?;

    println!("[WorkspaceStorage] Initialized workspace at {}", workspace_path);
    Ok(config)
}

/// Add .sidstack/ to .gitignore if not already present
fn add_to_gitignore(workspace_path: &str) -> Result<(), String> {
    let gitignore_path = Path::new(workspace_path).join(".gitignore");
    let sidstack_entry = ".sidstack/";

    // Check if .gitignore exists
    if gitignore_path.exists() {
        let content = fs::read_to_string(&gitignore_path)
            .map_err(|e| format!("Failed to read .gitignore: {}", e))?;

        // Check if .sidstack/ is already in .gitignore
        if content.lines().any(|line| line.trim() == sidstack_entry || line.trim() == ".sidstack") {
            return Ok(()); // Already present
        }

        // Append .sidstack/ to .gitignore
        let new_content = if content.ends_with('\n') {
            format!("{}\n# SidStack workspace data\n{}\n", content.trim_end(), sidstack_entry)
        } else {
            format!("{}\n\n# SidStack workspace data\n{}\n", content, sidstack_entry)
        };

        fs::write(&gitignore_path, new_content)
            .map_err(|e| format!("Failed to update .gitignore: {}", e))?;

        println!("[WorkspaceStorage] Added .sidstack/ to .gitignore");
    } else {
        // Create .gitignore with .sidstack/
        let content = format!("# SidStack workspace data\n{}\n", sidstack_entry);
        fs::write(&gitignore_path, content)
            .map_err(|e| format!("Failed to create .gitignore: {}", e))?;

        println!("[WorkspaceStorage] Created .gitignore with .sidstack/");
    }

    Ok(())
}

/// Load session state from workspace
#[tauri::command]
pub fn workspace_session_load(workspace_path: String) -> Result<SessionState, String> {
    let sessions_file = get_sidstack_dir(&workspace_path).join(SESSIONS_FILE);

    if !sessions_file.exists() {
        return Ok(SessionState::default());
    }

    let content = fs::read_to_string(&sessions_file)
        .map_err(|e| format!("Failed to read sessions.json: {}", e))?;

    let sessions: SessionState = serde_json::from_str(&content).map_err(|e| {
        eprintln!(
            "[WorkspaceStorage] Warning: Corrupted sessions.json: {}. Starting fresh.",
            e
        );
        format!("Corrupted sessions.json: {}", e)
    })?;

    // Update last_opened in workspace.json
    let workspace_file = get_sidstack_dir(&workspace_path).join(WORKSPACE_FILE);
    if let Ok(content) = fs::read_to_string(&workspace_file) {
        if let Ok(mut config) = serde_json::from_str::<WorkspaceConfig>(&content) {
            config.last_opened = chrono::Utc::now().to_rfc3339();
            if let Ok(json) = serde_json::to_string_pretty(&config) {
                let _ = fs::write(&workspace_file, json);
            }
        }
    }

    println!(
        "[WorkspaceStorage] Loaded {} tabs from workspace",
        sessions.tabs.len()
    );
    Ok(sessions)
}

/// Save session state to workspace
#[tauri::command]
pub fn workspace_session_save(
    workspace_path: String,
    state: SessionState,
) -> Result<(), String> {
    let sidstack_dir = get_sidstack_dir(&workspace_path);

    // Ensure directory exists
    if !sidstack_dir.exists() {
        return Err("Workspace not initialized. Call workspace_init first.".to_string());
    }

    // Update last_saved timestamp
    let mut state = state;
    state.last_saved = chrono::Utc::now().to_rfc3339();

    let sessions_file = sidstack_dir.join(SESSIONS_FILE);
    let json = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize sessions: {}", e))?;

    fs::write(&sessions_file, json)
        .map_err(|e| format!("Failed to write sessions.json: {}", e))?;

    println!(
        "[WorkspaceStorage] Saved {} tabs to workspace",
        state.tabs.len()
    );
    Ok(())
}

/// Get history file path for a terminal
#[tauri::command]
pub fn workspace_get_history_path(
    workspace_path: String,
    terminal_id: String,
) -> Result<String, String> {
    let history_dir = get_history_dir(&workspace_path);

    // Ensure history directory exists
    if !history_dir.exists() {
        fs::create_dir_all(&history_dir)
            .map_err(|e| format!("Failed to create history directory: {}", e))?;
    }

    let history_file = history_dir.join(format!("{}.history", terminal_id));
    Ok(history_file.to_string_lossy().to_string())
}

/// Get workspace config
#[tauri::command]
pub fn workspace_get_config(workspace_path: String) -> Result<WorkspaceConfig, String> {
    let workspace_file = get_sidstack_dir(&workspace_path).join(WORKSPACE_FILE);

    if !workspace_file.exists() {
        return Err("Workspace not initialized".to_string());
    }

    let content = fs::read_to_string(&workspace_file)
        .map_err(|e| format!("Failed to read workspace.json: {}", e))?;

    let config: WorkspaceConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse workspace.json: {}", e))?;

    Ok(config)
}

/// Validate that a cwd path exists, return fallback if not
#[tauri::command]
pub fn workspace_validate_cwd(cwd: String, fallback: String) -> String {
    if Path::new(&cwd).exists() {
        cwd
    } else {
        eprintln!(
            "[WorkspaceStorage] Warning: cwd '{}' not found, using fallback '{}'",
            cwd, fallback
        );
        fallback
    }
}
