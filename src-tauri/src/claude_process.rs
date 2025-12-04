//! Claude Process Manager
//!
//! Manages Claude CLI processes with structured JSON output parsing.
//! Supports both one-shot mode (-p) and persistent streaming mode.
//!
//! Persistent sessions:
//! - Spawn with --input-format stream-json --output-format stream-json
//! - Keep stdin open for multi-turn conversations
//! - Send input as NDJSON: {"type":"user","message":{"role":"user","content":"..."}}

#![allow(dead_code)]

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{broadcast, mpsc, RwLock};
use uuid::Uuid;

use crate::utils::{find_claude_cli, get_enhanced_path};

/// Claude event types from stream-json output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClaudeEvent {
    /// System information at start
    System {
        #[serde(default)]
        subtype: Option<String>,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        tools: Option<Vec<String>>,
        #[serde(default)]
        mcp_servers: Option<Vec<serde_json::Value>>,
    },

    /// Assistant message content
    #[serde(rename = "assistant")]
    Assistant {
        #[serde(default)]
        message: Option<AssistantMessage>,
        #[serde(default)]
        session_id: Option<String>,
    },

    /// User message (usually prompts)
    #[serde(rename = "user")]
    User {
        #[serde(default)]
        message: Option<UserMessage>,
        #[serde(default)]
        session_id: Option<String>,
    },

    /// Tool use request
    #[serde(rename = "tool_use")]
    ToolUse {
        tool: String,
        #[serde(default)]
        input: Option<serde_json::Value>,
        #[serde(default)]
        tool_use_id: Option<String>,
    },

    /// Tool result
    #[serde(rename = "tool_result")]
    ToolResult {
        #[serde(default)]
        tool_use_id: Option<String>,
        #[serde(default)]
        output: Option<String>,
        #[serde(default)]
        is_error: Option<bool>,
    },

    /// Final result
    #[serde(rename = "result")]
    Result {
        #[serde(default)]
        subtype: Option<String>,
        #[serde(default)]
        result: Option<String>,
        #[serde(default)]
        session_id: Option<String>,
        #[serde(default)]
        is_error: Option<bool>,
        #[serde(default)]
        duration_ms: Option<u64>,
        #[serde(default)]
        duration_api_ms: Option<u64>,
        #[serde(default)]
        cost_usd: Option<f64>,
        #[serde(default)]
        num_turns: Option<u32>,
    },

    /// Error from Claude
    #[serde(rename = "error")]
    Error {
        #[serde(default)]
        error: Option<ErrorInfo>,
    },

    /// Unknown event type (catch-all)
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    #[serde(default)]
    pub content: Option<Vec<ContentBlock>>,
    #[serde(default)]
    pub model: Option<String>,
}

