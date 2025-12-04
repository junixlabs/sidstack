/**
 * Tests - OnboardingProgress Component
 *
 * Verifies milestone display, progress tracking, and completion state.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { useOnboardingStore } from "@/stores/onboardingStore";

import { OnboardingProgress } from "./OnboardingProgress";

// Wrapper with required providers
function Wrapper({ children }: { children: React.ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

describe("OnboardingProgress", () => {
  beforeEach(() => {
    // Reset store to all milestones incomplete
    useOnboardingStore.setState({
      milestones: {
        projectOpened: false,
        projectHubViewed: false,
        knowledgeBrowsed: false,
        sessionLaunched: false,
        taskCreated: false,
        taskCompleted: false,
        trainingRoomVisited: false,
        impactAnalysisViewed: false,
        ticketQueueViewed: false,
      },
    });
  });

  it("renders full mode with milestone list", () => {
    render(<OnboardingProgress />, { wrapper: Wrapper });

    expect(screen.getByText("Getting Started")).toBeInTheDocument();
    expect(screen.getByText("View Project Hub")).toBeInTheDocument();
    expect(screen.getByText("Browse Knowledge")).toBeInTheDocument();
    expect(screen.getByText("Launch Session")).toBeInTheDocument();
    expect(screen.getByText("Create Task")).toBeInTheDocument();
    expect(screen.getByText("0/4")).toBeInTheDocument();
  });

  it("shows progress count when milestones completed", () => {
    useOnboardingStore.setState({
      milestones: {
        projectOpened: false,
        projectHubViewed: true,
        knowledgeBrowsed: true,
        sessionLaunched: false,
        taskCreated: false,
        taskCompleted: false,
        trainingRoomVisited: false,
        impactAnalysisViewed: false,
        ticketQueueViewed: false,
      },
    });

    render(<OnboardingProgress />, { wrapper: Wrapper });

    expect(screen.getByText("2/4")).toBeInTheDocument();
  });

  it("shows completion state when all milestones done", () => {
    useOnboardingStore.setState({
      milestones: {
        projectOpened: true,
        projectHubViewed: true,
        knowledgeBrowsed: true,
        sessionLaunched: true,
        taskCreated: true,
        taskCompleted: true,
        trainingRoomVisited: true,
        impactAnalysisViewed: true,
        ticketQueueViewed: true,
      },
    });

    render(<OnboardingProgress />, { wrapper: Wrapper });

    expect(screen.getByText("Onboarding complete")).toBeInTheDocument();
    // Should not show milestone list
    expect(screen.queryByText("View Project Hub")).not.toBeInTheDocument();
  });

  it("renders compact mode with progress counter", () => {
    useOnboardingStore.setState({
      milestones: {
        projectOpened: false,
        projectHubViewed: true,
        knowledgeBrowsed: false,
        sessionLaunched: false,
        taskCreated: false,
        taskCompleted: false,
        trainingRoomVisited: false,
        impactAnalysisViewed: false,
        ticketQueueViewed: false,
      },
    });

    render(<OnboardingProgress compact />, { wrapper: Wrapper });

    expect(screen.getByText("1/4")).toBeInTheDocument();
    // Full mode elements should not be visible
    expect(screen.queryByText("Getting Started")).not.toBeInTheDocument();
  });
});
