//! Test Room Tauri Commands
//!
//! Provides SQLite access for Test Room feature.
//! Uses the same database file as @sidstack/shared.

use rusqlite::{Connection, Result as SqliteResult, params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

// =============================================================================
// Types
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestRoom {
    pub id: String,
    #[serde(rename = "moduleId")]
    pub module_id: String,
    #[serde(rename = "specId")]
    pub spec_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
    #[serde(rename = "updatedAt")]
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestItem {
    pub id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    pub title: String,
    pub description: Option<String>,
    pub status: String,
    #[serde(rename = "orderIndex")]
    pub order_index: i32,
    #[serde(rename = "resultNotes")]
    pub result_notes: Option<String>,
    #[serde(rename = "testedAt")]
    pub tested_at: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestMessage {
    pub id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    pub sender: String,
    #[serde(rename = "messageType")]
    pub message_type: String,
    pub content: String,
    pub metadata: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestArtifact {
    pub id: String,
    #[serde(rename = "roomId")]
    pub room_id: String,
    #[serde(rename = "messageId")]
    pub message_id: Option<String>,
    pub name: String,
    #[serde(rename = "type")]
    pub artifact_type: String,
    pub path: Option<String>,
    pub content: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TestRoomSummary {
    #[serde(rename = "totalItems")]
    pub total_items: i32,
    #[serde(rename = "passedItems")]
    pub passed_items: i32,
    #[serde(rename = "failedItems")]
    pub failed_items: i32,
    #[serde(rename = "pendingItems")]
    pub pending_items: i32,
    #[serde(rename = "skippedItems")]
    pub skipped_items: i32,
    #[serde(rename = "inProgressItems")]
    pub in_progress_items: i32,
}

// =============================================================================
// Database Connection
// =============================================================================

fn get_db_path() -> PathBuf {
    let home = dirs::home_dir().expect("Failed to get home directory");
    home.join(".sidstack").join("sidstack.db")
}

fn get_connection() -> SqliteResult<Connection> {
    let db_path = get_db_path();

    // Ensure .sidstack directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }

    let conn = Connection::open(&db_path)?;

    // Set WAL mode and busy timeout for concurrent access with TypeScript processes
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "busy_timeout", 5000)?;

    // Initialize schema if needed
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS test_rooms (
            id TEXT PRIMARY KEY,
            moduleId TEXT NOT NULL UNIQUE,
            specId TEXT,
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            createdAt INTEGER NOT NULL,
            updatedAt INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_test_rooms_module ON test_rooms(moduleId);

        CREATE TABLE IF NOT EXISTS test_items (
            id TEXT PRIMARY KEY,
            roomId TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'pending',
            orderIndex INTEGER DEFAULT 0,
            resultNotes TEXT,
            testedAt INTEGER,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (roomId) REFERENCES test_rooms(id)
        );
        CREATE INDEX IF NOT EXISTS idx_test_items_room ON test_items(roomId);

        CREATE TABLE IF NOT EXISTS test_messages (
            id TEXT PRIMARY KEY,
            roomId TEXT NOT NULL,
            sender TEXT NOT NULL,
            messageType TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (roomId) REFERENCES test_rooms(id)
        );
        CREATE INDEX IF NOT EXISTS idx_test_messages_room ON test_messages(roomId);

        CREATE TABLE IF NOT EXISTS test_artifacts (
            id TEXT PRIMARY KEY,
            roomId TEXT NOT NULL,
            messageId TEXT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            path TEXT,
            content TEXT,
            createdAt INTEGER NOT NULL,
            FOREIGN KEY (roomId) REFERENCES test_rooms(id)
        );
        CREATE INDEX IF NOT EXISTS idx_test_artifacts_room ON test_artifacts(roomId);
        "
    )?;

    Ok(conn)
}

fn generate_id(prefix: &str) -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    let random: u32 = rand::random();
    format!("{}_{:x}{:x}", prefix, timestamp, random)
}

// =============================================================================
// Room Commands
// =============================================================================

#[command]
pub fn test_room_get_by_module(module_id: String) -> Result<Option<TestRoom>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, moduleId, specId, name, description, status, createdAt, updatedAt FROM test_rooms WHERE moduleId = ?")
        .map_err(|e| e.to_string())?;

    let room = stmt
        .query_row(params![module_id], |row| {
            Ok(TestRoom {
                id: row.get(0)?,
                module_id: row.get(1)?,
                spec_id: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(room)
}

#[command]
pub fn test_room_create(module_id: String, name: Option<String>, spec_id: Option<String>) -> Result<TestRoom, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let id = generate_id("troom");
    let room_name = name.unwrap_or_else(|| format!("Test Room: {}", module_id));

    conn.execute(
        "INSERT INTO test_rooms (id, moduleId, specId, name, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'active', ?, ?)",
        params![id, module_id, spec_id, room_name, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(TestRoom {
        id,
        module_id,
        spec_id,
        name: room_name,
        description: None,
        status: "active".to_string(),
        created_at: now,
        updated_at: now,
    })
}

#[command]
pub fn test_room_update(id: String, name: Option<String>, spec_id: Option<String>, status: Option<String>) -> Result<TestRoom, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let mut updates = vec!["updatedAt = ?".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];

    if let Some(n) = &name {
        updates.push("name = ?".to_string());
        params.push(Box::new(n.clone()));
    }
    if let Some(s) = &spec_id {
        updates.push("specId = ?".to_string());
        params.push(Box::new(s.clone()));
    }
    if let Some(st) = &status {
        updates.push("status = ?".to_string());
        params.push(Box::new(st.clone()));
    }

    params.push(Box::new(id.clone()));

    let sql = format!("UPDATE test_rooms SET {} WHERE id = ?", updates.join(", "));
    conn.execute(&sql, rusqlite::params_from_iter(params.iter().map(|p| p.as_ref())))
        .map_err(|e| e.to_string())?;

    // Return updated room
    test_room_get_by_id(id)
}

#[command]
pub fn test_room_get_by_id(id: String) -> Result<TestRoom, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let room = conn
        .query_row(
            "SELECT id, moduleId, specId, name, description, status, createdAt, updatedAt FROM test_rooms WHERE id = ?",
            params![id],
            |row| {
                Ok(TestRoom {
                    id: row.get(0)?,
                    module_id: row.get(1)?,
                    spec_id: row.get(2)?,
                    name: row.get(3)?,
                    description: row.get(4)?,
                    status: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(room)
}

#[command]
pub fn test_room_list() -> Result<Vec<TestRoom>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, moduleId, specId, name, description, status, createdAt, updatedAt FROM test_rooms ORDER BY updatedAt DESC")
        .map_err(|e| e.to_string())?;

    let rooms = stmt
        .query_map([], |row| {
            Ok(TestRoom {
                id: row.get(0)?,
                module_id: row.get(1)?,
                spec_id: row.get(2)?,
                name: row.get(3)?,
                description: row.get(4)?,
                status: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(rooms)
}

// =============================================================================
// Test Item Commands
// =============================================================================

#[command]
pub fn test_item_list(room_id: String) -> Result<Vec<TestItem>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, roomId, title, description, status, orderIndex, resultNotes, testedAt, createdAt FROM test_items WHERE roomId = ? ORDER BY orderIndex ASC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![room_id], |row| {
            Ok(TestItem {
                id: row.get(0)?,
                room_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
                order_index: row.get(5)?,
                result_notes: row.get(6)?,
                tested_at: row.get(7)?,
                created_at: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(items)
}

#[command]
pub fn test_item_create(room_id: String, title: String, description: Option<String>) -> Result<TestItem, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let id = generate_id("titem");

    // Get next order index
    let order_index: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(orderIndex), -1) + 1 FROM test_items WHERE roomId = ?",
            params![room_id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO test_items (id, roomId, title, description, status, orderIndex, createdAt) VALUES (?, ?, ?, ?, 'pending', ?, ?)",
        params![id, room_id, title, description, order_index, now],
    )
    .map_err(|e| e.to_string())?;

    // Update room's updatedAt
    conn.execute("UPDATE test_rooms SET updatedAt = ? WHERE id = ?", params![now, room_id])
        .ok();

    Ok(TestItem {
        id,
        room_id,
        title,
        description,
        status: "pending".to_string(),
        order_index,
        result_notes: None,
        tested_at: None,
        created_at: now,
    })
}

#[command]
pub fn test_item_update(id: String, status: Option<String>, result_notes: Option<String>) -> Result<TestItem, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let mut updates = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(s) = &status {
        updates.push("status = ?");
        params_vec.push(Box::new(s.clone()));

        // Set testedAt for pass/fail
        if s == "passed" || s == "failed" {
            updates.push("testedAt = ?");
            params_vec.push(Box::new(now));
        }
    }

    if let Some(notes) = &result_notes {
        updates.push("resultNotes = ?");
        params_vec.push(Box::new(notes.clone()));
    }

    if updates.is_empty() {
        return Err("No updates provided".to_string());
    }

    params_vec.push(Box::new(id.clone()));

    let sql = format!("UPDATE test_items SET {} WHERE id = ?", updates.join(", "));
    conn.execute(&sql, rusqlite::params_from_iter(params_vec.iter().map(|p| p.as_ref())))
        .map_err(|e| e.to_string())?;

    // Get updated item
    let item = conn
        .query_row(
            "SELECT id, roomId, title, description, status, orderIndex, resultNotes, testedAt, createdAt FROM test_items WHERE id = ?",
            params![id],
            |row| {
                Ok(TestItem {
                    id: row.get(0)?,
                    room_id: row.get(1)?,
                    title: row.get(2)?,
                    description: row.get(3)?,
                    status: row.get(4)?,
                    order_index: row.get(5)?,
                    result_notes: row.get(6)?,
                    tested_at: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    // Update room's updatedAt
    conn.execute("UPDATE test_rooms SET updatedAt = ? WHERE id = ?", params![now, item.room_id])
        .ok();

    Ok(item)
}

#[command]
pub fn test_item_delete(id: String) -> Result<bool, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM test_items WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(true)
}

// =============================================================================
// Message Commands
// =============================================================================

#[command]
pub fn test_message_list(room_id: String, limit: Option<i32>) -> Result<Vec<TestMessage>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(100);

    let mut stmt = conn
        .prepare("SELECT id, roomId, sender, messageType, content, metadata, createdAt FROM test_messages WHERE roomId = ? ORDER BY createdAt ASC LIMIT ?")
        .map_err(|e| e.to_string())?;

    let messages = stmt
        .query_map(params![room_id, limit], |row| {
            Ok(TestMessage {
                id: row.get(0)?,
                room_id: row.get(1)?,
                sender: row.get(2)?,
                message_type: row.get(3)?,
                content: row.get(4)?,
                metadata: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(messages)
}

#[command]
pub fn test_message_create(
    room_id: String,
    sender: String,
    message_type: String,
    content: String,
    metadata: Option<String>,
) -> Result<TestMessage, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;

    let id = generate_id("tmsg");

    conn.execute(
        "INSERT INTO test_messages (id, roomId, sender, messageType, content, metadata, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![id, room_id, sender, message_type, content, metadata, now],
    )
    .map_err(|e| e.to_string())?;

    // Update room's updatedAt
    conn.execute("UPDATE test_rooms SET updatedAt = ? WHERE id = ?", params![now, room_id])
        .ok();

    Ok(TestMessage {
        id,
        room_id,
        sender,
        message_type,
        content,
        metadata,
        created_at: now,
    })
}

// =============================================================================
// Summary Command
// =============================================================================

#[command]
pub fn test_room_get_summary(room_id: String) -> Result<TestRoomSummary, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let summary = conn
        .query_row(
            "SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress
            FROM test_items WHERE roomId = ?",
            params![room_id],
            |row| {
                Ok(TestRoomSummary {
                    total_items: row.get(0)?,
                    passed_items: row.get(1)?,
                    failed_items: row.get(2)?,
                    pending_items: row.get(3)?,
                    skipped_items: row.get(4)?,
                    in_progress_items: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?;

    Ok(summary)
}

// =============================================================================
// Artifact Commands
// =============================================================================

#[command]
pub fn test_artifact_list(room_id: String) -> Result<Vec<TestArtifact>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, roomId, messageId, name, type, path, content, createdAt FROM test_artifacts WHERE roomId = ? ORDER BY createdAt DESC")
        .map_err(|e| e.to_string())?;

    let artifacts = stmt
        .query_map(params![room_id], |row| {
            Ok(TestArtifact {
                id: row.get(0)?,
                room_id: row.get(1)?,
                message_id: row.get(2)?,
                name: row.get(3)?,
                artifact_type: row.get(4)?,
                path: row.get(5)?,
                content: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(artifacts)
}
