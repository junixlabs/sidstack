/**
 * Project Settings Panel
 *
 * UI for configuring project-level defaults for sessions,
 * sync behavior, and agent settings.
 *
 * Design: Uses app design tokens (--surface-*, --text-*, --border-*)
 * to maintain visual consistency with other block views.
 */

import {
  AlertCircle,
  Check,
  Cloud,
  Copy,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Settings2,
  SplitSquareHorizontal,
  Square,
  SquarePlus,
  Terminal,
  Ticket,
  Users,
  Zap,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useProjectSettingsStore } from "@/stores/projectSettingsStore";
import { useTunnelStore } from "@/stores/tunnelStore";
import type { WindowMode, TerminalApp, LaunchMode } from "@sidstack/shared";

interface ProjectSettingsPanelProps {
  projectPath: string;
  className?: string;
}

const TERMINAL_OPTIONS: { value: TerminalApp; label: string }[] = [
  { value: "iTerm", label: "iTerm" },
  { value: "Terminal", label: "Terminal.app" },
  { value: "Warp", label: "Warp" },
  { value: "Alacritty", label: "Alacritty" },
  { value: "kitty", label: "Kitty" },
  { value: "ghostty", label: "Ghostty" },
  { value: "Hyper", label: "Hyper" },
];

const MODE_OPTIONS: { value: LaunchMode; label: string; icon: React.ReactNode }[] = [
  { value: "normal", label: "Normal", icon: <Terminal className="w-4 h-4" /> },
  { value: "skip-permissions", label: "Skip Permissions", icon: <Zap className="w-4 h-4 text-yellow-500" /> },
];

const WINDOW_MODE_OPTIONS: { value: WindowMode; label: string; icon: React.ReactNode }[] = [
  { value: "always-new", label: "New Window", icon: <SquarePlus className="w-4 h-4" /> },
  { value: "per-project-tabs", label: "Project Tabs", icon: <Layers className="w-4 h-4" /> },
  { value: "per-project-splits", label: "Split Panes", icon: <SplitSquareHorizontal className="w-4 h-4" /> },
];

const ROLE_OPTIONS = [
  { value: "dev", label: "Developer" },
  { value: "qa", label: "QA Tester" },
  { value: "ba", label: "Business Analyst" },
  { value: "orchestrator", label: "Orchestrator" },
];

