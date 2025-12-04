/**
 * Scope Section
 *
 * Displays the detected scope of a change including:
 * - Primary files and modules
 * - Dependent modules with impact levels
 * - Affected files from dependency expansion
 */

import {
  FileCode,
  Folder,
  ArrowRight,
  Box,
  Link2,
} from "lucide-react";
import { memo } from "react";

import { cn } from "@/lib/utils";
import type { ChangeScope, ImpactLevel, ScopedModule, ScopedFile } from "@sidstack/shared";

// =============================================================================
// Types
// =============================================================================

interface ScopeSectionProps {
  scope: ChangeScope;
  compact?: boolean;
  className?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getImpactLevelColor(level: ImpactLevel) {
  switch (level) {
    case "direct":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)] border-[var(--border-default)]";
    case "indirect":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)] border-[var(--border-default)]";
    case "cascade":
      return "text-[var(--text-secondary)] bg-[var(--surface-2)] border-[var(--border-default)]";
  }
}

function getImpactLevelBadge(level: ImpactLevel) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-xs font-medium border",
        getImpactLevelColor(level)
      )}
    >
      {level}
    </span>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

const ModuleItem = memo(function ModuleItem({
  module,
  showDependencyPath,
}: {
  module: ScopedModule;
  showDependencyPath?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-muted)] bg-[var(--surface-0)] px-3 py-2">
      <div className="flex items-center gap-2">
        <Box className="h-4 w-4 text-[var(--text-secondary)]" />
        <span className="text-sm text-[var(--text-primary)]">{module.moduleName}</span>
        {getImpactLevelBadge(module.impactLevel)}
      </div>

      {showDependencyPath && module.dependencyPath.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-[var(--text-muted)]">
          <Link2 className="h-3 w-3" />
          {module.dependencyPath.join(" → ")}
        </div>
      )}

      {module.reason && (
        <span className="text-xs text-[var(--text-muted)]">{module.reason}</span>
      )}
    </div>
  );
});

const FileItem = memo(function FileItem({
  file,
  isPrimary,
}: {
  file: string | ScopedFile;
  isPrimary?: boolean;
}) {
  const filePath = typeof file === "string" ? file : file.filePath;
  const fileName = filePath.split("/").pop() || filePath;
  const dirPath = filePath.substring(0, filePath.length - fileName.length - 1);

  if (typeof file === "string") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-0)] px-3 py-2">
        <FileCode className="h-4 w-4 text-[var(--text-secondary)]" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--text-primary)]">{fileName}</span>
          {dirPath && (
            <span className="ml-2 text-xs text-[var(--text-muted)]">{dirPath}</span>
          )}
        </div>
        {isPrimary && (
          <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
            primary
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-muted)] bg-[var(--surface-0)] px-3 py-2">
      <div className="flex items-center gap-2">
        <FileCode className="h-4 w-4 text-[var(--text-secondary)]" />
        <div className="flex-1 min-w-0">
          <span className="text-sm text-[var(--text-primary)]">{fileName}</span>
          {dirPath && (
            <span className="ml-2 text-xs text-[var(--text-muted)]">{dirPath}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getImpactLevelBadge(file.impactLevel)}
        {file.reason && (
          <span className="text-xs text-[var(--text-muted)]">{file.reason}</span>
        )}
      </div>
    </div>
  );
});

// =============================================================================
// Component
// =============================================================================

export const ScopeSection = memo(function ScopeSection({
  scope,
  compact = false,
  className,
}: ScopeSectionProps) {
  const hasNoScope =
    scope.primaryModules.length === 0 &&
    scope.primaryFiles.length === 0 &&
    scope.dependentModules.length === 0 &&
    scope.affectedFiles.length === 0;

  if (hasNoScope) {
    return (
      <div className={cn("px-4 py-6 text-center text-[var(--text-muted)]", className)}>
        No scope detected
      </div>
    );
  }

  return (
    <div className={cn("space-y-4 px-4 pb-4", className)}>
      {/* Primary Modules */}
      {scope.primaryModules.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <Folder className="h-4 w-4 text-[var(--text-secondary)]" />
            Primary Modules
          </h4>
          <div className="space-y-2">
            {scope.primaryModules.map((moduleName) => (
              <div
                key={moduleName}
                className="flex items-center gap-2 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-0)] px-3 py-2"
              >
                <Box className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">{moduleName}</span>
                <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--text-secondary)]">
                  primary
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Files */}
      {scope.primaryFiles.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <FileCode className="h-4 w-4 text-[var(--text-secondary)]" />
            Primary Files
            <span className="text-[var(--text-muted)]">({scope.primaryFiles.length})</span>
          </h4>
          <div className="space-y-1">
            {(compact ? scope.primaryFiles.slice(0, 5) : scope.primaryFiles).map(
              (file) => (
                <FileItem key={file} file={file} isPrimary />
              )
            )}
            {compact && scope.primaryFiles.length > 5 && (
              <div className="text-sm text-[var(--text-muted)] pl-6">
                +{scope.primaryFiles.length - 5} more files
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dependent Modules */}
      {scope.dependentModules.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <ArrowRight className="h-4 w-4 text-[var(--text-secondary)]" />
            Dependent Modules
            <span className="text-[var(--text-muted)]">
              ({scope.dependentModules.length})
            </span>
          </h4>
          <div className="space-y-2">
            {(compact
              ? scope.dependentModules.slice(0, 3)
              : scope.dependentModules
            ).map((module) => (
              <ModuleItem
                key={module.moduleId}
                module={module}
                showDependencyPath={!compact}
              />
            ))}
            {compact && scope.dependentModules.length > 3 && (
              <div className="text-sm text-[var(--text-muted)] pl-6">
                +{scope.dependentModules.length - 3} more modules
              </div>
            )}
          </div>
        </div>
      )}

      {/* Affected Files */}
      {scope.affectedFiles.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
            <FileCode className="h-4 w-4 text-[var(--text-muted)]" />
            Affected Files
            <span className="text-[var(--text-muted)]">
              ({scope.affectedFiles.length})
            </span>
          </h4>
          <div className="space-y-1">
            {(compact
              ? scope.affectedFiles.slice(0, 5)
              : scope.affectedFiles
            ).map((file) => (
              <FileItem key={file.filePath} file={file} />
            ))}
            {compact && scope.affectedFiles.length > 5 && (
              <div className="text-sm text-[var(--text-muted)] pl-6">
                +{scope.affectedFiles.length - 5} more files
              </div>
            )}
          </div>
        </div>
      )}

      {/* Affected Entities */}
      {scope.affectedEntities.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium text-[var(--text-primary)]">
            Affected Entities
          </h4>
          <div className="flex flex-wrap gap-2">
            {scope.affectedEntities.map((entity) => (
              <span
                key={entity}
                className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-primary)]"
              >
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Expansion depth info */}
      {scope.expansionDepth > 0 && (
        <div className="text-xs text-[var(--text-muted)]">
          Dependency expansion depth: {scope.expansionDepth}
        </div>
      )}
    </div>
  );
});

export default ScopeSection;
