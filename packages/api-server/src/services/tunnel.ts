/**
 * Tunnel Service
 *
 * Manages local tunnels using cloudflared or ngrok to expose
 * the local webhook endpoint publicly.
 */

import { spawn, ChildProcess, execSync } from 'child_process';
import { EventEmitter } from 'events';

export type TunnelProvider = 'cloudflared' | 'ngrok';
export type TunnelStatus = 'stopped' | 'starting' | 'running' | 'error';

export interface TunnelInfo {
  provider: TunnelProvider | null;
  status: TunnelStatus;
  publicUrl: string | null;
  error: string | null;
  startedAt: string | null;
}

interface TunnelProviderInfo {
  name: TunnelProvider;
  installed: boolean;
  command: string;
}

class TunnelService extends EventEmitter {
  private process: ChildProcess | null = null;
  private provider: TunnelProvider | null = null;
  private status: TunnelStatus = 'stopped';
  private publicUrl: string | null = null;
  private error: string | null = null;
  private startedAt: string | null = null;
  private localPort: number;
  private outputBuffer: string = '';

  constructor(localPort: number = 19432) {
    super();
    this.localPort = localPort;
  }

  /**
   * Check which tunnel providers are installed
   */
  detectProviders(): TunnelProviderInfo[] {
    const providers: TunnelProviderInfo[] = [];

    // Check cloudflared
    try {
      execSync('which cloudflared', { stdio: 'ignore' });
      providers.push({
        name: 'cloudflared',
        installed: true,
        command: 'cloudflared',
      });
    } catch {
      providers.push({
        name: 'cloudflared',
        installed: false,
        command: 'cloudflared',
      });
    }

    // Check ngrok
    try {
      execSync('which ngrok', { stdio: 'ignore' });
      providers.push({
        name: 'ngrok',
        installed: true,
        command: 'ngrok',
      });
    } catch {
      providers.push({
        name: 'ngrok',
        installed: false,
        command: 'ngrok',
      });
    }

    return providers;
  }

  /**
   * Get the best available provider
   */
  getBestProvider(): TunnelProvider | null {
    const providers = this.detectProviders();

    // Prefer cloudflared (free, no signup required)
    const cloudflared = providers.find(p => p.name === 'cloudflared' && p.installed);
    if (cloudflared) return 'cloudflared';

    const ngrok = providers.find(p => p.name === 'ngrok' && p.installed);
    if (ngrok) return 'ngrok';

    return null;
  }

  /**
   * Start tunnel with specified or best available provider
   */
  async start(preferredProvider?: TunnelProvider): Promise<TunnelInfo> {
    if (this.status === 'running') {
      return this.getInfo();
    }

    const provider = preferredProvider || this.getBestProvider();

    if (!provider) {
      this.status = 'error';
      this.error = 'No tunnel provider installed. Install cloudflared or ngrok.';
      return this.getInfo();
    }

    // Verify provider is installed
    const providers = this.detectProviders();
    const providerInfo = providers.find(p => p.name === provider);
    if (!providerInfo?.installed) {
      this.status = 'error';
      this.error = `${provider} is not installed`;
      return this.getInfo();
    }

    this.provider = provider;
    this.status = 'starting';
    this.error = null;
    this.publicUrl = null;
    this.outputBuffer = '';

    try {
      if (provider === 'cloudflared') {
        await this.startCloudflared();
      } else {
        await this.startNgrok();
      }
    } catch (err) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : 'Failed to start tunnel';
    }

