/**
 * Config module - Agent and Skill configuration management
 */

export * from './migrate-agents.js';
export {
  parseSkillFile,
  listAvailableSkills,
  copySkill,
  copyCoreSkills,
  copyOptionalSkills,
  initializeProjectSkills,
  setupUserSkills,
  validateSkillConfig,
  createSkillFile,
  type SkillMigrationResult,
} from './migrate-skills.js';
export * from './subagent-config-manager.js';
export {
  SkillDiscovery,
  getSkillDiscovery,
  type SkillConfig,
  type ResolvedSkill,
  type SkillDiscoveryOptions,
} from './skill-discovery.js';
export * from './template-selector.js';
