// Redis Dependency Injection Tokens
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_PUBLISHER = Symbol('REDIS_PUBLISHER');
export const REDIS_SUBSCRIBER_FACTORY = Symbol('REDIS_SUBSCRIBER_FACTORY');
export const REDIS_HEALTH_SERVICE = Symbol('REDIS_HEALTH_SERVICE');
export const REDIS_CACHE_SERVICE = Symbol('REDIS_CACHE_SERVICE');

// Redis PubSub Channels
export const NOTIFICATION_CHANNEL = 'app:notifications';
export const USER_EVENTS_CHANNEL = 'app:user-events';
export const SYSTEM_EVENTS_CHANNEL = 'app:system-events';
