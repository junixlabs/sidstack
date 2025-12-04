import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// =============================================================================
// Onboarding Store
// Tracks user onboarding progress and preferences
// =============================================================================

export interface OnboardingMilestones {
  projectOpened: boolean;
  projectHubViewed: boolean;
  taskCreated: boolean;
  sessionLaunched: boolean;
  knowledgeBrowsed: boolean;
  taskCompleted: boolean;
  trainingRoomVisited: boolean;
  impactAnalysisViewed: boolean;
  ticketQueueViewed: boolean;
}

interface OnboardingState {
  // Modal state
  showGettingStarted: boolean;
  setShowGettingStarted: (show: boolean) => void;

  // User preferences
  dontShowAgain: boolean;
  setDontShowAgain: (value: boolean) => void;

  // Track which projects have been onboarded (by project path hash)
  onboardedProjects: string[];
  markProjectOnboarded: (projectPath: string) => void;
  isProjectOnboarded: (projectPath: string) => boolean;

  // Milestones tracking
  milestones: OnboardingMilestones;
  completeMilestone: (milestone: keyof OnboardingMilestones) => void;
  getMilestoneProgress: () => { completed: number; total: number };
  isOnboardingComplete: () => boolean;

  // Timestamps
  onboardingCompletedAt: number | null;
  firstSeenAt: number | null;

  // Actions
  resetOnboarding: () => void;
  skipOnboarding: (projectPath: string) => void;
}

// Hash a path to a short string for storage
function hashPath(path: string): string {
  let hash = 0;
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

const DEFAULT_MILESTONES: OnboardingMilestones = {
  projectOpened: false,
  projectHubViewed: false,
  taskCreated: false,
  sessionLaunched: false,
  knowledgeBrowsed: false,
  taskCompleted: false,
  trainingRoomVisited: false,
  impactAnalysisViewed: false,
  ticketQueueViewed: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      // Modal state
      showGettingStarted: false,
      setShowGettingStarted: (show) => set({ showGettingStarted: show }),

      // User preferences
      dontShowAgain: false,
      setDontShowAgain: (value) => set({ dontShowAgain: value }),

      // Onboarded projects tracking
      onboardedProjects: [],
      markProjectOnboarded: (projectPath) =>
        set((state) => {
          const hash = hashPath(projectPath);
          if (state.onboardedProjects.includes(hash)) return state;
          return {
            onboardedProjects: [...state.onboardedProjects, hash],
          };
        }),
      isProjectOnboarded: (projectPath) => {
        const hash = hashPath(projectPath);
        return get().onboardedProjects.includes(hash);
      },

      // Milestones
      milestones: DEFAULT_MILESTONES,
      completeMilestone: (milestone) =>
        set((state) => {
          if (state.milestones[milestone]) return state;

          const newMilestones = { ...state.milestones, [milestone]: true };

          // Check if all milestones are complete
          const allComplete = Object.values(newMilestones).every(Boolean);

          return {
            milestones: newMilestones,
            onboardingCompletedAt: allComplete ? Date.now() : state.onboardingCompletedAt,
          };
        }),
      getMilestoneProgress: () => {
        const { milestones } = get();
        const completed = Object.values(milestones).filter(Boolean).length;
        const total = Object.keys(milestones).length;
        return { completed, total };
      },
      isOnboardingComplete: () => {
        const { milestones } = get();
        return Object.values(milestones).every(Boolean);
      },

      // Timestamps
      onboardingCompletedAt: null,
      firstSeenAt: null,

      // Actions
      resetOnboarding: () =>
        set({
          showGettingStarted: false,
          dontShowAgain: false,
          onboardedProjects: [],
          milestones: DEFAULT_MILESTONES,
          onboardingCompletedAt: null,
          firstSeenAt: null,
        }),

      skipOnboarding: (projectPath) =>
        set((state) => {
          const hash = hashPath(projectPath);
          return {
            showGettingStarted: false,
            onboardedProjects: state.onboardedProjects.includes(hash)
              ? state.onboardedProjects
              : [...state.onboardedProjects, hash],
          };
        }),
    }),
    {
      name: "sidstack-onboarding",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        dontShowAgain: state.dontShowAgain,
        onboardedProjects: state.onboardedProjects,
        milestones: state.milestones,
        onboardingCompletedAt: state.onboardingCompletedAt,
        firstSeenAt: state.firstSeenAt,
      }),
    }
  )
);
