import winston from "winston";

const production = process.env.NODE_ENV === "production";
const transports: winston.transport[] = [new winston.transports.Console()];

if (!production && process.env.FILE_LOGS === "true") {
  transports.push(new winston.transports.File({ filename: "logs/error.log", level: "error" }));
  transports.push(new winston.transports.File({ filename: "logs/combined.log" }));
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
  defaultMeta: { service: process.env.SERVICE_NAME || "vega-api" },
  transports,
});

export default logger;
