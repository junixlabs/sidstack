/// API Server Manager
///
/// Manages the lifecycle of the API server process.
/// Starts the server when the app launches and stops it on exit.

use std::net::TcpStream;
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

const API_SERVER_PORT: u16 = 19432;

/// Shared state for the API server process
pub struct ApiServerState {
    process: Option<Child>,
}

impl ApiServerState {
    pub fn new() -> Self {
        Self { process: None }
    }
}

pub type SharedApiServerState = Arc<Mutex<ApiServerState>>;

pub fn create_api_server_state() -> SharedApiServerState {
    Arc::new(Mutex::new(ApiServerState::new()))
}

/// Check if the API server is already running on port 19432
fn is_port_in_use(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(100),
    )
    .is_ok()
}

/// Get the project root directory (3 levels up from src-tauri)
fn get_project_root() -> Option<std::path::PathBuf> {
    // Try to find project root by looking for package.json with workspaces
    let exe_path = std::env::current_exe().ok()?;

    // In dev mode, we're running from target/debug
    // In production, we need to find the project root differently

    // First try: Look for sidstack root from current directory
    let current_dir = std::env::current_dir().ok()?;

    // Check if we're in the sidstack directory already
    if current_dir.join("packages").join("api-server").exists() {
        return Some(current_dir);
    }

    // Try to find from exe path (dev mode: target/debug/sidstack)
    let mut path = exe_path.parent()?; // debug
    path = path.parent()?; // target
    path = path.parent()?; // src-tauri
    path = path.parent()?; // agent-manager
    path = path.parent()?; // apps
    path = path.parent()?; // sidstack root

    if path.join("packages").join("api-server").exists() {
        return Some(path.to_path_buf());
    }

    // Fallback: Try common locations
    let home = std::env::var("HOME").ok()?;
    let fallback_paths = [
        format!("{}/tools/sidstack", home),
        format!("{}/projects/sidstack", home),
        format!("{}/dev/sidstack", home),
    ];

    for fallback in &fallback_paths {
        let path = std::path::PathBuf::from(fallback);
        if path.join("packages").join("api-server").exists() {
            return Some(path);
        }
    }

    None
}

/// Resolve the full path to a command by checking common locations.
/// macOS GUI apps don't inherit the shell PATH, so `pnpm` may not be found.
fn resolve_command(name: &str) -> String {
    let search_paths = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
    ];
    for dir in &search_paths {
        let full = format!("{}/{}", dir, name);
        if std::path::Path::new(&full).exists() {
            return full;
        }
    }
    name.to_string()
}

/// Build a PATH that includes common tool directories.
/// Ensures child processes can find node, pnpm, cargo, etc.
fn enriched_path() -> String {
    let extra = [
        "/opt/homebrew/bin",
        "/usr/local/bin",
        "/usr/bin",
        "/bin",
    ];
    let current = std::env::var("PATH").unwrap_or_default();
    let mut parts: Vec<&str> = extra.to_vec();
    if !current.is_empty() {
        parts.push(&current);
    }
    parts.join(":")
}

/// Start the API server process
pub async fn start_api_server(state: SharedApiServerState) -> Result<(), String> {
    // Check if already running on port
    if is_port_in_use(API_SERVER_PORT) {
        eprintln!("[ApiServer] Port {} already in use, assuming API server is running", API_SERVER_PORT);
        return Ok(());
    }

    let project_root = get_project_root()
        .ok_or_else(|| "Could not find project root".to_string())?;

    eprintln!("[ApiServer] Starting API server from {:?}", project_root);

    let pnpm = resolve_command("pnpm");
    eprintln!("[ApiServer] Using pnpm at: {}", pnpm);

    // Use pnpm to start the API server (using 'start' which runs built dist)
    let child = Command::new(&pnpm)
        .args(["--filter", "@sidstack/api-server", "start"])
        .current_dir(&project_root)
        .env("PATH", enriched_path())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start API server: {}", e))?;

    let pid = child.id();
    eprintln!("[ApiServer] Started API server with PID {}", pid);

    // Store the process handle
    {
        let mut state = state.lock().await;
        state.process = Some(child);
    }

    // Wait for server to be ready (poll port)
    let max_retries = 30; // 3 seconds
    for i in 0..max_retries {
        if is_port_in_use(API_SERVER_PORT) {
            eprintln!("[ApiServer] API server ready on port {}", API_SERVER_PORT);
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
        if i % 10 == 0 {
            eprintln!("[ApiServer] Waiting for API server to start... ({}/{})", i, max_retries);
        }
    }

    eprintln!("[ApiServer] Warning: API server may not have started properly");
    Ok(())
}

/// Stop the API server process
pub async fn stop_api_server(state: SharedApiServerState) {
    let mut state = state.lock().await;

    if let Some(mut child) = state.process.take() {
        let pid = child.id();
        eprintln!("[ApiServer] Stopping API server (PID {})", pid);

        // Try graceful shutdown first
        #[cfg(unix)]
        {
            // Send SIGTERM
            unsafe {
                libc::kill(pid as i32, libc::SIGTERM);
            }
        }

        #[cfg(not(unix))]
        {
            let _ = child.kill();
        }

        // Wait a bit for graceful shutdown
        std::thread::sleep(Duration::from_millis(500));

        // Force kill if still running
        let _ = child.kill();
        let _ = child.wait();

        eprintln!("[ApiServer] API server stopped");
    }
}
