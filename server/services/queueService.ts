// import { Queue, Worker, Job } from "bullmq";
// import IORedis from "ioredis";
// import crypto from "crypto";

// // Graceful connection error management for Redis
// import { recordQueueEnqueue } from "../observability/metrics.ts";
// let redisConnection: IORedis | null = null;
// let aiAssessmentQueue: Queue | null = null;
// let outboundEmailQueue: Queue | null = null;
// let isRedisAvailable = false;

// try {
//   const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  
//   // Use lazy instantiation / safe connection handlers to prevent app-wide startup crashes
//   redisConnection = new IORedis(redisUrl, {
//     maxRetriesPerRequest: null, // BullMQ requirement
//     enableReadyCheck: false,
//     connectTimeout: 5000,
//     reconnectOnError: () => true
//   });

//   redisConnection.on("connect", () => {
//     isRedisAvailable = true;
//     console.log("🐂 Redis connected successfully for BullMQ");
//   });

//   redisConnection.on("error", (err) => {
//     isRedisAvailable = false;
//     console.warn("⚠️ Redis connection warning: queued workloads are temporarily unavailable.");
//   });

//   // Initialize the main job queue
//   aiAssessmentQueue = new Queue("ai-assessments", { 
//     connection: redisConnection as any 
//   });
//   outboundEmailQueue = new Queue("outbound-email", {
//     connection: redisConnection as any
//   });

// } catch (err) {
//   isRedisAvailable = false;
//   console.warn("⚠️ Failed to initialize Redis/BullMQ Queue:", err);
// }

// // Separate function for processing the actual evaluation to reuse in queue and fallback states
// export async function processSessionEvaluation(data: { studentId: number; transcript: string }) {
//   const { studentId, transcript } = data;
//   console.log(`🤖 Processing AI Evaluation session for Student #${studentId}...`);
  
//   const { GoogleGenAI } = await import("@google/genai");
//   const db = (await import("../db.ts")).default;
//   const { calculateTalentScore, updateDailyTask } = await import("./analyticsService.ts");

//   if (!process.env.GEMINI_API_KEY) {
//     throw new Error("Cannot evaluate session: GEMINI_API_KEY environment variable is not defined");
//   }

//   const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
//   const prompt = `You are an elite AI interview evaluator. Analyze the following conversational interview transcript of a technical mock interview.
//   Transcript: ${transcript}
  
//   Score the student's performance from 0 to 100 on these 5 dimensions:
//   1. communication (general verbal flow, style)
//   2. confidence (answering posture, certainty)
//   3. explanation (technical accuracy, depth)
//   4. presentation (handling complex topics, formatting ideas)
//   5. knowledge (concrete theoretical and practical awareness)

//   Also provide an overall score, general detailed feedback (max 3 sentences), a list of up to 3 strengths, 3 weaknesses, and 3 actionable improvement tips.
  
//   Return strictly valid JSON with this format:
//   {
//     "scores": {
//       "overall": 85,
//       "communication": 80,
//       "confidence": 90,
//       "explanation": 85,
//       "presentation": 80,
//       "knowledge": 90
//     },
//     "detailed_feedback": "...",
//     "strengths": ["...", "..."],
//     "weaknesses": ["...", "..."],
//     "improvement_tips": ["...", "..."]
//   }`;

//   // Execute Gemini evaluation using the circuit breaker to handle transient hiccups
//   const { geminiBreaker } = await import("./circuitBreakerService.ts");
  
//   const rawResult = await geminiBreaker.fire({
//     apiCall: async () => {
//       const response = await ai.models.generateContent({
//         model: "gemini-3-flash-preview",
//         contents: prompt,
//         config: { responseMimeType: "application/json" }
//       });
//       return response.text || "";
//     }
//   });

//   const evaluationResult = JSON.parse(rawResult);
//   const scores = evaluationResult.scores || {};
//   const overallScore = scores.overall || 75;

//   // Retrieve student profile
//   let [profiles]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [studentId]);
//   let profileId = null;