/// User message content can be either:
/// - A string (for slash command output like /context, /cost)
/// - An array of ContentBlock (for regular user input)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum UserMessageContent {
    /// Slash command output - content is a raw string wrapped in <local-command-stdout>
    String(String),
    /// Regular user input - content is an array of content blocks
    Array(Vec<ContentBlock>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserMessage {
    #[serde(default)]
    pub content: Option<UserMessageContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    ToolUse {
        id: String,
        name: String,
        input: serde_json::Value,
    },
    ToolResult {
        tool_use_id: String,
        content: serde_json::Value,
    },
    #[serde(rename = "thinking")]
    Thinking {
        thinking: String,
    },
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorInfo {
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub code: Option<String>,
}

/// Claude process status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProcessStatus {
    Starting,
    Ready,
    Processing,
    Streaming,
    Completed,
    Error,
    Terminated,
}

/// Information about a Claude process
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeProcessInfo {
    pub id: String,
    pub session_id: Option<String>,
    pub role: String,
    pub working_dir: String,
    pub status: ProcessStatus,
    pub pid: u32,
    pub created_at: String,
}

/// Internal process data (for one-shot mode - legacy)
struct ProcessData {
    pid: u32,
    session_id: Option<String>,
    role: String,
    working_dir: String,
    status: ProcessStatus,
    #[allow(dead_code)]
    stdin_tx: Option<mpsc::Sender<String>>,
    #[allow(dead_code)]
    event_tx: broadcast::Sender<ClaudeEvent>,
    created_at: chrono::DateTime<chrono::Utc>,
}

/// Persistent session data (for multi-turn conversations)
/// Keeps stdin open to send multiple messages to the same Claude process
struct PersistentSession {
    /// Process ID assigned by us (UUID)
    id: String,
    /// Claude's session ID (from system.init event)
    claude_session_id: Option<String>,
    /// Process ID from OS
    pid: u32,
    /// Agent role
    role: String,
    /// Working directory
    working_dir: String,
    /// Current status
    status: ProcessStatus,
    /// Sender to write to stdin - we send commands through this channel
    stdin_tx: mpsc::Sender<String>,
    /// Event broadcaster for internal subscribers
    event_tx: broadcast::Sender<ClaudeEvent>,
    /// When was this session created
    created_at: chrono::DateTime<chrono::Utc>,
}

/// Claude Process Manager
pub struct ClaudeProcessManager {
    /// Legacy one-shot processes
    processes: RwLock<HashMap<String, ProcessData>>,
    /// Persistent sessions for multi-turn conversations
    sessions: RwLock<HashMap<String, PersistentSession>>,
}

impl ClaudeProcessManager {
    pub fn new() -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            sessions: RwLock::new(HashMap::new()),
        }
    }

    /// Spawn a new Claude process with stream-json output
    pub async fn spawn(
        &self,
        role: String,
        working_dir: String,
        prompt: Option<String>,
        session_id: Option<String>,
        max_turns: Option<u32>,
        app: AppHandle,
    ) -> Result<ClaudeProcessInfo, String> {
        let process_id = Uuid::new_v4().to_string();

        // Build command arguments
        // Note: --verbose is required when using -p with --output-format stream-json
        // --dangerously-skip-permissions auto-accepts tool permissions for agent terminals
        let mut args = vec![
            "-p".to_string(),
            prompt.clone().unwrap_or_else(|| "Hello".to_string()),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--dangerously-skip-permissions".to_string(),
        ];

        // Add session-id if provided or resuming
        if let Some(sid) = &session_id {
            args.push("--resume".to_string());
            args.push(sid.clone());
        }

        // Add max-turns if specified
        if let Some(turns) = max_turns {
            args.push("--max-turns".to_string());
            args.push(turns.to_string());
        }

        // Find Claude CLI path (GUI apps don't inherit shell PATH)
        let claude_path = find_claude_cli()
            .ok_or_else(|| "Claude CLI not found. Please install it via: npm install -g @anthropic-ai/claude-code".to_string())?;

        // Spawn the process with enhanced PATH
        let mut child = Command::new(&claude_path)
            .args(&args)
            .current_dir(&working_dir)
            .env("PATH", get_enhanced_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Claude CLI at {:?}: {}", claude_path, e))?;

        let pid = child.id();
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to capture stderr".to_string())?;

        // Create broadcast channel for events
        let (event_tx, _) = broadcast::channel(256);
        let event_tx_clone = event_tx.clone();

        // Store process data
        let process_data = ProcessData {
            pid,
            session_id: session_id.clone(),
            role: role.clone(),
            working_dir: working_dir.clone(),
            status: ProcessStatus::Starting,
            stdin_tx: None, // We use -p mode, no stdin needed
            event_tx,
            created_at: chrono::Utc::now(),
        };

        {
            let mut processes = self.processes.write().await;
            processes.insert(process_id.clone(), process_data);
        }

        // Spawn stdout parser task
        let app_stdout = app.clone();
        let pid_stdout = process_id.clone();
        let event_tx_stdout = event_tx_clone.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(json_line) => {
                        if json_line.trim().is_empty() {
                            continue;
                        }
                        // Parse NDJSON line
                        match serde_json::from_str::<ClaudeEvent>(&json_line) {
                            Ok(event) => {
                                // Broadcast event internally
                                let _ = event_tx_stdout.send(event.clone());

                                // Emit to frontend
                                let _ = app_stdout.emit(
                                    "claude-event",
                                    serde_json::json!({
                                        "process_id": pid_stdout,
                                        "event": event
                                    }),
                                );
                            }
                            Err(e) => {
                                // Emit parse error but continue
                                let _ = app_stdout.emit(
                                    "claude-parse-error",
                                    serde_json::json!({
                                        "process_id": pid_stdout,
                                        "line": json_line,
                                        "error": e.to_string()
                                    }),
                                );
                            }
                        }
                    }
                    Err(_) => break,
                }
            }

            // Emit process completion
            let _ = app_stdout.emit(
                "claude-process-complete",
                serde_json::json!({
                    "process_id": pid_stdout
                }),
            );
        });

        // Spawn stderr reader task
        let app_stderr = app.clone();
        let pid_stderr = process_id.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(content) = line {
                    let _ = app_stderr.emit(
                        "claude-stderr",
                        serde_json::json!({
                            "process_id": pid_stderr,
                            "content": content
                        }),
                    );
                }
            }
        });

        // Update status to Ready
        {
            let mut processes = self.processes.write().await;
            if let Some(p) = processes.get_mut(&process_id) {
                p.status = ProcessStatus::Ready;
            }
        }

        Ok(ClaudeProcessInfo {
            id: process_id,
            session_id,
            role,
            working_dir,
            status: ProcessStatus::Ready,
            pid,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Get process info by ID
    pub async fn get(&self, process_id: &str) -> Option<ClaudeProcessInfo> {
        let processes = self.processes.read().await;
        processes.get(process_id).map(|p| ClaudeProcessInfo {
            id: process_id.to_string(),
            session_id: p.session_id.clone(),
            role: p.role.clone(),
            working_dir: p.working_dir.clone(),
            status: p.status.clone(),
            pid: p.pid,
            created_at: p.created_at.to_rfc3339(),
        })
    }

    /// List all processes
    pub async fn list(&self) -> Vec<ClaudeProcessInfo> {
        let processes = self.processes.read().await;
        processes
            .iter()
            .map(|(id, p)| ClaudeProcessInfo {
                id: id.clone(),
                session_id: p.session_id.clone(),
                role: p.role.clone(),
                working_dir: p.working_dir.clone(),
                status: p.status.clone(),
                pid: p.pid,
                created_at: p.created_at.to_rfc3339(),
            })
            .collect()
    }

    /// Terminate a process
    pub async fn terminate(&self, process_id: &str) -> Result<(), String> {
        let mut processes = self.processes.write().await;

        if let Some(process) = processes.remove(process_id) {
            #[cfg(unix)]
            {
                unsafe {
                    libc::kill(process.pid as i32, libc::SIGTERM);
                }
            }
            #[cfg(windows)]
            {
                let _ = Command::new("taskkill")
                    .args(["/PID", &process.pid.to_string(), "/F"])
                    .output();
            }
            Ok(())
        } else {
            Err(format!("Process {} not found", process_id))
        }
    }

    /// Update process status
    pub async fn update_status(&self, process_id: &str, status: ProcessStatus) {
        let mut processes = self.processes.write().await;
        if let Some(p) = processes.get_mut(process_id) {
            p.status = status;
        }
    }

    // =========================================================================
    // Persistent Session Methods (for multi-turn conversations)
    // =========================================================================

    /// Spawn a persistent Claude session
    /// Uses --input-format stream-json --output-format stream-json
    /// Keeps stdin open for subsequent messages
    /// If resume_session_id is provided, uses --resume to continue a previous conversation
    pub async fn spawn_session(
        &self,
        role: String,
        working_dir: String,
        initial_prompt: Option<String>,
        terminal_id: Option<String>,
        resume_session_id: Option<String>,
        app: AppHandle,
    ) -> Result<ClaudeProcessInfo, String> {
        let session_id = Uuid::new_v4().to_string();
        let terminal_id_for_events = terminal_id.clone();

        // Build command for persistent streaming mode
        let mut args = vec![
            "--input-format".to_string(),
            "stream-json".to_string(),
            "--output-format".to_string(),
            "stream-json".to_string(),
            "--verbose".to_string(),
            "--dangerously-skip-permissions".to_string(),
        ];

        // Add --resume flag if resuming a previous session
        if let Some(ref resume_id) = resume_session_id {
            println!("[ClaudeProcess] Resuming session: {}", resume_id);
            args.push("--resume".to_string());
            args.push(resume_id.clone());
        }

        // Check for .mcp.json in working directory and add --mcp-config if found
        let mcp_config_path = std::path::Path::new(&working_dir).join(".mcp.json");
        if mcp_config_path.exists() {
            println!("[ClaudeProcess] Found MCP config at: {:?}", mcp_config_path);
            args.push("--mcp-config".to_string());
            args.push(mcp_config_path.to_string_lossy().to_string());
        } else {
            println!("[ClaudeProcess] No .mcp.json found in working directory: {}", working_dir);
        }

        // Find Claude CLI path (GUI apps don't inherit shell PATH)
        let claude_path = find_claude_cli()
            .ok_or_else(|| "Claude CLI not found. Please install it via: npm install -g @anthropic-ai/claude-code".to_string())?;

        println!("[ClaudeProcess] Spawning Claude at {:?} with args: {:?}", claude_path, args);

        // Spawn the process with stdin kept open and enhanced PATH
        let mut child = Command::new(&claude_path)
            .args(&args)
            .current_dir(&working_dir)
            .env("PATH", get_enhanced_path())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to spawn Claude CLI at {:?}: {}", claude_path, e))?;

        let pid = child.id();
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Failed to capture stdin".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to capture stderr".to_string())?;

        // Create channel for stdin communication
        let (stdin_tx, mut stdin_rx) = mpsc::channel::<String>(32);
        // Create broadcast channel for events
        let (event_tx, _) = broadcast::channel(256);
        let event_tx_clone = event_tx.clone();

        // Spawn stdin writer thread
        std::thread::spawn(move || {
            let mut stdin = stdin;
            while let Some(input) = stdin_rx.blocking_recv() {
                if let Err(e) = writeln!(stdin, "{}", input) {
                    eprintln!("[ClaudeSession] Failed to write to stdin: {}", e);
                    break;
                }
                if let Err(e) = stdin.flush() {
                    eprintln!("[ClaudeSession] Failed to flush stdin: {}", e);
                    break;
                }
            }
            // When channel is closed, stdin is dropped, sending EOF to Claude
        });

        // Clone session_id for use in closures
        let session_id_for_stdout = session_id.clone();
        let terminal_id_for_stdout = terminal_id_for_events.clone();

        // Create Arc for sharing sessions map reference
        // We'll update claude_session_id when we receive system.init event
        let sessions_arc = Arc::new(RwLock::new(None::<String>));
        let sessions_arc_clone = sessions_arc.clone();

        // Spawn stdout parser task
        let app_stdout = app.clone();
        let event_tx_stdout = event_tx_clone.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(json_line) => {
                        if json_line.trim().is_empty() {
                            continue;
                        }
                        // Parse NDJSON line
                        match serde_json::from_str::<ClaudeEvent>(&json_line) {
                            Ok(event) => {
                                // Extract Claude's session_id from system.init event
                                if let ClaudeEvent::System { session_id: Some(ref sid), ref subtype, .. } = event {
                                    if subtype.as_deref() == Some("init") {
                                        // Store the Claude session ID
                                        let sid_owned = sid.clone();
                                        let rt = tokio::runtime::Handle::try_current();
                                        if let Ok(handle) = rt {
                                            let arc = sessions_arc_clone.clone();
                                            handle.spawn(async move {
                                                let mut guard = arc.write().await;
                                                *guard = Some(sid_owned);
                                            });
                                        }
                                    }
                                }

                                // Broadcast event internally
                                let _ = event_tx_stdout.send(event.clone());

                                // Emit to frontend with terminal_id for routing
                                let _ = app_stdout.emit(
                                    "claude-event",
                                    serde_json::json!({
                                        "process_id": session_id_for_stdout,
                                        "terminal_id": terminal_id_for_stdout,
                                        "event": event
                                    }),
                                );
                            }
                            Err(e) => {
                                // Emit parse error but continue
                                let _ = app_stdout.emit(
                                    "claude-parse-error",
                                    serde_json::json!({
                                        "process_id": session_id_for_stdout,
                                        "terminal_id": terminal_id_for_stdout,
                                        "line": json_line,
                                        "error": e.to_string()
                                    }),
                                );
                            }
                        }
                    }
                    Err(_) => break,
                }
            }

            // Emit session completion
            let _ = app_stdout.emit(
                "claude-process-complete",
                serde_json::json!({
                    "process_id": session_id_for_stdout,
                    "terminal_id": terminal_id_for_stdout
                }),
            );
        });

        // Spawn stderr reader task
        let app_stderr = app.clone();
        let session_id_for_stderr = session_id.clone();
        let terminal_id_for_stderr = terminal_id_for_events.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(content) = line {
                    let _ = app_stderr.emit(
                        "claude-stderr",
                        serde_json::json!({
                            "process_id": session_id_for_stderr,
                            "terminal_id": terminal_id_for_stderr,
                            "content": content
                        }),
                    );
                }
            }
        });

        // Store session data
        let session_data = PersistentSession {
            id: session_id.clone(),
            claude_session_id: None, // Will be set when we receive system.init
            pid,
            role: role.clone(),
            working_dir: working_dir.clone(),
            status: ProcessStatus::Ready,
            stdin_tx: stdin_tx.clone(),
            event_tx,
            created_at: chrono::Utc::now(),
        };

        {
            let mut sessions = self.sessions.write().await;
            sessions.insert(session_id.clone(), session_data);
        }

        // If initial prompt is provided, send it immediately
        if let Some(prompt) = initial_prompt {
            self.send_input(&session_id, &prompt).await?;
        }

        Ok(ClaudeProcessInfo {
            id: session_id,
            session_id: None, // Claude's session_id will be available after first response
            role,
            working_dir,
            status: ProcessStatus::Ready,
            pid,
            created_at: chrono::Utc::now().to_rfc3339(),
        })
    }

    /// Send input to a persistent session
    /// Formats as NDJSON: {"type":"user","message":{"role":"user","content":"..."}}
    pub async fn send_input(&self, session_id: &str, input: &str) -> Result<(), String> {
        let sessions = self.sessions.read().await;

        if let Some(session) = sessions.get(session_id) {
            // Format as Claude expects
            let json_input = serde_json::json!({
                "type": "user",
                "message": {
                    "role": "user",
                    "content": input
                }
            });

            let json_str = serde_json::to_string(&json_input)
                .map_err(|e| format!("Failed to serialize input: {}", e))?;

            session.stdin_tx.send(json_str).await
                .map_err(|e| format!("Failed to send to session stdin: {}", e))?;

            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    /// Check if a session exists and is active
    pub async fn has_session(&self, session_id: &str) -> bool {
        let sessions = self.sessions.read().await;
        sessions.contains_key(session_id)
    }

    /// Get session info by ID
    pub async fn get_session(&self, session_id: &str) -> Option<ClaudeProcessInfo> {
        let sessions = self.sessions.read().await;
        sessions.get(session_id).map(|s| ClaudeProcessInfo {
            id: s.id.clone(),
            session_id: s.claude_session_id.clone(),
            role: s.role.clone(),
            working_dir: s.working_dir.clone(),
            status: s.status.clone(),
            pid: s.pid,
            created_at: s.created_at.to_rfc3339(),
        })
    }

    /// List all persistent sessions
    pub async fn list_sessions(&self) -> Vec<ClaudeProcessInfo> {
        let sessions = self.sessions.read().await;
        sessions
            .iter()
            .map(|(_, s)| ClaudeProcessInfo {
                id: s.id.clone(),
                session_id: s.claude_session_id.clone(),
                role: s.role.clone(),
                working_dir: s.working_dir.clone(),
                status: s.status.clone(),
                pid: s.pid,
                created_at: s.created_at.to_rfc3339(),
            })
            .collect()
    }

    /// Terminate a persistent session
    /// Drops stdin (sends EOF) then kills the process
    pub async fn terminate_session(&self, session_id: &str) -> Result<(), String> {
        let mut sessions = self.sessions.write().await;

        if let Some(session) = sessions.remove(session_id) {
            // Dropping stdin_tx closes the channel, which closes stdin, sending EOF
            drop(session.stdin_tx);

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
            Ok(())
        } else {
            Err(format!("Session {} not found", session_id))
        }
    }

    /// Update session status
    pub async fn update_session_status(&self, session_id: &str, status: ProcessStatus) {
        let mut sessions = self.sessions.write().await;
        if let Some(s) = sessions.get_mut(session_id) {
            s.status = status;
        }
    }

    /// Set Claude's session ID (called after receiving system.init event)
    pub async fn set_claude_session_id(&self, our_session_id: &str, claude_session_id: String) {
        let mut sessions = self.sessions.write().await;
        if let Some(s) = sessions.get_mut(our_session_id) {
            s.claude_session_id = Some(claude_session_id);
        }
    }

    /// Subscribe to process events
    #[allow(dead_code)]
    pub async fn subscribe(&self, process_id: &str) -> Option<broadcast::Receiver<ClaudeEvent>> {
        let processes = self.processes.read().await;
        processes.get(process_id).map(|p| p.event_tx.subscribe())
    }
}

impl Default for ClaudeProcessManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Shared state for Tauri
pub type SharedClaudeProcessManager = Arc<tokio::sync::Mutex<ClaudeProcessManager>>;

pub fn create_process_manager() -> SharedClaudeProcessManager {
    Arc::new(tokio::sync::Mutex::new(ClaudeProcessManager::new()))
}

// ============================================================================
// MCP Output Formatting
// ============================================================================

/// Format a Claude event as readable text for MCP tools
/// This allows orchestrator agents to read Claude output via terminal_read
fn format_event_for_mcp(event: &ClaudeEvent) -> String {
    match event {
        ClaudeEvent::System { subtype, session_id, .. } => {
            format!("[SYSTEM] {} (session: {})\n",
                subtype.as_deref().unwrap_or("init"),
                session_id.as_deref().unwrap_or("unknown"))
        }
        ClaudeEvent::User { message, .. } => {
            if let Some(msg) = message {
                if let Some(ref content) = msg.content {
                    match content {
                        UserMessageContent::String(text) => {
                            return format!("[USER] {}\n", text);
                        }
                        UserMessageContent::Array(blocks) => {
                            for c in blocks {
                                if let ContentBlock::Text { text } = c {
                                    return format!("[USER] {}\n", text);
                                }
                            }
                        }
                    }
                }
            }
            String::new()
        }
        ClaudeEvent::Assistant { message, .. } => {
            let mut output = String::new();
            if let Some(msg) = message {
                if let Some(ref content) = msg.content {
                    for c in content {
                        match c {
                            ContentBlock::Text { text } => {
                                output.push_str(&format!("[ASSISTANT] {}\n", text));
                            }
                            ContentBlock::Thinking { thinking } => {
                                let truncated = if thinking.len() > 200 {
                                    &thinking[..200]
                                } else {
                                    thinking
                                };
                                output.push_str(&format!("[THINKING] {}...\n", truncated));
                            }
                            _ => {}
                        }
                    }
                }
            }
            output
        }
        ClaudeEvent::ToolUse { tool, input, .. } => {
            let input_str = serde_json::to_string(input).unwrap_or_default();
            let truncated = if input_str.len() > 200 {
                &input_str[..200]
            } else {
                &input_str
            };
            format!("[TOOL_USE] {} - {}\n", tool, truncated)
        }
        ClaudeEvent::ToolResult { tool_use_id, output, is_error, .. } => {
            let status = if *is_error.as_ref().unwrap_or(&false) { "ERROR" } else { "OK" };
            let out = output.as_deref().unwrap_or("");
            let truncated = if out.len() > 200 { &out[..200] } else { out };
            format!("[TOOL_RESULT:{}] {} - {}\n",
                status,
                tool_use_id.as_deref().unwrap_or(""),
                truncated)
        }
        ClaudeEvent::Result { result, cost_usd, duration_ms, .. } => {
            format!("[RESULT] {} (cost: ${:.4}, duration: {}ms)\n",
                result.as_deref().unwrap_or("completed"),
                cost_usd.unwrap_or(0.0),
                duration_ms.unwrap_or(0))
        }
        ClaudeEvent::Error { error, .. } => {
            let msg = error.as_ref()
                .and_then(|e| e.message.as_deref())
                .unwrap_or("Unknown error");
            format!("[ERROR] {}\n", msg)
        }
        _ => String::new(),
    }
}

// ============================================================================
// Session History Loading
// ============================================================================

/// Convert working directory to Claude's project hash format
/// Claude uses path with dashes: /Users/foo/bar -> -Users-foo-bar
fn working_dir_to_claude_project_hash(working_dir: &str) -> String {
    working_dir.replace('/', "-")
}

/// Load historical events from Claude's session file
/// Returns parsed events from the .jsonl file
pub fn load_session_history(working_dir: &str, claude_session_id: &str) -> Result<Vec<serde_json::Value>, String> {
    let project_hash = working_dir_to_claude_project_hash(working_dir);
    let claude_sessions_dir = dirs::home_dir()
        .ok_or("Could not find home directory")?
        .join(".claude")
        .join("projects")
        .join(&project_hash);

    let session_file = claude_sessions_dir.join(format!("{}.jsonl", claude_session_id));

    if !session_file.exists() {
        return Err(format!("Session file not found: {:?}", session_file));
    }

    println!("[ClaudeProcess] Loading session history from: {:?}", session_file);

    let file = std::fs::File::open(&session_file)
        .map_err(|e| format!("Failed to open session file: {}", e))?;

    let reader = BufReader::new(file);
    let mut events = Vec::new();

    for line in reader.lines() {
        let line = line.map_err(|e| format!("Failed to read line: {}", e))?;
        if line.trim().is_empty() {
            continue;
        }

        match serde_json::from_str::<serde_json::Value>(&line) {
            Ok(event) => {
                // Only include user, assistant, tool_use, tool_result events
                // Skip queue-operation and other internal events
                if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
                    match event_type {
                        "user" | "assistant" | "tool_use" | "tool_result" | "result" => {
                            events.push(event);
                        }
                        _ => {
                            // Skip other event types
                        }
                    }
                }
            }
            Err(e) => {
                // Log but don't fail on parse errors
                eprintln!("[ClaudeProcess] Failed to parse event: {} - line: {}", e, &line[..line.len().min(100)]);
            }
        }
    }

    println!("[ClaudeProcess] Loaded {} history events", events.len());
    Ok(events)
}

