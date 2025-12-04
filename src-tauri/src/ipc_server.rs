use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, RwLock};
use tokio_tungstenite::{accept_async, tungstenite::Message};

const IPC_PORT: u16 = 17432;

/// Group chat message structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupChatMessage {
    pub from_role: String,
    pub from_id: String,
    pub content: String,
    pub mentions: Vec<String>,
    pub timestamp: String,
    /// Optional reply_to field - specifies who should receive responses
    /// Used to prevent message injection back to sender
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
}

/// IPC Request from MCP tools
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "method", content = "params")]
pub enum IpcRequest {
    #[serde(rename = "groupchat.send")]
    GroupChatSend {
        from_role: String,
        from_id: String,
        content: String,
        /// Optional reply_to - specifies who should receive responses (e.g., "@orchestrator")
        /// If set, message will not be injected back to sender even if mentioned
        reply_to: Option<String>,
    },

    #[serde(rename = "groupchat.history")]
    GroupChatHistory {
        limit: Option<usize>,
    },

    #[serde(rename = "agent.healthCheck")]
    AgentHealthCheck {
        from_role: String,
        from_id: String,
    },

    #[serde(rename = "agent.getPending")]
    AgentGetPending {
        role: String,
    },

    #[serde(rename = "session.save")]
    SessionSave {
        project_path: String,
        roles: std::collections::HashMap<String, crate::session::SessionInfo>,
    },

    #[serde(rename = "session.load")]
    SessionLoad,

    #[serde(rename = "session.clear")]
    SessionClear,

    #[serde(rename = "ping")]
    Ping,
}

/// IPC Response to MCP tools
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "status")]
pub enum IpcResponse {
    #[serde(rename = "success")]
    Success { data: serde_json::Value },

    #[serde(rename = "error")]
    Error { message: String, code: Option<String> },
}

/// IPC Message envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcMessage {
    pub id: String,
    #[serde(flatten)]
    pub request: IpcRequest,
}

/// IPC Response envelope
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcResponseMessage {
    pub id: String,
    #[serde(flatten)]
    pub response: IpcResponse,
}

/// Event to be broadcast to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum IpcEvent {
    #[serde(rename = "groupchat.message")]
    GroupChatMessage {
        from_role: String,
        from_id: String,
        content: String,
        mentions: Vec<String>,
        timestamp: String,
        target_ids: Vec<String>,
        /// Optional reply_to field - specifies who should receive responses
        #[serde(skip_serializing_if = "Option::is_none")]
        reply_to: Option<String>,
    },
}

/// Pending message for an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingMessage {
    pub from_role: String,
    pub content: String,
    pub timestamp: String,
    /// Optional reply_to field - specifies who should receive responses
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reply_to: Option<String>,
}

/// IPC Server state
pub struct IpcServerState {
    pub running: bool,
    pub event_tx: broadcast::Sender<IpcEvent>,
    pub chat_history: Vec<GroupChatMessage>,
    pub pending_messages: std::collections::HashMap<String, Vec<PendingMessage>>, // role -> messages
}

impl Default for IpcServerState {
    fn default() -> Self {
        let (event_tx, _) = broadcast::channel(100);
        Self {
            running: false,
            event_tx,
            chat_history: Vec::new(),
            pending_messages: std::collections::HashMap::new(),
        }
    }
}

/// Parse @mentions from content
/// Supports alphanumeric, underscore, and hyphen in role names
fn parse_mentions(content: &str) -> Vec<String> {
    let re = regex::Regex::new(r"@([\w-]+)").unwrap();
    re.captures_iter(content)
        .map(|cap| cap[1].to_string())
        .collect()
}

pub type SharedIpcServerState = Arc<RwLock<IpcServerState>>;

/// Create shared IPC server state
pub fn create_ipc_state() -> SharedIpcServerState {
    Arc::new(RwLock::new(IpcServerState::default()))
}

/// Handle a single WebSocket connection
async fn handle_connection(
    stream: TcpStream,
    app_handle: AppHandle,
    state: SharedIpcServerState,
) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[IPC] Failed to accept WebSocket: {}", e);
            return;
        }
    };

    let (mut write, mut read) = ws_stream.split();

    while let Some(msg_result) = read.next().await {
        let msg = match msg_result {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[IPC] WebSocket read error: {}", e);
                break;
            }
        };

        if let Message::Text(text) = msg {
            let response = process_message(&text, &app_handle, &state).await;
            if let Err(e) = write.send(Message::Text(response.into())).await {
                eprintln!("[IPC] Failed to send response: {}", e);
                break;
            }
        }
    }
}

