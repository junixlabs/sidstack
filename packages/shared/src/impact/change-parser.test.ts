/**
 * Change Parser Unit Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChangeParser, changeParser } from './change-parser';
import type { ChangeInput } from './types';

describe('ChangeParser', () => {
  let parser: ChangeParser;

  beforeEach(() => {
    parser = new ChangeParser();
  });

  describe('parse', () => {
    it('should parse a simple feature description', () => {
      const input: ChangeInput = {
        description: 'Add UserProfile authentication with Session management',
      };

      const result = parser.parse(input);

      expect(result.entities).toContain('UserProfile');
      expect(result.entities).toContain('Session');
      expect(result.keywords).toContain('authentication');
      expect(result.changeType).toBe('feature');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect add operations', () => {
      const input: ChangeInput = {
        description: 'Add payment processing module',
      };

      const result = parser.parse(input);

      expect(result.operations.length).toBeGreaterThan(0);
      expect(result.operations.some(op => op.type === 'add')).toBe(true);
      expect(result.changeType).toBe('feature');
    });

    it('should detect modify operations', () => {
      const input: ChangeInput = {
        description: 'Update user profile validation logic',
      };

      const result = parser.parse(input);

      expect(result.operations.some(op => op.type === 'modify')).toBe(true);
    });

    it('should detect delete operations', () => {
      const input: ChangeInput = {
        description: 'Remove deprecated API endpoints',
      };

      const result = parser.parse(input);

      expect(result.operations.some(op => op.type === 'delete')).toBe(true);
      expect(result.changeType).toBe('deletion');
    });

    it('should detect refactor operations', () => {
      const input: ChangeInput = {
        description: 'Refactor database connection handling',
      };

      const result = parser.parse(input);

      expect(result.operations.some(op => op.type === 'refactor')).toBe(true);
      expect(result.changeType).toBe('refactor');
    });

    it('should detect migration operations', () => {
      const input: ChangeInput = {
        description: 'Migrate user data to new schema',
      };

      const result = parser.parse(input);

      expect(result.operations.some(op => op.type === 'migrate')).toBe(true);
      expect(result.changeType).toBe('migration');
    });

    it('should extract PascalCase entities', () => {
      const input: ChangeInput = {
        description: 'Update UserProfile and OrderHistory models',
      };

      const result = parser.parse(input);

      expect(result.entities).toContain('UserProfile');
      expect(result.entities).toContain('OrderHistory');
    });

    it('should exclude common programming terms from entities', () => {
      const input: ChangeInput = {
        description: 'Create String validation for Array of Objects',
      };

      const result = parser.parse(input);

      expect(result.entities).not.toContain('String');
      expect(result.entities).not.toContain('Array');
      expect(result.entities).not.toContain('Object');
    });

    it('should extract keywords from target files', () => {
      const input: ChangeInput = {
        description: 'Update authentication',
        targetFiles: [
          'src/services/UserService.ts',
          'src/controllers/AuthController.ts',
        ],
      };

      const result = parser.parse(input);

      expect(result.keywords).toContain('userservice');
      expect(result.keywords).toContain('authcontroller');
    });

    it('should include target modules in analysis', () => {
      const input: ChangeInput = {
        description: 'Add feature',
        targetModules: ['authentication', 'user-management'],
      };

      const result = parser.parse(input);

      expect(result.keywords).toContain('authentication');
    });

    it('should infer bugfix change type', () => {
      const input: ChangeInput = {
        description: 'Fix login error when password contains special characters',
      };

      const result = parser.parse(input);

      expect(result.changeType).toBe('bugfix');
    });

    it('should respect explicit changeType', () => {
      const input: ChangeInput = {
        description: 'Add new feature',
        changeType: 'bugfix',
      };

      const result = parser.parse(input);

      expect(result.changeType).toBe('bugfix');
    });

    it('should filter out stop words from keywords', () => {
      const input: ChangeInput = {
        description: 'Update the user profile in the database',
      };

      const result = parser.parse(input);

      expect(result.keywords).not.toContain('the');
      expect(result.keywords).not.toContain('in');
    });

    it('should calculate higher confidence with more entities', () => {
      const input1: ChangeInput = {
        description: 'Add User model',
      };

      const input2: ChangeInput = {
        description: 'Add User, Order, and Product models with validation',
      };

      const result1 = parser.parse(input1);
      const result2 = parser.parse(input2);

      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence);
    });

    it('should handle empty description gracefully', () => {
      const input: ChangeInput = {
        description: '',
      };

      const result = parser.parse(input);

      expect(result.entities).toHaveLength(0);
      expect(result.operations).toHaveLength(0);
      expect(result.changeType).toBe('feature'); // Default
    });
  });

  describe('parseFromTask', () => {
    it('should parse task title and description', () => {
      const result = parser.parseFromTask(
        'Add UserProfile authentication',
        'Implement SessionManager login flow with Google and GitHub providers'
      );

      expect(result.keywords).toContain('authentication');
      expect(result.entities).toContain('UserProfile');
      expect(result.entities).toContain('SessionManager');
      expect(result.entities).toContain('Google');
      expect(result.entities).toContain('GitHub');
    });

    it('should handle missing description', () => {
      const result = parser.parseFromTask('Fix DatabaseConnection bug');

      // Note: parseFromTask sets changeType to 'feature' by default, but it gets inferred
      expect(result.keywords).toContain('database');
      expect(result.keywords).toContain('bug');
      expect(result.keywords).toContain('fix');
    });
  });

  describe('parseFromSpec', () => {
    it('should parse spec title and content', () => {
      const result = parser.parseFromSpec(
        'UserProfile Authentication Spec',
        'This spec defines the SessionToken authentication flow for the application.',
        'authentication'
      );

      expect(result.keywords).toContain('authentication');
      expect(result.entities).toContain('UserProfile');
      expect(result.entities).toContain('SessionToken');
    });

    it('should handle spec without module', () => {
      const result = parser.parseFromSpec(
        'API Design',
        'REST API endpoints for user management'
      );

      expect(result.keywords).toContain('api');
      expect(result.keywords).toContain('user');
    });
  });

  describe('singleton instance', () => {
    it('should export a singleton parser', () => {
      expect(changeParser).toBeInstanceOf(ChangeParser);
    });

    it('should work the same as new instance', () => {
      const input: ChangeInput = {
        description: 'Add feature',
      };

      const result1 = changeParser.parse(input);
      const result2 = parser.parse(input);

      expect(result1.changeType).toBe(result2.changeType);
    });
  });
});
