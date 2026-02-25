import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { useSidBotStore } from "@/stores/sidBotStore";

export function SidBotConfig() {
  const serverUrl = useSidBotStore((s) => s.serverUrl);
  const selectedModel = useSidBotStore((s) => s.selectedModel);
  const connectionOk = useSidBotStore((s) => s.connectionOk);
  const setServerUrl = useSidBotStore((s) => s.setServerUrl);
  const testConnection = useSidBotStore((s) => s.testConnection);

  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    setTesting(true);
    await testConnection();
    setTesting(false);
  };

  return (
    <div className="flex-1 flex flex-col p-4 gap-5 overflow-auto">
      {/* Server URL */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          Server URL
        </label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className={cn(
            "w-full bg-[var(--surface-2)] text-[var(--text-primary)] text-sm",
            "rounded-lg px-3 py-2 border border-[var(--border-muted)]",
            "placeholder:text-[var(--text-placeholder)]",
            "focus:outline-none focus:border-[var(--border-emphasis)]",
          )}
          placeholder="http://localhost:3222"
        />
      </div>

      {/* Model display */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          Model
        </label>
        <div className="text-sm text-[var(--text-muted)] bg-[var(--surface-2)] rounded-lg px-3 py-2 border border-[var(--border-muted)]">
          {selectedModel}
        </div>
      </div>

      {/* Test connection */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleTest}
          disabled={testing}
          className={cn(
            "flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "border border-[var(--border-default)]",
            "bg-[var(--surface-2)] text-[var(--text-secondary)]",
            "hover:bg-[var(--surface-3)] hover:text-[var(--text-primary)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
        >
          {testing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Testing...
            </>
          ) : (
            "Test Connection"
          )}
        </button>

        {/* Status indicators */}
        {connectionOk !== null && (
          <div className="flex flex-col gap-1.5 mt-1">
            <StatusRow ok={connectionOk} label="Server" />
            <StatusRow ok={connectionOk} label="Claude CLI" />
          </div>
        )}
      </div>
    </div>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-success)]" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-[var(--color-error)]" />
      )}
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span
        className={cn(
          "ml-auto",
          ok ? "text-[var(--color-success)]" : "text-[var(--color-error)]",
        )}
      >
        {ok ? "Connected" : "Offline"}
      </span>
    </div>
  );
}
