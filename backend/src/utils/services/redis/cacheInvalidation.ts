/**
 * Cache Invalidation Helper
 * Jab bhi database mein data change ho, yeh functions call karo
 */

import { cache } from "./cache";
import { REDIS_KEYS, REDIS_PATTERNS } from "./keys";

/**
 * User data change hone pe call karo
 * - Profile update
 * - Email change
 * - Role change
 * - Status change (active/inactive)
 */
export const invalidateUser = async (userId: number): Promise<void> => {
  await cache.del(REDIS_KEYS.USER(userId));
  console.log(`🗑️ Cache invalidated: user:${userId}`);
};

/**
 * User delete hone pe call karo
 */
export const invalidateUserComplete = async (userId: number): Promise<void> => {
  await Promise.all([
    cache.del(REDIS_KEYS.USER(userId)),
    cache.del(REDIS_KEYS.USER_PERMISSIONS(userId)),
    cache.del(REDIS_KEYS.USER_ACTIVE_SESSIONS(userId)),
  ]);
  console.log(`🗑️ Cache invalidated: all data for user:${userId}`);
};

/**
 * Permissions change hone pe call karo
 */
export const invalidatePermissions = async (userId: number): Promise<void> => {
  await cache.del(REDIS_KEYS.USER_PERMISSIONS(userId));
  console.log(`🗑️ Cache invalidated: permissions:${userId}`);
};

/**
 * Category create/update/delete pe call karo
 */
export const invalidateCategories = async (): Promise<void> => {
  await cache.del(REDIS_KEYS.CATEGORIES_LIST);
  console.log(`🗑️ Cache invalidated: categories`);
};

/**
 * Level create/update/delete pe call karo
 */
export const invalidateLevels = async (): Promise<void> => {
  await cache.del(REDIS_KEYS.LEVELS_LIST);
  console.log(`🗑️ Cache invalidated: levels`);
};

/**
 * Badge create/update/delete pe call karo
 */
export const invalidateBadges = async (): Promise<void> => {
  await cache.del(REDIS_KEYS.BADGES_LIST);
  console.log(`🗑️ Cache invalidated: badges`);
};

/**
 * Dashboard stats change hone pe call karo
 * - New student added
 * - Activity approved/rejected
 * - Any count change
 */
export const invalidateDashboardStats = async (schoolId?: number): Promise<void> => {
  if (schoolId) {
    await cache.del(REDIS_KEYS.DASHBOARD_STATS(schoolId));
    console.log(`🗑️ Cache invalidated: dashboard stats for school:${schoolId}`);
  }
  // Also invalidate global stats
  await cache.del(REDIS_KEYS.DASHBOARD_STATS());
  console.log(`🗑️ Cache invalidated: global dashboard stats`);
};

/**
 * Multiple users ka cache clear karo
 */
export const invalidateMultipleUsers = async (userIds: number[]): Promise<void> => {
  await Promise.all(userIds.map((id) => invalidateUser(id)));
};

/**
 * Sab cache clear karo (emergency/testing ke liye)
 */
export const invalidateAllCache = async (): Promise<void> => {
  await Promise.all([
    cache.delPattern(REDIS_PATTERNS.ALL_USERS),
    cache.delPattern(REDIS_PATTERNS.ALL_PERMISSIONS),
    cache.delPattern(REDIS_PATTERNS.ALL_STATS),
    cache.delPattern(REDIS_PATTERNS.ALL_STATIC),
  ]);
  console.log(`🗑️ Cache invalidated: ALL CACHE CLEARED`);
};
