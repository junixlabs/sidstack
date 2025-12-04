use std::fs;
use std::path::PathBuf;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CrashLog {
    pub exists: bool,
    pub path: String,
    pub content: Option<String>,
    pub size_bytes: u64,
}

fn get_crash_log_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("sidstack-agent-manager");
    path.push("crash.log");
    path
}

#[tauri::command]
pub async fn get_crash_logs() -> Result<CrashLog, String> {
    let log_path = get_crash_log_path();
    let path_str = log_path.to_string_lossy().to_string();

    if !log_path.exists() {
        return Ok(CrashLog {
            exists: false,
            path: path_str,
            content: None,
            size_bytes: 0,
        });
    }

    let metadata = fs::metadata(&log_path).map_err(|e| e.to_string())?;
    let size = metadata.len();

    // Only read last 50KB to avoid memory issues
    let content = if size > 50 * 1024 {
        let full_content = fs::read_to_string(&log_path).map_err(|e| e.to_string())?;
        let chars: Vec<char> = full_content.chars().collect();
        let start = chars.len().saturating_sub(50 * 1024);
        Some(format!("[Truncated...]\n{}", chars[start..].iter().collect::<String>()))
    } else {
        Some(fs::read_to_string(&log_path).map_err(|e| e.to_string())?)
    };

    Ok(CrashLog {
        exists: true,
        path: path_str,
        content,
        size_bytes: size,
    })
}

#[tauri::command]
pub async fn clear_crash_logs() -> Result<(), String> {
    let log_path = get_crash_log_path();
    if log_path.exists() {
        fs::remove_file(&log_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
