import { getCurrentWindow, LogicalPosition, LogicalSize } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { FileText } from "lucide-react";
import { useEffect, useCallback, useState, useRef } from "react";
import { Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { AppSidebar, sidebarItems, type SidebarItem } from "./components/AppSidebar";
import { DocsDialog } from "./components/DocsDialog";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GovernancePrompt } from "./components/GovernancePrompt";
import { KeyboardShortcutsDialog, useKeyboardShortcutsDialog } from "./components/KeyboardShortcutsDialog";
import { LogoCompact } from "./components/Logo";
import { ServiceHealthBanner } from "./components/ServiceHealthBanner";
import { StatusBar } from "./components/StatusBar";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import { WorkspaceViewSwitcher } from "./components/blocks/layout/WorkspaceViewSwitcher";
import { GettingStartedModal } from "./components/onboarding/GettingStartedModal";
import { WorkspaceProvider, type WorkspaceRef } from "./contexts/WorkspaceContext";
import { useTray } from "./hooks/useTray";
import { useDocumentVisibility } from "./hooks/useVisibility";
import { useAppStore } from "./stores/appStore";
import { useOnboardingStore } from "./stores/onboardingStore";
import { useProjectStore, migrateFromOldWorkspaceModel, needsMigration } from "./stores/projectStore";


import "./index.css";

// Window state persistence
const WINDOW_STATE_KEY = "sidstack-window-state";
interface WindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximized: boolean; // Track maximized state
}

function saveWindowState(state: WindowState) {
  try {
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(state));
  } catch {
    console.debug("Failed to save window state");
  }
}

// Migration key to force clear old window states without isMaximized
const WINDOW_STATE_VERSION = 2;
const WINDOW_STATE_VERSION_KEY = "sidstack-window-state-version";

function loadWindowState(): WindowState | null {
  try {
    // Check version - if old version, clear state and start fresh
    const savedVersion = localStorage.getItem(WINDOW_STATE_VERSION_KEY);
    if (!savedVersion || parseInt(savedVersion) < WINDOW_STATE_VERSION) {
      localStorage.removeItem(WINDOW_STATE_KEY);
      localStorage.setItem(WINDOW_STATE_VERSION_KEY, String(WINDOW_STATE_VERSION));
      return null; // Force maximize on first run after migration
    }

    const stored = localStorage.getItem(WINDOW_STATE_KEY);
    if (stored) {
      const state = JSON.parse(stored);
      // Migration: add isMaximized if missing (default to true for better UX)
      if (state.isMaximized === undefined) {
        state.isMaximized = true;
      }
      return state;
    }
  } catch {
    console.debug("Failed to load window state");
  }
  return null;
}


import { LAYOUT } from "@/constants/layout";

