/**
 * Schema Consistency Test
 *
 * Validates that the centralized knowledge schema (types.ts) is internally
 * consistent and that downstream consumers stay in sync.
 *
 * If this test fails, it means someone changed the schema without updating
 * all consumers — exactly the kind of drift this refactor prevents.
 */

import { describe, it, expect } from 'vitest';
import {
  DOCUMENT_TYPE_CONFIG,
  DOCUMENT_STATUS_CONFIG,
  FOLDER_CONFIG,
  ALL_DOCUMENT_TYPES,
  ALL_FOLDER_NAMES,
  FOLDER_TO_DEFAULT_TYPE,
  TYPE_TO_FOLDER,
  DEFAULT_FOLDERS,
} from './types';
import type { DocumentType } from './types';

describe('Knowledge Schema Consistency', () => {
  // =========================================================================
  // Internal consistency
  // =========================================================================

  describe('DOCUMENT_TYPE_CONFIG', () => {
    it('should have all document types', () => {
      const expected: DocumentType[] = [
        'spec', 'decision', 'proposal',
        'guide', 'reference',
        'template', 'checklist', 'pattern',
        'skill', 'principle', 'rule',
        'module', 'okr', 'index',
      ];
      expect(ALL_DOCUMENT_TYPES).toEqual(expect.arrayContaining(expected));
      expect(expected).toEqual(expect.arrayContaining(ALL_DOCUMENT_TYPES));
    });

    it('every type should have label, icon, color, folder, description, and emoji', () => {
      for (const [type, config] of Object.entries(DOCUMENT_TYPE_CONFIG)) {
        expect(config.label, `${type}.label`).toBeTruthy();
        expect(config.icon, `${type}.icon`).toBeTruthy();
        expect(config.color, `${type}.color`).toMatch(/^#[0-9a-f]{6}$/i);
        // folder can be empty string for 'index'
        expect(typeof config.folder, `${type}.folder`).toBe('string');
        expect(config.description, `${type}.description`).toBeTruthy();
        expect(config.emoji, `${type}.emoji`).toBeTruthy();
      }
    });

    it('ALL_DOCUMENT_TYPES should match Object.keys(DOCUMENT_TYPE_CONFIG)', () => {
      expect(ALL_DOCUMENT_TYPES).toEqual(Object.keys(DOCUMENT_TYPE_CONFIG));
    });
  });

  describe('FOLDER_CONFIG', () => {
    it('should have exactly 9 folders', () => {
      expect(FOLDER_CONFIG).toHaveLength(9);
    });

    it('ALL_FOLDER_NAMES should match FOLDER_CONFIG names', () => {
      expect(ALL_FOLDER_NAMES).toEqual(FOLDER_CONFIG.map(f => f.name));
    });

    it('ALL_FOLDER_NAMES should match DEFAULT_FOLDERS', () => {
      expect(ALL_FOLDER_NAMES).toEqual([...DEFAULT_FOLDERS]);
    });

    it('every folder should have complete config', () => {
      for (const folder of FOLDER_CONFIG) {
        expect(folder.name, 'name').toMatch(/^\d{2}-\w+$/);
        expect(folder.title, `${folder.name}.title`).toBeTruthy();
        expect(folder.description, `${folder.name}.description`).toBeTruthy();
        expect(['living', 'event'], `${folder.name}.docType`).toContain(folder.docType);
        expect(['descriptive', 'YYYY-MM-DD-slug'], `${folder.name}.namingConvention`).toContain(folder.namingConvention);
        expect(ALL_DOCUMENT_TYPES, `${folder.name}.defaultDocType`).toContain(folder.defaultDocType);
        expect(folder.readmeContent, `${folder.name}.readmeContent`).toBeTruthy();
        expect(folder.readmeContent.length, `${folder.name}.readmeContent length`).toBeGreaterThan(50);
      }
    });

    it('every folder defaultDocType should be a valid document type', () => {
      for (const folder of FOLDER_CONFIG) {
        expect(ALL_DOCUMENT_TYPES).toContain(folder.defaultDocType);
      }
    });
  });

  describe('Derived mappings', () => {
    it('FOLDER_TO_DEFAULT_TYPE should have entry for each folder', () => {
      for (const folder of FOLDER_CONFIG) {
        expect(FOLDER_TO_DEFAULT_TYPE[folder.name]).toBe(folder.defaultDocType);
      }
    });

    it('TYPE_TO_FOLDER should have entry for each document type', () => {
      for (const type of ALL_DOCUMENT_TYPES) {
        expect(TYPE_TO_FOLDER[type as DocumentType]).toBeDefined();
        // folder string should be from FOLDER_CONFIG or empty string
        const folder = TYPE_TO_FOLDER[type as DocumentType];
        if (folder !== '') {
          expect(ALL_FOLDER_NAMES).toContain(folder);
        }
      }
    });
  });

  describe('DOCUMENT_STATUS_CONFIG', () => {
    it('should have all expected statuses', () => {
      const expected = ['draft', 'active', 'review', 'archived'];
      expect(Object.keys(DOCUMENT_STATUS_CONFIG)).toEqual(expect.arrayContaining(expected));
    });

    it('every status should have label and color', () => {
      for (const [status, config] of Object.entries(DOCUMENT_STATUS_CONFIG)) {
        expect(config.label, `${status}.label`).toBeTruthy();
        expect(config.color, `${status}.color`).toMatch(/^#[0-9a-f]{6}$/i);
      }
    });
  });
});
