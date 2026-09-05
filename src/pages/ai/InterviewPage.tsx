import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api.ts";
import { useAuth } from "../../context/AuthContext.tsx";
import { useAccessibility } from "../../context/AccessibilityContext.tsx";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";
import { ConsentModal } from "../../components/ConsentModal.tsx";
import { 
  Send, User, Brain, RefreshCw, Mic, MicOff, Volume2, VolumeX, 
  PhoneOff, Circle, Camera, CheckCircle2, AlertCircle, Loader2,
  Lock, LayoutDashboard, ShieldCheck, UserCheck, Zap, CameraOff, ShieldAlert
} from "lucide-react";

function checkVideoActivity(video: HTMLVideoElement): boolean {
  try {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return false;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return true;
    ctx.drawImage(video, 0, 0, 64, 48);
    const imgData = ctx.getImageData(0, 0, 64, 48).data;
    let sum = 0;
    for (let i = 0; i < imgData.length; i += 4) {
      sum += (imgData[i] + imgData[i + 1] + imgData[i + 2]) / 3;
    }
    const avg = sum / (imgData.length / 4);
    return avg > 15 && avg < 245;
  } catch (e) {
    return true;
  }
}
import { LiveInterviewService } from "../../services/liveInterviewService";
import * as faceDetection from '@tensorflow-models/face-detection';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-core';

import { PreInterviewOnboarding, InterviewProfile } from "../../components/PreInterviewOnboarding.tsx";

