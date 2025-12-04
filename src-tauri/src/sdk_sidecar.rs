//! Agent SDK Sidecar Management
//!
//! Manages the lifecycle of the Node.js Agent SDK sidecar process.
//! The sidecar provides a WebSocket interface to the Claude Agent SDK.

use std::sync::Arc;
use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;

const SIDECAR_PORT: u16 = 17433;
const SIDECAR_NAME: &str = "agent-sdk-sidecar";

/// State for managing the sidecar process
pub struct SidecarState {
    /// Process ID if running
    pub pid: Option<u32>,
    /// Port the sidecar is listening on
    pub port: Option<u16>,
    /// Whether we're in the process of starting
    pub starting: bool,
}

impl Default for SidecarState {
    fn default() -> Self {
        Self {
            pid: None,
            port: None,
            starting: false,
        }
    }
}

/// Global sidecar state
pub type SharedSidecarState = Arc<Mutex<SidecarState>>;

/// Create a new shared sidecar state
pub fn create_sidecar_state() -> SharedSidecarState {
    Arc::new(Mutex::new(SidecarState::default()))
}

/// Start the Agent SDK sidecar process
#[tauri::command]
pub async fn start_sdk_sidecar(
    app: AppHandle,
    state: tauri::State<'_, SharedSidecarState>,
) -> Result<u16, String> {
    let mut sidecar = state.lock().await;

    // Already running?
    if sidecar.pid.is_some() {
        return Ok(sidecar.port.unwrap_or(SIDECAR_PORT));
    }

    // Already starting?
    if sidecar.starting {
        return Err("Sidecar is already starting".into());
    }

    sidecar.starting = true;
    drop(sidecar); // Release lock during spawn

    println!("[SdkSidecar] Starting Agent SDK sidecar on port {}", SIDECAR_PORT);

    // Spawn the sidecar process
    let shell = app.shell();
    let command = shell
        .sidecar(SIDECAR_NAME)
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("SIDECAR_PORT", SIDECAR_PORT.to_string());

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let pid = child.pid();
    println!("[SdkSidecar] Sidecar started with PID: {}", pid);

    // Update state
    let mut sidecar = state.lock().await;
    sidecar.pid = Some(pid);
    sidecar.port = Some(SIDECAR_PORT);
    sidecar.starting = false;

    // Spawn a task to monitor the process output and handle auto-restart
    let state_clone = state.inner().clone();
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    println!("[SdkSidecar] {}", line_str.trim());
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("[SdkSidecar] ERROR: {}", line_str.trim());
                }
                CommandEvent::Terminated(payload) => {
                    println!("[SdkSidecar] Process terminated: {:?}", payload);

                    // Reset state
                    {
                        let mut sidecar = state_clone.lock().await;
                        sidecar.pid = None;
                        sidecar.port = None;
                        sidecar.starting = false;
                    }

                    // Auto-restart after crash (unless intentionally stopped)
                    // Small delay before restart
                    tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

                    // Check if we should restart (not during app shutdown)
                    let should_restart = {
                        let sidecar = state_clone.lock().await;
                        // Only restart if not intentionally stopped (pid would be None)
                        // and not in the middle of starting
                        !sidecar.starting && sidecar.pid.is_none()
                    };

                    if should_restart {
                        println!("[SdkSidecar] Auto-restarting after crash...");
                        // Trigger restart by calling start_sdk_sidecar
                        if let Err(e) = restart_sidecar(&app_clone, &state_clone).await {
                            eprintln!("[SdkSidecar] Auto-restart failed: {}", e);
                        }
                    }

                    break;
                }
                _ => {}
            }
        }
    });

    // Give the sidecar a moment to start
    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(SIDECAR_PORT)
}

/// Stop the Agent SDK sidecar process
#[tauri::command]
pub async fn stop_sdk_sidecar(
    state: tauri::State<'_, SharedSidecarState>,
) -> Result<(), String> {
    let mut sidecar = state.lock().await;

    if let Some(pid) = sidecar.pid.take() {
        println!("[SdkSidecar] Stopping sidecar (PID: {})", pid);

        // Kill the process
        #[cfg(unix)]
        {
            use std::process::Command;
            let _ = Command::new("kill")
                .arg("-TERM")
                .arg(pid.to_string())
                .output();
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output();
        }

        sidecar.port = None;
        println!("[SdkSidecar] Sidecar stopped");
    }

    Ok(())
}

/// Get the sidecar status
#[tauri::command]
pub async fn get_sdk_sidecar_status(
    state: tauri::State<'_, SharedSidecarState>,
) -> Result<SidecarStatus, String> {
    let sidecar = state.lock().await;

    Ok(SidecarStatus {
        running: sidecar.pid.is_some(),
        port: sidecar.port,
        pid: sidecar.pid,
    })
}

/// Sidecar status response
#[derive(serde::Serialize)]
pub struct SidecarStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
}

/// Internal helper to restart sidecar (for auto-restart on crash)
async fn restart_sidecar(
    app: &AppHandle,
    state: &SharedSidecarState,
) -> Result<u16, String> {
    let mut sidecar = state.lock().await;

    // Already running or starting?
    if sidecar.pid.is_some() || sidecar.starting {
        return Ok(sidecar.port.unwrap_or(SIDECAR_PORT));
    }

    sidecar.starting = true;
    drop(sidecar);

    println!("[SdkSidecar] Restarting sidecar on port {}", SIDECAR_PORT);

    // Spawn the sidecar process
    let shell = app.shell();
    let command = shell
        .sidecar(SIDECAR_NAME)
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("SIDECAR_PORT", SIDECAR_PORT.to_string());

    let (mut rx, child) = command
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    let pid = child.pid();
    println!("[SdkSidecar] Sidecar restarted with PID: {}", pid);

    // Update state
    let mut sidecar = state.lock().await;
    sidecar.pid = Some(pid);
    sidecar.port = Some(SIDECAR_PORT);
    sidecar.starting = false;

    // Monitor the new process
    let state_clone = state.clone();
    let _app_clone = app.clone(); // Keep for potential future use
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    println!("[SdkSidecar] {}", line_str.trim());
                }
                CommandEvent::Stderr(line) => {
                    let line_str = String::from_utf8_lossy(&line);
                    eprintln!("[SdkSidecar] ERROR: {}", line_str.trim());
                }
                CommandEvent::Terminated(payload) => {
                    println!("[SdkSidecar] Process terminated: {:?}", payload);
                    let mut sidecar = state_clone.lock().await;
                    sidecar.pid = None;
                    sidecar.port = None;
                    sidecar.starting = false;
                    // Note: Not auto-restarting here to prevent infinite loop
                    break;
                }
                _ => {}
            }
        }
    });

    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

    Ok(SIDECAR_PORT)
}

/// Ensure sidecar is running, starting it if necessary
#[tauri::command]
pub async fn ensure_sdk_sidecar(
    app: AppHandle,
    state: tauri::State<'_, SharedSidecarState>,
) -> Result<u16, String> {
    let sidecar = state.lock().await;

    if sidecar.pid.is_some() {
        return Ok(sidecar.port.unwrap_or(SIDECAR_PORT));
    }

    drop(sidecar);

    // Start the sidecar
    start_sdk_sidecar(app, state).await
}
