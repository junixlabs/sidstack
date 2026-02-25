/**
 * In-memory conversation store with TTL and max turns.
 * Uses Gemini Content format for turns.
 */

interface Part {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thoughtSignature?: string; // Gemini 3 thought signature preservation
  [key: string]: unknown; // Allow additional SDK fields
}

export interface Turn {
  role: 'user' | 'model';
  parts: Part[];
}

interface Conversation {
  id: string;
  turns: Turn[];
  createdAt: number;
  lastAccess: number;
}

const MAX_TURNS = 50;
const TTL_MS = 60 * 60 * 1000; // 1 hour

const store = new Map<string, Conversation>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [id, conv] of store) {
    if (now - conv.lastAccess > TTL_MS) {
      store.delete(id);
    }
  }
}

export function getConversation(id: string): Conversation | undefined {
  pruneExpired();
  const conv = store.get(id);
  if (conv) {
    conv.lastAccess = Date.now();
  }
  return conv;
}

export function getOrCreateConversation(id: string): Conversation {
  pruneExpired();
  let conv = store.get(id);
  if (!conv) {
    conv = { id, turns: [], createdAt: Date.now(), lastAccess: Date.now() };
    store.set(id, conv);
  } else {
    conv.lastAccess = Date.now();
  }
  return conv;
}

export function addTurn(conversationId: string, turn: Turn): void {
  const conv = getOrCreateConversation(conversationId);
  conv.turns.push(turn);
  // Trim oldest turns if over max
  while (conv.turns.length > MAX_TURNS) {
    conv.turns.shift();
  }
  // Ensure history starts with a plain user turn (no functionResponse).
  // Trimming can break functionCall/functionResponse pairs — clean up orphans.
  while (conv.turns.length > 0) {
    const first = conv.turns[0];
    const isPlainUser =
      first.role === 'user' && !first.parts.some((p) => p.functionResponse);
    if (isPlainUser) break;
    conv.turns.shift();
  }
}

export function deleteConversation(id: string): boolean {
  return store.delete(id);
}

export function getHistory(conversationId: string): Turn[] {
  const conv = store.get(conversationId);
  return conv ? conv.turns : [];
}
