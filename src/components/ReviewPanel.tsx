import { useState, useCallback } from "react";

import { FileDiff } from "../types";

interface ReviewPanelProps {
  taskId: string;
  branchName: string;
  diffs: FileDiff[];
  onApprove: (comment?: string) => void;
  onReject: (comment: string) => void;
  onMerge: () => void;
  className?: string;
  isApproved?: boolean;
  isMerging?: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "code-review", label: "Code has been reviewed", checked: false },
  { id: "tests-pass", label: "Tests pass", checked: false },
  { id: "no-conflicts", label: "No merge conflicts", checked: false },
  { id: "docs-updated", label: "Documentation updated (if needed)", checked: false },
  { id: "security", label: "Security considerations checked", checked: false },
];

export function ReviewPanel({
  taskId,
  branchName,
  diffs,
  onApprove,
  onReject,
  onMerge,
  className = "",
  isApproved = false,
  isMerging = false,
}: ReviewPanelProps) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);
  const [rejectComment, setRejectComment] = useState("");
  const [approveComment, setApproveComment] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [mergeStatus, setMergeStatus] = useState<"idle" | "merging" | "success" | "error">(
    "idle"
  );

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item))
    );
  };

  const allChecked = checklist.every((item) => item.checked);

  const handleApprove = useCallback(() => {
    onApprove(approveComment || undefined);
  }, [onApprove, approveComment]);

  const handleReject = useCallback(() => {
    if (!rejectComment.trim()) {
      alert("Please provide a reason for rejection");
      return;
    }
    onReject(rejectComment.trim());
    setShowRejectInput(false);
    setRejectComment("");
  }, [onReject, rejectComment]);

  const handleMerge = useCallback(() => {
    setMergeStatus("merging");
    onMerge();
  }, [onMerge]);

  // Calculate stats
  const stats = diffs.reduce(
    (acc, diff) => ({
      files: acc.files + 1,
      additions: acc.additions + diff.additions,
      deletions: acc.deletions + diff.deletions,
    }),
    { files: 0, additions: 0, deletions: 0 }
  );

  return (
    <div className={`flex flex-col bg-[var(--surface-1)] border border-[var(--border-muted)] rounded ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-2)]">
        <div>
          <span className="text-sm text-[var(--text-secondary)] font-medium">Review: {taskId}</span>
          <span className="ml-2 text-xs text-[var(--text-muted)]">{branchName}</span>
        </div>
        <div className="flex items-center gap-2">
          {isApproved && (
            <span className="px-2 py-0.5 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] rounded">
              Approved
            </span>
          )}
          {mergeStatus === "success" && (
            <span className="px-2 py-0.5 text-xs bg-[var(--surface-2)] text-[var(--text-secondary)] rounded">
              Merged
            </span>
          )}
        </div>
      </div>

      {/* Stats summary */}
      <div className="px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-2)] flex items-center gap-4">
        <span className="text-sm text-[var(--text-muted)]">
          {stats.files} file{stats.files !== 1 ? "s" : ""} changed
        </span>
        <span className="text-sm text-[var(--text-secondary)]">+{stats.additions}</span>
        <span className="text-sm text-[var(--text-secondary)]">-{stats.deletions}</span>
      </div>

      {/* Files affected */}
      <div className="px-3 py-2 border-b border-[var(--border-muted)] max-h-32 overflow-y-auto">
        <div className="text-xs text-[var(--text-muted)] mb-1">Files affected:</div>
        <div className="space-y-1">
          {diffs.map((diff) => (
            <div key={diff.path} className="flex items-center gap-2 text-xs">
              <span
                className={`w-4 text-center ${
                  diff.status === "added"
                    ? "text-[var(--text-secondary)]"
                    : diff.status === "deleted"
                    ? "text-[var(--text-secondary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {diff.status === "added" ? "A" : diff.status === "deleted" ? "D" : "M"}
              </span>
              <span className="text-[var(--text-secondary)] truncate flex-1">{diff.path}</span>
              <span className="text-[var(--text-secondary)]">+{diff.additions}</span>
              <span className="text-[var(--text-secondary)]">-{diff.deletions}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist */}
      <div className="px-3 py-2 border-b border-[var(--border-muted)]">
        <div className="text-xs text-[var(--text-muted)] mb-2">Review checklist:</div>
        <div className="space-y-1">
          {checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]"
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={() => toggleChecklistItem(item.id)}
                className="w-3 h-3 rounded border-[var(--border-muted)] bg-[var(--surface-2)] text-[var(--text-secondary)] focus:ring-[var(--border-default)] focus:ring-offset-0"
              />
              {item.label}
            </label>
          ))}
        </div>
      </div>

      {/* Reject comment input */}
      {showRejectInput && (
        <div className="px-3 py-2 border-b border-[var(--border-muted)] bg-[var(--surface-2)]">
          <textarea
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
            placeholder="Reason for rejection (required)"
            className="w-full h-20 bg-[var(--surface-2)] border border-[var(--border-muted)] rounded p-2 text-xs text-[var(--text-secondary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-[var(--border-default)]"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => setShowRejectInput(false)}
              className="px-2 py-1 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              className="px-2 py-1 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] rounded"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      )}

      {/* Approve comment input */}
      {!showRejectInput && !isApproved && (
        <div className="px-3 py-2 border-b border-[var(--border-muted)]">
          <input
            type="text"
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            placeholder="Optional comment for approval"
            className="w-full bg-[var(--surface-2)] border border-[var(--border-muted)] rounded px-2 py-1 text-xs text-[var(--text-secondary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--border-default)]"
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between px-3 py-2 bg-[var(--surface-2)]">
        <div className="text-xs text-[var(--text-muted)]">
          {allChecked ? "All checks passed" : "Complete checklist to approve"}
        </div>
        <div className="flex items-center gap-2">
          {!isApproved && (
            <>
              <button
                onClick={() => setShowRejectInput(true)}
                className="px-3 py-1.5 text-xs bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-secondary)] rounded border border-[var(--border-muted)]"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                disabled={!allChecked}
                className="px-3 py-1.5 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
            </>
          )}
          {isApproved && (
            <button
              onClick={handleMerge}
              disabled={isMerging || mergeStatus === "success"}
              className="px-4 py-1.5 text-xs bg-[var(--surface-3)] hover:bg-[var(--surface-3)] text-[var(--text-primary)] rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isMerging ? (
                <>
                  <span className="w-3 h-3 border-2 border-[var(--text-muted)] border-t-[var(--text-primary)] rounded-full animate-spin" />
                  Merging...
                </>
              ) : mergeStatus === "success" ? (
                "Merged"
              ) : (
                "Merge"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
