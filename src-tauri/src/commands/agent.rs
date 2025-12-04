use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader, Write};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex, RwLock};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message};
use thiserror::Error;
use tauri_plugin_notification::NotificationExt;
use uuid::Uuid;
use crate::utils::{find_claude_cli, get_enhanced_path};

#[derive(Error, Debug)]
pub enum AgentError {
    #[error("Connection error: {0}")]
    Connection(String),
    #[error("Agent not found: {0}")]
    NotFound(String),
    #[error("Send error: {0}")]
    SendError(String),
}

impl serde::Serialize for AgentError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentStatus {
    Disconnected,
    Connecting,
    Connected,
    Working,
    Idle,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentInfo {
    pub agent_id: String,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub progress: u8,
    pub last_activity: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    pub agent_id: String,
    pub output_type: String,  // "stdout", "stderr", "tool_call", "result"
    pub content: String,
    pub timestamp: i64,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsMessage {
    Connect { agent_id: String },
    Disconnect { agent_id: String },
    Prompt { agent_id: String, prompt: String, context: Vec<String> },
    Output { agent_id: String, output_type: String, content: String },
    Status { agent_id: String, status: AgentStatus, progress: u8 },
    Error { agent_id: String, error: String },
    Ping,
    Pong,
}

#[allow(dead_code)]
pub struct AgentConnection {
    pub agent_id: String,
    pub status: AgentStatus,
    pub sender: mpsc::Sender<WsMessage>,
}

pub struct AgentManager {
    connections: RwLock<HashMap<String, AgentConnection>>,
    api_url: String,
}

impl AgentManager {
    pub fn new(api_url: String) -> Self {
        Self {
            connections: RwLock::new(HashMap::new()),
            api_url,
        }
    }

    pub async fn connect(&self, agent_id: &str, app: AppHandle) -> Result<(), AgentError> {
        // Check if already connected
        {
            let connections = self.connections.read().await;
            if connections.contains_key(agent_id) {
                return Ok(());
            }
        }

        let ws_url = format!("{}/ws/agent/{}", self.api_url, agent_id);

        let (ws_stream, _) = connect_async(&ws_url)
            .await
            .map_err(|e| AgentError::Connection(e.to_string()))?;

        let (mut write, mut read) = ws_stream.split();
        let (tx, mut rx) = mpsc::channel::<WsMessage>(100);

        let agent_id_clone = agent_id.to_string();
        let app_clone = app.clone();

        // Spawn task to handle incoming messages
        let agent_id_read = agent_id.to_string();
        tokio::spawn(async move {
            while let Some(msg) = read.next().await {
                match msg {
                    Ok(Message::Text(text)) => {
                        if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                            match &ws_msg {
                                WsMessage::Output { agent_id, output_type, content } => {
                                    let output = AgentOutput {
                                        agent_id: agent_id.clone(),
                                        output_type: output_type.clone(),
                                        content: content.clone(),
                                        timestamp: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs() as i64,
                                    };
                                    let _ = app_clone.emit("agent-output", output);
                                }
                                WsMessage::Status { agent_id, status, progress } => {
                                    let info = AgentInfo {
                                        agent_id: agent_id.clone(),
                                        status: status.clone(),
                                        current_task: None,
                                        progress: *progress,
                                        last_activity: std::time::SystemTime::now()
                                            .duration_since(std::time::UNIX_EPOCH)
                                            .unwrap()
                                            .as_secs() as i64,
                                    };
                                    let _ = app_clone.emit("agent-status", info);
                                }
                                WsMessage::Error { agent_id, error } => {
                                    let _ = app_clone.emit("agent-error", serde_json::json!({
                                        "agent_id": agent_id,
                                        "error": error
                                    }));
                                }
                                WsMessage::Pong => {
                                    // Heartbeat response, do nothing
                                }
                                _ => {}
                            }
                        }
                    }
                    Ok(Message::Close(_)) => {
                        let _ = app_clone.emit("agent-disconnected", &agent_id_read);
                        break;
                    }
                    Err(e) => {
                        let _ = app_clone.emit("agent-error", serde_json::json!({
                            "agent_id": agent_id_read,
                            "error": e.to_string()
                        }));
                        break;
                    }
                    _ => {}
                }
            }
        });

        // Spawn task to handle outgoing messages
        tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if let Ok(text) = serde_json::to_string(&msg) {
                    if write.send(Message::Text(text.into())).await.is_err() {
                        break;
                    }
                }
            }
        });

        // Store connection
        {
            let mut connections = self.connections.write().await;
            connections.insert(
                agent_id_clone.clone(),
                AgentConnection {
                    agent_id: agent_id_clone,
                    status: AgentStatus::Connected,
                    sender: tx,
                },
            );
        }

        Ok(())
    }

    pub async fn disconnect(&self, agent_id: &str) -> Result<(), AgentError> {
        let mut connections = self.connections.write().await;
        if let Some(conn) = connections.remove(agent_id) {
            let _ = conn.sender.send(WsMessage::Disconnect {
                agent_id: agent_id.to_string(),
            }).await;
        }
        Ok(())
    }

    pub async fn send_prompt(&self, agent_id: &str, prompt: &str, context: Vec<String>) -> Result<(), AgentError> {
        let connections = self.connections.read().await;
        let conn = connections
            .get(agent_id)
            .ok_or_else(|| AgentError::NotFound(agent_id.to_string()))?;

        conn.sender
            .send(WsMessage::Prompt {
                agent_id: agent_id.to_string(),
                prompt: prompt.to_string(),
                context,
            })
            .await
            .map_err(|e| AgentError::SendError(e.to_string()))?;

        Ok(())
    }

    pub async fn get_status(&self, agent_id: &str) -> Option<AgentStatus> {
        let connections = self.connections.read().await;
        connections.get(agent_id).map(|c| c.status.clone())
    }

    pub async fn list_connected(&self) -> Vec<String> {
        let connections = self.connections.read().await;
        connections.keys().cloned().collect()
    }
}

