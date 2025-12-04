/**
 * Tests - StatusBar Component
 *
 * Verifies status display, active workspace indicators, and project info.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { useAppStore } from "@/stores/appStore";
import { useProjectStore } from "@/stores/projectStore";

import { StatusBar } from "./StatusBar";

describe("StatusBar", () => {
  beforeEach(() => {
    // Reset stores
    useAppStore.setState({
      workspaces: [],
      activeWorkspace: null,
      projectPath: null,
    });
    useProjectStore.setState({
      projects: [],
    });
  });

  it("renders with default status message", () => {
    render(<StatusBar />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders with custom status message", () => {
    render(<StatusBar statusMessage="Building..." />);

    expect(screen.getByText("Building...")).toBeInTheDocument();
  });

  it("has footer role=status for accessibility", () => {
    render(<StatusBar />);

    const footer = screen.getByRole("status");
    expect(footer).toBeInTheDocument();
    expect(footer.tagName).toBe("FOOTER");
  });

  it("shows active workspace count when workspaces are active", () => {
    useAppStore.setState({
      workspaces: [
        { id: "ws-1", path: "/test", branch_name: "main", status: "active" } as any,
        { id: "ws-2", path: "/test2", branch_name: "dev", status: "active" } as any,
      ],
    });

    render(<StatusBar />);

    expect(screen.getByText("2 working")).toBeInTheDocument();
  });

  it("shows project name when project is active", () => {
    useAppStore.setState({
      projectPath: "/projects/my-app",
    });
    useProjectStore.setState({
      projects: [
        {
          id: "proj-1",
          name: "My App",
          worktrees: [
            { id: "main", path: "/projects/my-app", ports: { dev: 3000 } },
          ],
        } as any,
      ],
    });

    render(<StatusBar />);

    expect(screen.getByText("My App")).toBeInTheDocument();
  });
});
