/**
 * Hook to listen for IPC terminal events from the Tauri backend
 *
 * These events are emitted when the MCP server requests terminal actions
 * via the IPC WebSocket server.
 */

import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";

export interface IpcTerminalSpawnEvent {
  type: "terminal.spawn";
  id: string;
  cwd: string | null;
  role: string | null;
  auto_launch: string | null;
  /** Claude session ID to resume (for loading previous conversation) */
  resume_session_id: string | null;
}

export interface IpcTerminalKillEvent {
  type: "terminal.kill";
  id: string;
}

export interface IpcTerminalWriteEvent {
  type: "terminal.write";
  id: string;
  data: string;
}

export type IpcTerminalEvent =
  | IpcTerminalSpawnEvent
  | IpcTerminalKillEvent
  | IpcTerminalWriteEvent;

export interface UseIpcTerminalEventsOptions {
  onSpawn?: (event: IpcTerminalSpawnEvent) => void;
  onKill?: (event: IpcTerminalKillEvent) => void;
  onWrite?: (event: IpcTerminalWriteEvent) => void;
}

/**
 * Hook to listen for IPC terminal events from the Tauri backend.
 *
 * Events are emitted when the MCP server requests terminal actions
 * via the IPC WebSocket server.
 */
export function useIpcTerminalEvents(options: UseIpcTerminalEventsOptions) {
  const optionsRef = useRef(options);

  // Keep options ref updated
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    const unlistenPromises: Promise<UnlistenFn>[] = [];

    console.log("[useIpcTerminalEvents] Setting up event listeners...");

    // Listen for spawn events
    unlistenPromises.push(
      listen<IpcTerminalSpawnEvent>("ipc-terminal-spawn", (event) => {
        console.log("[useIpcTerminalEvents] Received ipc-terminal-spawn event:", event);
        optionsRef.current.onSpawn?.(event.payload);
      })
    );

    // Listen for kill events
    unlistenPromises.push(
      listen<IpcTerminalKillEvent>("ipc-terminal-kill", (event) => {
        optionsRef.current.onKill?.(event.payload);
      })
    );

    // Listen for write events
    unlistenPromises.push(
      listen<IpcTerminalWriteEvent>("ipc-terminal-write", (event) => {
        optionsRef.current.onWrite?.(event.payload);
      })
    );

    // Cleanup
    return () => {
      Promise.all(unlistenPromises).then((unlistenFns) => {
        unlistenFns.forEach((unlisten) => unlisten());
      });
    };
  }, []);
}

/**
 * Terminal write handler registry
 *
 * Allows XTermTerminal components to register their write functions
 * so that IPC events can write to them.
 */
class TerminalWriteRegistry {
  private handlers: Map<string, (data: string) => void> = new Map();

  register(id: string, handler: (data: string) => void): void {
    this.handlers.set(id, handler);
  }

  unregister(id: string): void {
    this.handlers.delete(id);
  }

  write(id: string, data: string): boolean {
    const handler = this.handlers.get(id);
    if (handler) {
      handler(data);
      return true;
    }
    console.warn(`[TerminalWriteRegistry] No handler for terminal ${id}`);
    return false;
  }

  has(id: string): boolean {
    return this.handlers.has(id);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
export const terminalWriteRegistry = new TerminalWriteRegistry();

export default useIpcTerminalEvents;