// Global agent manager state
pub struct AgentManagerState(pub Arc<Mutex<Option<AgentManager>>>);

/// Initialize agent manager with API URL
#[tauri::command]
pub async fn init_agent_manager(
    api_url: String,
    state: tauri::State<'_, AgentManagerState>,
) -> Result<(), AgentError> {
    let mut manager = state.0.lock().await;
    *manager = Some(AgentManager::new(api_url));
    Ok(())
}

/// Connect to an agent
#[tauri::command]
pub async fn connect_agent(
    agent_id: String,
    app: AppHandle,
    state: tauri::State<'_, AgentManagerState>,
) -> Result<(), AgentError> {
    let manager = state.0.lock().await;
    let manager = manager
        .as_ref()
        .ok_or_else(|| AgentError::Connection("Agent manager not initialized".to_string()))?;

    manager.connect(&agent_id, app).await
}

/// Disconnect from an agent
#[tauri::command]
pub async fn disconnect_agent(
    agent_id: String,
    state: tauri::State<'_, AgentManagerState>,
) -> Result<(), AgentError> {
    let manager = state.0.lock().await;
    let manager = manager
        .as_ref()
        .ok_or_else(|| AgentError::Connection("Agent manager not initialized".to_string()))?;

    manager.disconnect(&agent_id).await
}

/// Send prompt to an agent
#[tauri::command]
pub async fn send_prompt(
    agent_id: String,
    prompt: String,
    context: Vec<String>,
    state: tauri::State<'_, AgentManagerState>,
) -> Result<(), AgentError> {
    let manager = state.0.lock().await;
    let manager = manager
        .as_ref()
        .ok_or_else(|| AgentError::Connection("Agent manager not initialized".to_string()))?;

    manager.send_prompt(&agent_id, &prompt, context).await
}

