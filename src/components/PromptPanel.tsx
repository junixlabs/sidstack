import { useState, useCallback, KeyboardEvent } from "react";

import { useAppStore } from "../stores/appStore";

interface PromptPanelProps {
  agentId: string;
  onSendPrompt: (prompt: string, context: string[]) => void;
  className?: string;
  disabled?: boolean;
}

interface PromptHistoryItem {
  prompt: string;
  context: string[];
  timestamp: number;
}

const TEMPLATE_PROMPTS = [
  {
    label: "Fix bug",
    prompt: "Please fix the bug in the selected files. Analyze the issue and provide a solution.",
  },
  {
    label: "Add tests",
    prompt: "Add comprehensive unit tests for the selected files.",
  },
  {
    label: "Refactor",
    prompt: "Refactor the selected code to improve readability and maintainability.",
  },
  {
    label: "Explain",
    prompt: "Explain what this code does and how it works.",
  },
  {
    label: "Review",
    prompt: "Review this code for potential issues, bugs, and improvements.",
  },
  {
    label: "Document",
    prompt: "Add documentation and comments to explain the code.",
  },
];

export function PromptPanel({
  agentId,
  onSendPrompt,
  className = "",
  disabled = false,
}: PromptPanelProps) {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<PromptHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const { selectedFiles, clearSelectedFiles } = useAppStore();

  const handleSend = useCallback(() => {
    if (!prompt.trim() || disabled) return;

    const contextPaths = selectedFiles;
    onSendPrompt(prompt.trim(), contextPaths);

    // Add to history
    setHistory((prev) => [
      { prompt: prompt.trim(), context: contextPaths, timestamp: Date.now() },
      ...prev.slice(0, 19), // Keep last 20
    ]);

    setPrompt("");
    clearSelectedFiles();
  }, [prompt, disabled, selectedFiles, onSendPrompt, clearSelectedFiles]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTemplateSelect = (templatePrompt: string) => {
    setPrompt(templatePrompt);
    setShowTemplates(false);
  };

  const handleHistorySelect = (item: PromptHistoryItem) => {
    setPrompt(item.prompt);
    setShowHistory(false);
  };

  const removeContextFile = (path: string) => {
    useAppStore.getState().toggleFileSelection(path);
  };

  return (
    <div className={`flex flex-col bg-zinc-900 border border-zinc-700 rounded ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700 bg-zinc-800">
        <span className="text-sm text-zinc-300 font-medium">Prompt to {agentId}</span>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
            >
              Templates
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-10">
                {TEMPLATE_PROMPTS.map((template) => (
                  <button
                    key={template.label}
                    onClick={() => handleTemplateSelect(template.prompt)}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700"
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-2 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded"
            >
              History
            </button>
            {showHistory && history.length > 0 && (
              <div className="absolute right-0 top-full mt-1 w-72 bg-zinc-800 border border-zinc-700 rounded shadow-lg z-10 max-h-64 overflow-y-auto">
                {history.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleHistorySelect(item)}
                    className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-700 border-b border-zinc-700 last:border-0"
                  >
                    <div className="truncate">{item.prompt}</div>
                    <div className="text-zinc-500 text-[10px] mt-1">
                      {new Date(item.timestamp).toLocaleString()}
                      {item.context.length > 0 && ` - ${item.context.length} files`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context files */}
      {selectedFiles.length > 0 && (
        <div className="px-3 py-2 border-b border-zinc-700 bg-zinc-800/50">
          <div className="text-xs text-zinc-500 mb-1">Context files:</div>
          <div className="flex flex-wrap gap-1">
            {selectedFiles.map((file) => (
              <span
                key={file}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded"
              >
                <span className="truncate max-w-[150px]">
                  {file.split("/").pop()}
                </span>
                <button
                  onClick={() => removeContextFile(file)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Prompt textarea */}
      <div className="flex-1 p-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Enter your prompt here... (Cmd+Enter to send)"
          className="w-full h-32 bg-zinc-800 border border-zinc-700 rounded p-2 text-sm text-zinc-300 placeholder-zinc-600 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
      </div>

      {/* Footer with send button */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-700 bg-zinc-800">
        <span className="text-xs text-zinc-500">
          {selectedFiles.length > 0
            ? `${selectedFiles.length} file(s) as context`
            : "Select files in the tree to add as context"}
        </span>
        <button
          onClick={handleSend}
          disabled={!prompt.trim() || disabled}
          className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send to Agent
        </button>
      </div>
    </div>
  );
}
