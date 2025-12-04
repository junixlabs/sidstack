//! Slash Commands Backend
//!
//! Tauri commands to support terminal slash commands:
//! - File search and autocomplete
//! - File mention resolution
//! - Bash direct execution
//! - Custom commands loading

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SlashError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File not found: {0}")]
    NotFound(String),
    #[error("Command failed: {0}")]
    CommandFailed(String),
    #[error("Home directory not found")]
    NoHomeDir,
}

impl Serialize for SlashError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

// ============================================================================
// File Search (for @mention autocomplete)
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct FileSearchResult {
    pub path: String,
    pub is_dir: bool,
}

/// Search files for autocomplete
/// Returns relative paths with is_dir flag
#[tauri::command]
pub async fn slash_search_files(
    query: String,
    working_dir: String,
    max_results: Option<usize>,
) -> Result<Vec<FileSearchResult>, SlashError> {
    let base_path = Path::new(&working_dir);
    let max_results = max_results.unwrap_or(10);
    let query_lower = query.to_lowercase();

    let mut results = Vec::new();

    // If query contains '/', search in that subdirectory
    let (search_dir, prefix, search_term) = if query.contains('/') {
        let parts: Vec<&str> = query.rsplitn(2, '/').collect();
        let search_term = parts[0].to_lowercase();
        let prefix = if parts.len() > 1 { parts[1] } else { "" };
        let search_dir = base_path.join(prefix);
        (search_dir, format!("{}/", prefix), search_term)
    } else {
        (base_path.to_path_buf(), String::new(), query_lower)
    };

    if !search_dir.exists() || !search_dir.is_dir() {
        return Ok(results);
    }

    // Read directory entries
    let entries = fs::read_dir(&search_dir)?;

    for entry in entries.flatten() {
        if results.len() >= max_results {
            break;
        }

        let name = entry.file_name().to_string_lossy().to_string();
        let name_lower = name.to_lowercase();

        // Skip hidden files
        if name.starts_with('.') {
            continue;
        }

        // Skip common ignore patterns
        if matches!(
            name.as_str(),
            "node_modules" | "target" | "dist" | "build" | ".git"
        ) {
            continue;
        }

        // Match against search term
        if search_term.is_empty() || name_lower.starts_with(&search_term) {
            let is_dir = entry.path().is_dir();
            let relative_path = format!("{}{}", prefix, name);

            results.push(FileSearchResult {
                path: relative_path,
                is_dir,
            });
        }
    }

    // Sort: directories first, then alphabetically
    results.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.path.cmp(&b.path),
        }
    });

    Ok(results)
}

// ============================================================================
// File Mention Resolution
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct ResolvedMention {
    pub absolute_path: String,
    pub exists: bool,
    pub content: Option<String>,
}

/// Resolve a file mention (@path) to absolute path
/// Optionally loads content if file exists and is small enough
#[tauri::command]
pub async fn resolve_file_mention(
    path: String,
    working_dir: String,
) -> Result<ResolvedMention, SlashError> {
    let base = Path::new(&working_dir);
    let full_path = base.join(&path);
    let absolute_path = full_path.to_string_lossy().to_string();

    if !full_path.exists() {
        return Ok(ResolvedMention {
            absolute_path,
            exists: false,
            content: None,
        });
    }

    // Load content if it's a file and not too large
    let content = if full_path.is_file() {
        let metadata = fs::metadata(&full_path)?;
        // Only load files smaller than 100KB
        if metadata.len() < 100 * 1024 {
            fs::read_to_string(&full_path).ok()
        } else {
            None
        }
    } else {
        None
    };

    Ok(ResolvedMention {
        absolute_path,
        exists: true,
        content,
    })
}

/// Read file content by absolute path
#[tauri::command]
pub async fn read_file_content(path: String) -> Result<String, SlashError> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(SlashError::NotFound(path));
    }

    if !file_path.is_file() {
        return Err(SlashError::NotFound(format!("{} is not a file", path)));
    }

    let content = fs::read_to_string(file_path)?;
    Ok(content)
}

// ============================================================================
// Bash Direct Execution
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct BashResult {
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

/// Execute a bash command in the specified directory
#[tauri::command]
pub async fn execute_bash_command(
    command: String,
    working_dir: String,
) -> Result<BashResult, SlashError> {
    let output = if cfg!(target_os = "windows") {
        Command::new("cmd")
            .args(["/C", &command])
            .current_dir(&working_dir)
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .current_dir(&working_dir)
            .output()
    };

    match output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            let exit_code = output.status.code().unwrap_or(-1);

            Ok(BashResult {
                exit_code,
                stdout,
                stderr,
            })
        }
        Err(e) => Err(SlashError::CommandFailed(e.to_string())),
    }
}

// ============================================================================
// Custom Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct CustomCommandFile {
    pub name: String,
    pub content: String,
}

/// List custom commands from a directory
/// Returns .md files with their content
#[tauri::command]
pub async fn list_custom_commands(dir: String) -> Result<Vec<CustomCommandFile>, SlashError> {
    let path = Path::new(&dir);

    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let mut commands = Vec::new();

    for entry in fs::read_dir(path)?.flatten() {
        let file_path = entry.path();

        // Only process .md files
        if file_path.extension().map(|e| e == "md").unwrap_or(false) {
            let name = entry.file_name().to_string_lossy().to_string();

            if let Ok(content) = fs::read_to_string(&file_path) {
                commands.push(CustomCommandFile { name, content });
            }
        }
    }

    Ok(commands)
}

/// Get the user's home directory
#[tauri::command]
pub async fn get_home_dir() -> Result<String, SlashError> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or(SlashError::NoHomeDir)
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_slash_search_files() {
        // This test requires a valid directory
        let result = slash_search_files(
            "src".to_string(),
            ".".to_string(),
            Some(5),
        ).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_execute_bash_command() {
        let result = execute_bash_command(
            "echo hello".to_string(),
            ".".to_string(),
        ).await;

        assert!(result.is_ok());
        let bash_result = result.unwrap();
        assert_eq!(bash_result.exit_code, 0);
        assert!(bash_result.stdout.contains("hello"));
    }

    #[tokio::test]
    async fn test_get_home_dir() {
        let result = get_home_dir().await;
        assert!(result.is_ok());
        assert!(!result.unwrap().is_empty());
    }
}
