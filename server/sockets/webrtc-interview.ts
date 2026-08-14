import { Server, Socket } from "socket.io";
import db from "../db.ts";
import { createInterviewRedisBridge } from "./interviewRedisBridge.ts";

interface JoinRoomData {
  interviewId: string | number;
}

async function authorizeInterviewParticipant(user: any, interviewId: number) {
  const [rows]: any = await db.query(`
    SELECT i.id, i.status, a.student_id, sp.user_id AS student_user_id, j.company_id
    FROM interview_schedules i
    JOIN job_applications a ON i.application_id = a.id
    JOIN student_profiles sp ON a.student_id = sp.id
    JOIN jobs j ON a.job_id = j.id
    WHERE i.id = ?
    LIMIT 1
  `, [interviewId]);

  if (!rows?.length) return { allowed: false, reason: "INTERVIEW_NOT_FOUND" };
  const interview = rows[0];

  if (["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
    return { allowed: true, interview };
  }

  if (user.role === "STUDENT") {
    return { allowed: Number(interview.student_user_id) === Number(user.userId), interview };
  }

  if (user.role === "COMPANY") {
    const [companyRows]: any = await db.query(`
      SELECT company_id FROM company_hr_profiles WHERE user_id = ?
      UNION ALL
      SELECT id AS company_id FROM company_profiles WHERE user_id = ?
      LIMIT 1
    `, [user.userId, user.userId]);
    const companyId = companyRows?.[0]?.company_id;
    return { allowed: Number(companyId) === Number(interview.company_id), interview };
  }

  return { allowed: false, reason: "ROLE_NOT_ALLOWED", interview };
}

export function setupWebRTCInterviewSocket(io: Server) {
  const bridge = createInterviewRedisBridge(io);

  io.on("connection", (socket: Socket) => {
    let currentRoom: string | null = null;
    const currentUser = socket.data.user;

    socket.on("interview:join-room", async (data: JoinRoomData) => {
      const interviewId = Number(data?.interviewId);
      if (!Number.isInteger(interviewId) || interviewId <= 0) {
        return socket.emit("interview:error", { message: "Invalid interview id" });
      }

      try {
        const access = await authorizeInterviewParticipant(currentUser, interviewId);
        if (!access.allowed) {
          return socket.emit("interview:error", { message: "Access denied for this interview" });
        }

        const status = String(access.interview?.status || "UPCOMING").toUpperCase();
        if (["COMPLETED", "CANCELLED"].includes(status)) {
          return socket.emit("interview:error", { message: `Interview is ${status.toLowerCase()}` });
        }

        const roomId = `interview_${interviewId}`;
        currentRoom = roomId;
        socket.join(roomId);

        socket.emit("interview:joined", { roomId, role: currentUser.role });
        socket.to(roomId).emit("interview:user-joined", { role: currentUser.role });
        await bridge.publish(roomId, "interview:user-joined", { role: currentUser.role });

        // A new authorized participant means peers on this or another API node should negotiate.
        io.to(roomId).emit("interview:ready");
        await bridge.publish(roomId, "interview:ready", {});
      } catch (err) {
        console.error("Interview room authorization failed:", err);
        socket.emit("interview:error", { message: "Unable to authorize interview room" });
      }
    });

    const relay = (event: string, payload: any) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit(event, payload);
      bridge.publish(currentRoom, event, payload).catch((error) => {
        console.error(`Failed to bridge ${event}:`, error);
      });
    };

    socket.on("rtc:offer", (data: { offer: any }) => relay("rtc:offer", { offer: data.offer }));
    socket.on("rtc:answer", (data: { answer: any }) => relay("rtc:answer", { answer: data.answer }));
    socket.on("rtc:ice-candidate", (data: { candidate: any }) => relay("rtc:ice-candidate", { candidate: data.candidate }));
    socket.on("interview:chat-message", (data: { message: any }) => relay("interview:chat-message", { message: data.message }));
    socket.on("interview:code-change", (data: { code: string; lang: string }) => relay("interview:code-change", { code: data.code, lang: data.lang }));
    socket.on("interview:peer-audio-toggle", (data: { micOn: boolean }) => relay("interview:peer-audio-toggle", { micOn: Boolean(data.micOn) }));
    socket.on("interview:peer-video-toggle", (data: { videoOn: boolean }) => relay("interview:peer-video-toggle", { videoOn: Boolean(data.videoOn) }));
    socket.on("interview:frame", (data: { frame: string }) => {
      if (typeof data?.frame === "string" && data.frame.length <= 2_000_000) relay("interview:frame", { frame: data.frame });
    });

    socket.on("interview:end-call", () => {
      if (!currentRoom) return;
      io.to(currentRoom).emit("interview:ended");
      bridge.publish(currentRoom, "interview:ended", {}).catch(() => undefined);
      socket.leave(currentRoom);
      currentRoom = null;
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        socket.to(currentRoom).emit("interview:user-left", { role: currentUser.role });
        bridge.publish(currentRoom, "interview:user-left", { role: currentUser.role }).catch(() => undefined);
      }
    });
  });
}
