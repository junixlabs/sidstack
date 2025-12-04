mod commands;
mod agent_coordinator;
mod api_server;
mod claude_process;
mod ipc_server;
mod session;
mod session_storage;
mod workspace_storage;
mod team_storage;
mod team_manager;
mod claude_session;
mod recovery_watchdog;
mod singleton;
mod session_tracker;
mod sdk_sidecar;
pub mod utils;

use commands::git::{get_diff, get_file_diff, list_branches, get_commit_log, get_repo_status, run_git_command, run_shell_command};
use commands::workspace::{list_workspaces, create_workspace, delete_workspace, get_workspace_status, sync_shared_symlinks};
use commands::file::{get_file_content, get_file_tree, search_files, delete_file, rename_file, create_file, create_folder, get_image_base64, path_exists, read_file, list_markdown_files, init_knowledge_folder, validate_knowledge_files, fix_knowledge_file, list_files_with_extension};
use commands::agent::{
    init_agent_manager, connect_agent, disconnect_agent, send_prompt,
    get_agent_status, list_connected_agents, AgentManagerState,
    start_background_monitor, stop_background_monitor, is_background_monitor_running,
    BackgroundMonitorState, BackgroundMonitorStateWrapper,
    // Claude CLI session commands
    spawn_claude_session, send_to_claude_session, stop_claude_session,
    get_claude_session, list_claude_sessions, ClaudeSessionManagerState, ClaudeSessionManager,
};
use commands::tray::{setup_tray, update_tray_tooltip, show_notification};
use commands::crash::{get_crash_logs, clear_crash_logs};
use commands::claude::{
    claude_spawn, claude_get_process, claude_list_processes,
    claude_terminate, claude_update_status,
    // Persistent session commands
    claude_spawn_session, claude_send_input, claude_has_session,
    claude_get_session, claude_list_sessions, claude_terminate_session,
};
use claude_process::{create_process_manager, claude_load_session_history};
use agent_coordinator::{
    create_coordinator,
    coordinator_register_agent, coordinator_unregister_agent,
    coordinator_send_message, coordinator_update_status,
    coordinator_get_agent, coordinator_list_agents,
    coordinator_delegate_task, coordinator_get_orchestrator,
    coordinator_get_idle_workers, coordinator_health_check,
};
use commands::window::{
    open_task_window, close_task_window, save_window_position,
    list_windows, focus_window, broadcast_to_windows, open_project_window,
};
use commands::team::{
    team_create, team_list, team_get, team_update, team_archive,
    team_add_member, team_remove_member, team_update_member_session,
    team_update_member_status, team_update_member_task, team_get_members,
    team_pause, team_resume,
    team_report_member_failure, team_create_replacement,
    team_get_recovery_context, team_get_recovery_history, team_member_heartbeat,
};
use commands::openspec::{
    get_openspec_summary, get_openspec_changes, get_openspec_specs, get_openspec_file_content,
    get_openspec_modules, get_openspec_changes_by_module,
};
use commands::orchestrator::{
    analyze_request, submit_request,
};
use commands::session::{
    session_track, session_untrack, session_list, session_get, session_cleanup_orphaned,
};
use commands::slash::{
    slash_search_files, resolve_file_mention, read_file_content,
    execute_bash_command, list_custom_commands, get_home_dir,
};
use commands::test_room::{
    test_room_get_by_module, test_room_create, test_room_update, test_room_list, test_room_get_summary,
    test_item_list, test_item_create, test_item_update, test_item_delete,
    test_message_list, test_message_create,
    test_artifact_list,
};
use ipc_server::{create_ipc_state, start_ipc_server, ipc_subscribe, send_group_chat_message};
use session_tracker::create_session_tracker;
use team_manager::create_team_manager;
use recovery_watchdog::{create_watchdog_handle, start_watchdog};
use api_server::{create_api_server_state, start_api_server, stop_api_server};
use sdk_sidecar::{
    create_sidecar_state, start_sdk_sidecar, stop_sdk_sidecar,
    get_sdk_sidecar_status, ensure_sdk_sidecar,
};
use session_storage::{
    session_storage_list, session_storage_get, session_storage_create,
    session_storage_rename, session_storage_delete, session_storage_update_status,
    session_storage_update_role, session_storage_update_claude_id, session_storage_export,
    session_storage_load_output, session_storage_append_output, session_storage_cleanup,
};
use workspace_storage::{
    workspace_exists, workspace_init, workspace_session_load, workspace_session_save,
    workspace_get_history_path, workspace_get_config, workspace_validate_cwd,
};
use std::sync::Arc;
use tauri::Manager;
use tokio::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check for singleton - prevent multiple instances
    if let Err(msg) = singleton::check_singleton() {
        eprintln!("[Agent Manager] {}", msg);
        // Show native dialog
        #[cfg(not(mobile))]
        {
            use std::process::Command;
            #[cfg(target_os = "macos")]
            {
                let _ = Command::new("osascript")
                    .args(["-e", &format!(
                        "display dialog \"{}\" with title \"Agent Manager\" buttons {{\"OK\"}} default button 1 with icon stop",
                        msg.replace("\"", "\\\"")
                    )])
                    .output();
            }
            #[cfg(target_os = "windows")]
            {
                let _ = Command::new("powershell")
                    .args(["-Command", &format!(
                        "[System.Windows.Forms.MessageBox]::Show('{}', 'Agent Manager', 'OK', 'Error')",
                        msg.replace("'", "''")
                    )])
                    .output();
            }
            #[cfg(target_os = "linux")]
            {
                let _ = Command::new("zenity")
                    .args(["--error", "--title=Agent Manager", "--text", &msg])
                    .output();
            }
        }
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .manage(AgentManagerState(Arc::new(Mutex::new(None))))
        .manage(BackgroundMonitorStateWrapper(Arc::new(Mutex::new(BackgroundMonitorState::default()))))
        .manage(ClaudeSessionManagerState(Arc::new(Mutex::new(ClaudeSessionManager::new()))))
        .manage(create_ipc_state())
        .manage(create_process_manager())
        .manage(create_coordinator(5)) // Max 5 concurrent workers
        .manage(create_team_manager().expect("Failed to create team manager"))
        .manage(create_watchdog_handle())
        .manage(create_api_server_state())
        .manage(create_sidecar_state())
        .plugin(tauri_plugin_shell::init())
        .manage({
            // Create session tracker and cleanup orphaned processes from previous runs
            let (tracker, orphaned) = create_session_tracker();
            if !orphaned.is_empty() {
                eprintln!("[Agent Manager] Cleaned up {} orphaned agent session(s) from previous run", orphaned.len());
            }
            tracker
        })
        .setup(|app| {
            // Setup system tray
            let _ = setup_tray(app.handle());

            // Start API server
            let api_state = app.state::<api_server::SharedApiServerState>().inner().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = start_api_server(api_state).await {
                    eprintln!("[Agent Manager] Failed to start API server: {}", e);
                }
            });

            // Start IPC server for MCP communication
            let ipc_state = app.state::<ipc_server::SharedIpcServerState>().inner().clone();
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_ipc_server(app_handle, ipc_state).await;
            });

            // Start recovery watchdog
            let watchdog_handle = app.state::<recovery_watchdog::SharedWatchdog>().inner().clone();
            let team_manager = app.state::<team_manager::SharedTeamManager>().inner().clone();
            let watchdog_app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                start_watchdog(watchdog_handle, team_manager, watchdog_app_handle).await;
            });

            // Cleanup old sessions (30 days)
            tauri::async_runtime::spawn(async move {
                match session_storage::cleanup_old_sessions(30) {
                    Ok(count) if count > 0 => {
                        eprintln!("[SessionStorage] Cleaned up {} old session(s)", count);
                    }
                    Err(e) => {
                        eprintln!("[SessionStorage] Cleanup error: {}", e);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Git commands
            get_diff,
            get_file_diff,
            list_branches,
            get_commit_log,
            get_repo_status,
            run_git_command,
            run_shell_command,
            // Workspace commands
            list_workspaces,
            create_workspace,
            delete_workspace,
            get_workspace_status,
            sync_shared_symlinks,
            // File commands
            get_file_content,
            get_image_base64,
            get_file_tree,
            search_files,
            delete_file,
            rename_file,
            create_file,
            create_folder,
            path_exists,
            read_file,
            list_markdown_files,
            init_knowledge_folder,
            validate_knowledge_files,
            fix_knowledge_file,
            list_files_with_extension,
            // Agent commands
            init_agent_manager,
            connect_agent,
            disconnect_agent,
            send_prompt,
            get_agent_status,
            list_connected_agents,
            // Background monitoring
            start_background_monitor,
            stop_background_monitor,
            is_background_monitor_running,
            // Claude CLI sessions
            spawn_claude_session,
            send_to_claude_session,
            stop_claude_session,
            get_claude_session,
            list_claude_sessions,
            // Tray commands
            update_tray_tooltip,
            show_notification,
            // Crash reporting
            get_crash_logs,
            clear_crash_logs,
            // Window management
            open_task_window,
            close_task_window,
            save_window_position,
            list_windows,
            focus_window,
            broadcast_to_windows,
            open_project_window,
            // IPC server
            ipc_subscribe,
            send_group_chat_message,
            // Claude process manager (stream-json)
            claude_spawn,
            claude_get_process,
            claude_list_processes,
            claude_terminate,
            claude_update_status,
            // Claude persistent sessions (multi-turn)
            claude_spawn_session,
            claude_send_input,
            claude_has_session,
            claude_get_session,
            claude_list_sessions,
            claude_terminate_session,
            claude_load_session_history,
            // Agent coordinator
            coordinator_register_agent,
            coordinator_unregister_agent,
            coordinator_send_message,
            coordinator_update_status,
            coordinator_get_agent,
            coordinator_list_agents,
            coordinator_delegate_task,
            coordinator_get_orchestrator,
            coordinator_get_idle_workers,
            coordinator_health_check,
            // Team management
            team_create,
            team_list,
            team_get,
            team_update,
            team_archive,
            team_add_member,
            team_remove_member,
            team_update_member_session,
            team_update_member_status,
            team_update_member_task,
            team_get_members,
            team_pause,
            team_resume,
            team_report_member_failure,
            team_create_replacement,
            team_get_recovery_context,
            team_get_recovery_history,
            team_member_heartbeat,
            // OpenSpec commands
            get_openspec_summary,
            get_openspec_changes,
            get_openspec_specs,
            get_openspec_file_content,
            get_openspec_modules,
            get_openspec_changes_by_module,
            // Orchestrator commands
            analyze_request,
            submit_request,
            // Session tracking
            session_track,
            session_untrack,
            session_list,
            session_get,
            session_cleanup_orphaned,
            // Session storage (persistent)
            session_storage_list,
            session_storage_get,
            session_storage_create,
            session_storage_rename,
            session_storage_delete,
            session_storage_update_status,
            session_storage_update_role,
            session_storage_update_claude_id,
            session_storage_export,
            session_storage_load_output,
            session_storage_append_output,
            session_storage_cleanup,
            // Slash commands
            slash_search_files,
            resolve_file_mention,
            read_file_content,
            execute_bash_command,
            list_custom_commands,
            get_home_dir,
            // Agent SDK sidecar
            start_sdk_sidecar,
            stop_sdk_sidecar,
            get_sdk_sidecar_status,
            ensure_sdk_sidecar,
            // Workspace session persistence
            workspace_exists,
            workspace_init,
            workspace_session_load,
            workspace_session_save,
            workspace_get_history_path,
            workspace_get_config,
            workspace_validate_cwd,
            // Test Room commands
            test_room_get_by_module,
            test_room_create,
            test_room_update,
            test_room_list,
            test_room_get_summary,
            test_item_list,
            test_item_create,
            test_item_update,
            test_item_delete,
            test_message_list,
            test_message_create,
            test_artifact_list,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                // Stop API server on exit
                let api_state = app_handle.state::<api_server::SharedApiServerState>().inner().clone();
                let sidecar_state = app_handle.state::<sdk_sidecar::SharedSidecarState>().inner().clone();
                tauri::async_runtime::block_on(async {
                    stop_api_server(api_state).await;
                    // Stop SDK sidecar
                    let mut sidecar = sidecar_state.lock().await;
                    if let Some(pid) = sidecar.pid.take() {
                        println!("[Agent Manager] Stopping SDK sidecar (PID: {})", pid);
                        #[cfg(unix)]
                        {
                            use std::process::Command as StdCommand;
                            let _ = StdCommand::new("kill").arg("-TERM").arg(pid.to_string()).output();
                        }
                        #[cfg(windows)]
                        {
                            use std::process::Command as StdCommand;
                            let _ = StdCommand::new("taskkill").args(["/PID", &pid.to_string(), "/F"]).output();
                        }
                    }
                });

                // Cleanup singleton lockfile
                singleton::cleanup_singleton();
            }
        });
}
