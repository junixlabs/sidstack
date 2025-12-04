/**
 * Smoke Tests - Tool Definitions
 *
 * Validates that all exported tool definition arrays have valid MCP schema structure.
 */
import { describe, it, expect } from 'vitest';
import { ticketTools } from '../src/tools/handlers/tickets';
import { trainingRoomTools } from '../src/tools/handlers/training-room';
import { entityReferenceTools } from '../src/tools/handlers/entity-references';
import { contextBuilderTools } from '../src/tools/handlers/context-builder';
import { capabilityTools } from '../src/tools/handlers/capabilities';

const allToolGroups = [
  { name: 'ticketTools', tools: ticketTools },
  { name: 'trainingRoomTools', tools: trainingRoomTools },
  { name: 'entityReferenceTools', tools: entityReferenceTools },
  { name: 'contextBuilderTools', tools: contextBuilderTools },
  { name: 'capabilityTools', tools: capabilityTools },
];

describe('Tool Definitions (Smoke)', () => {
  allToolGroups.forEach(({ name, tools }) => {
    describe(name, () => {
      it('exports a non-empty array', () => {
        expect(Array.isArray(tools)).toBe(true);
        expect(tools.length).toBeGreaterThan(0);
      });

      tools.forEach((tool) => {
        describe(`tool: ${tool.name}`, () => {
          it('has required MCP fields', () => {
            expect(typeof tool.name).toBe('string');
            expect(tool.name.length).toBeGreaterThan(0);
            expect(typeof tool.description).toBe('string');
            expect(tool.description.length).toBeGreaterThan(0);
          });

          it('has valid inputSchema', () => {
            expect(tool.inputSchema).toBeDefined();
            expect(tool.inputSchema.type).toBe('object');
            expect(tool.inputSchema.properties).toBeDefined();
          });

          it('has snake_case name', () => {
            expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
          });
        });
      });
    });
  });
});
