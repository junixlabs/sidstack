/**
 * Team Management Handlers
 * Multi-agent team coordination
 */

import * as teamClient from '../team-client.js';

export async function handleTeamCreate(args: Record<string, unknown>) {
  const { name, projectPath, autoRecovery, maxRecoveryAttempts, members, description } = args as {
    name: string;
    projectPath: string;
    autoRecovery?: boolean;
    maxRecoveryAttempts?: number;
    members?: Array<{ role: string; agentType: string }>;
    description?: string;
  };

  const team = await teamClient.createTeam({
    name,
    projectPath,
    autoRecovery,
    maxRecoveryAttempts,
    members,
    description,
  });

  const memberList = [
    `  - ${team.config.orchestrator.role} (${team.config.orchestrator.id})`,
    ...team.config.workers.map(w => `  - ${w.role} (${w.id})`),
  ].join('\n');

  return {
    content: [{
      type: 'text',
      text: `Team created: ${team.config.name}\nID: ${team.config.id}\nAuto-recovery: ${team.config.autoRecovery}\n\nMembers:\n${memberList}`,
    }],
  };
}

export async function handleTeamList(args: Record<string, unknown>) {
  const { projectPath, status } = args as { projectPath: string; status?: string };

  const teams = await teamClient.listTeams(projectPath, status);

  if (teams.length === 0) {
    return {
      content: [{
        type: 'text',
        text: `No teams found for project: ${projectPath}`,
      }],
    };
  }

  const teamList = teams.map(t =>
    `- ${t.name} (${t.id})\n  Status: ${t.status} | Members: ${t.memberCount} | Last active: ${t.lastActive}`
  ).join('\n\n');

  return {
    content: [{
      type: 'text',
      text: `Teams for ${projectPath}:\n\n${teamList}`,
    }],
  };
}

export async function handleTeamGet(args: Record<string, unknown>) {
  const { projectPath, teamId } = args as { projectPath: string; teamId: string };

  const team = await teamClient.getTeam(projectPath, teamId);

  const memberList = [
    `  - ${team.config.orchestrator.role}: ${team.state.members[team.config.orchestrator.id]?.status || 'unknown'}`,
    ...team.config.workers.map(w => `  - ${w.role}: ${team.state.members[w.id]?.status || 'unknown'}`),
  ].join('\n');

  return {
    content: [{
      type: 'text',
      text: `Team: ${team.config.name}\nID: ${team.config.id}\nStatus: ${team.state.status}\nAuto-recovery: ${team.config.autoRecovery}\nLast active: ${team.state.lastActive}\n\nMembers:\n${memberList}\n\nActive specs: ${team.state.activeSpecs.join(', ') || 'none'}`,
    }],
  };
}

export async function handleTeamUpdate(args: Record<string, unknown>) {
  const { projectPath, teamId, name, autoRecovery, maxRecoveryAttempts } = args as {
    projectPath: string;
    teamId: string;
    name?: string;
    autoRecovery?: boolean;
    maxRecoveryAttempts?: number;
  };

  const team = await teamClient.updateTeam(projectPath, teamId, { name, autoRecovery, maxRecoveryAttempts });

  return {
    content: [{
      type: 'text',
      text: `Team updated: ${team.config.name}\nAuto-recovery: ${team.config.autoRecovery}\nMax recovery attempts: ${team.config.maxRecoveryAttempts}`,
    }],
  };
}

export async function handleTeamArchive(args: Record<string, unknown>) {
  const { projectPath, teamId } = args as { projectPath: string; teamId: string };

  await teamClient.archiveTeam(projectPath, teamId);

  return {
    content: [{
      type: 'text',
      text: `Team ${teamId} archived.`,
    }],
  };
}

export async function handleTeamAddMember(args: Record<string, unknown>) {
  const { projectPath, teamId, role, agentType } = args as {
    projectPath: string;
    teamId: string;
    role: string;
    agentType: string;
  };

  const member = await teamClient.addMember(projectPath, teamId, role, agentType);

  return {
    content: [{
      type: 'text',
      text: `Member added to team:\nID: ${member.id}\nRole: ${member.role}\nAgent type: ${member.agentType}`,
    }],
  };
}

export async function handleTeamRemoveMember(args: Record<string, unknown>) {
  const { projectPath, teamId, memberId } = args as {
    projectPath: string;
    teamId: string;
    memberId: string;
  };

  await teamClient.removeMember(projectPath, teamId, memberId);

  return {
    content: [{
      type: 'text',
      text: `Member ${memberId} removed from team.`,
    }],
  };
}

