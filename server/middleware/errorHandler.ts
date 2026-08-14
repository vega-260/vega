import type { Request, Response, NextFunction } from "express";
import logger from "../services/logger.ts";
import type { RequestWithId } from "../observability/requestContext.ts";
import { AppError } from "../shared/errors.ts";

export function notFoundHandler(req: Request, res: Response) {
  return res.status(404).json({ success: false, message: "Route not found", path: req.path });
}

export function errorHandler(error: unknown, req: RequestWithId, res: Response, _next: NextFunction) {
  const err = error instanceof Error ? error : new Error(String(error));
  logger.error("Unhandled request error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
  if (res.headersSent) return;
  const appError = err instanceof AppError ? err : null;
  const statusCode = appError?.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    code: appError?.code || "INTERNAL_ERROR",
    message: appError?.expose ? appError.message : "Internal server error",
    details: appError?.expose ? appError.details : undefined,
    requestId: req.requestId,
  });
}
