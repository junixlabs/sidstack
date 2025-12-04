/**
 * Global test setup for React component tests.
 * Mocks Tauri APIs and other browser-only dependencies.
 */
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock Tauri window APIs
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    isMaximized: vi.fn().mockResolvedValue(false),
    outerPosition: vi.fn().mockResolvedValue({ x: 0, y: 0 }),
    outerSize: vi.fn().mockResolvedValue({ width: 1280, height: 800 }),
    setPosition: vi.fn().mockResolvedValue(undefined),
    setSize: vi.fn().mockResolvedValue(undefined),
    unmaximize: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    onCloseRequested: vi.fn().mockResolvedValue(() => {}),
  }),
  LogicalPosition: vi.fn(),
  LogicalSize: vi.fn(),
}));

// Mock Tauri dialog plugin
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue(null),
}));

// Mock Tauri shell plugin
vi.mock("@tauri-apps/plugin-shell", () => ({
  Command: {
    create: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue({ stdout: "", stderr: "", code: 0 }),
    }),
  },
}));

// Mock global fetch for API calls
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
  text: () => Promise.resolve(""),
});
