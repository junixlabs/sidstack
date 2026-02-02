// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::panic;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;

fn get_crash_log_path() -> PathBuf {
    let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    path.push("sidstack");
    fs::create_dir_all(&path).ok();
    path.push("crash.log");
    path
}

fn setup_panic_handler() {
    let default_hook = panic::take_hook();
    panic::set_hook(Box::new(move |panic_info| {
        // Get crash info
        let message = if let Some(s) = panic_info.payload().downcast_ref::<&str>() {
            s.to_string()
        } else if let Some(s) = panic_info.payload().downcast_ref::<String>() {
            s.clone()
        } else {
            "Unknown panic".to_string()
        };

        let location = panic_info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown location".to_string());

        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        let crash_report = format!(
            "[{}] CRASH at {}\nMessage: {}\n---\n",
            timestamp, location, message
        );

        // Write to crash log
        let log_path = get_crash_log_path();
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = file.write_all(crash_report.as_bytes());
        }

        // Call default panic handler
        default_hook(panic_info);
    }));
}

fn main() {
    setup_panic_handler();
    sidstack_lib::run()
}