//   if (profiles && profiles.length > 0) {
//     profileId = profiles[0].id;
//     // Save to interview logs
//     await db.query(`
//       INSERT INTO interview_history 
//       (student_id, score, communication_score, confidence_score, explanation_score, presentation_score, knowledge_score, feedback, strengths_json, weaknesses_json, tips_json, transcript_json) 
//       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//     `, [
//       profileId, 
//       overallScore,
//       scores.communication || 75,
//       scores.confidence || 75,
//       scores.explanation || 75,
//       scores.presentation || 75,
//       scores.knowledge || 75,
//       evaluationResult.detailed_feedback || "Excellent effort in this mock session.",
//       JSON.stringify(evaluationResult.strengths || []),
//       JSON.stringify(evaluationResult.weaknesses || []),
//       JSON.stringify(evaluationResult.improvement_tips || []),
//       JSON.stringify([{ role: "evaluation_summary", text: "Transcript analyzed by queue thread" }])
//     ]);

//     await db.query("UPDATE student_profiles SET completeness_score = LEAST(100, completeness_score + 15) WHERE id = ?", [profileId]);
//   }

//   // Save to modern adaptive systems table mapping
//   await db.query(`
//     INSERT INTO interview_sessions 
//     (user_id, role, level, techstack, focus, difficulty, communication, score, status)
//     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
//   `, [
//     studentId,
//     "Software Engineer",
//     "Fresher",
//     JSON.stringify(["Software Development"]),
//     "Mixed",
//     "Medium",
//     "Voice",
//     overallScore
//   ]);

//   // Update rolling stats
//   const [existingPerf]: any = await db.query("SELECT id, avg_interview_score FROM student_performance_stats WHERE user_id = ?", [studentId]);
//   if (existingPerf.length > 0) {
//     const currentAvg = existingPerf[0].avg_interview_score || 0;
//     const newAvg = (currentAvg + overallScore) / 2;
//     await db.query(`
//       UPDATE student_performance_stats 
//       SET avg_interview_score = ?, updated_at = CURRENT_TIMESTAMP
//       WHERE user_id = ?
//     `, [newAvg, studentId]);
//   } else {
//     await db.query(`
//       INSERT INTO student_performance_stats (user_id, avg_interview_score)
//       VALUES (?, ?)
//     `, [studentId, overallScore]);
//   }

//   // Auto increment tasks and evaluate holistic talents metric
//   await updateDailyTask(studentId, 'INTERVIEW');
//   await calculateTalentScore(Number(studentId));

//   console.log(`✅ Student #${studentId} asynchronous assessment completed and saved successfully.`);
//   return evaluationResult;
// }

// export async function withDistributedLock<T>(key: string, ttlMs: number, work: () => Promise<T>): Promise<T | null> {
//   if (!redisConnection || !isRedisAvailable) {
//     if (process.env.NODE_ENV === "production") return null;
//     return work();
//   }
//   const lockKey = `vega:lock:${key}`;
//   const token = crypto.randomUUID();
//   const acquired = await redisConnection.set(lockKey, token, "PX", Math.max(1000, ttlMs), "NX");
//   if (acquired !== "OK") return null;
//   try {
//     return await work();
//   } finally {
//     const releaseScript = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
//     await redisConnection.eval(releaseScript, 1, lockKey, token).catch(() => undefined);
//   }
// }


// export type QueuedEmail = {
//   to: string;
//   subject: string;
//   html: string;
//   dedupeKey?: string;
// };

// export async function enqueueEmail(message: QueuedEmail) {
//   if (!isRedisAvailable || !outboundEmailQueue) {
//     if (process.env.NODE_ENV === "production") throw new Error("Outbound email queue is temporarily unavailable");
//     const { sendEmail } = await import("./emailService.ts");
//     await sendEmail(message.to, message.subject, message.html);
//     return { success: true, mode: "development_direct" as const };
//   }
//   const digest = message.dedupeKey
//     ? crypto.createHash("sha256").update(message.dedupeKey).digest("hex").slice(0, 40)
//     : crypto.createHash("sha256").update(`${message.to}:${message.subject}:${message.html}`).digest("hex").slice(0, 40);
//   try {
//     await outboundEmailQueue.add("send-email", message, {
//       jobId: `email-${digest}`,
//       attempts: 5,
//       backoff: { type: "exponential", delay: 3000 },
//       removeOnComplete: { age: 24 * 60 * 60, count: 20_000 },
//       removeOnFail: { age: 14 * 24 * 60 * 60, count: 50_000 },
//     });
//     recordQueueEnqueue(true);
//     return { success: true, mode: "queued" as const };
//   } catch (error) {
//     recordQueueEnqueue(false);
//     throw error;
//   }
// }

