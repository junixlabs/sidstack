import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { getConfig, getApiBaseUrl } from './config';

export class ServerManager implements vscode.Disposable {
  private process: ChildProcess | null = null;
  private outputChannel: vscode.OutputChannel;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private _isConnected = false;
  private _disposed = false;
  private _onConnectionChanged = new vscode.EventEmitter<boolean>();
  readonly onConnectionChanged = this._onConnectionChanged.event;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('SidStack API Server');
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  async ensureRunning(): Promise<boolean> {
    if (await this.checkHealth()) {
      this.setConnected(true);
      return true;
    }

    const config = getConfig();
    if (!config.autoStartServer) {
      this.setConnected(false);
      return false;
    }

    return this.startServer();
  }

  private async startServer(): Promise<boolean> {
    if (this.process) {
      return this.checkHealth();
    }

    const config = getConfig();
    this.outputChannel.appendLine(`Starting API server on port ${config.apiPort}...`);

    try {
      this.process = spawn('npx', ['@sidstack/api-server'], {
        env: {
          ...process.env,
          API_PORT: String(config.apiPort),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(data.toString().trim());
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(`[stderr] ${data.toString().trim()}`);
      });

      // BUG-7 FIX: Handle process spawn errors (e.g., npx not found)
      this.process.on('error', (err) => {
        this.outputChannel.appendLine(`Process error: ${err.message}`);
        this.process = null;
        this.setConnected(false);
      });

      this.process.on('exit', (code) => {
        this.outputChannel.appendLine(`API server exited with code ${code}`);
        this.process = null;
        this.setConnected(false);
      });

      // Wait for server to be ready (up to 10 seconds)
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        if (await this.checkHealth()) {
          this.outputChannel.appendLine('API server is ready.');
          this.setConnected(true);
          return true;
        }
      }

      this.outputChannel.appendLine('API server failed to start within timeout.');
      this.setConnected(false);
      return false;
    } catch (error) {
      this.outputChannel.appendLine(`Failed to start server: ${error}`);
      this.setConnected(false);
      return false;
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const response = await fetch(`${getApiBaseUrl()}/health`, { signal: controller.signal });
        return response.ok;
      } finally {
        clearTimeout(timeout);
      }
    } catch {
      return false;
    }
  }

  startHealthMonitor(): void {
    if (this.healthCheckInterval) { return; }

    this.healthCheckInterval = setInterval(async () => {
      const healthy = await this.checkHealth();
      if (healthy !== this._isConnected) {
        this.setConnected(healthy);
      }
    }, 15_000);
  }

  stopHealthMonitor(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private setConnected(connected: boolean): void {
    if (this._disposed) { return; }
    if (this._isConnected !== connected) {
      this._isConnected = connected;
      this._onConnectionChanged.fire(connected);
    }
  }

  // BUG-4 FIX: Guard against double dispose
  dispose(): void {
    if (this._disposed) { return; }
    this._disposed = true;
    this.stopHealthMonitor();
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this._onConnectionChanged.dispose();
    this.outputChannel.dispose();
  }
}