export const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
  projectPath,
  className,
}) => {
  const {
    settings,
    isLoading,
    error,
    isDirty,
    loadSettings,
    saveSettings,
    updateSessionSettings,
    updateSyncSettings,
    updateAgentSettings,
    updateTicketSettings,
    resetToDefaults,
    clearError,
  } = useProjectSettingsStore();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  // Tunnel store
  const {
    info: tunnelInfo,
    providers: tunnelProviders,
    recommendedProvider,
    isLoading: isTunnelLoading,
    fetchStatus: fetchTunnelStatus,
    fetchProviders: fetchTunnelProviders,
    start: startTunnel,
    stop: stopTunnel,
  } = useTunnelStore();

  // Load settings on mount
  useEffect(() => {
    loadSettings(projectPath);
  }, [projectPath, loadSettings]);

  // Load tunnel status when self-hosted is enabled
  useEffect(() => {
    if (settings.ticket?.source === 'self-hosted' && settings.ticket?.tunnelEnabled) {
      fetchTunnelStatus();
      fetchTunnelProviders();
    }
  }, [settings.ticket?.source, settings.ticket?.tunnelEnabled, fetchTunnelStatus, fetchTunnelProviders]);

  // Sync tunnel URL to settings when tunnel connects
  useEffect(() => {
    if (tunnelInfo.status === 'running' && tunnelInfo.publicUrl) {
      const webhookUrl = `${tunnelInfo.publicUrl}/api/tickets`;
      if (settings.ticket?.tunnelUrl !== webhookUrl) {
        updateTicketSettings({ tunnelUrl: webhookUrl });
      }
    } else if (tunnelInfo.status === 'stopped' && settings.ticket?.tunnelUrl) {
      updateTicketSettings({ tunnelUrl: undefined });
    }
  }, [tunnelInfo.status, tunnelInfo.publicUrl, settings.ticket?.tunnelUrl, updateTicketSettings]);

  // Handle tunnel toggle
  const handleTunnelToggle = useCallback(async (enabled: boolean) => {
    updateTicketSettings({ tunnelEnabled: enabled });

    if (enabled) {
      await fetchTunnelProviders();
      await startTunnel();
    } else {
      await stopTunnel();
    }
  }, [updateTicketSettings, fetchTunnelProviders, startTunnel, stopTunnel]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    const success = await saveSettings();
    setIsSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  const handleReset = async () => {
    if (confirm("Reset all settings to defaults?")) {
      await resetToDefaults();
    }
  };

  const handleCopyWebhookUrl = () => {
    const url = settings.ticket?.tunnelUrl || "http://localhost:19432/api/tickets";
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading && !settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-muted)]" />
      </div>
    );
  }

  return (
    <div className={cn("text-[var(--text-primary)]", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-[var(--text-secondary)]" />
          <h2 className="text-sm font-medium text-[var(--text-primary)]">Project Settings</h2>
          {isDirty && (
            <Badge
              variant="outline"
              className="text-[11px] px-1.5 py-0 h-5 border-[var(--color-warning)] text-[var(--color-warning)]"
            >
              Unsaved
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isLoading}
            className="h-7 px-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className="h-7 px-3 text-xs"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : saveSuccess ? (
              <Check className="w-3.5 h-3.5 mr-1" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1" />
            )}
            {saveSuccess ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 px-3 py-2 rounded bg-[var(--color-error)]/10 text-[var(--color-error)] text-xs flex items-center justify-between">
          <span>{error}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearError}
            className="h-6 px-2 text-xs hover:bg-[var(--color-error)]/20"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Session Settings */}
      <SettingsSection
        icon={<Terminal className="w-3.5 h-3.5" />}
        title="Session Defaults"
        description="Default settings when launching Claude sessions"
      >
        {/* Default Terminal & Mode - 2 columns */}
        <div className="grid grid-cols-2 gap-3">
          <SettingsField label="Default Terminal">
            <Select
              value={settings.session.defaultTerminal}
              onValueChange={(v) => updateSessionSettings({ defaultTerminal: v as TerminalApp })}
            >
              <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-[var(--border-muted)] hover:border-[var(--border-default)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMINAL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>

          <SettingsField label="Default Mode">
            <Select
              value={settings.session.defaultMode}
              onValueChange={(v) => updateSessionSettings({ defaultMode: v as LaunchMode })}
            >
              <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-[var(--border-muted)] hover:border-[var(--border-default)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    <span className="flex items-center gap-2">
                      {opt.icon}
                      {opt.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsField>
        </div>

        {/* Window Mode - full width */}
        <SettingsField
          label="Window Mode"
          hint="How terminal windows are managed for this project"
        >
          <Select
            value={settings.session.windowMode}
            onValueChange={(v) => updateSessionSettings({ windowMode: v as WindowMode })}
          >
            <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-[var(--border-muted)] hover:border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_MODE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  <span className="flex items-center gap-2">
                    {opt.icon}
                    {opt.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      {/* Sync Settings */}
      <SettingsSection
        icon={<RefreshCw className="w-3.5 h-3.5" />}
        title="Sync Behavior"
        description="How session status is synchronized"
      >
        {/* Auto Sync Toggle */}
        <SettingsToggle
          label="Auto Sync"
          description="Automatically sync session status"
          checked={settings.sync.autoSyncEnabled}
          onCheckedChange={(v) => updateSyncSettings({ autoSyncEnabled: v })}
        />

        {/* Sync Interval - only show when auto sync enabled */}
        {settings.sync.autoSyncEnabled && (
          <SettingsSlider
            label="Sync Interval"
            value={settings.sync.syncIntervalSeconds}
            onChange={(v) => updateSyncSettings({ syncIntervalSeconds: v })}
            min={15}
            max={120}
            step={5}
            unit="s"
            hint="How often to check session status (15-120 seconds)"
          />
        )}

        {/* Sync on Focus */}
        <SettingsToggle
          label="Sync on Window Focus"
          description="Sync when app window gains focus"
          checked={settings.sync.syncOnWindowFocus}
          onCheckedChange={(v) => updateSyncSettings({ syncOnWindowFocus: v })}
        />

        {/* Auto Refresh */}
        <div className="pt-2 border-t border-[var(--border-muted)]">
          <SettingsToggle
            label="Auto Refresh Data"
            description="Automatically refresh views (Tickets, Tasks, Sessions)"
            checked={settings.sync.autoRefreshEnabled}
            onCheckedChange={(v) => updateSyncSettings({ autoRefreshEnabled: v })}
          />

          {settings.sync.autoRefreshEnabled && (
            <SettingsSlider
              label="Refresh Interval"
              value={settings.sync.autoRefreshIntervalSeconds}
              onChange={(v) => updateSyncSettings({ autoRefreshIntervalSeconds: v })}
              min={5}
              max={60}
              step={5}
              unit="s"
              hint="How often to refresh data (5-60 seconds)"
            />
          )}
        </div>
      </SettingsSection>

      {/* Agent Settings */}
      <SettingsSection
        icon={<Users className="w-3.5 h-3.5" />}
        title="Agent Defaults"
        description="Default settings for spawned agents"
      >
        {/* Default Role */}
        <SettingsField label="Default Role">
          <Select
            value={settings.agent.defaultRole}
            onValueChange={(v) => updateAgentSettings({ defaultRole: v })}
          >
            <SelectTrigger className="h-8 text-xs bg-[var(--surface-2)] border-[var(--border-muted)] hover:border-[var(--border-default)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>

        {/* Max Concurrent Agents */}
        <SettingsSlider
          label="Max Concurrent Agents"
          value={settings.agent.maxConcurrentAgents}
          onChange={(v) => updateAgentSettings({ maxConcurrentAgents: v })}
          min={1}
          max={10}
          step={1}
        />

        {/* Auto Recovery */}
        <SettingsToggle
          label="Auto Recovery"
          description="Automatically recover failed agents"
          checked={settings.agent.autoRecoveryEnabled}
          onCheckedChange={(v) => updateAgentSettings({ autoRecoveryEnabled: v })}
        />
      </SettingsSection>

      {/* Ticket Settings */}
      <SettingsSection
        icon={<Ticket className="w-3.5 h-3.5" />}
        title="Ticket Source"
        description="Configure how tickets are received from external sources"
      >
        {/* Source Selection */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => updateTicketSettings({ source: 'self-hosted' })}
            className={cn(
              "flex items-center gap-2 p-3 rounded-md border text-left transition-colors",
              settings.ticket?.source === 'self-hosted'
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                : "border-[var(--border-muted)] hover:border-[var(--border-default)] bg-[var(--surface-2)]"
            )}
          >
            <Server className={cn(
              "w-4 h-4",
              settings.ticket?.source === 'self-hosted' ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
            )} />
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">Self-hosted</div>
              <div className="text-[11px] text-[var(--text-muted)]">Local webhook endpoint</div>
            </div>
          </button>
          <button
            onClick={() => updateTicketSettings({ source: 'sidstack-cloud' })}
            className={cn(
              "flex items-center gap-2 p-3 rounded-md border text-left transition-colors",
              settings.ticket?.source === 'sidstack-cloud'
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                : "border-[var(--border-muted)] hover:border-[var(--border-default)] bg-[var(--surface-2)]"
            )}
          >
            <Cloud className={cn(
              "w-4 h-4",
              settings.ticket?.source === 'sidstack-cloud' ? "text-[var(--accent-primary)]" : "text-[var(--text-muted)]"
            )} />
            <div>
              <div className="text-xs font-medium text-[var(--text-primary)]">SidStack Cloud</div>
              <div className="text-[11px] text-[var(--text-muted)]">Cloud relay service</div>
            </div>
          </button>
        </div>

        {/* Self-hosted mode options */}
        {settings.ticket?.source === 'self-hosted' && (
          <>
            {/* Enable Webhook */}
            <SettingsToggle
              label="Enable Webhook Endpoint"
              description="Accept incoming tickets via POST /api/tickets"
              checked={settings.ticket?.webhookEnabled ?? false}
              onCheckedChange={(v) => updateTicketSettings({ webhookEnabled: v })}
            />

            {settings.ticket?.webhookEnabled && (
              <>
                {/* Webhook URL */}
                <div className="p-2.5 rounded bg-[var(--surface-2)] border border-[var(--border-muted)]">
                  <Label className="text-[11px] text-[var(--text-muted)]">Webhook URL</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-[var(--text-primary)] flex-1 truncate font-mono">
                      {settings.ticket?.tunnelUrl || "http://localhost:19432/api/tickets"}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2"
                      onClick={handleCopyWebhookUrl}
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                </div>

                {/* Tunnel Section */}
                <div className="p-3 rounded bg-[var(--surface-2)] border border-[var(--border-muted)] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-xs text-[var(--text-primary)]">Public Tunnel</Label>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Expose webhook URL publicly
                      </p>
                    </div>
                    <Switch
                      checked={settings.ticket?.tunnelEnabled ?? false}
                      onCheckedChange={handleTunnelToggle}
                      disabled={isTunnelLoading}
                      className="data-[state=checked]:bg-[var(--accent-primary)]"
                    />
                  </div>

                  {settings.ticket?.tunnelEnabled && (
                    <>
                      {/* Tunnel Status */}
                      <div className="flex items-center justify-between py-2 border-t border-[var(--border-muted)]">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            tunnelInfo.status === 'running' && "bg-green-500",
                            tunnelInfo.status === 'starting' && "bg-yellow-500 animate-pulse",
                            tunnelInfo.status === 'stopped' && "bg-gray-400",
                            tunnelInfo.status === 'error' && "bg-red-500"
                          )} />
                          <span className="text-[11px] text-[var(--text-secondary)]">
                            {tunnelInfo.status === 'running' && `Running (${tunnelInfo.provider})`}
                            {tunnelInfo.status === 'starting' && 'Starting...'}
                            {tunnelInfo.status === 'stopped' && 'Stopped'}
                            {tunnelInfo.status === 'error' && 'Error'}
                          </span>
                        </div>
                        {tunnelInfo.status === 'running' ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => stopTunnel()}
                            disabled={isTunnelLoading}
                          >
                            <Square className="w-3 h-3 mr-1" />
                            Stop
                          </Button>
                        ) : tunnelInfo.status !== 'starting' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => startTunnel()}
                            disabled={isTunnelLoading}
                          >
                            {isTunnelLoading ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Play className="w-3 h-3 mr-1" />
                            )}
                            Start
                          </Button>
                        )}
                      </div>

                      {/* Error Message */}
                      {tunnelInfo.status === 'error' && tunnelInfo.error && (
                        <div className="flex items-start gap-2 p-2 rounded bg-[var(--color-error)]/10 text-[var(--color-error)]">
                          <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                          <div className="text-[11px]">
                            <p>{tunnelInfo.error}</p>
                            {!recommendedProvider && (
                              <p className="mt-1 text-[var(--text-muted)]">
                                Install{' '}
                                <a
                                  href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-[var(--text-primary)]"
                                >
                                  cloudflared
                                </a>
                                {' '}or{' '}
                                <a
                                  href="https://ngrok.com/download"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="underline hover:text-[var(--text-primary)]"
                                >
                                  ngrok
                                </a>
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Public URL when running */}
                      {tunnelInfo.status === 'running' && tunnelInfo.publicUrl && (
                        <div className="p-2 rounded bg-[var(--color-success)]/10 border border-[var(--color-success)]/30">
                          <Label className="text-[11px] text-[var(--color-success)]">Public Webhook URL</Label>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs text-[var(--text-primary)] flex-1 truncate font-mono">
                              {tunnelInfo.publicUrl}/api/tickets
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => {
                                navigator.clipboard.writeText(`${tunnelInfo.publicUrl}/api/tickets`);
                                setCopied(true);
                                setTimeout(() => setCopied(false), 2000);
                              }}
                            >
                              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2"
                              onClick={() => window.open(`${tunnelInfo.publicUrl}/health`, '_blank')}
                            >
                              <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Provider Info */}
                      {tunnelProviders.length > 0 && tunnelInfo.status !== 'running' && (
                        <div className="text-[11px] text-[var(--text-muted)]">
                          Available: {tunnelProviders.filter(p => p.installed).map(p => p.name).join(', ') || 'None'}
                          {recommendedProvider && ` (using ${recommendedProvider})`}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Help text */}
                <p className="text-[11px] text-[var(--text-muted)]">
                  Configure your issue tracker (Jira, GitHub, Linear) to send webhooks to this URL.
                  Tickets will appear in the Ticket Queue for review.
                </p>
              </>
            )}
          </>
        )}

        {/* SidStack Cloud mode */}
        {settings.ticket?.source === 'sidstack-cloud' && (
          <>
            {/* Connection Status */}
            <div className="p-3 rounded bg-[var(--surface-2)] border border-[var(--border-muted)]">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs text-[var(--text-primary)]">Connection Status</Label>
                <span className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full",
                  settings.ticket?.cloud?.connected
                    ? "bg-[var(--color-success)]/20 text-[var(--color-success)]"
                    : "bg-[var(--text-muted)]/20 text-[var(--text-muted)]"
                )}>
                  {settings.ticket?.cloud?.connected ? 'Connected' : 'Not connected'}
                </span>
              </div>

              {settings.ticket?.cloud?.connected ? (
                <>
                  {/* Connected state */}
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Account</span>
                      <span className="text-[var(--text-primary)]">{settings.ticket.cloud.email}</span>
                    </div>
                    {settings.ticket.cloud.webhookUrl && (
                      <div>
                        <span className="text-[var(--text-muted)] block mb-1">Webhook URL</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-[var(--text-primary)] flex-1 truncate font-mono bg-[var(--surface-3)] px-2 py-1 rounded">
                            {settings.ticket.cloud.webhookUrl}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2"
                            onClick={() => {
                              navigator.clipboard.writeText(settings.ticket!.cloud!.webhookUrl!);
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                            }}
                          >
                            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-3 h-7 text-xs"
                    onClick={() => {
                      // TODO: Implement disconnect
                      updateTicketSettings({
                        cloud: { connected: false, status: 'disconnected' }
                      });
                    }}
                  >
                    Disconnect
                  </Button>
                </>
              ) : (
                <>
                  {/* Not connected state */}
                  <p className="text-[11px] text-[var(--text-muted)] mb-3">
                    Connect to SidStack Cloud to get a public webhook URL that forwards tickets to your local app in real-time.
                  </p>
                  <Button
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={() => {
                      // TODO: Implement connect flow
                      // For now, show coming soon
                      alert('SidStack Cloud is coming soon!');
                    }}
                  >
                    <Cloud className="w-3.5 h-3.5 mr-1.5" />
                    Connect to SidStack Cloud
                  </Button>
                </>
              )}
            </div>

            {/* Benefits */}
            <div className="text-[11px] text-[var(--text-muted)] space-y-1">
              <p className="font-medium text-[var(--text-secondary)]">Benefits:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-1">
                <li>No tunnel setup required</li>
                <li>Persistent webhook URL</li>
                <li>Real-time ticket sync via WebSocket</li>
                <li>Works behind firewalls</li>
              </ul>
            </div>
          </>
        )}
      </SettingsSection>
    </div>
  );
};

// =============================================================================
// Reusable Settings Components
// =============================================================================

/**
 * Settings Section - Card-like container for a group of settings
 */
interface SettingsSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
  return (
    <div className="mb-4 rounded-md border border-[var(--border-muted)] bg-[var(--surface-1)]">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[var(--border-muted)]">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <span className="text-[var(--text-secondary)]">{icon}</span>
          <span className="text-xs font-medium">{title}</span>
        </div>
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{description}</p>
      </div>
      {/* Content */}
      <div className="p-3 space-y-3">
        {children}
      </div>
    </div>
  );
}

/**
 * Settings Field - Label + input wrapper
 */
interface SettingsFieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function SettingsField({ label, hint, children }: SettingsFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-[var(--text-secondary)]">{label}</Label>
      {children}
      {hint && (
        <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}

/**
 * Settings Toggle - Switch with label and description
 */
interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SettingsToggle({ label, description, checked, onCheckedChange }: SettingsToggleProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="space-y-0.5">
        <Label className="text-xs text-[var(--text-primary)]">{label}</Label>
        <p className="text-[11px] text-[var(--text-muted)]">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-[var(--accent-primary)]"
      />
    </div>
  );
}

/**
 * Settings Slider - Slider with label and value display
 */
interface SettingsSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
}

function SettingsSlider({ label, value, onChange, min, max, step, unit, hint }: SettingsSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-[var(--text-secondary)]">{label}</Label>
        <span className="text-xs text-[var(--text-muted)] tabular-nums">
          {value}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(values: number[]) => onChange(values[0])}
        min={min}
        max={max}
        step={step}
        className="[&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
      />
      {hint && (
        <p className="text-[11px] text-[var(--text-muted)]">{hint}</p>
      )}
    </div>
  );
}

export default ProjectSettingsPanel;
