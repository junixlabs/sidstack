//! Singleton instance check for Agent Manager
//!
//! Prevents multiple instances of the app from running simultaneously
//! by using a lockfile and port check.

use std::fs::{self, File};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::time::Duration;

const IPC_PORT: u16 = 17432;
const LOCK_FILE_NAME: &str = ".sidstack-agent-manager.lock";

/// Get the lockfile path in the user's home directory
fn get_lock_file_path() -> PathBuf {
    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    home.join(LOCK_FILE_NAME)
}

/// Check if another instance is already running
/// Returns Ok(()) if this is the first instance, Err(message) otherwise
pub fn check_singleton() -> Result<(), String> {
    let lock_path = get_lock_file_path();

    // First, try to connect to the IPC port
    // If successful, another instance is running
    if TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", IPC_PORT).parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
    {
        return Err(format!(
            "Another instance of Agent Manager is already running (IPC port {} in use).\n\
             Please close the existing instance before starting a new one.",
            IPC_PORT
        ));
    }

    // Check lockfile
    if lock_path.exists() {
        // Read PID from lockfile
        if let Ok(mut file) = File::open(&lock_path) {
            let mut pid_str = String::new();
            if file.read_to_string(&mut pid_str).is_ok() {
                let pid = pid_str.trim().parse::<i32>().unwrap_or(0);
                if pid > 0 && is_process_running(pid) {
                    return Err(format!(
                        "Another instance of Agent Manager is already running (PID: {}).\n\
                         Please close the existing instance before starting a new one.",
                        pid
                    ));
                }
            }
        }
        // Stale lockfile, remove it
        let _ = fs::remove_file(&lock_path);
    }

    // Create new lockfile with our PID
    if let Ok(mut file) = File::create(&lock_path) {
        let pid = std::process::id();
        let _ = file.write_all(pid.to_string().as_bytes());
    }

    Ok(())
}

/// Check if a process with given PID is running
fn is_process_running(pid: i32) -> bool {
    #[cfg(unix)]
    {
        // On Unix, send signal 0 to check if process exists
        unsafe { libc::kill(pid, 0) == 0 }
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

/// Clean up the lockfile on exit
pub fn cleanup_singleton() {
    let lock_path = get_lock_file_path();
    // Only remove if we created it (check PID matches)
    if let Ok(mut file) = File::open(&lock_path) {
        let mut pid_str = String::new();
        if file.read_to_string(&mut pid_str).is_ok() {
            let stored_pid = pid_str.trim().parse::<u32>().unwrap_or(0);
            if stored_pid == std::process::id() {
                let _ = fs::remove_file(&lock_path);
            }
        }
    }
}
