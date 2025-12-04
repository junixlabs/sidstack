use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowState {
    pub label: String,
    pub title: String,
    pub position: Option<WindowPosition>,
    pub task_id: Option<String>,
}

fn get_window_state_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("sidstack-agent-manager");
    fs::create_dir_all(&path).ok();
    path.push("windows.json");
    path
}

fn load_window_states() -> Vec<WindowState> {
    let path = get_window_state_path();
    if path.exists() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(states) = serde_json::from_str(&content) {
                return states;
            }
        }
    }
    Vec::new()
}

fn save_window_states(states: &[WindowState]) {
    let path = get_window_state_path();
    if let Ok(json) = serde_json::to_string_pretty(states) {
        let _ = fs::write(&path, json);
    }
}

#[tauri::command]
pub async fn open_task_window(
    app: tauri::AppHandle,
    task_id: String,
    title: String,
) -> Result<String, String> {
    let label = format!("task-{}", task_id);

    // Check if window already exists
    if app.get_webview_window(&label).is_some() {
        // Focus existing window
        if let Some(window) = app.get_webview_window(&label) {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(label);
    }

    // Load saved position for this window
    let states = load_window_states();
    let saved_state = states.iter().find(|s| s.label == label);

    let mut builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App("index.html".into()),
    )
    .title(&title)
    .inner_size(1000.0, 700.0)
    .min_inner_size(600.0, 400.0)
    .center();

    // Apply saved position if available
    if let Some(state) = saved_state {
        if let Some(pos) = &state.position {
            builder = builder
                .position(pos.x as f64, pos.y as f64)
                .inner_size(pos.width as f64, pos.height as f64);
        }
    }

    builder.build().map_err(|e| e.to_string())?;

    Ok(label)
}

#[tauri::command]
pub async fn close_task_window(app: tauri::AppHandle, task_id: String) -> Result<(), String> {
    let label = format!("task-{}", task_id);
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_window_position(
    app: tauri::AppHandle,
    label: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        let position = window.outer_position().map_err(|e| e.to_string())?;
        let size = window.inner_size().map_err(|e| e.to_string())?;

        let window_state = WindowState {
            label: label.clone(),
            title: window.title().unwrap_or_default(),
            position: Some(WindowPosition {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            }),
            task_id: if label.starts_with("task-") {
                Some(label.strip_prefix("task-").unwrap().to_string())
            } else {
                None
            },
        };

        let mut states = load_window_states();

        // Update or add state
        if let Some(existing) = states.iter_mut().find(|s| s.label == label) {
            *existing = window_state;
        } else {
            states.push(window_state);
        }

        save_window_states(&states);
    }
    Ok(())
}

#[tauri::command]
pub async fn list_windows(app: tauri::AppHandle) -> Vec<String> {
    app.webview_windows()
        .keys()
        .cloned()
        .collect()
}

#[tauri::command]
pub async fn focus_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub async fn broadcast_to_windows(
    app: tauri::AppHandle,
    event: String,
    payload: String,
) -> Result<(), String> {
    app.emit(&event, payload).map_err(|e: tauri::Error| e.to_string())?;
    Ok(())
}

/// Open a new window for a specific project
#[tauri::command]
pub async fn open_project_window(
    app: tauri::AppHandle,
    project_path: String,
) -> Result<String, String> {
    // Create a unique label based on project path hash
    let label = format!("project-{}", crate::utils::hash_path(&project_path));

    // Check if window already exists
    if app.get_webview_window(&label).is_some() {
        if let Some(window) = app.get_webview_window(&label) {
            window.set_focus().map_err(|e| e.to_string())?;
        }
        return Ok(label);
    }

    // Get project name for title
    let project_name = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Project");

    // URL encode the project path for query parameter
    let encoded_path = urlencoding::encode(&project_path);
    let url = format!("index.html?project={}", encoded_path);

    WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App(url.into()),
    )
    .title(&format!("SidStack - {}", project_name))
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(label)
}