/// Process an incoming IPC message
async fn process_message(
    text: &str,
    app_handle: &AppHandle,
    state: &SharedIpcServerState,
) -> String {
    // Parse the message
    let msg: IpcMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            return serde_json::to_string(&IpcResponseMessage {
                id: "unknown".to_string(),
                response: IpcResponse::Error {
                    message: format!("Failed to parse message: {}", e),
                    code: Some("PARSE_ERROR".to_string()),
                },
            })
            .unwrap_or_default();
        }
    };

    let response = match msg.request {
        IpcRequest::Ping => IpcResponse::Success {
            data: serde_json::json!({ "pong": true }),
        },

        IpcRequest::GroupChatSend {
            from_role,
            from_id,
            content,
            reply_to,
        } => {
            // Parse @mentions from content
            let mentions = parse_mentions(&content);
            let timestamp = chrono::Utc::now().to_rfc3339();

            // Note: Without terminal registry, we can't find target agents
            // Group chat messages are stored but not delivered to agents
            let target_ids: Vec<String> = Vec::new();

            // Create chat message with reply_to field
            let chat_msg = GroupChatMessage {
                from_role: from_role.clone(),
                from_id: from_id.clone(),
                content: content.clone(),
                mentions: mentions.clone(),
                timestamp: timestamp.clone(),
                reply_to: reply_to.clone(),
            };

            // Store in history and add to pending messages for mentioned roles
            {
                let mut state_write = state.write().await;
                state_write.chat_history.push(chat_msg);
                // Keep last 100 messages
                if state_write.chat_history.len() > 100 {
                    state_write.chat_history.remove(0);
                }

                // Add to pending messages for each mentioned role (excluding sender)
                for mention in &mentions {
                    // Skip if mention is the sender (prevents self-injection)
                    if mention.eq_ignore_ascii_case(&from_role) {
                        continue;
                    }
                    let pending = PendingMessage {
                        from_role: from_role.clone(),
                        content: content.clone(),
                        timestamp: timestamp.clone(),
                        reply_to: reply_to.clone(),
                    };
                    state_write
                        .pending_messages
                        .entry(mention.to_lowercase())
                        .or_insert_with(Vec::new)
                        .push(pending);
                }
            }

            // Create event for broadcasting
            let event = IpcEvent::GroupChatMessage {
                from_role: from_role.clone(),
                from_id: from_id.clone(),
                content: content.clone(),
                mentions: mentions.clone(),
                timestamp: timestamp.clone(),
                target_ids: target_ids.clone(),
                reply_to: reply_to.clone(),
            };

            // Emit to Tauri frontend (for UI display)
            let _ = app_handle.emit("ipc-groupchat-message", &event);

            // Broadcast internally
            {
                let state_read = state.read().await;
                let _ = state_read.event_tx.send(event);
            }

            IpcResponse::Success {
                data: serde_json::json!({
                    "sent": true,
                    "mentions": mentions,
                    "targetIds": target_ids,
                    "timestamp": timestamp,
                    "replyTo": reply_to
                }),
            }
        }

        IpcRequest::GroupChatHistory { limit } => {
            let state_read = state.read().await;
            let history_limit = limit.unwrap_or(50);
            let history: Vec<_> = state_read
                .chat_history
                .iter()
                .rev()
                .take(history_limit)
                .cloned()
                .collect();

            IpcResponse::Success {
                data: serde_json::to_value(history).unwrap_or(serde_json::json!([])),
            }
        }

        IpcRequest::AgentHealthCheck { from_role: _, from_id: _ } => {
            // Without terminal registry, we can't ping agents
            IpcResponse::Success {
                data: serde_json::json!({
                    "status": "no_agents",
                    "message": "Agent health check requires terminal registry (removed)",
                    "pinged": []
                }),
            }
        }

        IpcRequest::AgentGetPending { role } => {
            let role_lower = role.to_lowercase();
            let mut state_write = state.write().await;

            // Get and clear pending messages for this role
            let pending = state_write
                .pending_messages
                .remove(&role_lower)
                .unwrap_or_default();

            if pending.is_empty() {
                IpcResponse::Success {
                    data: serde_json::json!({
                        "hasPending": false,
                        "messages": [],
                        "count": 0
                    }),
                }
            } else {
                IpcResponse::Success {
                    data: serde_json::json!({
                        "hasPending": true,
                        "messages": pending,
                        "count": pending.len()
                    }),
                }
            }
        }

        IpcRequest::SessionSave { project_path, roles } => {
            let mapping = crate::session::RoleSessionMapping {
                project_path,
                saved_at: chrono::Utc::now().to_rfc3339(),
                roles,
            };

            match crate::session::save_role_sessions(&mapping) {
                Ok(_) => IpcResponse::Success {
                    data: serde_json::json!({
                        "saved": true,
                        "rolesCount": mapping.roles.len()
                    }),
                },
                Err(e) => IpcResponse::Error {
                    message: e,
                    code: Some("SAVE_ERROR".to_string()),
                },
            }
        }

        IpcRequest::SessionLoad => match crate::session::load_role_sessions() {
            Ok(Some(mapping)) => IpcResponse::Success {
                data: serde_json::to_value(mapping).unwrap_or(serde_json::json!(null)),
            },
            Ok(None) => IpcResponse::Success {
                data: serde_json::json!({ "found": false }),
            },
            Err(e) => IpcResponse::Error {
                message: e,
                code: Some("LOAD_ERROR".to_string()),
            },
        },

        IpcRequest::SessionClear => match crate::session::clear_role_sessions() {
            Ok(_) => IpcResponse::Success {
                data: serde_json::json!({ "cleared": true }),
            },
            Err(e) => IpcResponse::Error {
                message: e,
                code: Some("CLEAR_ERROR".to_string()),
            },
        },
    };

    serde_json::to_string(&IpcResponseMessage {
        id: msg.id,
        response,
    })
    .unwrap_or_default()
}

