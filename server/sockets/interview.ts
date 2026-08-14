import { Server, Socket } from "socket.io";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export function setupInterviewSocket(io: Server) {
  io.on("connection", (socket: Socket) => {
    const authenticatedUser = socket.data.user;
    let chatSession: any = null;
    let silenceTimer: NodeJS.Timeout | null = null;

    const stopSilenceDetection = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = null;
    };

    const startSilenceDetection = () => {
      stopSilenceDetection();
      silenceTimer = setTimeout(async () => {
        if (!chatSession) return;
        try {
          const nudge = await chatSession.sendMessage({
            message: "[SYSTEM: The candidate has been silent. Offer one short hint or gently rephrase the current question.]",
          });
          socket.emit("ai_message", { text: nudge.text, isHint: true });
          startSilenceDetection();
        } catch (err) {
          console.error("Silence nudge error:", err);
        }
      }, 10_000);
    };

    socket.on("start_interview", async (data: { resume?: string } = {}) => {
      if (authenticatedUser?.role !== "STUDENT") {
        return socket.emit("error", "STUDENT_ACCOUNT_REQUIRED");
      }
      if (!process.env.GEMINI_API_KEY) {
        return socket.emit("error", "AI_SERVICE_UNAVAILABLE");
      }

      const studentUserId = Number(authenticatedUser.userId);
      const { XPService } = await import("../services/xpService.ts");
      try {
        // Identity always comes from the authenticated socket, never from client payload.
        await XPService.spendInterviewCredit(studentUserId);
      } catch {
        return socket.emit("error", "INSUFFICIENT_CREDITS");
      }

      const resumeText = data.resume || "No resume provided.";
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are Aoede, a concise senior technical interviewer. Conduct a natural mock interview using 1-2 sentences per response. Ask one question at a time, follow up when answers are vague, and provide a small hint when the candidate is stuck. Do not use markdown. Candidate resume context: ${resumeText.slice(0, 12000)}`,
        },
      });
      chatSession = chat;

      try {
        const initial = await chat.sendMessage({ message: "Start with a friendly greeting and the first relevant interview question." });
        socket.emit("ai_message", { text: initial.text });
        startSilenceDetection();
      } catch (error) {
        console.error("Mock interview start error:", error);
        socket.emit("error", "AI_SERVICE_UNAVAILABLE");
      }
    });

    socket.on("user_message", async (message: string) => {
      if (!chatSession || typeof message !== "string" || !message.trim()) return;
      stopSilenceDetection();
      try {
        const result = await chatSession.sendMessage({ message: message.slice(0, 8000) });
        socket.emit("ai_message", { text: result.text });
        startSilenceDetection();
      } catch (error) {
        console.error("AI response error:", error);
        socket.emit("error", "AI_SERVICE_UNAVAILABLE");
      }
    });

    socket.on("disconnect", stopSilenceDetection);
  });
}
