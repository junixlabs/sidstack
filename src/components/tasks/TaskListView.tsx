import type { Task } from "@/stores/taskStore";

import { TaskRow } from "./TaskRow";

interface TaskListViewProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onContextMenu?: (task: Task, event: React.MouseEvent) => void;
}

export function TaskListView({
  tasks,
  selectedTaskId,
  onSelectTask,
  onContextMenu,
}: TaskListViewProps) {
  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isSelected={task.id === selectedTaskId}
          onSelect={() => onSelectTask(task.id)}
          depth={0}
          hasChildren={false}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
