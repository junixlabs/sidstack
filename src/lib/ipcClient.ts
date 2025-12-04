/**
 * Shared IPC WebSocket Client
 *
 * Maintains a single persistent WebSocket connection to the IPC server.
 * All IPC requests are queued and sent through this connection.
 * This prevents the connection storm caused by creating new WebSocket
 * connections for every request.
 */

import { showError } from "./toast";

const IPC_URL = "ws://127.0.0.1:17432";
const RECONNECT_DELAY = 1000; // 1 second
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RECONNECT_ATTEMPTS = 5;

interface PendingRequest {
  id: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

class IpcClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private requestQueue: Array<{ id: string; method: string; params?: Record<string, unknown> }> = [];
  private reconnectAttempts = 0;
  private isConnecting = false;
  private isConnected = false;

  constructor() {
    this.connect();
  }

  private connect(): void {
    if (this.isConnecting || this.isConnected) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(IPC_URL);

      this.ws.onopen = () => {
        console.log("[IpcClient] Connected to IPC server");
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Flush queued requests
        this.flushQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          const pending = this.pendingRequests.get(response.id);

          if (pending) {
            clearTimeout(pending.timeout);
            this.pendingRequests.delete(response.id);

            if (response.status === "error") {
              pending.reject(new Error(response.message || "IPC error"));
            } else {
              pending.resolve(response.data);
            }
          }
        } catch (err) {
          console.error("[IpcClient] Failed to parse response:", err);
        }
      };

      this.ws.onerror = () => {
        console.error("[IpcClient] WebSocket error");
      };

      this.ws.onclose = () => {
        console.log("[IpcClient] Connection closed");
        this.isConnected = false;
        this.isConnecting = false;
        this.ws = null;

        // Reject all pending requests
        this.pendingRequests.forEach((pending) => {
          clearTimeout(pending.timeout);
          pending.reject(new Error("Connection closed"));
        });
        this.pendingRequests.clear();

        // Attempt to reconnect
        if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          this.reconnectAttempts++;
          console.log(`[IpcClient] Reconnecting in ${RECONNECT_DELAY}ms (attempt ${this.reconnectAttempts})`);
          setTimeout(() => this.connect(), RECONNECT_DELAY);
        } else {
          // Show error toast after max retries
          showError("Connection Lost", "Unable to connect to backend. Please restart the app.");
        }
      };
    } catch (err) {
      console.error("[IpcClient] Failed to create WebSocket:", err);
      this.isConnecting = false;

      // Attempt to reconnect
      if (this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        this.reconnectAttempts++;
        setTimeout(() => this.connect(), RECONNECT_DELAY);
      }
    }
  }

  private flushQueue(): void {
    while (this.requestQueue.length > 0 && this.isConnected && this.ws) {
      const request = this.requestQueue.shift()!;
      this.ws.send(JSON.stringify(request));
    }
  }

  async request<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error("IPC request timeout"));
      }, REQUEST_TIMEOUT);

      this.pendingRequests.set(id, {
        id,
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const request = { id, method, params };

      if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(request));
      } else {
        // Queue the request for when connection is established
        this.requestQueue.push(request);

        // Ensure we're trying to connect
        if (!this.isConnecting && !this.isConnected) {
          this.connect();
        }
      }
    });
  }

  // Convenience method for MCP tool calls
  async mcpCall<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
    return this.request<T>("mcp.call", { tool: toolName, args });
  }

  // Check if connected
  get connected(): boolean {
    return this.isConnected;
  }

  // Manual reconnect
  reconnect(): void {
    if (this.ws) {
      this.ws.close();
    }
    this.reconnectAttempts = 0;
    this.connect();
  }
}

// Singleton instance
export const ipcClient = new IpcClient();

// Export convenience functions
export async function ipcRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
  return ipcClient.request<T>(method, params);
}

export async function mcpCall<T>(toolName: string, args: Record<string, unknown> = {}): Promise<T> {
  return ipcClient.mcpCall<T>(toolName, args);
}

export default ipcClient;
