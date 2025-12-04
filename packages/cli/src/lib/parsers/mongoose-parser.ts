/**
 * Mongoose Schema Parser
 *
 * Parses Mongoose schema files to extract document structure:
 * - Field definitions
 * - Embedded documents
 * - References (ObjectId refs)
 * - Indexes
 */

import * as fs from 'fs/promises';
import * as path from 'path';

import { glob } from 'glob';

export interface DocumentSchema {
  name: string;
  collection: string;
  fields: DocumentField[];
  embeds: EmbeddedSchema[];
  refs: ReferenceField[];
  indexes: string[];
}

export interface DocumentField {
  name: string;
  type: string; // String, Number, Date, ObjectId, Array, Object, etc.
  required: boolean;
  unique?: boolean;
  default?: any;
  index?: boolean;
  arrayOf?: string; // If type is Array, what's the element type
}

export interface EmbeddedSchema {
  fieldName: string;
  schemaName: string;
}

export interface ReferenceField {
  fieldName: string;
  refModel: string;
}

export class MongooseParser {
  /**
   * Parse all Mongoose schemas in project
   */
  async parseSchemas(projectPath: string): Promise<DocumentSchema[]> {
    const schemas: DocumentSchema[] = [];

    // Find schema files
    const patterns = [
      'models/**/*.schema.{js,ts}',
      'models/**/*.model.{js,ts}',
      'schemas/**/*.{js,ts}',
      'src/models/**/*.{js,ts}',
      'src/schemas/**/*.{js,ts}',
    ];

    const schemaFiles: string[] = [];
    for (const pattern of patterns) {
      const matches = await glob(pattern, { cwd: projectPath, absolute: true });
      schemaFiles.push(...matches);
    }

    // Deduplicate
    const uniqueFiles = [...new Set(schemaFiles)];

    // Parse each file
    for (const file of uniqueFiles) {
      try {
        const schema = await this.parseSchemaFile(file);
        if (schema) {
          schemas.push(schema);
        }
      } catch (error) {
        console.warn(`Failed to parse ${file}:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    return schemas;
  }

  /**
   * Parse a single schema file
   */
  private async parseSchemaFile(filePath: string): Promise<DocumentSchema | null> {
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract schema name from filename or variable name
    const filename = path.basename(filePath);
    const schemaName = this.extractSchemaName(content, filename);

    if (!schemaName) {
      return null;
    }

    // Find the Schema definition
    // Pattern: new Schema({ ... }) or new mongoose.Schema({ ... })
    const schemaMatch = content.match(/new\s+(?:mongoose\.)?Schema\s*\(\s*{([^}]+(?:{[^}]*}[^}]*)*)\}/s);

    if (!schemaMatch) {
      return null;
    }

    const schemaBody = schemaMatch[1];

    // Parse fields
    const fields = this.parseFields(schemaBody);

    // Parse embedded schemas
    const embeds = this.findEmbeddedSchemas(schemaBody);

    // Parse references
    const refs = this.findReferences(schemaBody);

    // Parse indexes
    const indexes = this.findIndexes(content);

    // Extract collection name (default: lowercase plural of schema name)
    const collection = this.extractCollectionName(content, schemaName);

    return {
      name: schemaName,
      collection,
      fields,
      embeds,
      refs,
      indexes,
    };
  }

  /**
   * Extract schema name from file content or filename
   */
  private extractSchemaName(content: string, filename: string): string | null {
    // Try to find: const UserSchema = new Schema(...)
    const varMatch = content.match(/const\s+(\w+)Schema\s*=/);
    if (varMatch) {
      return varMatch[1];
    }

    // Try to find: export const UserSchema = new Schema(...)
    const exportMatch = content.match(/export\s+const\s+(\w+)Schema\s*=/);
    if (exportMatch) {
      return exportMatch[1];
    }

    // Try to find model: mongoose.model('User', ...)
    const modelMatch = content.match(/mongoose\.model\s*\(\s*['"`](\w+)['"`]/);
    if (modelMatch) {
      return modelMatch[1];
    }

    // Fallback: extract from filename
    // user.schema.ts -> User
    // UserModel.ts -> User
    const nameMatch = filename.match(/^(\w+)(?:\.schema|\.model)?\.(?:ts|js)$/i);
    if (nameMatch) {
      const name = nameMatch[1];
      return name.charAt(0).toUpperCase() + name.slice(1).replace(/Model$/, '');
    }

    return null;
  }

  /**
   * Parse field definitions from schema body
   */
  private parseFields(schemaBody: string): DocumentField[] {
    const fields: DocumentField[] = [];

    // Match field patterns:
    // fieldName: Type
    // fieldName: { type: Type, required: true, ... }

    // Simple pattern: fieldName: Type
    const simplePattern = /(\w+):\s*(\w+)(?:\s*,|\s*})/g;

    // Complex pattern: fieldName: { ... }
    const complexPattern = /(\w+):\s*{([^}]+)}/g;

    // Try complex pattern first
    let match;
    while ((match = complexPattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const fieldDef = match[2];

      const field = this.parseComplexField(fieldName, fieldDef);
      if (field) {
        fields.push(field);
      }
    }

    // Try simple pattern for remaining fields
    schemaBody = schemaBody.replace(complexPattern, ''); // Remove already parsed
    while ((match = simplePattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const typeName = match[2];

      // Skip if it's a keyword or already parsed
      if (['type', 'required', 'default', 'unique', 'index'].includes(fieldName)) {
        continue;
      }

      fields.push({
        name: fieldName,
        type: this.normalizeType(typeName),
        required: false,
      });
    }

    return fields;
  }

  /**
   * Parse complex field definition
   */
  private parseComplexField(fieldName: string, fieldDef: string): DocumentField | null {
    // Extract type
    const typeMatch = fieldDef.match(/type:\s*(\[?\w+\]?)/);
    if (!typeMatch) {
      return null;
    }

    let typeName = typeMatch[1];
    let arrayOf: string | undefined;

    // Check if it's an array type: [String] or [{ type: String }]
    if (typeName.startsWith('[') && typeName.endsWith(']')) {
      arrayOf = this.normalizeType(typeName.slice(1, -1));
      typeName = 'Array';
    }

    const type = this.normalizeType(typeName);

    // Extract required
    const required = fieldDef.includes('required: true');

    // Extract unique
    const unique = fieldDef.includes('unique: true');

    // Extract index
    const index = fieldDef.includes('index: true');

    // Extract default
    let defaultValue: any;
    const defaultMatch = fieldDef.match(/default:\s*([^,}]+)/);
    if (defaultMatch) {
      defaultValue = defaultMatch[1].trim();
    }

    return {
      name: fieldName,
      type,
      required,
      unique,
      index,
      default: defaultValue,
      arrayOf,
    };
  }

  /**
   * Find embedded schemas
   */
  private findEmbeddedSchemas(schemaBody: string): EmbeddedSchema[] {
    const embeds: EmbeddedSchema[] = [];

    // Pattern: fieldName: SomeSchema or fieldName: { type: SomeSchema }
    const embedPattern = /(\w+):\s*(?:{[^}]*type:\s*)?(\w+Schema)/g;

    let match;
    while ((match = embedPattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const schemaName = match[2].replace(/Schema$/, ''); // Remove 'Schema' suffix

      embeds.push({
        fieldName,
        schemaName,
      });
    }

    return embeds;
  }

  /**
   * Find reference fields (ObjectId refs)
   */
  private findReferences(schemaBody: string): ReferenceField[] {
    const refs: ReferenceField[] = [];

    // Pattern: ref: 'ModelName' or ref: "ModelName"
    const refPattern = /(\w+):\s*{[^}]*ref:\s*['"`](\w+)['"`]/g;

    let match;
    while ((match = refPattern.exec(schemaBody)) !== null) {
      const fieldName = match[1];
      const refModel = match[2];

      refs.push({
        fieldName,
        refModel,
      });
    }

    return refs;
  }

  /**
   * Find indexes defined in schema
   */
  private findIndexes(content: string): string[] {
    const indexes: string[] = [];

    // Pattern: schema.index({ fieldName: 1 })
    const indexPattern = /\.index\s*\(\s*{\s*(\w+):/g;

    let match;
    while ((match = indexPattern.exec(content)) !== null) {
      indexes.push(match[1]);
    }

    return indexes;
  }

  /**
   * Extract collection name from schema options or model definition
   */
  private extractCollectionName(content: string, schemaName: string): string {
    // Try to find: { collection: 'collectionName' } in schema options
    const collectionMatch = content.match(/collection:\s*['"`](\w+)['"`]/);
    if (collectionMatch) {
      return collectionMatch[1];
    }

    // Default: lowercase plural of schema name
    return this.pluralize(schemaName.toLowerCase());
  }

  /**
   * Normalize Mongoose type to standard type name
   */
  private normalizeType(typeName: string): string {
    const typeMap: Record<string, string> = {
      'String': 'String',
      'Number': 'Number',
      'Date': 'Date',
      'Boolean': 'Boolean',
      'ObjectId': 'ObjectId',
      'Array': 'Array',
      'Mixed': 'Object',
      'Buffer': 'Buffer',
      'Map': 'Map',
      'Decimal128': 'Decimal',
      'mongoose.Schema.Types.ObjectId': 'ObjectId',
      'Schema.Types.ObjectId': 'ObjectId',
      'mongoose.Schema.Types.Mixed': 'Object',
    };

    return typeMap[typeName] || typeName;
  }

  /**
   * Simple pluralization
   */
  private pluralize(word: string): string {
    if (word.endsWith('y')) {
      return word.slice(0, -1) + 'ies';
    } else if (word.endsWith('s')) {
      return word + 'es';
    } else {
      return word + 's';
    }
  }
}
