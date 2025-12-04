import { useEffect, useRef, useState } from "react";

import { useAgent, AgentOutput, AgentStatus } from "../hooks/useAgent";

interface AgentMonitorProps {
  agentId: string;
  className?: string;
  onPause?: () => void;
  onResume?: () => void;
}

const statusColors: Record<AgentStatus, string> = {
  disconnected: "bg-[var(--text-muted)]",
  connecting: "bg-[var(--text-secondary)] animate-pulse",
  connected: "bg-[var(--text-secondary)]",
  working: "bg-[var(--text-secondary)] animate-pulse",
  idle: "bg-[var(--text-secondary)]",
  error: "bg-[var(--text-secondary)]",
};

const statusLabels: Record<AgentStatus, string> = {
  disconnected: "Disconnected",
  connecting: "Connecting...",
  connected: "Connected",
  working: "Working",
  idle: "Idle",
  error: "Error",
};

function OutputLine({ output }: { output: AgentOutput }) {
  const typeColors: Record<string, string> = {
    stdout: "text-[var(--text-secondary)]",
    stderr: "text-[var(--text-secondary)]",
    tool_call: "text-[var(--text-secondary)]",
    result: "text-[var(--text-secondary)]",
  };

  const typeIcons: Record<string, string> = {
    stdout: "",
    stderr: "[!]",
    tool_call: "[>]",
    result: "[=]",
  };

  return (
    <div className={`font-mono text-xs ${typeColors[output.output_type] || "text-[var(--text-secondary)]"}`}>
      <span className="text-[var(--text-muted)] mr-2">
        {new Date(output.timestamp * 1000).toLocaleTimeString()}
      </span>
      {typeIcons[output.output_type] && (
        <span className="mr-1">{typeIcons[output.output_type]}</span>
      )}
      <span className="whitespace-pre-wrap">{output.content}</span>
    </div>
  );
}

export function AgentMonitor({ agentId, className = "", onPause, onResume }: AgentMonitorProps) {
  const {
    status,
    progress,
    outputs,
    error,
    isConnecting,
    connect,
    disconnect,
    clearOutputs,
    clearError,
  } = useAgent(agentId);

  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new output arrives
  useEffect(() => {
    if (autoScroll && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [outputs, autoScroll]);

  // Handle scroll to detect manual scrolling
  const handleScroll = () => {
    if (outputRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = outputRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      setIsPaused(false);
      onResume?.();
    } else {
      setIsPaused(true);
      onPause?.();
    }
  };

  return (
    <div className={`flex flex-col bg-[var(--surface-0)] border border-[var(--border-default)] rounded ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-default)] bg-[var(--surface-1)]">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-sm text-[var(--text-secondary)] font-medium">{agentId}</span>
          <span className="text-xs text-[var(--text-muted)]">{statusLabels[status]}</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "disconnected" ? (
            <button
              onClick={connect}
              disabled={isConnecting}
              className="px-2 py-1 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)] rounded disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect"}
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseResume}
                className={`px-2 py-1 text-xs rounded ${
                  isPaused
                    ? "bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)]"
                    : "bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)]"
                }`}
              >
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={disconnect}
                className="px-2 py-1 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] rounded"
              >
                Disconnect
              </button>
            </>
          )}
          <button
            onClick={clearOutputs}
            className="px-2 py-1 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] rounded"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {status === "working" && progress > 0 && (
        <div className="h-1 bg-[var(--surface-2)]">
          <div
            className="h-full bg-[var(--text-secondary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-2)] border-b border-[var(--border-muted)]">
          <span className="text-xs text-[var(--text-secondary)]">{error}</span>
          <button onClick={clearError} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
            x
          </button>
        </div>
      )}

      {/* Output area */}
      <div
        ref={outputRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1 min-h-[200px] max-h-[400px]"
      >
        {outputs.length === 0 ? (
          <div className="text-[var(--text-muted)] text-sm text-center py-8">
            {status === "disconnected"
              ? "Connect to see agent output"
              : "Waiting for output..."}
          </div>
        ) : (
          outputs.map((output, idx) => <OutputLine key={idx} output={output} />)
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && outputs.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (outputRef.current) {
              outputRef.current.scrollTop = outputRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 px-2 py-1 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-4)] text-[var(--text-primary)] rounded shadow"
        >
          Scroll to bottom
        </button>
      )}
    </div>
  );
}
