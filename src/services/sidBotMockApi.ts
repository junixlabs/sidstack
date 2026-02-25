import type { SSEEvent, SidBotAction } from "@/stores/sidBotStore";

// =============================================================================
// Mock SSE API for SidBot Phase 1
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* streamTokens(
  text: string,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    if (signal.aborted) return;
    const token = i === 0 ? words[i] : " " + words[i];
    yield { type: "token", data: token };
    await delay(30 + Math.random() * 20);
  }
  yield { type: "done" };
}

// Route: task/create keywords
async function* taskRoute(signal: AbortSignal): AsyncGenerator<SSEEvent> {
  const text =
    "I can help you create a task. You can use the Task Manager to create, track, and manage tasks with governance rules and quality gates.";
  yield* streamTokens(text, signal);

  const action: SidBotAction = {
    type: "navigate",
    label: "Open Task Manager",
    payload: { viewId: "task-manager" },
  };
  yield { type: "action", action };
}

// Route: knowledge/docs/help keywords
async function* knowledgeRoute(signal: AbortSignal): AsyncGenerator<SSEEvent> {
  const text =
    "The Knowledge Browser lets you explore project documentation, design patterns, API specs, and business logic. All knowledge is stored as markdown in `.sidstack/knowledge/` and indexed automatically.";
  yield* streamTokens(text, signal);

  const action: SidBotAction = {
    type: "open_knowledge",
    label: "Browse Knowledge",
  };
  yield { type: "action", action };
}

// Route: analyze/code/fix/bug keywords — includes Claude flow
async function* claudeRoute(signal: AbortSignal): AsyncGenerator<SSEEvent> {
  // Phase 1: thinking text
  const thinkText = "Let me analyze that for you. I'll invoke Claude to inspect the code...";
  yield* streamTokens(thinkText, signal);

  if (signal.aborted) return;

  // Phase 2: Claude start
  yield { type: "claude_start", step: "Launching Claude CLI..." };
  await delay(800);
  if (signal.aborted) return;

  // Phase 3: progress steps
  const steps = [
    { step: "Reading project files", detail: "Scanning src/ directory" },
    { step: "Analyzing code patterns", detail: "Checking for issues..." },
    { step: "Generating suggestions", detail: "Found 2 potential improvements" },
  ];
  for (const s of steps) {
    if (signal.aborted) return;
    yield { type: "claude_progress", step: s.step, detail: s.detail };
    await delay(1200 + Math.random() * 600);
  }

  // Phase 4: Claude end
  yield { type: "claude_end", status: "success" };
  await delay(300);

  // Phase 5: result text
  const resultText =
    "\n\nAnalysis complete. Found 2 suggestions:\n\n1. **Unused import** in `src/App.tsx` — `useRef` is imported but could be cleaned up\n2. **Type safety** — Consider adding stricter null checks in the store\n\nWould you like me to create a task to address these?";
  yield* streamTokens(resultText, signal);

  const action: SidBotAction = {
    type: "create_task",
    label: "Create cleanup task",
  };
  yield { type: "action", action };
}

// Route: default
async function* defaultRoute(signal: AbortSignal): AsyncGenerator<SSEEvent> {
  const text =
    "I'm SidBot, your project intelligence assistant. I can help you with:\n\n- **Tasks** — Create and manage development tasks\n- **Knowledge** — Search project documentation\n- **Analysis** — Run code analysis with Claude\n- **Impact** — Assess change risk before implementing\n\nTry asking me to *create a task*, *search knowledge*, or *analyze code*.";
  yield* streamTokens(text, signal);
}

/**
 * Mock SSE message handler — routes based on keywords in user text.
 */
export async function* mockSendMessage(
  text: string,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const lower = text.toLowerCase();

  // Small initial delay to feel realistic
  await delay(200);
  if (signal.aborted) return;

  if (/\b(task|create)\b/.test(lower)) {
    yield* taskRoute(signal);
  } else if (/\b(knowledge|docs|help|what can)\b/.test(lower)) {
    yield* knowledgeRoute(signal);
  } else if (/\b(analyze|code|fix|bug|review)\b/.test(lower)) {
    yield* claudeRoute(signal);
  } else {
    yield* defaultRoute(signal);
  }
}

/**
 * Mock health check endpoint.
 */
export async function mockHealthCheck(): Promise<{
  status: string;
  claudeAvailable: boolean;
}> {
  await delay(300);
  return { status: "ok", claudeAvailable: true };
}
