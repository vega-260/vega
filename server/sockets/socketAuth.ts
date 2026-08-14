import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../services/authService.ts";

export interface SocketUser {
  userId: number;
  role: "STUDENT" | "COMPANY" | "TPO" | "ADMIN" | "SUPER_ADMIN";
  email: string;
}

export function installSocketAuthentication(io: Server) {
  io.use((socket: Socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || "").trim();
      if (!token) return next(new Error("AUTHENTICATION_REQUIRED"));

      const decoded = jwt.verify(token, JWT_SECRET, {
        algorithms: ["HS256"],
        issuer: "vega-api",
        audience: "vega-web",
      }) as any;

      if (!decoded?.userId || !decoded?.role || !decoded?.email) {
        return next(new Error("INVALID_ACCESS_TOKEN"));
      }

      socket.data.user = {
        userId: Number(decoded.userId),
        role: decoded.role,
        email: decoded.email,
      } satisfies SocketUser;
      return next();
    } catch {
      return next(new Error("INVALID_OR_EXPIRED_ACCESS_TOKEN"));
    }
  });
}
