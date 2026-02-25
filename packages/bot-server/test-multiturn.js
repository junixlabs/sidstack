/**
 * Multi-turn conversation test — reproduces Gemini 400 error.
 * Uses same conversationId across turns to simulate frontend behavior.
 */

const BASE_URL = 'http://localhost:3222';
const CONV_ID = 'test-multi-' + Date.now();
const CTX = {
  projectName: 'sidstack',
  activeView: 'project-hub',
  projectPath: '/Users/chuongle/tools/sidstack',
  projectVersion: '0.4.7',
};

const TURNS = [
  'Hello',
  'Show me pending tasks',
  'App whats new',
  'What modules does the project have?',
  'Show me tickets',
  'Go to task manager',
  'How many tasks are blocked?',
  'What is the knowledge system?',
  'Go to knowledge',
  'Show me high priority tasks',
  'What tickets are open?',
  'Help me navigate to settings',
];

async function sendChat(message) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, conversationId: CONV_ID, context: CTX }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const text = await res.text();
    const events = [];
    const lines = text.split('\n');
    let cur = null;
    for (const line of lines) {
      if (line.startsWith('event: ')) cur = { type: line.slice(7).trim() };
      else if (line.startsWith('data: ') && cur) {
        try { cur.data = JSON.parse(line.slice(6)); } catch { cur.data = line.slice(6); }
        events.push(cur);
        cur = null;
      }
    }
    return { events, rawSSE: text };
  } catch (err) {
    clearTimeout(timeout);
    return { events: [], rawSSE: '', error: err.message };
  }
}

async function run() {
  console.log('='.repeat(72));
  console.log('  MULTI-TURN CONVERSATION TEST');
  console.log(`  conversationId: ${CONV_ID}`);
  console.log('='.repeat(72));

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < TURNS.length; i++) {
    const msg = TURNS[i];
    const start = Date.now();
    const r = await sendChat(msg);
    const elapsed = Date.now() - start;

    const tokens = r.events.filter(e => e.type === 'token').map(e => e.data?.text || '').join('');
    const route = r.events.find(e => e.type === 'message_end')?.data?.route || '?';
    const hasDone = r.events.some(e => e.type === 'done');
    const hasError = r.events.some(e => e.type === 'error');
    const tokenChunks = r.events.filter(e => e.type === 'token').length;

    const issues = [];
    if (r.error) issues.push(`network: ${r.error}`);
    if (tokens.length === 0 && !r.error) issues.push('0 tokens');
    if (!hasDone && !r.error) issues.push('missing done');
    if (hasError) {
      const errData = r.events.find(e => e.type === 'error')?.data;
      issues.push(`error: ${JSON.stringify(errData)}`);
    }

    if (issues.length === 0) {
      passed++;
      console.log(`  ✓ Turn ${i + 1}: "${msg}"  [${route}] ${tokenChunks}tok ${elapsed}ms`);
      console.log(`      "${tokens.replace(/\n/g, ' ').slice(0, 100)}${tokens.length > 100 ? '...' : ''}"`);
    } else {
      failed++;
      console.log(`  ✗ Turn ${i + 1}: "${msg}"  [${route}] ${tokenChunks}tok ${elapsed}ms`);
      for (const i of issues) console.log(`      → ${i}`);
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log('\n' + '='.repeat(72));
  console.log(`  RESULT: ${passed}/${TURNS.length} passed, ${failed} failed`);
  console.log('='.repeat(72));
}

run().catch(console.error);
