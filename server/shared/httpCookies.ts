import type { Request, Response } from "express";
import { env } from "../config/env.ts";

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return part.slice(separator + 1).trim();
    }
  }
  return undefined;
}

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(env.cookie.name, token, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: env.cookie.path,
    maxAge: env.cookie.maxAgeMs,
  });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(env.cookie.name, {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: env.cookie.path,
  });
}