/// Get agent status
#[tauri::command]
pub async fn get_agent_status(
    agent_id: String,
    state: tauri::State<'_, AgentManagerState>,
) -> Result<Option<AgentStatus>, AgentError> {
    let manager = state.0.lock().await;
    let manager = manager
        .as_ref()
        .ok_or_else(|| AgentError::Connection("Agent manager not initialized".to_string()))?;

    Ok(manager.get_status(&agent_id).await)
}

/// List connected agents
#[tauri::command]
pub async fn list_connected_agents(
    state: tauri::State<'_, AgentManagerState>,
) -> Result<Vec<String>, AgentError> {
    let manager = state.0.lock().await;
    let manager = manager
        .as_ref()
        .ok_or_else(|| AgentError::Connection("Agent manager not initialized".to_string()))?;

    Ok(manager.list_connected().await)
}

// Background monitoring state
pub struct BackgroundMonitorState {
    pub running: AtomicBool,
    pub poll_interval_secs: u64,
}

impl Default for BackgroundMonitorState {
    fn default() -> Self {
        Self {
            running: AtomicBool::new(false),
            poll_interval_secs: 30,
        }
    }
}

pub struct BackgroundMonitorStateWrapper(pub Arc<Mutex<BackgroundMonitorState>>);

/// Start background agent monitoring
#[tauri::command]
pub async fn start_background_monitor(
    app: AppHandle,
    poll_interval_secs: Option<u64>,
    monitor_state: tauri::State<'_, BackgroundMonitorStateWrapper>,
    agent_state: tauri::State<'_, AgentManagerState>,
) -> Result<(), AgentError> {
    let monitor = monitor_state.0.lock().await;

    // Check if already running
    if monitor.running.load(Ordering::SeqCst) {
        return Ok(());
    }

    monitor.running.store(true, Ordering::SeqCst);
    let interval = poll_interval_secs.unwrap_or(monitor.poll_interval_secs);

    let running_flag = Arc::new(AtomicBool::new(true));
    let running_flag_clone = running_flag.clone();
    let app_clone = app.clone();
    let agent_state_inner = agent_state.0.clone();

    // Store previous statuses for change detection
    let prev_statuses: Arc<RwLock<HashMap<String, AgentStatus>>> = Arc::new(RwLock::new(HashMap::new()));

    // Spawn background monitoring task
    tokio::spawn(async move {
        let mut interval_timer = tokio::time::interval(tokio::time::Duration::from_secs(interval));

        while running_flag_clone.load(Ordering::SeqCst) {
            interval_timer.tick().await;

            // Get agent manager
            let manager_guard = agent_state_inner.lock().await;
            if let Some(manager) = manager_guard.as_ref() {
                let connected_agents = manager.list_connected().await;

                for agent_id in connected_agents {
                    if let Some(status) = manager.get_status(&agent_id).await {
                        let mut prev = prev_statuses.write().await;
                        let status_changed = prev.get(&agent_id).map(|s| {
                            std::mem::discriminant(s) != std::mem::discriminant(&status)
                        }).unwrap_or(true);

                        if status_changed {
                            // Emit status change event
                            let info = AgentInfo {
                                agent_id: agent_id.clone(),
                                status: status.clone(),
                                current_task: None,
                                progress: 0,
                                last_activity: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap()
                                    .as_secs() as i64,
                            };
                            let _ = app_clone.emit("agent-status-change", &info);

                            // Show notification for important status changes
                            match &status {
                                AgentStatus::Error => {
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Agent Error")
                                        .body(&format!("Agent {} encountered an error", agent_id))
                                        .show();
                                }
                                AgentStatus::Idle => {
                                    // Agent completed work
                                    if let Some(prev_status) = prev.get(&agent_id) {
                                        if matches!(prev_status, AgentStatus::Working) {
                                            let _ = app_clone.notification()
                                                .builder()
                                                .title("Task Completed")
                                                .body(&format!("Agent {} finished working", agent_id))
                                                .show();
                                        }
                                    }
                                }
                                AgentStatus::Disconnected => {
                                    let _ = app_clone.notification()
                                        .builder()
                                        .title("Agent Disconnected")
                                        .body(&format!("Agent {} disconnected", agent_id))
                                        .show();
                                }
                                _ => {}
                            }

                            prev.insert(agent_id, status);
                        }
                    }
                }
            }
            drop(manager_guard);
        }
    });

    Ok(())
}

