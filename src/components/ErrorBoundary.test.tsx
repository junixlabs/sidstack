/**
 * Tests - ErrorBoundary Component
 *
 * Verifies error catching, fallback rendering, and retry behavior.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorBoundary, ComponentErrorBoundary } from "./ErrorBoundary";

// Component that throws on render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error: component crashed");
  }
  return <div>Working component</div>;
}

describe("ErrorBoundary", () => {
  // Suppress console.error for error boundary tests
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  it("renders children when no error", () => {
    render(
      <ErrorBoundary>
        <div>Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText("Normal content")).toBeInTheDocument();
  });

  it("shows error UI when child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Refresh App")).toBeInTheDocument();
  });

  it("shows technical details when error occurs", () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    // Click to expand technical details
    fireEvent.click(screen.getByText("Technical details"));
    expect(screen.getByText(/Test error: component crashed/)).toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    render(
      <ErrorBoundary fallback={<div>Custom error view</div>}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText("Custom error view")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(onError).toHaveBeenCalledOnce();
    expect(onError.mock.calls[0][0].message).toBe("Test error: component crashed");
  });

  consoleSpy.mockRestore();
});

describe("ComponentErrorBoundary", () => {
  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  it("renders children normally", () => {
    render(
      <ComponentErrorBoundary componentName="TestWidget">
        <div>Widget content</div>
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Widget content")).toBeInTheDocument();
  });

  it("shows component-specific error message", () => {
    render(
      <ComponentErrorBoundary componentName="TestWidget">
        <ThrowingComponent shouldThrow={true} />
      </ComponentErrorBoundary>
    );

    expect(screen.getByText("Error loading TestWidget")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });

  consoleSpy.mockRestore();
});
