/**
 * Settings Block View
 *
 * Block view for configuring project settings.
 */

import { Settings2 } from "lucide-react";

import { ProjectSettingsPanel } from "@/components/settings/ProjectSettingsPanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/stores/appStore";
import type { BlockViewProps } from "@/types/block";

import { registerBlockView } from "../BlockRegistry";

export const SettingsBlockView: React.FC<BlockViewProps> = (_props) => {
  const projectPath = useAppStore((s) => s.projectPath);

  if (!projectPath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)]">
        <Settings2 className="w-12 h-12 mb-4 opacity-50" />
        <p>No project selected</p>
        <p className="text-sm mt-1">Open a project to configure settings</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-6 max-w-2xl mx-auto">
        <ProjectSettingsPanel projectPath={projectPath} />
      </div>
    </ScrollArea>
  );
};

export default SettingsBlockView;

// Register in BlockRegistry
registerBlockView("settings", SettingsBlockView);
