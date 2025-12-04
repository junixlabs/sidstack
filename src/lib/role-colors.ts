/**
 * Role color mapping for agent terminals
 * Colors are chosen for visual distinction and accessibility
 *
 * Uses the 3-role governance model: orchestrator, worker, reviewer
 * Worker specialties get color overrides for visual distinction.
 */

import { normalizeRole } from '@sidstack/shared';
import type { AgentRole } from '@sidstack/shared';

export interface RoleColorConfig {
  border: string;
  bg: string;
  bgHover: string;
  text: string;
  badge: string;
  badgeText: string;
}

/** Core role colors (3 roles + user + default) */
const ROLE_COLORS: Record<AgentRole | "user" | "default", RoleColorConfig> = {
  orchestrator: {
    border: "border-purple-500",
    bg: "bg-purple-500/10",
    bgHover: "hover:bg-purple-500/20",
    text: "text-purple-400",
    badge: "bg-purple-500/20",
    badgeText: "text-purple-300",
  },
  worker: {
    border: "border-green-500",
    bg: "bg-green-500/10",
    bgHover: "hover:bg-green-500/20",
    text: "text-green-400",
    badge: "bg-green-500/20",
    badgeText: "text-green-300",
  },
  reviewer: {
    border: "border-yellow-500",
    bg: "bg-yellow-500/10",
    bgHover: "hover:bg-yellow-500/20",
    text: "text-yellow-400",
    badge: "bg-yellow-500/20",
    badgeText: "text-yellow-300",
  },
  user: {
    border: "border-gray-500",
    bg: "bg-gray-500/10",
    bgHover: "hover:bg-gray-500/20",
    text: "text-gray-400",
    badge: "bg-gray-500/20",
    badgeText: "text-gray-300",
  },
  default: {
    border: "border-gray-600",
    bg: "bg-gray-600/10",
    bgHover: "hover:bg-gray-600/20",
    text: "text-gray-400",
    badge: "bg-gray-600/20",
    badgeText: "text-gray-400",
  },
};

/** Worker specialty color overrides */
const SPECIALTY_COLORS: Record<string, RoleColorConfig> = {
  frontend: {
    border: "border-cyan-500",
    bg: "bg-cyan-500/10",
    bgHover: "hover:bg-cyan-500/20",
    text: "text-cyan-400",
    badge: "bg-cyan-500/20",
    badgeText: "text-cyan-300",
  },
  backend: {
    border: "border-green-500",
    bg: "bg-green-500/10",
    bgHover: "hover:bg-green-500/20",
    text: "text-green-400",
    badge: "bg-green-500/20",
    badgeText: "text-green-300",
  },
  database: {
    border: "border-blue-500",
    bg: "bg-blue-500/10",
    bgHover: "hover:bg-blue-500/20",
    text: "text-blue-400",
    badge: "bg-blue-500/20",
    badgeText: "text-blue-300",
  },
  devops: {
    border: "border-orange-500",
    bg: "bg-orange-500/10",
    bgHover: "hover:bg-orange-500/20",
    text: "text-orange-400",
    badge: "bg-orange-500/20",
    badgeText: "text-orange-300",
  },
  qa: {
    border: "border-pink-500",
    bg: "bg-pink-500/10",
    bgHover: "hover:bg-pink-500/20",
    text: "text-pink-400",
    badge: "bg-pink-500/20",
    badgeText: "text-pink-300",
  },
};

/**
 * Get role color configuration
 * Resolves core role first, then checks specialty overrides for workers.
 */
export function getRoleColor(role?: string, specialty?: string): RoleColorConfig {
  if (!role) return ROLE_COLORS.default;

  // Handle "user" and "default" directly
  if (role === "user") return ROLE_COLORS.user;

  const normalized = normalizeRole(role);

  // For workers, check specialty override
  if (normalized === "worker") {
    // Specialty passed explicitly
    if (specialty && SPECIALTY_COLORS[specialty]) {
      return SPECIALTY_COLORS[specialty];
    }
    // Legacy: role string itself may be a specialty (e.g. "frontend")
    const legacySpecialty = role.toLowerCase();
    if (legacySpecialty !== "worker" && SPECIALTY_COLORS[legacySpecialty]) {
      return SPECIALTY_COLORS[legacySpecialty];
    }
  }

  return ROLE_COLORS[normalized] || ROLE_COLORS.default;
}

/** Hex color map for core roles */
const ROLE_HEX: Record<string, string> = {
  orchestrator: "#a855f7", // purple-500
  worker: "#22c55e",       // green-500
  reviewer: "#eab308",     // yellow-500
  user: "#6b7280",         // gray-500
};

/** Hex color map for worker specialties */
const SPECIALTY_HEX: Record<string, string> = {
  frontend: "#06b6d4", // cyan-500
  backend: "#22c55e",  // green-500
  database: "#3b82f6", // blue-500
  devops: "#f97316",   // orange-500
  qa: "#ec4899",       // pink-500
};

/**
 * Get role border color hex value (for inline styles)
 */
export function getRoleBorderHex(role?: string, specialty?: string): string {
  if (!role) return "#4b5563"; // gray-600 default

  if (role === "user") return ROLE_HEX.user;

  const normalized = normalizeRole(role);

  if (normalized === "worker") {
    if (specialty && SPECIALTY_HEX[specialty]) {
      return SPECIALTY_HEX[specialty];
    }
    const legacySpecialty = role.toLowerCase();
    if (legacySpecialty !== "worker" && SPECIALTY_HEX[legacySpecialty]) {
      return SPECIALTY_HEX[legacySpecialty];
    }
  }

  return ROLE_HEX[normalized] || "#4b5563";
}

/**
 * Get all available core roles
 */
export function getAvailableRoles(): (AgentRole | "user" | "default")[] {
  return Object.keys(ROLE_COLORS) as (AgentRole | "user" | "default")[];
}
