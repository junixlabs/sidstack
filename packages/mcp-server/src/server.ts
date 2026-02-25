#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';
import { randomUUID } from 'crypto';

import { sqliteTools, handleSqliteTool } from './tools/sqlite-tools.js';
import { tools as allTools, handleToolCall } from './tools/index.js';

// Read version from package.json to avoid hardcoding
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

// File-based MCP call logging (async write stream)
const logDir = path.join(os.homedir(), '.sidstack', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'mcp.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
function mcpLog(msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  logStream.write(`[${ts}] ${msg}\n`);
}

// Create a set of sqlite tool names for routing
const sqliteToolNames = new Set(sqliteTools.map(t => t.name));

// =============================================================================
// MCP Server Setup (shared between stdio and HTTP modes)
// =============================================================================

function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'sidstack-mcp-server',
      version: pkg.version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: allTools };
  });

  // Handle tool calls - route to appropriate handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const start = Date.now();
    // Redact sensitive fields before logging
    const SENSITIVE_KEYS = ['token', 'key', 'password', 'secret', 'apikey', 'authorization', 'credential'];
    let argsPreview = '';
    if (args) {
      const redacted: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(args)) {
        redacted[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? '[REDACTED]' : v;
      }
      argsPreview = JSON.stringify(redacted).slice(0, 200);
    }
    mcpLog(`← ${name} ${argsPreview}`);

    try {
      const result = sqliteToolNames.has(name)
        ? await handleSqliteTool(name, args as Record<string, unknown>)
        : await handleToolCall(name, args as Record<string, unknown>);
      mcpLog(`→ ${name} OK (${Date.now() - start}ms)`);
      return result;
    } catch (err) {
      mcpLog(`→ ${name} ERROR (${Date.now() - start}ms): ${err}`);
      throw err;
    }
  });

  return server;
}

// =============================================================================
// Stdio Mode (default — for Claude Code local usage)
// =============================================================================

async function startStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  mcpLog(`SidStack MCP server v${pkg.version} started [stdio] (${allTools.length} tools)`);
  console.error(`SidStack MCP server v${pkg.version} running on stdio (${allTools.length} tools)`);
}

// =============================================================================
// HTTP Mode (--http flag — for remote multi-agent access)
// =============================================================================

async function startHttp() {
  const port = parseInt(process.env.MCP_PORT || '19433', 10);
  const apiKey = process.env.SIDSTACK_MCP_KEY || process.env.SIDSTACK_API_KEY;

  // Track active transports per session
  const sessions = new Map<string, StreamableHTTPServerTransport>();

  const httpServer = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        version: pkg.version,
        transport: 'streamable-http',
        tools: allTools.length,
        activeSessions: sessions.size,
      }));
      return;
    }

    // Auth check (optional, same as API Server)
    if (apiKey) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7) !== apiKey) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }
    }

    // Only handle /mcp path
    if (req.url !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found. Use /mcp for MCP protocol, /health for status.' }));
      return;
    }

    // Route to existing session or create new one
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      // Existing session
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res);
      return;
    }

    if (sessionId && !sessions.has(sessionId)) {
      // Unknown session ID
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    // New session — create transport + server
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, transport);
        mcpLog(`HTTP session created: ${sid}`);
      },
      onsessionclosed: (sid) => {
        sessions.delete(sid);
        mcpLog(`HTTP session closed: ${sid}`);
      },
    });

    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  httpServer.listen(port, () => {
    mcpLog(`SidStack MCP server v${pkg.version} started [http :${port}] (${allTools.length} tools)`);
    console.error(`SidStack MCP server v${pkg.version} running on http://0.0.0.0:${port}/mcp (${allTools.length} tools)`);
  });
}

// =============================================================================
// Entry Point
// =============================================================================

const mode = process.argv.includes('--http') ? 'http' : 'stdio';

if (mode === 'http') {
  startHttp().catch(console.error);
} else {
  startStdio().catch(console.error);
}