export async function handleTeamPause(args: Record<string, unknown>) {
  const { projectPath, teamId, terminalSessions } = args as {
    projectPath: string;
    teamId: string;
    terminalSessions?: teamClient.TerminalSessionInfo[];
  };

  await teamClient.pauseTeam(projectPath, teamId, terminalSessions || []);

  return {
    content: [{
      type: 'text',
      text: `Team ${teamId} paused. State saved for later resume.`,
    }],
  };
}

export async function handleTeamResume(args: Record<string, unknown>) {
  const { projectPath, teamId } = args as { projectPath: string; teamId: string };

  const result = await teamClient.resumeTeam(projectPath, teamId);

  let output = `Team ${result.team.config.name} resumed.\nStatus: ${result.team.state.status}`;
  if (result.sessionInfo) {
    output += `\n\nPrevious session info available for ${result.sessionInfo.terminals.length} terminal(s).`;
  }

  return {
    content: [{
      type: 'text',
      text: output,
    }],
  };
}

export async function handleTeamGetMembers(args: Record<string, unknown>) {
  const { projectPath, teamId } = args as { projectPath: string; teamId: string };

  const members = await teamClient.getMembers(projectPath, teamId);

  const memberList = members.map(m => {
    const roleLabel = m.specialty ? `${m.role} (${m.specialty})` : m.role;
    let info = `- ${roleLabel} (${m.id})\n  Status: ${m.status}`;
    if (m.terminalId) info += ` | Terminal: ${m.terminalId}`;
    if (m.currentTask) info += `\n  Task: ${m.currentTask.taskId} (${m.currentTask.progress}%)`;
    if (m.failureCount > 0) info += `\n  Failures: ${m.failureCount}`;
    return info;
  }).join('\n\n');

  return {
    content: [{
      type: 'text',
      text: `Team members:\n\n${memberList}`,
    }],
  };
}

export async function handleTeamRecoverMember(args: Record<string, unknown>) {
  const { projectPath, teamId, memberId, reason } = args as {
    projectPath: string;
    teamId: string;
    memberId: string;
    reason?: string;
  };

  // Report failure
  await teamClient.reportMemberFailure(projectPath, teamId, memberId, reason || 'Manual recovery triggered');

  // Create replacement
  const replacement = await teamClient.createReplacement(projectPath, teamId, memberId);

  return {
    content: [{
      type: 'text',
      text: `Recovery initiated:\nFailed member: ${memberId}\nReplacement member: ${replacement.id}\nRole: ${replacement.role}\n\nReplacement is ready for terminal spawn.`,
    }],
  };
}

export async function handleTeamRecoveryInfo(args: Record<string, unknown>) {
  const { projectPath, teamId, memberId, limit } = args as {
    projectPath: string;
    teamId: string;
    memberId?: string;
    limit?: number;
  };

  // If memberId provided, get context for that member
  if (memberId) {
    const context = await teamClient.getRecoveryContext(projectPath, teamId, memberId);

    let output = 'Recovery Context:\n';
    if (context.specId) output += `Spec: ${context.specId}\n`;
    if (context.taskId) output += `Task: ${context.taskId}\n`;
    if (context.phase) output += `Phase: ${context.phase}\n`;
    output += `Progress: ${context.progress}%\n`;
    if (context.artifacts.length > 0) output += `Artifacts: ${context.artifacts.join(', ')}\n`;
    output += `\nInstructions:\n${context.resumeInstructions}`;

    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  }

  // Otherwise, get recovery history
  const events = await teamClient.getRecoveryHistory(projectPath, teamId, limit);

  if (events.length === 0) {
    return {
      content: [{
        type: 'text',
        text: 'No recovery events in history.',
      }],
    };
  }

  const eventList = events.map(e => {
    let info = `[${e.timestamp}] ${e.failedMemberRole}\n  Failed: ${e.failedMemberId}\n  Replaced by: ${e.replacementMemberId}\n  Reason: ${e.reason}`;
    if (e.specId) info += `\n  Spec: ${e.specId}`;
    info += `\n  Success: ${e.success}`;
    return info;
  }).join('\n\n');

  return {
    content: [{
      type: 'text',
      text: `Recovery history (${events.length} events):\n\n${eventList}`,
    }],
  };
}
