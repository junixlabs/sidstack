/**
 * Capability Registry (Project Intelligence Hub)
 *
 * Loads capability definitions from YAML files, resolves hierarchy,
 * and provides query/filter operations.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import type {
  CapabilityDefinition,
  CapabilityNode,
  CapabilityQuery,
  CapabilityRegistryStats,
  LoadedCapability,
} from './capability-types';

// ============================================================================
// Path Utilities
// ============================================================================

export function getCapabilitiesPath(projectPath: string): string {
  return path.join(projectPath, '.sidstack', 'capabilities');
}

export function capabilitiesExist(projectPath: string): boolean {
  const capPath = getCapabilitiesPath(projectPath);
  return fs.existsSync(capPath);
}

export function ensureCapabilitiesDir(projectPath: string): string {
  const capPath = getCapabilitiesPath(projectPath);
  if (!fs.existsSync(capPath)) {
    fs.mkdirSync(capPath, { recursive: true });
  }
  return capPath;
}

// ============================================================================
// Loading
// ============================================================================

export function loadAllCapabilities(projectPath: string): LoadedCapability[] {
  const capPath = getCapabilitiesPath(projectPath);
  if (!fs.existsSync(capPath)) return [];

  const files = fs.readdirSync(capPath).filter(
    (f) => (f.endsWith('.yaml') || f.endsWith('.yml')) && !f.startsWith('_'),
  );

  const loaded: LoadedCapability[] = [];
  for (const file of files) {
    const filePath = path.join(capPath, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const definition = yaml.load(content) as CapabilityDefinition;
      if (definition && definition.id) {
        loaded.push({ definition, filePath, fileName: file });
      }
    } catch {
      // Skip malformed YAML
    }
  }

  return loaded;
}

export function loadCapability(
  projectPath: string,
  capabilityId: string,
): LoadedCapability | null {
  const all = loadAllCapabilities(projectPath);
  return all.find((c) => c.definition.id === capabilityId) || null;
}

// ============================================================================
// Hierarchy Resolution
// ============================================================================

export function resolveHierarchy(capabilities: CapabilityDefinition[]): CapabilityNode[] {
  const byId = new Map<string, CapabilityDefinition>();
  for (const cap of capabilities) {
    byId.set(cap.id, cap);
  }

  // Find roots (L0s or orphans without valid parent)
  const roots: CapabilityNode[] = [];
  const childrenMap = new Map<string, CapabilityDefinition[]>();

  for (const cap of capabilities) {
    if (!cap.parent || !byId.has(cap.parent)) {
      // Root node
    } else {
      const siblings = childrenMap.get(cap.parent) || [];
      siblings.push(cap);
      childrenMap.set(cap.parent, siblings);
    }
  }

  function buildNode(cap: CapabilityDefinition, depth: number): CapabilityNode {
    const children = (childrenMap.get(cap.id) || []).map((c) => buildNode(c, depth + 1));
    return { capability: cap, children, depth };
  }

  for (const cap of capabilities) {
    if (!cap.parent || !byId.has(cap.parent)) {
      roots.push(buildNode(cap, 0));
    }
  }

  return roots;
}

// ============================================================================
// Query & Filter
// ============================================================================

export function queryCapabilities(
  capabilities: CapabilityDefinition[],
  query: CapabilityQuery,
): CapabilityDefinition[] {
  return capabilities.filter((cap) => {
    if (query.level && cap.level !== query.level) return false;
    if (query.status && cap.status !== query.status) return false;
    if (query.maturity && cap.maturity !== query.maturity) return false;
    if (query.parent && cap.parent !== query.parent) return false;
    if (query.tag && !(cap.tags || []).includes(query.tag)) return false;
    if (query.moduleId && !(cap.modules || []).includes(query.moduleId)) return false;
    return true;
  });
}

export function getCapabilityStats(
  capabilities: CapabilityDefinition[],
): CapabilityRegistryStats {
  const stats: CapabilityRegistryStats = {
    total: capabilities.length,
    byLevel: { L0: 0, L1: 0, L2: 0 },
    byStatus: { planned: 0, active: 0, deprecated: 0 },
    byMaturity: { planned: 0, developing: 0, established: 0, optimized: 0 },
  };

  for (const cap of capabilities) {
    stats.byLevel[cap.level]++;
    stats.byStatus[cap.status]++;
    stats.byMaturity[cap.maturity]++;
  }

  return stats;
}

// ============================================================================
// Write Capability (create/update YAML)
// ============================================================================

export function writeCapability(
  projectPath: string,
  definition: CapabilityDefinition,
): string {
  const capPath = ensureCapabilitiesDir(projectPath);
  const filePath = path.join(capPath, `${definition.id}.yaml`);
  const content = yaml.dump(definition, { lineWidth: 120, noRefs: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

export function deleteCapability(
  projectPath: string,
  capabilityId: string,
): boolean {
  const capPath = getCapabilitiesPath(projectPath);
  const filePath = path.join(capPath, `${capabilityId}.yaml`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