// export function createEmailWorker(concurrency = Number(process.env.EMAIL_WORKER_CONCURRENCY || 4)) {
//   if (!redisConnection) throw new Error("REDIS_URL is required for the email worker");
//   const worker = new Worker("outbound-email", async (job: Job<QueuedEmail>) => {
//     const { sendEmail } = await import("./emailService.ts");
//     const { to, subject, html } = job.data;
//     await sendEmail(to, subject, html);
//     return { delivered: true };
//   }, {
//     connection: redisConnection as any,
//     concurrency: Math.max(1, Math.min(concurrency, 25)),
//   });
//   worker.on("failed", (job, err) => console.error(`Outbound email failed after retry (${job?.id}):`, err));
//   return worker;
// }

// export async function closeQueueConnections() {
//   await Promise.all([
//     aiAssessmentQueue?.close().catch(() => undefined),
//     outboundEmailQueue?.close().catch(() => undefined),
//   ]);
//   aiAssessmentQueue = null;
//   outboundEmailQueue = null;
//   if (redisConnection) await redisConnection.quit().catch(() => redisConnection?.disconnect());
//   redisConnection = null;
//   isRedisAvailable = false;
// }

// // Worker creation is explicit so API containers never consume background jobs.
// export function createAssessmentWorker(concurrency = Number(process.env.AI_WORKER_CONCURRENCY || 2)) {
//   if (!redisConnection) {
//     throw new Error("REDIS_URL is required for the assessment worker");
//   }

//   const worker = new Worker("ai-assessments", async (job: Job) => {
//     console.log(`📦 BullMQ Processing Job: ${job.id}`);
//     return processSessionEvaluation(job.data);
//   }, {
//     connection: redisConnection as any,
//     concurrency: Math.max(1, Math.min(concurrency, 20)),
//   });

//   worker.on("completed", (job) => console.log(`🏆 Task Job Completed Successfully: ${job.id}`));
//   worker.on("failed", (job, err) => console.error(`❌ Task Job Failed: ${job?.id} error:`, err));
//   return worker;
// }

// export function getQueueHealth() {
//   return { configured: Boolean(process.env.REDIS_URL), available: isRedisAvailable };
// }

// // Expose main utility for queue inserts
// export async function addInterviewToProcessQueue(studentId: number, transcript: string) {
//   if (isRedisAvailable && aiAssessmentQueue) {
//     try {
//       console.log(`📥 Offloading mock assessment for Student #${studentId} to Redis Event Broker...`);
//       const digest = crypto.createHash("sha256").update(`${studentId}:${transcript}`).digest("hex").slice(0, 32);
//       await aiAssessmentQueue.add("evaluate-session", {
//         studentId,
//         transcript,
//         timestamp: Date.now()
//       }, {
//         jobId: `interview-${studentId}-${digest}`,
//         attempts: 3,
//         backoff: { type: "exponential", delay: 5000 },
//         removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
//         removeOnFail: { age: 7 * 24 * 60 * 60, count: 50_000 }
//       });
//       recordQueueEnqueue(true);
//       return { success: true, mode: "queued" };
//     } catch (err) {
//       recordQueueEnqueue(false);
//       console.error("Queue insert failed, falling back to direct asynchronous process task:", err);
//     }
//   }

//   if (process.env.NODE_ENV === "production") {
//     throw new Error("Assessment queue is temporarily unavailable");
//   }

//   // Development-only fallback keeps local setup convenient without risking production API saturation.
//   console.warn(`🔌 Development fallback: processing evaluation outside Redis for Student #${studentId}`);
//   setImmediate(() => processSessionEvaluation({ studentId, transcript }).catch((e) => {
//     console.error("Development fallback task failed:", e);
//   }));
//   return { success: true, mode: "development_fallback" };
// }




import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import crypto from "crypto";

// Graceful connection error management for Redis
import { recordQueueEnqueue } from "../observability/metrics.ts";

let redisConnection: IORedis | null = null;
let aiAssessmentQueue: Queue | null = null;
let outboundEmailQueue: Queue | null = null;
let isRedisAvailable = false;

const isProduction = process.env.NODE_ENV === "production";
const redisEnabled =
  String(process.env.REDIS_ENABLED ?? "true").trim().toLowerCase() !== "false";
const redisUrl = String(process.env.REDIS_URL ?? "").trim();

