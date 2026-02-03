#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { sqliteTools, handleSqliteTool } from './tools/sqlite-tools.js';
import { tools as allTools, handleToolCall } from './tools/index.js';

// Read version from package.json to avoid hardcoding
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

// File-based MCP call logging
const logDir = path.join(os.homedir(), '.sidstack', 'logs');
fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, 'mcp.log');
function mcpLog(msg: string) {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const line = `[${ts}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
}

// Create a set of sqlite tool names for routing
const sqliteToolNames = new Set(sqliteTools.map(t => t.name));

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
  const argsPreview = args ? JSON.stringify(args).slice(0, 200) : '';
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  mcpLog(`SidStack MCP server v${pkg.version} started (${allTools.length} tools)`);
  console.error(`SidStack MCP server v${pkg.version} running on stdio (${allTools.length} tools)`);
}

main().catch(console.error);
