import clsx from "clsx";
import { Search } from "lucide-react";
import { useCallback, useMemo } from "react";

import { useReviewStore, type ChangedFile, type FileStatus } from "@/stores/reviewStore";

interface ReviewSidebarProps {
  files: ChangedFile[];
}

/**
 * Status badge (A, M, D, R)
 */
function StatusBadge({ status }: { status: FileStatus }) {
  const letter = status[0].toUpperCase();
  // Monochrome neutral palette - all statuses use same styling
  const colorClass = "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border-default)]";

  return (
    <span
      className={clsx(
        "inline-flex items-center justify-center",
        "w-5 h-5 text-[11px] font-semibold",
        "rounded border",
        colorClass
      )}
    >
      {letter}
    </span>
  );
}

/**
 * File item row
 */
function FileItem({ file, isSelected }: { file: ChangedFile; isSelected: boolean }) {
  const selectFile = useReviewStore((state) => state.selectFile);

  const handleClick = useCallback(() => {
    selectFile(file.path);
  }, [file.path, selectFile]);

  // Extract filename from path
  const fileName = useMemo(() => {
    const parts = file.path.split("/");
    return parts[parts.length - 1];
  }, [file.path]);

  // Get directory path (shortened if too long)
  const dirPath = useMemo(() => {
    const parts = file.path.split("/");
    if (parts.length <= 1) return "";
    const dir = parts.slice(0, -1).join("/");
    return dir.length > 30 ? "..." + dir.slice(-27) : dir;
  }, [file.path]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        "w-full flex items-center gap-2 px-2 py-1.5",
        "text-left text-sm",
        "hover:bg-[var(--surface-2)] transition-colors",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--border-active)]",
        isSelected && "bg-[var(--surface-2)] border-l-2 border-[var(--border-active)]"
      )}
    >
      <StatusBadge status={file.status} />

      <div className="flex-1 min-w-0">
        <div className="text-[var(--text-primary)] truncate">{fileName}</div>
        {dirPath && <div className="text-[var(--text-muted)] text-xs truncate">{dirPath}</div>}
      </div>

      <div className="flex items-center gap-1 text-xs shrink-0">
        {file.additions > 0 && <span className="text-[var(--text-secondary)]">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-[var(--text-secondary)]">-{file.deletions}</span>}
      </div>
    </button>
  );
}

/**
 * Sidebar component showing changed files
 */
export function ReviewSidebar({ files }: ReviewSidebarProps) {
  const { fileFilter, setFileFilter, selectedFilePath } = useReviewStore();

  const handleFilterChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFileFilter(e.target.value);
    },
    [setFileFilter]
  );

  // Group files by status for summary
  const summary = useMemo(() => {
    return files.reduce(
      (acc, file) => {
        acc[file.status] = (acc[file.status] || 0) + 1;
        return acc;
      },
      {} as Record<FileStatus, number>
    );
  }, [files]);

  return (
    <div className="flex flex-col h-full bg-[var(--surface-1)] border-r border-[var(--border-default)]">
      {/* Search/filter input */}
      <div className="p-2 border-b border-[var(--border-default)]">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={fileFilter}
            onChange={handleFilterChange}
            placeholder="Filter files..."
            className={clsx(
              "w-full pl-8 pr-3 py-1.5",
              "bg-[var(--surface-2)] border border-[var(--border-default)] rounded",
              "text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]",
              "focus:outline-none focus:border-[var(--border-active)]"
            )}
          />
        </div>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border-default)] text-xs">
        <span className="text-[var(--text-muted)]">{files.length} files</span>
        {summary.added && (
          <span className="text-[var(--text-secondary)]">+{summary.added}</span>
        )}
        {summary.modified && (
          <span className="text-[var(--text-secondary)]">~{summary.modified}</span>
        )}
        {summary.deleted && (
          <span className="text-[var(--text-secondary)]">-{summary.deleted}</span>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-sm">
            {fileFilter ? "No files match filter" : "No changed files"}
          </div>
        ) : (
          <div className="py-1">
            {files.map((file) => (
              <FileItem
                key={file.path}
                file={file}
                isSelected={file.path === selectedFilePath}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewSidebar;
