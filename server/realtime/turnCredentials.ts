import crypto from "crypto";
import { env } from "../config/env.ts";

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export function createIceServers(userId: number): IceServer[] {
  const servers: IceServer[] = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];
  if (env.turn.urls.length === 0) return servers;

  if (env.turn.sharedSecret) {
    const expiry = Math.floor(Date.now() / 1000) + env.turn.ttlSeconds;
    const username = `${expiry}:${userId}`;
    const credential = crypto.createHmac("sha1", env.turn.sharedSecret).update(username).digest("base64");
    servers.push({ urls: env.turn.urls, username, credential });
    return servers;
  }

  if (env.turn.staticUsername && env.turn.staticCredential) {
    servers.push({ urls: env.turn.urls, username: env.turn.staticUsername, credential: env.turn.staticCredential });
  }
  return servers;
}
