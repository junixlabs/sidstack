#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { sqliteTools, handleSqliteTool } from './tools/sqlite-tools.js';
import { tools as allTools, handleToolCall } from './tools/index.js';

// Read version from package.json to avoid hardcoding
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = JSON.parse(require('fs').readFileSync(require('path').resolve(__dirname, '../package.json'), 'utf-8'));

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

  if (sqliteToolNames.has(name)) {
    return handleSqliteTool(name, args as Record<string, unknown>);
  } else {
    return handleToolCall(name, args as Record<string, unknown>);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`SidStack MCP server v${pkg.version} running on stdio (${allTools.length} tools)`);
}

main().catch(console.error);
