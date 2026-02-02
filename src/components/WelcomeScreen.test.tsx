/**
 * Tests - WelcomeScreen Component
 *
 * Verifies welcome UI, feature cards, and action buttons.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the raw changelog import
vi.mock("../../CHANGELOG.md?raw", () => ({
  default: "## [1.0.0] - 2026-01-21\n- Added new feature\n- Fixed critical bug\n- Improved performance",
}));

import { WelcomeScreen } from "./WelcomeScreen";

describe("WelcomeScreen", () => {
  const onOpenProject = vi.fn();
  const onShowDocs = vi.fn();

  it("renders welcome title and subtitle", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    expect(screen.getByText("Welcome to SidStack")).toBeInTheDocument();
    expect(screen.getByText("AI-Powered Project Intelligence Platform")).toBeInTheDocument();
  });

  it("displays feature cards", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    expect(screen.getByText("Project Hub")).toBeInTheDocument();
    expect(screen.getByText("Knowledge Browser")).toBeInTheDocument();
    expect(screen.getByText("Training Room")).toBeInTheDocument();
  });

  it("shows action buttons", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    expect(screen.getByText("Open Project")).toBeInTheDocument();
    expect(screen.getByText("Documentation")).toBeInTheDocument();
  });

  it("calls onOpenProject when Open Project clicked", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    fireEvent.click(screen.getByText("Open Project"));
    expect(onOpenProject).toHaveBeenCalledOnce();
  });

  it("calls onShowDocs when Documentation clicked", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    fireEvent.click(screen.getByText("Documentation"));
    expect(onShowDocs).toHaveBeenCalledOnce();
  });

  it("displays What's New section with changelog", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    expect(screen.getByText(/What's New in v1\.0\.0/)).toBeInTheDocument();
  });

  it("shows keyboard shortcut hint", () => {
    render(<WelcomeScreen onOpenProject={onOpenProject} onShowDocs={onShowDocs} />);

    expect(screen.getByText("Cmd+O")).toBeInTheDocument();
  });
});
