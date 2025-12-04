// Base Error
export class SidStackError extends Error {
  constructor(
    message: string,
    public code: string,
    public override cause?: Error
  ) {
    super(message);
    this.name = 'SidStackError';
  }
}

// Service Errors
export class ServiceUnavailableError extends SidStackError {
  constructor(serviceName: string, cause?: Error) {
    super(`Service unavailable: ${serviceName}`, 'SERVICE_UNAVAILABLE', cause);
    this.name = 'ServiceUnavailableError';
  }
}

export class ConnectionError extends SidStackError {
  constructor(target: string, cause?: Error) {
    super(`Failed to connect to ${target}`, 'CONNECTION_ERROR', cause);
    this.name = 'ConnectionError';
  }
}

// Graph Errors
export class NodeNotFoundError extends SidStackError {
  constructor(nodeId: string) {
    super(`Node not found: ${nodeId}`, 'NODE_NOT_FOUND');
    this.name = 'NodeNotFoundError';
  }
}

export class QueryError extends SidStackError {
  constructor(query: string, cause?: Error) {
    super(`Query execution failed: ${query.substring(0, 100)}...`, 'QUERY_ERROR', cause);
    this.name = 'QueryError';
  }
}

// Task Errors
export class TaskNotFoundError extends SidStackError {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`, 'TASK_NOT_FOUND');
    this.name = 'TaskNotFoundError';
  }
}

export class TaskAssignmentError extends SidStackError {
  constructor(taskId: string, agentId: string, reason: string) {
    super(`Cannot assign task ${taskId} to agent ${agentId}: ${reason}`, 'TASK_ASSIGNMENT_ERROR');
    this.name = 'TaskAssignmentError';
  }
}

// Agent Errors
export class AgentNotFoundError extends SidStackError {
  constructor(agentId: string) {
    super(`Agent not found: ${agentId}`, 'AGENT_NOT_FOUND');
    this.name = 'AgentNotFoundError';
  }
}

export class AgentBusyError extends SidStackError {
  constructor(agentId: string) {
    super(`Agent is busy: ${agentId}`, 'AGENT_BUSY');
    this.name = 'AgentBusyError';
  }
}

// Configuration Errors
export class ConfigurationError extends SidStackError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR');
    this.name = 'ConfigurationError';
  }
}

export class WorkspaceNotInitializedError extends SidStackError {
  constructor(path: string) {
    super(`Workspace not initialized at: ${path}`, 'WORKSPACE_NOT_INITIALIZED');
    this.name = 'WorkspaceNotInitializedError';
  }
}

// Validation Errors
export class ValidationError extends SidStackError {
  constructor(field: string, reason: string) {
    super(`Validation failed for ${field}: ${reason}`, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}