    return this.getInfo();
  }

  /**
   * Start cloudflared tunnel
   */
  private startCloudflared(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['tunnel', '--url', `http://localhost:${this.localPort}`];

      console.log(`[tunnel] Starting cloudflared: cloudflared ${args.join(' ')}`);

      this.process = spawn('cloudflared', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const timeout = setTimeout(() => {
        if (this.status === 'starting') {
          this.status = 'error';
          this.error = 'Timeout waiting for tunnel URL';
          reject(new Error('Timeout'));
        }
      }, 30000);

      this.process.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.outputBuffer += output;
        console.log(`[tunnel:stdout] ${output.trim()}`);
        this.parseCloudflaredOutput(output);

        if (this.publicUrl) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        this.outputBuffer += output;
        console.log(`[tunnel:stderr] ${output.trim()}`);
        // cloudflared outputs URL to stderr
        this.parseCloudflaredOutput(output);

        if (this.publicUrl) {
          clearTimeout(timeout);
          resolve();
        }
      });

      this.process.on('error', (err) => {
        clearTimeout(timeout);
        this.status = 'error';
        this.error = err.message;
        this.process = null;
        reject(err);
      });

      this.process.on('exit', (code) => {
        clearTimeout(timeout);
        console.log(`[tunnel] cloudflared exited with code ${code}`);
        if (this.status === 'running') {
          this.status = 'stopped';
          this.publicUrl = null;
          this.emit('stopped');
        }
        this.process = null;
      });
    });
  }

  /**
   * Parse cloudflared output for the public URL
   */
  private parseCloudflaredOutput(output: string): void {
    // cloudflared outputs: https://xxx.trycloudflare.com
    const urlMatch = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (urlMatch && !this.publicUrl) {
      this.publicUrl = urlMatch[0];
      this.status = 'running';
      this.startedAt = new Date().toISOString();
      console.log(`[tunnel] Public URL: ${this.publicUrl}`);
      this.emit('connected', this.publicUrl);
    }
  }

  /**
   * Start ngrok tunnel
   */
  private startNgrok(): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['http', this.localPort.toString()];

      console.log(`[tunnel] Starting ngrok: ngrok ${args.join(' ')}`);

      this.process = spawn('ngrok', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // ngrok needs a different approach - it runs a local API
      // We'll poll the ngrok API for the tunnel URL
      const checkNgrokApi = async () => {
        try {
          const response = await fetch('http://127.0.0.1:4040/api/tunnels');
          const data = await response.json() as { tunnels: Array<{ public_url: string }> };
          if (data.tunnels && data.tunnels.length > 0) {
            const httpsUrl = data.tunnels.find((t: { public_url: string }) => t.public_url.startsWith('https://'));
            if (httpsUrl) {
              this.publicUrl = httpsUrl.public_url;
              this.status = 'running';
              this.startedAt = new Date().toISOString();
              console.log(`[tunnel] ngrok URL: ${this.publicUrl}`);
              this.emit('connected', this.publicUrl);
              return true;
            }
          }
        } catch {
          // ngrok API not ready yet
        }
        return false;
      };

      // Poll for URL
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = setInterval(async () => {
        attempts++;
        const found = await checkNgrokApi();
        if (found) {
          clearInterval(pollInterval);
          resolve();
        } else if (attempts >= maxAttempts) {
          clearInterval(pollInterval);
          this.status = 'error';
          this.error = 'Timeout waiting for ngrok URL';
          reject(new Error('Timeout'));
        }
      }, 1000);

      this.process.on('error', (err) => {
        clearInterval(pollInterval);
        this.status = 'error';
        this.error = err.message;
        this.process = null;
        reject(err);
      });

      this.process.on('exit', (code) => {
        clearInterval(pollInterval);
        console.log(`[tunnel] ngrok exited with code ${code}`);
        if (this.status === 'running') {
          this.status = 'stopped';
          this.publicUrl = null;
          this.emit('stopped');
        }
        this.process = null;
      });
    });
  }

  /**
   * Stop the tunnel
   */
  stop(): TunnelInfo {
    if (this.process) {
      console.log('[tunnel] Stopping tunnel...');
      this.process.kill('SIGTERM');
      this.process = null;
    }

    this.status = 'stopped';
    this.publicUrl = null;
    this.error = null;
    this.startedAt = null;
    this.provider = null;

    return this.getInfo();
  }

  /**
   * Get current tunnel info
   */
  getInfo(): TunnelInfo {
    return {
      provider: this.provider,
      status: this.status,
      publicUrl: this.publicUrl,
      error: this.error,
      startedAt: this.startedAt,
    };
  }

  /**
   * Get webhook URL (public if tunnel running, local otherwise)
   */
  getWebhookUrl(): string {
    if (this.publicUrl) {
      return `${this.publicUrl}/api/tickets`;
    }
    return `http://localhost:${this.localPort}/api/tickets`;
  }
}

// Singleton instance
export const tunnelService = new TunnelService();

export default tunnelService;
