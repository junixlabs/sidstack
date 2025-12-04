/// Utility functions for the agent manager

use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;

/// Create a short hash from a path for use in window labels
pub fn hash_path(path: &str) -> String {
    let mut hasher = DefaultHasher::new();
    path.hash(&mut hasher);
    format!("{:x}", hasher.finish())[..8].to_string()
}

/// Find Claude CLI executable path
/// Checks common locations since GUI apps don't inherit shell PATH
pub fn find_claude_cli() -> Option<PathBuf> {
    let home = std::env::var("HOME").unwrap_or_default();

    let candidates = [
        // Homebrew (Apple Silicon)
        "/opt/homebrew/bin/claude".to_string(),
        // Homebrew (Intel)
        "/usr/local/bin/claude".to_string(),
        // User local bin
        format!("{}/.local/bin/claude", home),
    ];

    for candidate in &candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            return Some(path);
        }
    }

    // Fallback: try which command via login shell (inherits user's PATH)
    if let Ok(output) = std::process::Command::new("/bin/sh")
        .args(["-l", "-c", "which claude"])
        .output()
    {
        if output.status.success() {
            let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path_str.is_empty() {
                return Some(PathBuf::from(path_str));
            }
        }
    }

    None
}

/// Get enhanced PATH that includes common CLI tool locations
/// GUI apps don't inherit shell PATH, so we need to add common paths
pub fn get_enhanced_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let current_path = std::env::var("PATH").unwrap_or_default();

    let mut paths = vec![
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        format!("{}/.local/bin", home),
        format!("{}/.nvm/versions/node/v22.16.0/bin", home),
        format!("{}/.nvm/versions/node/v20.18.0/bin", home),
    ];

    if !current_path.is_empty() {
        paths.push(current_path);
    }

    paths.join(":")
}
