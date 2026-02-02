//! Session Tracker - Persists agent session PIDs for orphan cleanup
//!
//! This module ensures no Claude agents run in the background without user knowledge.
//! It persists session information to disk and cleans up orphaned processes on startup.

#![allow(dead_code)]

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{BufReader, BufWriter};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Tracked session info
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackedSession {
    pub session_id: String,
    pub pid: u32,
    pub terminal_id: Option<String>,
    pub role: Option<String>,
    pub cwd: String,
    pub started_at: DateTime<Utc>,
}

/// Session tracker state
#[derive(Debug, Default, Serialize, Deserialize)]
pub struct SessionTrackerData {
    /// App PID that created these sessions
    pub app_pid: u32,
    /// Active sessions
    pub sessions: HashMap<String, TrackedSession>,
    /// Last updated timestamp
    pub updated_at: DateTime<Utc>,
}

/// Session tracker manager
#[derive(Debug)]
pub struct SessionTracker {
    data: SessionTrackerData,
    file_path: PathBuf,
}

impl SessionTracker {
    /// Create new session tracker with persistence path
    pub fn new() -> Self {
        let file_path = Self::get_sessions_path();
        let data = SessionTrackerData {
            app_pid: std::process::id(),
            sessions: HashMap::new(),
            updated_at: Utc::now(),
        };

        Self { data, file_path }
    }

    /// Get path to sessions file
    fn get_sessions_path() -> PathBuf {
        let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("sidstack");
        fs::create_dir_all(&path).ok();
        path.push("active_sessions.json");
        path
    }

    /// Load existing sessions from disk
    pub fn load(&mut self) -> std::io::Result<()> {
        if !self.file_path.exists() {
            return Ok(());
        }

        let file = File::open(&self.file_path)?;
        let reader = BufReader::new(file);
        match serde_json::from_reader::<_, SessionTrackerData>(reader) {
            Ok(data) => {
                self.data = data;
                Ok(())
            }
            Err(e) => {
                eprintln!("[SessionTracker] Failed to parse sessions file: {}", e);
                // Remove corrupted file
                fs::remove_file(&self.file_path).ok();
                Ok(())
            }
        }
    }

    /// Save sessions to disk
    pub fn save(&mut self) -> std::io::Result<()> {
        self.data.updated_at = Utc::now();
        let file = File::create(&self.file_path)?;
        let writer = BufWriter::new(file);
        serde_json::to_writer_pretty(writer, &self.data)?;
        Ok(())
    }

    /// Add a session to track
    pub fn add_session(
        &mut self,
        session_id: String,
        pid: u32,
        terminal_id: Option<String>,
        role: Option<String>,
        cwd: String,
    ) {
        let session = TrackedSession {
            session_id: session_id.clone(),
            pid,
            terminal_id,
            role,
            cwd,
            started_at: Utc::now(),
        };
        self.data.sessions.insert(session_id, session);
        if let Err(e) = self.save() {
            eprintln!("[SessionTracker] Failed to save: {}", e);
        }
    }

    /// Remove a session from tracking
    pub fn remove_session(&mut self, session_id: &str) {
        self.data.sessions.remove(session_id);
        if let Err(e) = self.save() {
            eprintln!("[SessionTracker] Failed to save: {}", e);
        }
    }

    /// Get all tracked sessions
    pub fn list_sessions(&self) -> Vec<TrackedSession> {
        self.data.sessions.values().cloned().collect()
    }

    /// Get a specific session
    pub fn get_session(&self, session_id: &str) -> Option<&TrackedSession> {
        self.data.sessions.get(session_id)
    }

    /// Check if a process is still running
    fn is_process_running(pid: u32) -> bool {
        #[cfg(unix)]
        {
            unsafe { libc::kill(pid as i32, 0) == 0 }
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            Command::new("tasklist")
                .args(["/FI", &format!("PID eq {}", pid), "/NH"])
                .output()
                .map(|output| {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    stdout.contains(&pid.to_string())
                })
                .unwrap_or(false)
        }
    }

    /// Terminate a process
    fn terminate_process(pid: u32) -> bool {
        eprintln!("[SessionTracker] Terminating orphaned process PID {}", pid);

        #[cfg(unix)]
        {
            unsafe {
                // Try SIGTERM first
                if libc::kill(pid as i32, libc::SIGTERM) == 0 {
                    // Wait briefly and check if still running
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    if libc::kill(pid as i32, 0) == 0 {
                        // Still running, force kill
                        libc::kill(pid as i32, libc::SIGKILL);
                    }
                    return true;
                }
                false
            }
        }

        #[cfg(windows)]
        {
            use std::process::Command;
            Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
    }

    /// Cleanup orphaned sessions from previous app runs
    /// Returns list of terminated session IDs
    pub fn cleanup_orphaned(&mut self) -> Vec<String> {
        let mut orphaned = Vec::new();
        let current_app_pid = std::process::id();

        // Check if sessions are from a different app instance
        if self.data.app_pid != current_app_pid && self.data.app_pid != 0 {
            // Check if old app is still running
            let old_app_running = Self::is_process_running(self.data.app_pid);

            if !old_app_running {
                eprintln!(
                    "[SessionTracker] Previous app (PID {}) is not running, cleaning up orphaned sessions",
                    self.data.app_pid
                );

                // Terminate all sessions from old app
                for (session_id, session) in self.data.sessions.iter() {
                    if Self::is_process_running(session.pid) {
                        eprintln!(
                            "[SessionTracker] Terminating orphaned session '{}' (PID {})",
                            session_id, session.pid
                        );
                        Self::terminate_process(session.pid);
                        orphaned.push(session_id.clone());
                    }
                }
            }
        }

        // Clear all sessions and start fresh
        if !orphaned.is_empty() {
            self.data.sessions.clear();
            self.data.app_pid = current_app_pid;
            if let Err(e) = self.save() {
                eprintln!("[SessionTracker] Failed to save after cleanup: {}", e);
            }
        } else {
            // Just update app_pid
            self.data.app_pid = current_app_pid;
            if let Err(e) = self.save() {
                eprintln!("[SessionTracker] Failed to save: {}", e);
            }
        }

        orphaned
    }

    /// Clear all sessions (e.g., on app exit)
    pub fn clear_all(&mut self) {
        self.data.sessions.clear();
        // Don't delete file, just clear sessions
        if let Err(e) = self.save() {
            eprintln!("[SessionTracker] Failed to save: {}", e);
        }
    }
}

/// Shared state wrapper for Tauri
pub type SharedSessionTracker = Arc<Mutex<SessionTracker>>;

/// Create shared session tracker and perform initial cleanup
pub fn create_session_tracker() -> (SharedSessionTracker, Vec<String>) {
    let mut tracker = SessionTracker::new();

    // Load existing sessions
    if let Err(e) = tracker.load() {
        eprintln!("[SessionTracker] Failed to load sessions: {}", e);
    }

    // Cleanup orphaned sessions from previous runs
    let orphaned = tracker.cleanup_orphaned();

    if !orphaned.is_empty() {
        eprintln!(
            "[SessionTracker] Cleaned up {} orphaned session(s)",
            orphaned.len()
        );
    }

    (Arc::new(Mutex::new(tracker)), orphaned)
}
