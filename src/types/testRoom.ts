// Test Room Types for SidStack
// Collaborative testing space for human-agent interaction

export type TestStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'skipped';
export type RoomStatus = 'active' | 'completed' | 'archived';
export type MessageSender = 'agent' | 'human' | 'system';
export type MessageType = 'text' | 'request' | 'response' | 'result';
export type RequestType = 'credentials' | 'action' | 'confirmation';
export type ArtifactType = 'file' | 'screenshot' | 'log' | 'response';

/**
 * Test Room - one per module/spec
 */
export interface TestRoom {
  id: string;
  moduleId: string;
  specId?: string;
  name: string;
  description?: string;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Test Item - checklist item for tracking test progress
 */
export interface TestItem {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  status: TestStatus;
  orderIndex: number;
  resultNotes?: string;
  testedAt?: string;
  createdAt: string;
}

/**
 * Test Message - conversation entry between human and agent
 */
export interface TestMessage {
  id: string;
  roomId: string;
  sender: MessageSender;
  messageType: MessageType;
  content: string;
  metadata?: TestMessageMetadata;
  createdAt: string;
}

/**
 * Metadata attached to messages
 */
export interface TestMessageMetadata {
  // For 'request' type messages
  requestType?: RequestType;

  // For 'result' type messages
  testItemId?: string;
  status?: TestStatus;

  // For tracking request-response pairs
  requestId?: string;

  // For action requests
  command?: string;
  actionStatus?: 'pending' | 'done' | 'skipped';
}

/**
 * Test Artifact - files, screenshots, logs attached to test sessions
 */
export interface TestArtifact {
  id: string;
  roomId: string;
  messageId?: string;
  name: string;
  type: ArtifactType;
  path?: string;
  content?: string;
  createdAt: string;
}

/**
 * Pending request from agent waiting for human response
 */
export interface PendingRequest {
  id: string;
  messageId: string;
  requestType: RequestType;
  message: string;
  command?: string; // For action requests
  createdAt: string;
}

/**
 * Test Room with all related data loaded
 */
export interface TestRoomWithData extends TestRoom {
  items: TestItem[];
  messages: TestMessage[];
  artifacts: TestArtifact[];
  pendingRequests: PendingRequest[];
}

/**
 * Test Room summary for list views
 */
export interface TestRoomSummary {
  id: string;
  moduleId: string;
  name: string;
  status: RoomStatus;
  totalItems: number;
  passedItems: number;
  failedItems: number;
  pendingItems: number;
  lastActivity: string;
}

/**
 * Create test room input
 */
export interface CreateTestRoomInput {
  moduleId: string;
  specId?: string;
  name?: string;
  description?: string;
}

/**
 * Create test item input
 */
export interface CreateTestItemInput {
  roomId: string;
  title: string;
  description?: string;
  orderIndex?: number;
}

/**
 * Send message input
 */
export interface SendMessageInput {
  roomId: string;
  sender: MessageSender;
  messageType: MessageType;
  content: string;
  metadata?: TestMessageMetadata;
}

/**
 * Update test item status input
 */
export interface UpdateTestItemInput {
  id: string;
  status?: TestStatus;
  resultNotes?: string;
}

/**
 * Add artifact input
 */
export interface AddArtifactInput {
  roomId: string;
  messageId?: string;
  name: string;
  type: ArtifactType;
  path?: string;
  content?: string;
}

/**
 * Session export data for markdown generation
 */
export interface TestSessionExport {
  room: TestRoom;
  items: TestItem[];
  messages: TestMessage[];
  artifacts: TestArtifact[];
  sessionStart: string;
  sessionEnd: string;
}

/**
 * Status icon mapping
 */
export const TEST_STATUS_ICONS: Record<TestStatus, string> = {
  pending: '☐',
  in_progress: '⏳',
  passed: '✅',
  failed: '❌',
  skipped: '⏭️',
};

/**
 * Status colors for UI
 */
export const TEST_STATUS_COLORS: Record<TestStatus, string> = {
  pending: 'text-gray-400',
  in_progress: 'text-yellow-400',
  passed: 'text-green-400',
  failed: 'text-red-400',
  skipped: 'text-gray-500',
};