/// Stop background agent monitoring
#[tauri::command]
pub async fn stop_background_monitor(
    monitor_state: tauri::State<'_, BackgroundMonitorStateWrapper>,
) -> Result<(), AgentError> {
    let monitor = monitor_state.0.lock().await;
    monitor.running.store(false, Ordering::SeqCst);
    Ok(())
}

/// Check if background monitor is running
#[tauri::command]
pub async fn is_background_monitor_running(
    monitor_state: tauri::State<'_, BackgroundMonitorStateWrapper>,
) -> Result<bool, AgentError> {
    let monitor = monitor_state.0.lock().await;
    Ok(monitor.running.load(Ordering::SeqCst))
}

// =============================================================================
// CLAUDE CLI SPAWNING (Direct Process Management)
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeSession {
    pub id: String,
    pub pid: u32,
    pub role: String,
    pub working_dir: String,
    pub status: ClaudeSessionStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ClaudeSessionStatus {
    Starting,
    Ready,
    Streaming,
    Stopped,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeChunk {
    pub session_id: String,
    pub content: String,
    pub is_complete: bool,
}

/// Manages Claude CLI sessions (spawned processes)
pub struct ClaudeSessionManager {
    sessions: RwLock<HashMap<String, ClaudeSessionData>>,
}

struct ClaudeSessionData {
    pid: u32,
    stdin_tx: mpsc::Sender<String>,
    status: ClaudeSessionStatus,
    role: String,
    working_dir: String,
}

impl ClaudeSessionManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
        }
    }
}

impl Default for ClaudeSessionManager {
    fn default() -> Self {
        Self::new()
    }
}

pub struct ClaudeSessionManagerState(pub Arc<Mutex<ClaudeSessionManager>>);

/// Spawn a new Claude CLI session
#[tauri::command]
pub async fn spawn_claude_session(
    role: String,
    working_dir: String,
    app: AppHandle,
    state: tauri::State<'_, ClaudeSessionManagerState>,
) -> Result<ClaudeSession, AgentError> {
    let session_id = Uuid::new_v4().to_string();

    // Find Claude CLI path (GUI apps don't inherit shell PATH)
    let claude_path = find_claude_cli()
        .ok_or_else(|| AgentError::Connection("Claude CLI not found. Please install it via: npm install -g @anthropic-ai/claude-code".to_string()))?;

    // Spawn Claude CLI process with enhanced PATH
    let mut child = Command::new(&claude_path)
        .args(["--print", "--dangerously-skip-permissions"])
        .current_dir(&working_dir)
        .env("PATH", get_enhanced_path())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| AgentError::Connection(format!("Failed to spawn Claude CLI at {:?}: {}", claude_path, e)))?;

    let pid = child.id();
    let stdout = child.stdout.take()
        .ok_or_else(|| AgentError::Connection("Failed to capture stdout".to_string()))?;
    let stderr = child.stderr.take()
        .ok_or_else(|| AgentError::Connection("Failed to capture stderr".to_string()))?;
    let mut stdin = child.stdin.take()
        .ok_or_else(|| AgentError::Connection("Failed to capture stdin".to_string()))?;

    // Create channel for stdin messages
    let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(100);

    // Spawn task to handle stdin
    tokio::spawn(async move {
        while let Some(msg) = stdin_rx.recv().await {
            if let Err(e) = writeln!(stdin, "{}", msg) {
                eprintln!("Failed to write to stdin: {}", e);
                break;
            }
            if stdin.flush().is_err() {
                break;
            }
        }
    });

    // Spawn task to stream stdout
    let app_stdout = app.clone();
    let sid_stdout = session_id.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            match line {
                Ok(content) => {
                    let chunk = ClaudeChunk {
                        session_id: sid_stdout.clone(),
                        content,
                        is_complete: false,
                    };
                    let _ = app_stdout.emit("claude-chunk", &chunk);
                }
                Err(_) => break,
            }
        }
        // Emit completion event
        let chunk = ClaudeChunk {
            session_id: sid_stdout.clone(),
            content: String::new(),
            is_complete: true,
        };
        let _ = app_stdout.emit("claude-complete", &chunk);
    });

    // Spawn task to stream stderr
    let app_stderr = app.clone();
    let sid_stderr = session_id.clone();
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            if let Ok(content) = line {
                let _ = app_stderr.emit("claude-error", serde_json::json!({
                    "session_id": sid_stderr,
                    "error": content
                }));
            }
        }
    });

    // Store session
    {
        let manager = state.0.lock().await;
        let mut sessions = manager.sessions.write().await;
        sessions.insert(session_id.clone(), ClaudeSessionData {
            pid,
            stdin_tx,
            status: ClaudeSessionStatus::Ready,
            role: role.clone(),
            working_dir: working_dir.clone(),
        });
    }

    Ok(ClaudeSession {
        id: session_id,
        pid,
        role,
        working_dir,
        status: ClaudeSessionStatus::Ready,
    })
}