/// Start the IPC WebSocket server
pub async fn start_ipc_server(app_handle: AppHandle, state: SharedIpcServerState) {
    // Mark as running
    {
        let mut state_write = state.write().await;
        state_write.running = true;
    }

    let addr = format!("127.0.0.1:{}", IPC_PORT);
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => {
            println!("[IPC] Server listening on ws://{}", addr);
            l
        }
        Err(e) => {
            eprintln!("[IPC] Failed to bind to {}: {}", addr, e);
            return;
        }
    };

    loop {
        match listener.accept().await {
            Ok((stream, addr)) => {
                println!("[IPC] New connection from {}", addr);
                let app_handle_clone = app_handle.clone();
                let state_clone = state.clone();
                tokio::spawn(async move {
                    handle_connection(stream, app_handle_clone, state_clone).await;
                });
            }
            Err(e) => {
                eprintln!("[IPC] Failed to accept connection: {}", e);
            }
        }
    }
}

/// Tauri command to check if IPC server is running
#[tauri::command]
pub async fn ipc_subscribe(
    state: tauri::State<'_, SharedIpcServerState>,
) -> Result<(), String> {
    let state_read = state.read().await;
    if state_read.running {
        Ok(())
    } else {
        Err("IPC server not running".to_string())
    }
}

/// Tauri command to send a group chat message from frontend
/// This allows agents to reply via the UI
#[tauri::command]
pub async fn send_group_chat_message(
    from_role: String,
    from_id: String,
    content: String,
    reply_to: Option<String>,
    app: tauri::AppHandle,
    state: tauri::State<'_, SharedIpcServerState>,
) -> Result<serde_json::Value, String> {
    // Parse @mentions from content
    let mentions = parse_mentions(&content);
    let timestamp = chrono::Utc::now().to_rfc3339();

    // Note: Without terminal registry, we can't find target agents
    let target_ids: Vec<String> = Vec::new();

    // Create chat message
    let chat_msg = GroupChatMessage {
        from_role: from_role.clone(),
        from_id: from_id.clone(),
        content: content.clone(),
        mentions: mentions.clone(),
        timestamp: timestamp.clone(),
        reply_to: reply_to.clone(),
    };

    // Store in history and add to pending messages for mentioned roles
    {
        let mut state_write = state.write().await;
        state_write.chat_history.push(chat_msg);
        if state_write.chat_history.len() > 100 {
            state_write.chat_history.remove(0);
        }

        // Add to pending messages for each mentioned role (excluding sender)
        for mention in &mentions {
            if mention.eq_ignore_ascii_case(&from_role) {
                continue;
            }
            let pending = PendingMessage {
                from_role: from_role.clone(),
                content: content.clone(),
                timestamp: timestamp.clone(),
                reply_to: reply_to.clone(),
            };
            state_write
                .pending_messages
                .entry(mention.to_lowercase())
                .or_insert_with(Vec::new)
                .push(pending);
        }
    }

    // Create event for broadcasting
    let event = IpcEvent::GroupChatMessage {
        from_role: from_role.clone(),
        from_id: from_id.clone(),
        content: content.clone(),
        mentions: mentions.clone(),
        timestamp: timestamp.clone(),
        target_ids: target_ids.clone(),
        reply_to: reply_to.clone(),
    };

    // Emit to Tauri frontend
    let _ = app.emit("ipc-groupchat-message", &event);

    // Broadcast internally
    {
        let state_read = state.read().await;
        let _ = state_read.event_tx.send(event);
    }

    Ok(serde_json::json!({
        "sent": true,
        "mentions": mentions,
        "targetIds": target_ids,
        "timestamp": timestamp,
        "replyTo": reply_to
    }))
}
