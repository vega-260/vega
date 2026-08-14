import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "../services/authService.ts";
import { hasCapability, isVegaRole, type VegaRole } from "../security/rbac.ts";

export interface AuthUser {
  userId: number;
  role: VegaRole;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

function isValidAuthPayload(decoded: string | JwtPayload): decoded is JwtPayload & AuthUser {
  if (typeof decoded === "string") return false;
  return (
    Number.isInteger(Number(decoded.userId)) &&
    typeof decoded.role === "string" &&
    isVegaRole(decoded.role) &&
    typeof decoded.email === "string"
  );
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  const token = header.slice(7).trim();
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: "vega-api",
      audience: "vega-web",
    });

    if (!isValidAuthPayload(decoded)) {
      return res.status(401).json({ success: false, message: "Invalid access token" });
    }

    req.user = {
      userId: Number(decoded.userId),
      role: decoded.role,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

export const authorize = (roles: VegaRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: "Access denied: Insufficient permissions" });
    }
    return next();
  };
};

export const isAdmin = authorize(["ADMIN", "SUPER_ADMIN"]);

/**
 * Ownership guard for routes whose URL parameter is the users.id value.
 * ADMIN/SUPER_ADMIN may access any account. Other roles may access only themselves.
 */
export const requireSelfParam = (paramName = "userId") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) return next();

    const requestedId = Number(req.params[paramName]);
    if (!Number.isInteger(requestedId) || requestedId <= 0 || requestedId !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied: Resource does not belong to this account" });
    }
    return next();
  };
};

/** Rejects client-supplied identity spoofing while allowing legacy payloads that match the JWT. */
export const requireMatchingBodyUser = (fieldName = "userId") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) return next();

    const value = req.body?.[fieldName];
    if (value !== undefined && Number(value) !== req.user.userId) {
      return res.status(403).json({ success: false, message: "Access denied: Identity mismatch" });
    }
    return next();
  };
};

export const requireCapability = (capability: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, message: "Authentication required" });
    if (!hasCapability(req.user.role, capability)) {
      return res.status(403).json({ success: false, message: "Access denied: Missing capability" });
    }
    return next();
  };
};