let lastRedisWarningAt = 0;
const REDIS_WARNING_INTERVAL_MS = 30_000;

function logRedisWarning(message: string, error?: unknown) {
  const now = Date.now();
  if (now - lastRedisWarningAt < REDIS_WARNING_INTERVAL_MS) return;

  lastRedisWarningAt = now;
  if (error) {
    console.warn(message, error);
  } else {
    console.warn(message);
  }
}

function initializeRedisQueues() {
  // Redis is optional for a temporary single-instance deployment.
  // When disabled, no Redis/BullMQ connection is created and the API continues
  // using the direct fallbacks implemented below.
  if (!redisEnabled) {
    console.warn(
      "⚠️ Redis/BullMQ disabled (REDIS_ENABLED=false). " +
      "Queueing, Redis cache, and distributed coordination are unavailable."
    );
    return;
  }

  if (!redisUrl) {
    console.warn(
      "⚠️ REDIS_URL is empty. Continuing without Redis/BullMQ. " +
      "Set REDIS_URL before enabling Redis-backed production workloads."
    );
    return;
  }

  try {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // BullMQ requirement
      enableReadyCheck: false,
      connectTimeout: 5000,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 1000, 10_000),
      reconnectOnError: () => true,
    });

    redisConnection.on("connect", () => {
      isRedisAvailable = true;
      console.log("🐂 Redis connected successfully for BullMQ");
    });

    redisConnection.on("ready", () => {
      isRedisAvailable = true;
    });

    redisConnection.on("close", () => {
      isRedisAvailable = false;
    });

    redisConnection.on("end", () => {
      isRedisAvailable = false;
    });

    redisConnection.on("error", (err) => {
      isRedisAvailable = false;
      logRedisWarning(
        "⚠️ Redis connection warning: queued workloads are temporarily unavailable.",
        isProduction ? err : undefined
      );
    });

    aiAssessmentQueue = new Queue("ai-assessments", {
      connection: redisConnection as any,
    });

    outboundEmailQueue = new Queue("outbound-email", {
      connection: redisConnection as any,
    });
  } catch (err) {
    isRedisAvailable = false;

    logRedisWarning(
      "⚠️ Failed to initialize Redis/BullMQ. Continuing without Redis-backed queues.",
      err
    );

    redisConnection = null;
    aiAssessmentQueue = null;
    outboundEmailQueue = null;
  }
}

initializeRedisQueues();

