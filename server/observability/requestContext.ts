import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { finishQueryBudget, runWithQueryBudget } from "./queryBudget.ts";

export interface RequestWithId extends Request { requestId?: string }

export function requestContext(req: RequestWithId, res: Response, next: NextFunction) {
  const incoming = req.header("x-request-id");
  const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  runWithQueryBudget(requestId, req.path, () => {
    res.once("finish", () => finishQueryBudget(req.method, req.originalUrl || req.url));
    next();
  });
}
