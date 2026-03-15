// Presence system configuration

export interface PresenceConfig {
  maxReconnectAttempts: number;
  reconnectDelay: number; // in milliseconds
  heartbeatInterval: number; // in milliseconds
  presenceDebounceDelay: number; // in milliseconds
  inactivityTimeout: number; // in milliseconds
}

export const presenceConfig: PresenceConfig = {
  maxReconnectAttempts: 5,
  reconnectDelay: 2000, // 2 seconds
  heartbeatInterval: 1000 * 60 * 5, // 5 minutes
  presenceDebounceDelay: 500, // 500ms debounce for presence updates
  inactivityTimeout: 1000 * 60 * 30, // 30 minutes of inactivity before cleanup
};

// Helper functions for getting config values
export function getMaxReconnectAttempts(): number {
  return presenceConfig.maxReconnectAttempts;
}

export function getReconnectDelay(): number {
  return presenceConfig.reconnectDelay;
}

export function getHeartbeatInterval(): number {
  return presenceConfig.heartbeatInterval;
}

export function getPresenceDebounceDelay(): number {
  return presenceConfig.presenceDebounceDelay;
}

export function getInactivityTimeout(): number {
  return presenceConfig.inactivityTimeout;
}
