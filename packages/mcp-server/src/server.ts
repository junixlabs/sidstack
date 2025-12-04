#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { sqliteTools, handleSqliteTool } from './tools/sqlite-tools.js';
import { tools as allTools, handleToolCall } from './tools/index.js';

// Create a set of sqlite tool names for routing
const sqliteToolNames = new Set(sqliteTools.map(t => t.name));

const server = new Server(
  {
    name: 'sidstack-mcp-server',
    version: '0.1.0',
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
  console.error(`SidStack MCP server v0.1.0 running on stdio (${allTools.length} tools)`);
}

main().catch(console.error);
