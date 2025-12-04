import type { Task, TaskNode } from "@/stores/taskStore";

import { TaskRow } from "./TaskRow";

interface TaskTreeViewProps {
  nodes: TaskNode[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  expandedTasks: Set<string>;
  onToggleExpand: (id: string) => void;
  depth?: number;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

export function TaskTreeView({
  nodes,
  selectedTaskId,
  onSelectTask,
  expandedTasks,
  onToggleExpand,
  depth = 0,
  onContextMenu,
}: TaskTreeViewProps) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node, index) => {
        const hasChildren = node.children.length > 0;
        const isExpanded = expandedTasks.has(node.task.id);
        const isEpic = !node.task.parentTaskId && hasChildren;
        const isLast = index === nodes.length - 1;

        return (
          <div key={node.task.id}>
            <TaskRow
              task={node.task}
              isSelected={node.task.id === selectedTaskId}
              onSelect={() => onSelectTask(node.task.id)}
              depth={depth}
              hasChildren={hasChildren}
              isExpanded={isExpanded}
              isEpic={isEpic}
              childCount={node.children.length}
              isLast={isLast}
              onToggleExpand={() => onToggleExpand(node.task.id)}
              onContextMenu={onContextMenu}
            />
            {hasChildren && isExpanded && (
              <div className="relative">
                {/* Tree line for children */}
                {depth === 0 && (
                  <div
                    className="absolute left-[26px] top-0 bottom-0 w-px bg-[var(--border-muted)]"
                    style={{ height: 'calc(100% - 12px)' }}
                  />
                )}
                <TaskTreeView
                  nodes={node.children}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={onSelectTask}
                  expandedTasks={expandedTasks}
                  onToggleExpand={onToggleExpand}
                  depth={depth + 1}
                  onContextMenu={onContextMenu}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