/// Tauri command to load session history
#[tauri::command]
pub fn claude_load_session_history(
    working_dir: String,
    claude_session_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    load_session_history(&working_dir, &claude_session_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_system_event() {
        let json = r#"{"type":"system","subtype":"init","session_id":"abc123","tools":["Read","Write"]}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        match event {
            ClaudeEvent::System { session_id, tools, .. } => {
                assert_eq!(session_id, Some("abc123".to_string()));
                assert!(tools.is_some());
            }
            _ => panic!("Expected System event"),
        }
    }

    #[test]
    fn test_parse_assistant_event() {
        let json = r#"{"type":"assistant","message":{"content":[{"type":"text","text":"Hello!"}]}}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        match event {
            ClaudeEvent::Assistant { message, .. } => {
                assert!(message.is_some());
                let msg = message.unwrap();
                assert!(msg.content.is_some());
            }
            _ => panic!("Expected Assistant event"),
        }
    }

    #[test]
    fn test_parse_tool_use_event() {
        let json = r#"{"type":"tool_use","tool":"Read","input":{"file_path":"/test.txt"},"tool_use_id":"tool123"}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        match event {
            ClaudeEvent::ToolUse { tool, tool_use_id, .. } => {
                assert_eq!(tool, "Read");
                assert_eq!(tool_use_id, Some("tool123".to_string()));
            }
            _ => panic!("Expected ToolUse event"),
        }
    }

    #[test]
    fn test_parse_result_event() {
        let json = r#"{"type":"result","subtype":"success","result":"Done!","cost_usd":0.05,"duration_ms":1234}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        match event {
            ClaudeEvent::Result { result, cost_usd, duration_ms, .. } => {
                assert_eq!(result, Some("Done!".to_string()));
                assert_eq!(cost_usd, Some(0.05));
                assert_eq!(duration_ms, Some(1234));
            }
            _ => panic!("Expected Result event"),
        }
    }

    #[test]
    fn test_parse_unknown_event() {
        let json = r#"{"type":"future_event_type","data":"something"}"#;
        let event: ClaudeEvent = serde_json::from_str(json).unwrap();
        assert!(matches!(event, ClaudeEvent::Unknown));
    }
}
