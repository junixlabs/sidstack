import {
  Home,
  LayoutGrid,
  Users,
  FileText,
  Inbox,
} from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useAppStore, type AppView } from "@/stores/appStore";
import { useNotificationStore, selectPendingSpecCount } from "@/stores/notificationStore";

// Activity bar items matching VS Code pattern
const ACTIVITY_ITEMS: Array<{
  id: AppView;
  label: string;
  icon: typeof Home;
  shortcut: string;
}> = [
  { id: "dashboard", label: "Project", icon: Home, shortcut: "⌘1" },
  { id: "tasks", label: "Tasks", icon: LayoutGrid, shortcut: "⌘2" },
  { id: "tickets", label: "Tickets", icon: Inbox, shortcut: "⌘3" },
  { id: "agents", label: "Agents", icon: Users, shortcut: "⌘4" },
  { id: "specs", label: "Specs", icon: FileText, shortcut: "⌘5" },
];

interface ActivityBarProps {
  className?: string;
}

export function ActivityBar({ className }: ActivityBarProps) {
  const { theme, activeView, setActiveView, setActiveTab } = useAppStore();
  const pendingSpecCount = useNotificationStore(selectPendingSpecCount);
  const isDark = theme === "dark";

  const handleViewChange = (viewId: AppView) => {
    // Clear active file tab so view can render
    setActiveTab(null as unknown as string);
    setActiveView(viewId);
  };

  return (
    <aside
      className={cn(
        "flex-none w-12 flex flex-col items-center py-2 border-r",
        isDark ? "bg-[var(--surface-0)] border-[var(--surface-3)]" : "bg-gray-100 border-gray-200",
        className
      )}
    >
      {/* Activity icons */}
      <nav className="flex flex-col gap-1">
        {ACTIVITY_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          const hasBadge = item.id === "specs" && pendingSpecCount > 0;

          return (
            <Tooltip key={item.id} delayDuration={200}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleViewChange(item.id)}
                  className={cn(
                    "relative w-10 h-10 rounded-lg flex items-center justify-center",
                    "transition-all duration-100",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                    isActive
                      ? isDark
                        ? "bg-[var(--surface-2)] text-white"
                        : "bg-white text-blue-600 shadow-sm"
                      : isDark
                      ? "text-[var(--text-muted)] hover:text-white hover:bg-[var(--surface-1)]"
                      : "text-gray-500 hover:text-gray-900 hover:bg-white/50"
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="w-5 h-5" />

                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-6 rounded-r",
                        isDark ? "bg-white" : "bg-blue-600"
                      )}
                    />
                  )}

                  {/* Badge for pending specs */}
                  {hasBadge && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[11px] font-medium flex items-center justify-center">
                      {pendingSpecCount > 9 ? "9+" : pendingSpecCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label} <span className="text-[11px] opacity-50 ml-1">{item.shortcut}</span>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom section - can add settings/account later */}
    </aside>
  );
}
