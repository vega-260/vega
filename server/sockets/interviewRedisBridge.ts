import type { Server } from "socket.io";
import IORedis from "ioredis";
import crypto from "crypto";

export type InterviewBridgeMessage = {
  nodeId: string;
  roomId: string;
  event: string;
  payload: unknown;
};

export function createInterviewRedisBridge(io: Server) {
  const redisEnabled =
    String(process.env.REDIS_ENABLED ?? "true")
      .trim()
      .toLowerCase() !== "false";

  const redisUrl = String(process.env.REDIS_URL ?? "").trim();

  // Temporary single-instance fallback:
  // If Redis is explicitly disabled, do not require REDIS_URL.
  if (!redisEnabled) {
    console.warn(
      "⚠️ Redis interview signaling disabled. Using single-instance Socket.IO signaling."
    );

    return {
      enabled: false,
      publish: async (
        _roomId: string,
        _event: string,
        _payload: unknown
      ) => undefined,
    };
  }

  // Redis is enabled but URL is missing.
  if (!redisUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "REDIS_URL is required for distributed interview signaling when REDIS_ENABLED=true"
      );
    }

    console.warn(
      "⚠️ REDIS_URL is empty. Interview Redis bridge disabled for local development."
    );

    return {
      enabled: false,
      publish: async (
        _roomId: string,
        _event: string,
        _payload: unknown
      ) => undefined,
    };
  }

  const nodeId = crypto.randomUUID();

  const publisher = new IORedis(redisUrl, {
    maxRetriesPerRequest: 2,
  });

  const subscriber = publisher.duplicate();

  const channel = "vega:interview:signal";

  subscriber.subscribe(channel).catch((error) => {
    console.error(
      "Interview Redis subscription failed:",
      error
    );
  });

  subscriber.on("message", (_channel, raw) => {
    try {
      const message =
        JSON.parse(raw) as InterviewBridgeMessage;

      if (
        message.nodeId === nodeId ||
        !message.roomId ||
        !message.event
      ) {
        return;
      }

      io.to(message.roomId).emit(
        message.event,
        message.payload
      );
    } catch (error) {
      console.error(
        "Invalid interview Redis bridge message:",
        error
      );
    }
  });

  publisher.on("error", (error) => {
    console.error(
      "Interview Redis publisher error:",
      error.message
    );
  });

  subscriber.on("error", (error) => {
    console.error(
      "Interview Redis subscriber error:",
      error.message
    );
  });

  return {
    enabled: true,

    publish: async (
      roomId: string,
      event: string,
      payload: unknown
    ) => {
      const message: InterviewBridgeMessage = {
        nodeId,
        roomId,
        event,
        payload,
      };

      await publisher.publish(
        channel,
        JSON.stringify(message)
      );
    },
  };
}