/// Send message to a Claude CLI session
#[tauri::command]
pub async fn send_to_claude_session(
    session_id: String,
    message: String,
    state: tauri::State<'_, ClaudeSessionManagerState>,
) -> Result<(), AgentError> {
    let manager = state.0.lock().await;
    let sessions = manager.sessions.read().await;

    let session = sessions.get(&session_id)
        .ok_or_else(|| AgentError::NotFound(session_id.clone()))?;

    session.stdin_tx.send(message).await
        .map_err(|e| AgentError::SendError(e.to_string()))?;

    Ok(())
}

/// Stop a Claude CLI session
#[tauri::command]
pub async fn stop_claude_session(
    session_id: String,
    state: tauri::State<'_, ClaudeSessionManagerState>,
) -> Result<(), AgentError> {
    let manager = state.0.lock().await;
    let mut sessions = manager.sessions.write().await;

    if let Some(session) = sessions.remove(&session_id) {
        // Kill the process
        #[cfg(unix)]
        {
            unsafe {
                libc::kill(session.pid as i32, libc::SIGTERM);
            }
        }
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &session.pid.to_string(), "/F"])
                .output();
        }
    }

    Ok(())
}

/// Get Claude session status
#[tauri::command]
pub async fn get_claude_session(
    session_id: String,
    state: tauri::State<'_, ClaudeSessionManagerState>,
) -> Result<Option<ClaudeSession>, AgentError> {
    let manager = state.0.lock().await;
    let sessions = manager.sessions.read().await;

    Ok(sessions.get(&session_id).map(|s| ClaudeSession {
        id: session_id,
        pid: s.pid,
        role: s.role.clone(),
        working_dir: s.working_dir.clone(),
        status: s.status.clone(),
    }))
}

/// List all Claude CLI sessions
#[tauri::command]
pub async fn list_claude_sessions(
    state: tauri::State<'_, ClaudeSessionManagerState>,
) -> Result<Vec<ClaudeSession>, AgentError> {
    let manager = state.0.lock().await;
    let sessions = manager.sessions.read().await;

    Ok(sessions.iter().map(|(id, s)| ClaudeSession {
        id: id.clone(),
        pid: s.pid,
        role: s.role.clone(),
        working_dir: s.working_dir.clone(),
        status: s.status.clone(),
    }).collect())
}
