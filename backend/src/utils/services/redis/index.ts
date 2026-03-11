import Redis from "ioredis";

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3,
  retryStrategy: (times: number) => {
    if (times > 3) {
      console.error("Redis: Max retry attempts reached");
      return null; // Stop retrying
    }
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  lazyConnect: true, // Don't connect immediately
};

// Create Redis client
const redis = new Redis(redisConfig);

// Connection state
let isConnected = false;

// Connection event handlers
redis.on("connect", () => {
  console.log("✅ Redis Connected Successfully");
  isConnected = true;
});

redis.on("ready", () => {
  console.log("✅ Redis Ready to accept commands");
});

redis.on("error", (err) => {
  console.error("❌ Redis Connection Error:", err.message);
  isConnected = false;
});

redis.on("close", () => {
  console.log("Redis connection closed");
  isConnected = false;
});

redis.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});

/**
 * Initialize Redis connection
 */
export const initRedis = async (): Promise<boolean> => {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.REDIS_PASSWORD
  ) {
    console.error(
      "❌ REDIS_PASSWORD not set. Skipping Redis connection in production."
    );
    return false;
  }

  try {
    await redis.connect();
    // Test connection with ping
    const pong = await redis.ping();
    if (pong === "PONG") {
      console.log("✅ Redis PING successful");
      return true;
    }
    return false;
  } catch (error) {
    console.error("❌ Redis initialization failed:", error);
    return false;
  }
};

/**
 * Check if Redis is connected
 */
export const isRedisConnected = (): boolean => {
  return isConnected && redis.status === "ready";
};

/**
 * Gracefully close Redis connection
 */
export const closeRedis = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log("Redis connection closed gracefully");
  } catch (error) {
    console.error("Error closing Redis:", error);
    redis.disconnect();
  }
};

/**
 * Get Redis client for direct operations
 */
export const getRedisClient = (): Redis => {
  return redis;
};

export default redis;