// Separate function for processing the actual evaluation to reuse in queue and fallback states
export async function processSessionEvaluation(data: { studentId: number; transcript: string }) {
  const { studentId, transcript } = data;
  console.log(`🤖 Processing AI Evaluation session for Student #${studentId}...`);
  
  const { GoogleGenAI } = await import("@google/genai");
  const db = (await import("../db.ts")).default;
  const { calculateTalentScore, updateDailyTask } = await import("./analyticsService.ts");

  if (!process.env.GEMINI_API_KEY) {
    throw new Error("Cannot evaluate session: GEMINI_API_KEY environment variable is not defined");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const prompt = `You are an elite AI interview evaluator. Analyze the following conversational interview transcript of a technical mock interview.
  Transcript: ${transcript}
  
  Score the student's performance from 0 to 100 on these 5 dimensions:
  1. communication (general verbal flow, style)
  2. confidence (answering posture, certainty)
  3. explanation (technical accuracy, depth)
  4. presentation (handling complex topics, formatting ideas)
  5. knowledge (concrete theoretical and practical awareness)

  Also provide an overall score, general detailed feedback (max 3 sentences), a list of up to 3 strengths, 3 weaknesses, and 3 actionable improvement tips.
  
  Return strictly valid JSON with this format:
  {
    "scores": {
      "overall": 85,
      "communication": 80,
      "confidence": 90,
      "explanation": 85,
      "presentation": 80,
      "knowledge": 90
    },
    "detailed_feedback": "...",
    "strengths": ["...", "..."],
    "weaknesses": ["...", "..."],
    "improvement_tips": ["...", "..."]
  }`;

  // Execute Gemini evaluation using the circuit breaker to handle transient hiccups
  const { geminiBreaker } = await import("./circuitBreakerService.ts");
  
  const rawResult = await geminiBreaker.fire({
    apiCall: async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });
      return response.text || "";
    }
  });

  const evaluationResult = JSON.parse(rawResult);
  const scores = evaluationResult.scores || {};
  const overallScore = scores.overall || 75;

  // Retrieve student profile
  let [profiles]: any = await db.query("SELECT id FROM student_profiles WHERE user_id = ?", [studentId]);
  let profileId = null;

  if (profiles && profiles.length > 0) {
    profileId = profiles[0].id;
    // Save to interview logs
    await db.query(`
      INSERT INTO interview_history 
      (student_id, score, communication_score, confidence_score, explanation_score, presentation_score, knowledge_score, feedback, strengths_json, weaknesses_json, tips_json, transcript_json) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      profileId, 
      overallScore,
      scores.communication || 75,
      scores.confidence || 75,
      scores.explanation || 75,
      scores.presentation || 75,
      scores.knowledge || 75,
      evaluationResult.detailed_feedback || "Excellent effort in this mock session.",
      JSON.stringify(evaluationResult.strengths || []),
      JSON.stringify(evaluationResult.weaknesses || []),
      JSON.stringify(evaluationResult.improvement_tips || []),
      JSON.stringify([{ role: "evaluation_summary", text: "Transcript analyzed by queue thread" }])
    ]);

    await db.query("UPDATE student_profiles SET completeness_score = LEAST(100, completeness_score + 15) WHERE id = ?", [profileId]);
  }

  // Save to modern adaptive systems table mapping
  await db.query(`
    INSERT INTO interview_sessions 
    (user_id, role, level, techstack, focus, difficulty, communication, score, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED')
  `, [
    studentId,
    "Software Engineer",
    "Fresher",
    JSON.stringify(["Software Development"]),
    "Mixed",
    "Medium",
    "Voice",
    overallScore
  ]);

  // Update rolling stats
  const [existingPerf]: any = await db.query("SELECT id, avg_interview_score FROM student_performance_stats WHERE user_id = ?", [studentId]);
  if (existingPerf.length > 0) {
    const currentAvg = existingPerf[0].avg_interview_score || 0;
    const newAvg = (currentAvg + overallScore) / 2;
    await db.query(`
      UPDATE student_performance_stats 
      SET avg_interview_score = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `, [newAvg, studentId]);
  } else {
    await db.query(`
      INSERT INTO student_performance_stats (user_id, avg_interview_score)
      VALUES (?, ?)
    `, [studentId, overallScore]);
  }

  // Auto increment tasks and evaluate holistic talents metric
  await updateDailyTask(studentId, 'INTERVIEW');
  await calculateTalentScore(Number(studentId));

  console.log(`✅ Student #${studentId} asynchronous assessment completed and saved successfully.`);
  return evaluationResult;
}

export async function withDistributedLock<T>(
  key: string,
  ttlMs: number,
  work: () => Promise<T>
): Promise<T | null> {
  if (!redisEnabled || !redisConnection || !isRedisAvailable) {
    // Temporary single-instance fallback. This is NOT a distributed lock.
    // Re-enable Redis before running multiple API instances/workers.
    console.warn(
      `⚠️ Redis distributed lock unavailable for "${key}". Running without a distributed lock.`
    );
    return work();
  }
  const lockKey = `vega:lock:${key}`;
  const token = crypto.randomUUID();
  const acquired = await redisConnection.set(lockKey, token, "PX", Math.max(1000, ttlMs), "NX");
  if (acquired !== "OK") return null;
  try {
    return await work();
  } finally {
    const releaseScript = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await redisConnection.eval(releaseScript, 1, lockKey, token).catch(() => undefined);
  }
}


export type QueuedEmail = {
  to: string;
  subject: string;
  html: string;
  dedupeKey?: string;
};

export async function enqueueEmail(message: QueuedEmail) {
  if (!redisEnabled || !isRedisAvailable || !outboundEmailQueue) {
    console.warn(
      "⚠️ Redis email queue unavailable. Sending email directly from the API process."
    );

    const { sendEmail } = await import("./emailService.ts");
    await sendEmail(message.to, message.subject, message.html);
    return { success: true, mode: "direct" as const };
  }
  const digest = message.dedupeKey
    ? crypto.createHash("sha256").update(message.dedupeKey).digest("hex").slice(0, 40)
    : crypto.createHash("sha256").update(`${message.to}:${message.subject}:${message.html}`).digest("hex").slice(0, 40);
  try {
    await outboundEmailQueue.add("send-email", message, {
      jobId: `email-${digest}`,
      attempts: 5,
      backoff: { type: "exponential", delay: 3000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 20_000 },
      removeOnFail: { age: 14 * 24 * 60 * 60, count: 50_000 },
    });
    recordQueueEnqueue(true);
    return { success: true, mode: "queued" as const };
  } catch (error) {
    recordQueueEnqueue(false);
    throw error;
  }
}

export function createEmailWorker(
  concurrency = Number(process.env.EMAIL_WORKER_CONCURRENCY || 4)
) {
  if (!redisEnabled) {
    throw new Error(
      "Redis is disabled (REDIS_ENABLED=false); the email worker cannot run."
    );
  }

  if (!redisConnection) {
    throw new Error("REDIS_URL is required for the email worker");
  }
  const worker = new Worker("outbound-email", async (job: Job<QueuedEmail>) => {
    const { sendEmail } = await import("./emailService.ts");
    const { to, subject, html } = job.data;
    await sendEmail(to, subject, html);
    return { delivered: true };
  }, {
    connection: redisConnection as any,
    concurrency: Math.max(1, Math.min(concurrency, 25)),
  });
  worker.on("failed", (job, err) => console.error(`Outbound email failed after retry (${job?.id}):`, err));
  return worker;
}

export async function closeQueueConnections() {
  await Promise.all([
    aiAssessmentQueue?.close().catch(() => undefined),
    outboundEmailQueue?.close().catch(() => undefined),
  ]);
  aiAssessmentQueue = null;
  outboundEmailQueue = null;
  if (redisConnection) await redisConnection.quit().catch(() => redisConnection?.disconnect());
  redisConnection = null;
  isRedisAvailable = false;
}

// Worker creation is explicit so API containers never consume background jobs.
export function createAssessmentWorker(
  concurrency = Number(process.env.AI_WORKER_CONCURRENCY || 2)
) {
  if (!redisEnabled) {
    throw new Error(
      "Redis is disabled (REDIS_ENABLED=false); the assessment worker cannot run."
    );
  }

  if (!redisConnection) {
    throw new Error("REDIS_URL is required for the assessment worker");
  }

  const worker = new Worker("ai-assessments", async (job: Job) => {
    console.log(`📦 BullMQ Processing Job: ${job.id}`);
    return processSessionEvaluation(job.data);
  }, {
    connection: redisConnection as any,
    concurrency: Math.max(1, Math.min(concurrency, 20)),
  });

  worker.on("completed", (job) => console.log(`🏆 Task Job Completed Successfully: ${job.id}`));
  worker.on("failed", (job, err) => console.error(`❌ Task Job Failed: ${job?.id} error:`, err));
  return worker;
}

export function getQueueHealth() {
  return {
    enabled: redisEnabled,
    configured: redisEnabled && Boolean(redisUrl),
    available: redisEnabled && isRedisAvailable,
    mode:
      redisEnabled && isRedisAvailable
        ? "redis"
        : "direct_fallback",
  };
}

// Expose main utility for queue inserts
export async function addInterviewToProcessQueue(
  studentId: number,
  transcript: string
) {
  if (redisEnabled && isRedisAvailable && aiAssessmentQueue) {
    try {
      console.log(`📥 Offloading mock assessment for Student #${studentId} to Redis Event Broker...`);
      const digest = crypto.createHash("sha256").update(`${studentId}:${transcript}`).digest("hex").slice(0, 32);
      await aiAssessmentQueue.add("evaluate-session", {
        studentId,
        transcript,
        timestamp: Date.now()
      }, {
        jobId: `interview-${studentId}-${digest}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 10_000 },
        removeOnFail: { age: 7 * 24 * 60 * 60, count: 50_000 }
      });
      recordQueueEnqueue(true);
      return { success: true, mode: "queued" };
    } catch (err) {
      recordQueueEnqueue(false);
      console.error("Queue insert failed, falling back to direct asynchronous process task:", err);
    }
  }

  // Temporary no-Redis fallback. The work runs inside this API instance.
  // Re-enable Redis/BullMQ before scaling horizontally or handling heavy AI traffic.
  console.warn(
    `🔌 Redis unavailable: processing evaluation directly for Student #${studentId}`
  );

  setImmediate(() =>
    processSessionEvaluation({ studentId, transcript }).catch((e) => {
      console.error("Direct assessment processing failed:", e);
    })
  );

  return { success: true, mode: "direct_fallback" };
}