function StatProgress({ label, value }: { label: string, value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
        <span>{label.toUpperCase()}</span>
        <span>{value}%</span>
      </div>
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function InterviewPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [consentOpen, setConsentOpen] = useState(localStorage.getItem("consent_interview") !== "true");
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [appState, setAppState] = useState<"idle" | "listening" | "processing" | "speaking">("idle");
  const [interviewFinished, setInterviewFinished] = useState(false);
  const [interviewProfile, setInterviewProfile] = useState<InterviewProfile | null>(null);
  
  // Verification State
  const [verificationStatus, setVerificationStatus] = useState({
    camera: false,
    microphone: false,
    face: false,
    stable: false
  });
  type HardwareState = 'idle' | 'checking' | 'granted' | 'denied' | 'not_found' | 'error';
  const [cameraState, setCameraState] = useState<HardwareState>('idle');
  const [micState, setMicState] = useState<HardwareState>('idle');
  const [permissionBannerMsg, setPermissionBannerMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [cheatingWarnings, setCheatingWarnings] = useState<{ face: number; tabs: number; paste: number }>({ face: 0, tabs: 0, paste: 0 });
  const [lastWarning, setLastWarning] = useState<string | null>(null);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [xpBalance, setXpBalance] = useState<number | null>(null);
  const [freeMockCount, setFreeMockCount] = useState<number | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(true);

  // Live Metrics
  const [liveMetrics, setLiveMetrics] = useState({
    technical_depth: 80,
    confidence: 85,
    fluency: 88,
    communication: 90
  });

  const [isRefreshScreenActive, setIsRefreshScreenActive] = useState(false);

  useEffect(() => {
    const isStarted = sessionStorage.getItem("tb_interview_started") === "true";
    if (isStarted) {
      setIsRefreshScreenActive(true);
    }
  }, []);

  const handleResumeInterview = () => {
    try {
      const savedProfile = sessionStorage.getItem("tb_interview_profile");
      const savedMessages = sessionStorage.getItem("tb_interview_messages");
      const savedMetrics = sessionStorage.getItem("tb_interview_metrics");
      const savedWarnings = sessionStorage.getItem("tb_interview_warnings");

      if (savedProfile) setInterviewProfile(JSON.parse(savedProfile));
      if (savedMessages) setMessages(JSON.parse(savedMessages));
      if (savedMetrics) setLiveMetrics(JSON.parse(savedMetrics));
      if (savedWarnings) setCheatingWarnings(JSON.parse(savedWarnings));

      setInterviewStarted(false); // Direct to Verification Screen to connect camera/mic correctly
      setIsRefreshScreenActive(false);
    } catch (e) {
      console.error("Failed to restore session:", e);
      setIsRefreshScreenActive(false);
    }
  };

  const handleRestartFresh = () => {
    sessionStorage.removeItem("tb_interview_started");
    sessionStorage.removeItem("tb_interview_profile");
    sessionStorage.removeItem("tb_interview_messages");
    sessionStorage.removeItem("tb_interview_metrics");
    sessionStorage.removeItem("tb_interview_warnings");
    sessionStorage.removeItem("tb_interview_credit_deducted");
    
    setInterviewProfile(null);
    setMessages([]);
    setInterviewStarted(false);
    setIsRefreshScreenActive(false);
  };

  const handleExitToDashboard = () => {
    sessionStorage.removeItem("tb_interview_started");
    sessionStorage.removeItem("tb_interview_profile");
    sessionStorage.removeItem("tb_interview_messages");
    sessionStorage.removeItem("tb_interview_metrics");
    sessionStorage.removeItem("tb_interview_warnings");
    sessionStorage.removeItem("tb_interview_credit_deducted");
    
    navigate("/student");
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (interviewStarted) {
        e.preventDefault();
        e.returnValue = "Accidental reload detected. You are in an active AI Mock interview. Reloading may impact your compliance scoring. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [interviewStarted]);

  useEffect(() => {
    if (interviewStarted) {
      sessionStorage.setItem("tb_interview_started", "true");
      if (interviewProfile) {
        sessionStorage.setItem("tb_interview_profile", JSON.stringify(interviewProfile));
      }
      if (messages && messages.length > 0) {
        sessionStorage.setItem("tb_interview_messages", JSON.stringify(messages));
      }
      sessionStorage.setItem("tb_interview_metrics", JSON.stringify(liveMetrics));
      sessionStorage.setItem("tb_interview_warnings", JSON.stringify(cheatingWarnings));
    }
  }, [interviewStarted, interviewProfile, messages, liveMetrics, cheatingWarnings]);

  const liveServiceRef = useRef<LiveInterviewService | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectionRef = useRef<faceDetection.FaceDetector | null>(null);
  const verificationTimerRef = useRef<any>(null);
  const faceDetectedStartTimeRef = useRef<number | null>(null);

  const { setPageContext } = useAccessibility();

  useEffect(() => {
    if (setPageContext) {

      setPageContext({
        interviewStarted,
        verificationStatus,
        isVoiceEnabled,
        actions: {
          beginVerification: runVerification,
          startInterview: startInterview,
          toggleVoice: () => setIsVoiceEnabled(!isVoiceEnabled),
        }
      });
    }
  }, [interviewStarted, verificationStatus, isVoiceEnabled, setPageContext]);

  // Monitor browser permissions
  useEffect(() => {
    let unmounted = false;

    const checkInitialPermissions = async () => {
      if (typeof navigator === "undefined" || !navigator.permissions) return;

      try {
        const camPerm = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (!unmounted) {
          if (camPerm.state === "denied") {
            setCameraState("denied");
            setPermissionBannerMsg("Camera permission denied. Please allow camera access to continue.");
          } else if (camPerm.state === "granted") {
            setCameraState("granted");
          }
        }
        camPerm.onchange = () => {
          if (unmounted) return;
          if (camPerm.state === "denied") {
            setCameraState("denied");
            setPermissionBannerMsg("Camera permission denied. Please allow camera access to continue.");
            setVerificationStatus(prev => ({ ...prev, camera: false, face: false, stable: false }));
          } else if (camPerm.state === "granted") {
            setCameraState("granted");
            setPermissionBannerMsg(null);
          } else {
            setCameraState("idle");
          }
        };
      } catch (e) {
        // Query not supported for camera in this browser engine
      }

      try {
        const micPerm = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (!unmounted) {
          if (micPerm.state === "denied") {
            setMicState("denied");
          } else if (micPerm.state === "granted") {
            setMicState("granted");
          }
        }
        micPerm.onchange = () => {
          if (unmounted) return;
          if (micPerm.state === "denied") {
            setMicState("denied");
            setVerificationStatus(prev => ({ ...prev, microphone: false, stable: false }));
          } else if (micPerm.state === "granted") {
            setMicState("granted");
          } else {
            setMicState("idle");
          }
        };
      } catch (e) {}
    };

    checkInitialPermissions();

    return () => {
      unmounted = true;
    };
  }, []);

  // Initialize LiveInterviewService once on mount
  useEffect(() => {
    liveServiceRef.current = new LiveInterviewService();
    
    liveServiceRef.current.onStateChange = (state) => {
      console.log("UI STATE CHANGE:", state);
      setAppState(state);
      setIsListening(state === "listening" || state === "speaking");
      if (state === "processing") setLoading(true);
      else setLoading(false);
    };

    liveServiceRef.current.onMessage = (sender, text) => {
      console.log(`UI MESSAGE RECEIVED from ${sender}:`, text);
      const internalTriggers = [
        "ACTIVATE_INTERVIEW_PROTOCOL", 
        "START_INTERVIEW_SESSION",
        "Please start the interview session now with your welcome greeting.",
        "Hello! Please start the interview now with your welcome greeting.",
        "Start the interview now. Say hello and ask me to introduce myself.",
        "Hello, please start the interview greeting as instructed."
      ];
      
      if (internalTriggers.includes(text)) return;

      if (text === "[INTERVIEW_COMPLETED]") {
        console.log("INTERNAL TRIGGER: [INTERVIEW_COMPLETED] received");
      } else if (sender === "user") {
        api.post("/ai/analyze-sentence", { text }).then(res => {
          if (res.data && res.data.success) {
            const m = res.data.data;
            setLiveMetrics({
              technical_depth: m.technical_depth || 80,
              confidence: m.confidence || 85,
              fluency: m.fluency || 88,
              communication: m.communication || 90
            });
          }
        }).catch(err => console.log("Silent metric err", err));
      }
      
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.role === sender && last.text === text) return prev;
        return [...prev, { role: sender, text }];
      });
    };

    liveServiceRef.current.onError = (err) => {
      if (err === "INSUFFICIENT_CREDITS") {
        setInsufficientCredits(true);
      } else {
        alert(err);
      }
      stopInterview();
    };

    return () => {
      liveServiceRef.current?.stop();
    };
  }, []);

  // Voice toggle sync
  useEffect(() => {
    if (liveServiceRef.current) {
      liveServiceRef.current.isMuted = !isVoiceEnabled;
    }
  }, [isVoiceEnabled]);

  // Initialize Face Detection once on mount
  useEffect(() => {
    let mounted = true;
    const initDetector = async () => {
      try {
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detector = await faceDetection.createDetector(model, {
          runtime: 'tfjs',
          maxFaces: 1,
        });
        if (mounted) {
          detectionRef.current = detector;
        }
      } catch (err) {
        console.warn("Face detector init fallback mode:", err);
      }
    };
    initDetector();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && interviewStarted) {
        setCheatingWarnings(prev => ({ ...prev, tabs: prev.tabs + 1 }));
        setLastWarning("TAB_SWITCH");
        liveServiceRef.current?.sendText("[SYSTEM WARNING: The candidate just switched tabs or minimized the window. Please confront them about this behavior.]");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [interviewStarted]);

  useEffect(() => {
    return () => {
      if (verificationTimerRef.current) clearInterval(verificationTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const checkCredits = async () => {
      try {
        const res = await api.get("/xp/balance");
        if (res.data && res.data.balance) {
          setXpBalance(res.data.balance.xp_balance);
          setFreeMockCount(res.data.balance.free_mock_count);
        }
      } catch (err) {
        console.error("Failed to check credits", err);
      } finally {
        setCheckingCredits(false);
      }
    };
    checkCredits();
  }, []);

  const runVerification = async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    setPermissionBannerMsg(null);
    setCameraState("checking");
    setMicState("checking");

    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    if (activeStream) {
      activeStream.getTracks().forEach((t) => t.stop());
      setActiveStream(null);
    }
    setVerificationProgress(0);
    faceDetectedStartTimeRef.current = null;

    let videoStream: MediaStream | null = null;
    let audioStream: MediaStream | null = null;
    let camDenied = false;
    let micDenied = false;

    // 1. Request Video
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" }
      });
      setCameraState("granted");
    } catch (err: any) {
      console.warn("Video access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        camDenied = true;
        setCameraState("denied");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setCameraState("not_found");
      } else {
        setCameraState("error");
      }
    }

    // 2. Request Audio
    try {
      audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState("granted");
    } catch (err: any) {
      console.warn("Audio access error:", err);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        micDenied = true;
        setMicState("denied");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setMicState("not_found");
      } else {
        setMicState("error");
      }
    }

    if (camDenied) {
      setPermissionBannerMsg("Camera permission denied. Please allow camera access to continue.");
      setVerificationStatus({
        camera: false,
        microphone: !micDenied && !!audioStream,
        face: false,
        stable: false
      });
      setIsVerifying(false);
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      return;
    }

    if (!videoStream) {
      setVerificationStatus({
        camera: false,
        microphone: !micDenied && !!audioStream,
        face: false,
        stable: false
      });
      setIsVerifying(false);
      if (audioStream) audioStream.getTracks().forEach((t) => t.stop());
      return;
    }

    if (micDenied || !audioStream) {
      setPermissionBannerMsg("Microphone permission denied. Please allow microphone access to continue.");
      setVerificationStatus({
        camera: true,
        microphone: false,
        face: false,
        stable: false
      });
      setIsVerifying(false);
      if (videoStream) videoStream.getTracks().forEach((t) => t.stop());
      return;
    }

    // Both video and audio approved!
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...audioStream.getAudioTracks()
    ]);
    setActiveStream(combined);
    setVerificationStatus(prev => ({ ...prev, camera: true, microphone: true }));

    if (videoRef.current) {
      videoRef.current.srcObject = combined;
      videoRef.current.play().catch(e => console.warn("Video play error:", e));
    }

    // Face detection & stabilization loop
    verificationTimerRef.current = setInterval(async () => {
      if (!videoRef.current) return;

      let faceFound = false;
      if (videoRef.current.readyState >= 2 && videoRef.current.videoWidth > 0) {
        if (detectionRef.current) {
          try {
            const faces = await detectionRef.current.estimateFaces(videoRef.current);
            faceFound = faces.length === 1;
          } catch (detErr) {
            faceFound = checkVideoActivity(videoRef.current);
          }
        } else {
          faceFound = checkVideoActivity(videoRef.current);
        }
      }

      setVerificationStatus(prev => {
        const nextFace = faceFound;
        let nextStable = prev.stable;

        if (interviewStarted && !nextFace) {
          setLastWarning("FACE_MISSING");
          setCheatingWarnings(c => ({ ...c, face: c.face + 0.1 }));
        }

        if (nextFace) {
          if (faceDetectedStartTimeRef.current === null) {
            faceDetectedStartTimeRef.current = Date.now();
          } else {
            const duration = Date.now() - faceDetectedStartTimeRef.current;
            const progress = Math.min((duration / 2500) * 100, 100);
            setVerificationProgress(progress);
            if (duration >= 2500) {
              nextStable = true;
            }
          }
        } else {
          faceDetectedStartTimeRef.current = null;
          setVerificationProgress(0);
          nextStable = false;
        }

        return { ...prev, face: nextFace, stable: nextStable };
      });
    }, 200);
  };

  const startInterview = async () => {
    console.log("START INTERVIEW BUTTON CLICKED");
    if (!verificationStatus.stable || !activeStream) {
      console.log("CRITICAL: Verification not stable or stream missing", verificationStatus);
      return;
    }
    setIsStarting(true);
    setInterviewFinished(false);
    
    if (verificationTimerRef.current) {
      clearInterval(verificationTimerRef.current);
      verificationTimerRef.current = null;
    }
    
    // Switch state to interview view so the video element mounts
    setInterviewStarted(true);
    
    const wasDeducted = sessionStorage.getItem("tb_interview_credit_deducted") === "true";
    
    try {
      if (!wasDeducted) {
        // Verify credits
        const verifyRes = await api.post("/xp/verify-interview");
        if (!verifyRes.data.success) {
          throw new Error("INSUFFICIENT_CREDITS");
        }
      }

      if (liveServiceRef.current) {
        if (wasDeducted) {
          liveServiceRef.current.isResumedSession = true;
          const prevTranscript = messages.map(m => `${m.role === 'user' ? 'Candidate' : 'Interviewer'}: ${m.text}`).join("\n");
          liveServiceRef.current.previousTranscript = prevTranscript;
        } else {
          liveServiceRef.current.isResumedSession = false;
          liveServiceRef.current.previousTranscript = "";
        }
      }

      // Connect to AI
      await liveServiceRef.current?.start(JSON.stringify(interviewProfile || profile), activeStream);

      if (!wasDeducted) {
        // Deduct credit
        await api.post("/xp/deduct-interview");
        sessionStorage.setItem("tb_interview_credit_deducted", "true");
      }
    } catch (err: any) {
      console.error("Failed to start session:", err);
      if (err.response?.data?.message === "INSUFFICIENT_CREDITS" || err.message === "INSUFFICIENT_CREDITS") {
        setInsufficientCredits(true);
      } else {
        alert("Failed to start interview. Please try again.");
      }
      setInterviewStarted(false);
    } finally {
      setIsStarting(false);
    }
  };

  const stopInterview = () => {
    setInterviewStarted(false);
    setInterviewFinished(false);
    setVerificationStatus({ camera: false, microphone: false, face: false, stable: false });
    setCameraState("idle");
    setMicState("idle");
    setPermissionBannerMsg(null);
    setVerificationProgress(0);
    faceDetectedStartTimeRef.current = null;
    setIsVerifying(false);
    liveServiceRef.current?.stop();
    if (activeStream) {
       activeStream.getTracks().forEach(t => t.stop());
       setActiveStream(null);
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    setMessages(prev => [...prev, { role: "user", text: input }]);
    liveServiceRef.current?.sendText(input);
    setInput("");
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // Ensure video stream is attached to the ref whenever the UI switches
  useEffect(() => {
    let mounted = true;
    if (videoRef.current && activeStream) {
      if (videoRef.current.srcObject !== activeStream) {
        videoRef.current.srcObject = activeStream;
        videoRef.current.play().catch(err => console.warn("Auto-play failed:", err));
      }
    }
    return () => { mounted = false; };
  }, [interviewStarted, activeStream, videoRef.current]);

  const isSavingRef = useRef(false);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === "ai" && lastMsg.text === "[INTERVIEW_COMPLETED]" && !isSavingRef.current) {
      const summary = liveServiceRef.current?.getFinalReport();
      if (summary) {
        isSavingRef.current = true;
        api.post("/ai/save-interview-feedback", {
          userId: user?.id,
          profile: interviewProfile,
          ...summary,
          transcript: messages.filter(m => !["[INTERVIEW_COMPLETED]", "ACTIVATE_INTERVIEW_PROTOCOL"].includes(m.text))
        }).then(() => {
          console.log("Feedback saved to dashboard successfully");
          // Clear session storage on completion
          sessionStorage.removeItem("tb_interview_started");
          sessionStorage.removeItem("tb_interview_profile");
          sessionStorage.removeItem("tb_interview_messages");
          sessionStorage.removeItem("tb_interview_metrics");
          sessionStorage.removeItem("tb_interview_warnings");
          sessionStorage.removeItem("tb_interview_credit_deducted");

          setInterviewFinished(true);
          liveServiceRef.current?.stop();
          navigate("/interview-ended");
        }).catch(err => {
          console.error("Failed to save feedback:", err);
          // Clear session storage so they can start fresh
          sessionStorage.removeItem("tb_interview_started");
          sessionStorage.removeItem("tb_interview_profile");
          sessionStorage.removeItem("tb_interview_messages");
          sessionStorage.removeItem("tb_interview_metrics");
          sessionStorage.removeItem("tb_interview_warnings");
          sessionStorage.removeItem("tb_interview_credit_deducted");

          isSavingRef.current = false; // Allow retry if failed? 
          setInterviewFinished(true);
          navigate("/interview-ended");
        });
      }
    }
  }, [messages, user?.id, navigate]);

  return (
    <div className="max-w-6xl mx-auto pt-0 pb-8 font-sans text-slate-800">
      <AnimatePresence mode="wait">
      {isRefreshScreenActive ? (
        <motion.div 
          key="refresh_screen" 
          initial={{ opacity: 0, scale: 0.95 }} 
          animate={{ opacity: 1, scale: 1 }} 
          exit={{ opacity: 0, scale: 0.95 }}
          className="max-w-xl mx-auto w-full bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-slate-100 relative overflow-hidden text-center"
        >
          {/* Subtle tech background shapes */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="text-center relative z-10 w-full flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-blue-100 animate-pulse">
              <RefreshCw size={32} />
            </div>
            
            <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight text-center">
              Evaluation Interrupted
            </h2>
            <p className="text-slate-500 text-sm mb-8 leading-relaxed max-w-sm mx-auto text-center font-medium">
              A browser refresh was detected during your active AI mock interview. Your progress has been successfully recovered.
            </p>

            {/* Recovered Data Box */}
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 text-left mb-8 space-y-4 w-full">
              <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-200/60">
                <span className="text-slate-400 font-bold uppercase tracking-wider">Session Details</span>
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-850 text-[9px] font-black uppercase tracking-widest rounded-full">
                  Recovered
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Target Role</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {(() => {
                      try {
                        const prof = JSON.parse(sessionStorage.getItem("tb_interview_profile") || "{}");
                        return prof.role || "Software Developer";
                      } catch (e) {
                        return "Software Developer";
                      }
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block">Difficulty</span>
                  <span className="font-bold text-slate-800 text-sm">
                    {(() => {
                      try {
                        const prof = JSON.parse(sessionStorage.getItem("tb_interview_profile") || "{}");
                        return prof.difficulty || "Medium";
                      } catch (e) {
                        return "Medium";
                      }
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block font-sans">Turns Saved</span>
                  <span className="font-bold text-slate-800 text-sm block">
                    {(() => {
                      try {
                        const msgs = JSON.parse(sessionStorage.getItem("tb_interview_messages") || "[]");
                        return `${msgs.length} Interaction(s)`;
                      } catch (e) {
                        return "0 Interactions";
                      }
                    })()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest block font-sans text-red-400">Compliance Alerts</span>
                  <span className="font-bold text-red-500 font-sans text-sm block">
                    {(() => {
                      try {
                        const warn = JSON.parse(sessionStorage.getItem("tb_interview_warnings") || '{"face":0,"tabs":0,"paste":0}');
                        const total = (warn.face || 0) + (warn.tabs || 0) + (warn.paste || 0);
                        return `${total} Incident(s)`;
                      } catch (e) {
                        return "0 Incidents";
                      }
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={handleResumeInterview}
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-blue-600/10 flex items-center justify-center gap-2"
              >
                <Zap size={16} /> Resume Evaluation
              </button>
              
              <button 
                onClick={handleRestartFresh}
                className="w-full py-4 bg-slate-50 hover:bg-slate-105 text-slate-700 font-bold uppercase tracking-widest text-xs rounded-2xl transition-all border border-slate-200"
              >
                Restart Fresh Session
              </button>

              <button 
                onClick={handleExitToDashboard}
                className="mt-4 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors p-2 text-center"
              >
                Return to Student Dashboard
              </button>
            </div>
          </div>
        </motion.div>
      ) : !interviewProfile ? (
         <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <PreInterviewOnboarding onComplete={(prof) => setInterviewProfile(prof)} />
         </motion.div>
      ) : !interviewStarted ? (
        <motion.div 
          key="verification"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-card overflow-hidden"
        >
          <div className="relative h-2 bg-slate-100 italic">
            <motion.div 
              className="absolute inset-0 bg-blue-600 origin-left"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: verificationProgress / 100 }}
            />
          </div>
          
          <div className="p-12 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-xl shadow-blue-500/20">
              <ShieldCheck size={40} />
            </div>
            
            <h2 className="text-4xl font-bold mb-4 tracking-tight">Interview Readiness Verification</h2>
            <p className="text-xl text-slate-500 mb-8 max-w-lg mx-auto">
              Our AI system requires hardware and identity verification to maintain professional integrity.
            </p>

            {(cameraState === "denied" || permissionBannerMsg) && (
              <div className="mb-8 p-4 rounded-2xl bg-red-50/90 border-2 border-red-200 flex items-start gap-3.5 text-left text-red-900 shadow-sm max-w-3xl mx-auto">
                <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-red-900">
                    Camera permission denied. Please allow camera access to continue.
                  </h4>
                  <p className="text-xs text-red-700 mt-1 leading-relaxed">
                    Camera access is strictly required to verify identity and proceed with the mock interview. Click the camera or lock icon in your browser's address bar, set Camera to <strong>"Allow"</strong>, and click <strong>Retry Access</strong>.
                  </p>
                </div>
                <button
                  onClick={runVerification}
                  className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center gap-1.5"
                >
                  <RefreshCw size={13} />
                  Retry Access
                </button>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              {/* Preview Container */}
              <div className="relative">
                <div className="aspect-video bg-slate-900 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-2xl relative">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]" 
                  />
                  {cameraState === "denied" ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6 text-center z-10">
                      <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3 shadow-inner">
                        <CameraOff size={28} />
                      </div>
                      <h5 className="font-bold text-white text-sm mb-1">Camera Permission Denied</h5>
                      <p className="text-slate-400 text-xs max-w-xs mb-4 leading-relaxed">
                        Camera access is required for identity and proctoring verification.
                      </p>
                      <button
                        onClick={runVerification}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-900/30"
                      >
                        <RefreshCw size={14} /> Retry Camera Permission
                      </button>
                    </div>
                  ) : !isVerifying && !activeStream ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm">
                      <Camera size={48} className="text-slate-700 animate-pulse" />
                    </div>
                  ) : null}
                  {isVerifying && verificationStatus.face && (
                    <div className="absolute top-4 right-4 bg-emerald-500 text-white p-2 rounded-full shadow-lg z-10">
                      <UserCheck size={20} />
                    </div>
                  )}
                </div>
                
                <div className="mt-6 flex justify-center gap-6">
                  <div className={`flex flex-col items-center gap-2 ${
                    verificationStatus.camera 
                      ? "text-emerald-600" 
                      : cameraState === "denied" 
                      ? "text-red-500" 
                      : "text-slate-400"
                  }`}>
                    <div className={`p-3 rounded-2xl ${
                      verificationStatus.camera 
                        ? "bg-emerald-50" 
                        : cameraState === "denied" 
                        ? "bg-red-50" 
                        : "bg-slate-50"
                    }`}>
                      {cameraState === "denied" ? <CameraOff size={20} /> : <Camera size={20} />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Camera</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 ${
                    verificationStatus.microphone 
                      ? "text-emerald-600" 
                      : (micState === "denied" || cameraState === "denied")
                      ? "text-red-500" 
                      : "text-slate-400"
                  }`}>
                    <div className={`p-3 rounded-2xl ${
                      verificationStatus.microphone 
                        ? "bg-emerald-50" 
                        : (micState === "denied" || cameraState === "denied")
                        ? "bg-red-50" 
                        : "bg-slate-50"
                    }`}>
                      {(micState === "denied" || cameraState === "denied") ? <MicOff size={20} /> : <Mic size={20} />}
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Mic</span>
                  </div>
                  <div className={`flex flex-col items-center gap-2 ${
                    verificationStatus.face && verificationStatus.stable 
                      ? "text-emerald-600" 
                      : cameraState === "denied"
                      ? "text-red-500"
                      : "text-slate-400"
                  }`}>
                    <div className={`p-3 rounded-2xl ${
                      verificationStatus.face && verificationStatus.stable 
                        ? "bg-emerald-50" 
                        : cameraState === "denied"
                        ? "bg-red-50" 
                        : "bg-slate-50"
                    }`}>
                      <User size={20} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest">Face Detection</span>
                  </div>
                </div>
              </div>

              {/* Status & Control */}
              <div className="text-left space-y-6">
                <div className="space-y-4">
                  {/* Camera Status Card */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                    verificationStatus.camera 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                      : cameraState === "denied"
                      ? "bg-red-50 border-red-200 text-red-900"
                      : cameraState === "not_found"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    {verificationStatus.camera ? (
                      <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                    ) : cameraState === "denied" ? (
                      <AlertCircle size={24} className="text-red-600 shrink-0" />
                    ) : cameraState === "checking" ? (
                      <Loader2 size={24} className="text-blue-600 animate-spin shrink-0" />
                    ) : (
                      <Camera size={24} className="text-slate-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm">Camera Status</h4>
                      <p className="text-xs font-medium opacity-90 leading-snug">
                        {verificationStatus.camera 
                          ? "Camera detected & connected" 
                          : cameraState === "denied"
                          ? "Camera permission denied. Please allow camera access to continue."
                          : cameraState === "not_found"
                          ? "No camera hardware detected on device"
                          : cameraState === "checking"
                          ? "Checking camera access..."
                          : "Ready to verify hardware"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Microphone Status Card */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                    verificationStatus.microphone 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                      : (micState === "denied" || cameraState === "denied")
                      ? "bg-red-50 border-red-200 text-red-900"
                      : micState === "not_found"
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    {verificationStatus.microphone ? (
                      <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                    ) : (micState === "denied" || cameraState === "denied") ? (
                      <AlertCircle size={24} className="text-red-600 shrink-0" />
                    ) : micState === "checking" ? (
                      <Loader2 size={24} className="text-blue-600 animate-spin shrink-0" />
                    ) : (
                      <Mic size={24} className="text-slate-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm">Microphone Status</h4>
                      <p className="text-xs font-medium opacity-90 leading-snug">
                        {verificationStatus.microphone 
                          ? "Microphone detected & connected" 
                          : micState === "denied"
                          ? "Microphone permission denied. Please allow microphone access to continue."
                          : cameraState === "denied"
                          ? "Blocked: Camera permission required first"
                          : micState === "not_found"
                          ? "No microphone hardware detected on device"
                          : micState === "checking"
                          ? "Checking microphone access..."
                          : "Ready to verify microphone"}
                      </p>
                    </div>
                  </div>

                  {/* Face Detection Card */}
                  <div className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${
                    (verificationStatus.face && verificationStatus.stable) 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900" 
                      : cameraState === "denied"
                      ? "bg-red-50 border-red-200 text-red-900"
                      : isVerifying
                      ? "bg-blue-50 border-blue-200 text-blue-900"
                      : "bg-slate-50 border-slate-200 text-slate-800"
                  }`}>
                    {(verificationStatus.face && verificationStatus.stable) ? (
                      <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                    ) : cameraState === "denied" ? (
                      <AlertCircle size={24} className="text-red-600 shrink-0" />
                    ) : isVerifying ? (
                      <Loader2 size={24} className="text-blue-600 animate-spin shrink-0" />
                    ) : (
                      <User size={24} className="text-slate-400 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm">Face Detection</h4>
                      <p className="text-xs font-medium opacity-90 leading-snug">
                        {cameraState === "denied"
                          ? "Verification blocked: Camera permission required"
                          : (verificationStatus.face && verificationStatus.stable)
                          ? "Identity Verified (Single face confirmed)"
                          : !isVerifying
                          ? "Verification pending camera connection"
                          : !verificationStatus.face 
                          ? "Looking for face... Please look directly into camera" 
                          : !verificationStatus.stable 
                          ? `Stabilizing... ${Math.round(verificationProgress)}%` 
                          : "Identity Verified"}
                      </p>
                    </div>
                  </div>
                </div>

                {!checkingCredits && (
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50/50 p-5 border border-amber-200/60 flex items-center justify-between rounded-2xl shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-white shadow-sm border border-amber-100 rounded-xl">
                        <Zap size={20} className="text-amber-500 fill-amber-500" />
                      </div>
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-widest text-amber-700/60 mb-0.5">Interview Cost</div>
                        <div className="font-bold text-amber-950 text-sm">
                          {freeMockCount && freeMockCount > 0 
                            ? <span className="text-emerald-600 flex items-center gap-1.5"><CheckCircle2 size={14} className="inline" /> 1 free credit</span> 
                            : <span>125 XP per session</span>
                          }
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-amber-700/60 mb-0.5">Your Balance</div>
                      <div className="font-bold text-amber-950 text-sm">
                        {freeMockCount && freeMockCount > 0 
                          ? <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full text-xs">{freeMockCount} Free Left</span>
                          : <span className="bg-amber-200/50 px-2.5 py-0.5 rounded-full border border-amber-300/50">{xpBalance ?? 0} XP</span>
                        }
                      </div>
                    </div>
                  </div>
                )}

                {cameraState === "denied" ? (
                  <button 
                    id="retry-verification-btn"
                    data-testid="retry-verification-btn"
                    onClick={runVerification}
                    className="w-full btn-primary bg-red-600 hover:bg-red-700 text-white py-4 text-base font-bold flex items-center justify-center gap-3 transition-colors shadow-lg shadow-red-900/20 cursor-pointer"
                  >
                    <RefreshCw size={20} className="text-white shrink-0" />
                    <span className="text-white font-bold">Retry Verification (Camera Denied)</span>
                  </button>
                ) : !isVerifying && !verificationStatus.stable ? (
                  <button 
                    id="submit-verification-btn"
                    data-testid="submit-verification-btn"
                    onClick={runVerification}
                    className="w-full btn-primary bg-slate-900 hover:bg-slate-800 text-white py-4 text-lg font-bold flex items-center justify-center gap-3 transition-all shadow-xl shadow-slate-900/25 cursor-pointer"
                  >
                    <Lock size={20} className="text-white shrink-0" />
                    <span className="text-white font-bold tracking-wide">Submit & Begin Verification</span>
                  </button>
                ) : (
                  <button 
                    id="start-interview-btn"
                    data-testid="start-interview-btn"
                    onClick={startInterview}
                    disabled={!verificationStatus.stable || isStarting}
                    className="w-full btn-primary bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-bold disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden transition-all shadow-xl shadow-blue-600/25 cursor-pointer"
                  >
                    {isStarting ? (
                      <>
                        <Loader2 className="animate-spin text-white shrink-0" size={20} />
                        <span className="text-white font-bold">Starting Interview...</span>
                      </>
                    ) : (
                      <>
                        {verificationStatus.stable && (
                          <motion.div 
                            initial={{ x: "-100%" }}
                            animate={{ x: "100%" }}
                            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 bg-white/20 skew-x-12"
                          />
                        )}
                        <Brain size={20} className="text-white shrink-0" />
                        <span className="text-white font-bold">
                          {verificationStatus.stable ? "Submit & Start Professional Interview" : `Verifying Hardware & Identity (${Math.round(verificationProgress)}%)...`}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div 
          key="interview"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[800px]"
        >
          {/* Left: Video Feed & Stats */}
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card bg-black overflow-hidden relative aspect-video lg:aspect-square flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover brightness-110 scale-x-[-1]" />
              <div className="absolute top-4 left-4 flex gap-2">
                 <div className="px-3 py-1 bg-red-600/80 backdrop-blur-md text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 uppercase tracking-widest">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" /> PRO LIVE
                 </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                 <p className="text-white text-xs font-medium">{user?.email}</p>
                 <p className="text-white/60 text-[10px] uppercase font-bold tracking-widest">Certified Candidate</p>
              </div>
            </div>

            <div className="glass-card p-6 space-y-4">
               <h4 className="font-bold text-xs text-slate-400 uppercase tracking-widest">Compliance Monitor</h4>
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">Tab Switches</span>
                    <span className={cheatingWarnings.tabs > 0 ? "text-red-500" : "text-emerald-500"}>{cheatingWarnings.tabs}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">Paste Actions</span>
                    <span className={cheatingWarnings.paste > 0 ? "text-red-500" : "text-emerald-500"}>{cheatingWarnings.paste || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">Face Stability</span>
                    <span className={Math.floor(cheatingWarnings.face) > 0 ? "text-red-500" : "text-emerald-500"}>{Math.floor(cheatingWarnings.face)} Alerts</span>
                  </div>
                  <StatProgress label="Technical Depth" value={liveMetrics.technical_depth} />
                  <StatProgress label="Confidence" value={liveMetrics.confidence} />
                  <StatProgress label="Fluency" value={liveMetrics.fluency} />
                  <StatProgress label="Communication" value={liveMetrics.communication} />
               </div>
               
               {lastWarning && (
                 <motion.div 
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600"
                 >
                   <AlertCircle size={14} />
                   <span className="text-[10px] font-black uppercase tracking-widest">
                     {lastWarning === "TAB_SWITCH" ? "Tab Switch Detected" : 
                      lastWarning === "PASTE" ? "Copy/Paste Detected" : 
                      "Face Not Visible"}
                   </span>
                 </motion.div>
               )}
            </div>

            <button 
              onClick={stopInterview}
              className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-[0.2em] border border-red-100 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <PhoneOff size={16} /> Force Terminate
            </button>
          </div>

          {/* Right: Interview Chat */}
          <div className="lg:col-span-2 glass-card flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 bg-white/50 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                <Brain size={20} />
              </div>
              <div>
                <h3 className="font-bold">Aoede AI Pro</h3>
                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                  Active Evaluation
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 glass-card bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-slate-200">
                Continuous Evaluation
              </div>
              <button 
                onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                className={`p-2 rounded-lg transition-colors ${isVoiceEnabled ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600"}`}
              >
                {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
            </div>
          </div>

          {/* Chat Container */}
          <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-6 bg-slate-50/30">
            <AnimatePresence>
              {messages.filter(m => !["[INTERVIEW_COMPLETED]", "ACTIVATE_INTERVIEW_PROTOCOL", "START_INTERVIEW_SESSION"].includes(m.text)).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${m.role === "user" ? "bg-slate-200 text-slate-600" : "bg-blue-100 text-blue-600"}`}>
                      {m.role === "user" ? <User size={16} /> : <Brain size={16} />}
                    </div>
                    <div className={`p-4 rounded-2xl text-sm leading-relaxed ${m.role === "user" ? "bg-blue-600 text-white rounded-tr-none shadow-lg shadow-blue-500/20" : "bg-white border border-slate-100 shadow-sm rounded-tl-none text-slate-700"}`}>
                      {m.text}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                  <Loader2 className="animate-spin text-blue-600" size={16} />
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Analyzing response...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-white border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative group">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSend()}
                  onPaste={(e) => {
                    e.preventDefault();
                    setCheatingWarnings(c => ({...c, paste: c.paste + 1}));
                    setLastWarning("PASTE");
                    liveServiceRef.current?.sendText("[SYSTEM WARNING: The candidate just attempted to paste text into the chat. Tell them they cannot use outside resources.]");
                  }}
                  placeholder={loading ? "AI is processing..." : "Share your response here..."}
                  className={`w-full pl-6 pr-16 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all ${isListening && !loading ? "ring-2 ring-emerald-100 border-emerald-300" : ""}`}
                />
                <button 
                  onClick={() => handleSend()}
                  disabled={!input.trim() || loading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-blue-600 text-white hover:bg-blue-700 items-center justify-center flex transition-all disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${appState === "listening" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${appState === "listening" ? "bg-white animate-pulse" : "bg-slate-300"}`} />
                {appState === "listening" ? "LISTENING" : "IDLE"}
              </div>
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${appState === "speaking" ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${appState === "speaking" ? "bg-white animate-bounce" : "bg-slate-300"}`} />
                {appState === "speaking" ? "AI SPEAKING" : "SILENT"}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )}
    </AnimatePresence>

    <AnimatePresence>
      {insufficientCredits && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="bg-white border border-slate-200 p-8 max-w-md w-full relative overflow-hidden rounded-3xl shadow-2xl"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
                <AlertCircle size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Not enough XP points.</h2>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                You need <span className="font-bold text-slate-700">125 XP</span> to start an AI mock interview. You can either purchase XP points directly or earn them via standard daily check-ins and inviting friends!
              </p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => navigate("/xp-store")}
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-yellow-950 font-black uppercase tracking-widest rounded-2xl transition-all shadow-md shadow-yellow-400/20"
                >
                  Buy XP Points
                </button>
                <button 
                  onClick={() => navigate("/student")}
                  className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold uppercase tracking-widest text-sm rounded-2xl transition-all border border-slate-200"
                >
                  Earn XP for Free
                </button>
              </div>
              
              <button 
                onClick={() => setInsufficientCredits(false)}
                className="mt-6 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors p-2"
              >
                Cancel Overlay
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    <ConsentModal
      isOpen={consentOpen}
      title="Behavioral Interview Consent"
      subtitle="Voice Recording, Transcripts & Face Verification"
      consentMessage="By starting this simulated mock interview, you consent to user authentication verification, conversation transcription through cloud Speech-To-Text processing, and behavioral analyzing logic. Your response summaries, video indicators, and transcripts are analyzed to compile a complete placement scorecard."
      compulsoryWarning="Declining this consent will prevent you from initiating this mock interview simulation sessions. Interview scores and behavior parameters mapping are required elements of recruiters assessments."
      onAgree={() => {
        localStorage.setItem("consent_interview", "true");
        setConsentOpen(false);
      }}
      onDisagreeClose={() => {
        navigate("/student");
      }}
    />
    </div>
  );
}