function App() {
  const {
    projectPath,
    addWorkspace,
    openWorkspaces,
    switchWorkspace,
    workspaces,
    theme,
  } = useAppStore();

  const {
    openProject,
  } = useProjectStore();
  const { updateTooltip } = useTray();

  // Performance: Track document visibility for animation/polling optimization
  useDocumentVisibility();

  const [statusMessage, setStatusMessage] = useState("Ready");
  const [activeSidebarItem, setActiveSidebarItem] = useState("project-hub");
  const [showDocs, setShowDocs] = useState(false);
  const { open: showShortcuts, setOpen: setShowShortcuts } = useKeyboardShortcutsDialog();

  // Onboarding store
  const {
    showGettingStarted,
    setShowGettingStarted,
    isProjectOnboarded,
    dontShowAgain,
    completeMilestone,
  } = useOnboardingStore();

  // Ref to access active workspace's methods
  const activeWorkspaceRef = useRef<WorkspaceRef | null>(null);

  // Update tray when workspaces change
  useEffect(() => {
    const activeTaskCount = workspaces.filter((w) => w.status === "active").length;
    updateTooltip(activeTaskCount, 0);
  }, [workspaces, updateTooltip]);

  // Run migration from old workspace model on startup
  useEffect(() => {
    if (needsMigration()) {
      migrateFromOldWorkspaceModel().catch(console.error);
    }
  }, []);

  // Show Getting Started modal for new projects
  useEffect(() => {
    if (projectPath && !dontShowAgain && !isProjectOnboarded(projectPath)) {
      // Small delay to let the UI settle before showing modal
      const timer = setTimeout(() => {
        setShowGettingStarted(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [projectPath, dontShowAgain, isProjectOnboarded]);

  // Note: Session initialization is now handled by WorkspaceContext
  // Each workspace manages its own blocks and layout independently

  // Restore window state on mount
  // Note: Tauri config has "maximized": true, so window starts maximized by default
  // This effect only handles restoring non-maximized state if user previously resized
  useEffect(() => {
    const restoreWindowState = async () => {
      const savedState = loadWindowState();
      const appWindow = getCurrentWindow();

      try {
        if (savedState && !savedState.isMaximized) {
          // Only restore position/size if user explicitly un-maximized before
          await appWindow.unmaximize();
          await appWindow.setPosition(new LogicalPosition(savedState.x, savedState.y));
          await appWindow.setSize(new LogicalSize(savedState.width, savedState.height));
        }
        // Otherwise: keep maximized (from Tauri config default)
      } catch {
        // Window state restore failed, keep maximized
      }
    };
    restoreWindowState();
  }, []);

  // Save window state on close
  useEffect(() => {
    const saveAllBeforeClose = async () => {
      const appWindow = getCurrentWindow();
      try {
        const isMaximized = await appWindow.isMaximized();
        const position = await appWindow.outerPosition();
        const size = await appWindow.outerSize();
        saveWindowState({
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
          isMaximized,
        });
      } catch {
        // Window state save failed, ignore
      }
    };

    const appWindow = getCurrentWindow();
    const unlistenPromise = appWindow.onCloseRequested(async (event) => {
      event.preventDefault();
      await saveAllBeforeClose();
      await appWindow.close();
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);


  // Handle sidebar item click - switch to that view (fullscreen)
  // ViewSwitcher component handles block creation automatically
  const handleSidebarItemClick = useCallback((item: SidebarItem) => {
    if (!item.blockType) return;

    // Just switch the active view - ViewSwitcher handles the rest
    setActiveSidebarItem(item.id);
    setStatusMessage(`Switched to ${item.label}`);

    // Track onboarding milestones
    if (item.id === "project-hub") completeMilestone("projectHubViewed");
    if (item.id === "knowledge") completeMilestone("knowledgeBrowsed");
    if (item.id === "ticket-queue") completeMilestone("ticketQueueViewed");
    if (item.id === "training-room") completeMilestone("trainingRoomVisited");
  }, [completeMilestone]);

  // Handle navigation from Getting Started modal
  const handleOnboardingNavigate = useCallback((viewId: string) => {
    setActiveSidebarItem(viewId);
    const item = sidebarItems.find(i => i.id === viewId);
    if (item) {
      setStatusMessage(`Switched to ${item.label}`);
    }

    // Track onboarding milestones
    if (viewId === "project-hub") completeMilestone("projectHubViewed");
    if (viewId === "knowledge") completeMilestone("knowledgeBrowsed");
    if (viewId === "ticket-queue") completeMilestone("ticketQueueViewed");
    if (viewId === "training-room") completeMilestone("trainingRoomVisited");
  }, [completeMilestone]);

  // Handle worktree click - open worktree status view
  const handleWorktreeClick = useCallback((worktreePath: string, branch: string) => {
    const ws = activeWorkspaceRef.current;
    if (!ws) return;

    // Generate a unique sidebarItemId for this worktree
    const worktreeSidebarId = `worktree-${branch}`;

    // Check if there's already a worktree-status block for this worktree
    const existingBlockId = ws.findBlockBySidebarItemId(worktreeSidebarId);

    if (existingBlockId) {
      // View exists, just switch to it
      ws.setActiveBlock(existingBlockId);
    } else {
      // Create new block
      const blockId = ws.addBlock({
        viewType: "worktree-status",
        title: `Git: ${branch}`,
        worktreePath: worktreePath,
        sidebarItemId: worktreeSidebarId,
      });
      ws.setActiveBlock(blockId);
    }

    // Switch the active sidebar item to show this worktree view
    setActiveSidebarItem(worktreeSidebarId);
    setStatusMessage(`Viewing git status for ${branch}`);
  }, []);

  // Handle open project dialog
  const handleOpenProject = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });
      if (selected) {
        // Use new project-based model
        await openProject(selected as string);
        // Also add to old model for compatibility during migration
        addWorkspace(selected as string);
        setStatusMessage(`Opened: ${(selected as string).split("/").pop()}`);
      }
    } catch (e) {
      console.error("Failed to open project:", e);
    }
  }, [addWorkspace, openProject]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + O: Open project
      if ((e.metaKey || e.ctrlKey) && e.key === "o") {
        e.preventDefault();
        handleOpenProject();
      }

      // Cmd/Ctrl + W: Close active block
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        const ws = activeWorkspaceRef.current;
        if (ws) {
          const currentActiveBlockId = ws.getActiveBlockId();
          if (currentActiveBlockId) {
            ws.closeBlock(currentActiveBlockId);
          }
        }
      }

      // Cmd/Ctrl + 1-5: Sidebar navigation
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        const navigableItems = sidebarItems.filter(item => !item.separator);
        if (navigableItems[index]) {
          handleSidebarItemClick(navigableItems[index]);
        }
      }

      // Cmd/Ctrl + Alt + 1-9: Switch workspace by position
      if ((e.metaKey || e.ctrlKey) && e.altKey && e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        const index = parseInt(e.key) - 1;
        if (openWorkspaces[index]) {
          switchWorkspace(openWorkspaces[index]);
        }
      }

      // Cmd/Ctrl + [: Previous workspace
      if ((e.metaKey || e.ctrlKey) && e.key === "[") {
        e.preventDefault();
        const currentIndex = openWorkspaces.indexOf(projectPath || "");
        const newIndex = currentIndex > 0 ? currentIndex - 1 : openWorkspaces.length - 1;
        if (openWorkspaces[newIndex]) {
          switchWorkspace(openWorkspaces[newIndex]);
        }
      }

      // Cmd/Ctrl + ]: Next workspace
      if ((e.metaKey || e.ctrlKey) && e.key === "]") {
        e.preventDefault();
        const currentIndex = openWorkspaces.indexOf(projectPath || "");
        const newIndex = currentIndex < openWorkspaces.length - 1 ? currentIndex + 1 : 0;
        if (openWorkspaces[newIndex]) {
          switchWorkspace(openWorkspaces[newIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSidebarItemClick, openWorkspaces, projectPath, switchWorkspace, handleOpenProject]);

  return (
    <TooltipProvider delayDuration={300}>
      {/* APP SHELL - Full viewport, flex column layout */}
      <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--surface-0)]">
        {/* ===== ZONE 1: HEADER (40px fixed, simplified) ===== */}
        <header
          data-tauri-drag-region
          style={{ height: LAYOUT.HEADER_HEIGHT }}
          className="flex-none flex items-center pl-[72px] pr-3 border-b bg-[var(--surface-1)] border-[var(--border-muted)]"
        >
          {/* Left: Logo (pl-[72px] reserves space for macOS traffic lights with titleBarStyle: overlay) */}
          <div className="flex items-center">
            <LogoCompact size={24} />
          </div>

          {/* Workspace Tabs */}
          <WorkspaceTabs className="ml-3" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: Action buttons */}
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowDocs(true)}
                >
                  <FileText className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Documentation</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* ===== SERVICE HEALTH BANNER (conditional) ===== */}
        <ServiceHealthBanner />

        {/* ===== ZONE 2: MAIN CONTENT (Sidebar + Per-Workspace TileLayouts) ===== */}
        <main className="flex-1 min-h-0 overflow-hidden flex">
          {openWorkspaces.length === 0 ? (
            /* Welcome Screen - shown when no workspace is open */
            <WelcomeScreen
              onOpenProject={handleOpenProject}
              onShowDocs={() => setShowDocs(true)}
            />
          ) : (
            <>
              {/* App Sidebar - Navigation between block types */}
              <AppSidebar
                activeItem={activeSidebarItem}
                onItemClick={handleSidebarItemClick}
                onWorktreeClick={handleWorktreeClick}
              />

              {/* Workspace Content Area */}
              {/* Render ALL open workspaces, hide inactive with visibility (NOT display:none) */}
              {/* xterm.js requires elements to be in layout flow for dimension calculations */}
              {/* See: https://github.com/xtermjs/xterm.js/issues/3029 */}
              <div className="flex-1 min-h-0 overflow-hidden relative">
                {openWorkspaces.map((wsPath) => {
                  const isActiveWs = wsPath === projectPath;
                  return (
                    <div
                      key={wsPath}
                      className="absolute inset-0"
                      style={{
                        visibility: isActiveWs ? "visible" : "hidden",
                        zIndex: isActiveWs ? 1 : 0,
                        pointerEvents: isActiveWs ? "auto" : "none",
                      }}
                    >
                      <WorkspaceProvider
                        workspacePath={wsPath}
                        isActive={isActiveWs}
                        workspaceRef={isActiveWs ? activeWorkspaceRef : undefined}
                      >
                        <ErrorBoundary>
                          <WorkspaceViewSwitcher activeViewId={activeSidebarItem} />
                        </ErrorBoundary>
                      </WorkspaceProvider>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </main>

        {/* ===== ZONE 3: STATUS BAR (24px fixed) ===== */}
        <StatusBar statusMessage={statusMessage} />

        {/* ===== GLOBAL TOAST NOTIFICATIONS ===== */}
        <Toaster
          position="bottom-right"
          theme={theme === "dark" ? "dark" : "light"}
          richColors
          closeButton
          toastOptions={{
            duration: 4000,
            className: "text-[13px]",
          }}
        />

        {/* ===== GOVERNANCE PROMPT (shows when workspace lacks governance) ===== */}
        <GovernancePrompt />

        {/* ===== DOCUMENTATION DIALOG ===== */}
        <DocsDialog open={showDocs} onOpenChange={setShowDocs} />

        {/* ===== KEYBOARD SHORTCUTS DIALOG ===== */}
        <KeyboardShortcutsDialog open={showShortcuts} onOpenChange={setShowShortcuts} />

        {/* ===== GETTING STARTED MODAL (first-run experience) ===== */}
        {projectPath && (
          <GettingStartedModal
            open={showGettingStarted}
            onOpenChange={setShowGettingStarted}
            onNavigate={handleOnboardingNavigate}
            projectPath={projectPath}
          />
        )}
      </div>
    </TooltipProvider>
  );
}

export default App;
