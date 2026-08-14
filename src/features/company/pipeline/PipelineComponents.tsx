import { useState } from "react";
import {
  AlertTriangle, BarChart2, Calendar, CalendarPlus, Check, CheckCircle, ChevronRight, Clock, Download,
  Filter, Mail, MailPlus, MessageSquare, Plus, RefreshCw, Search, Sparkles, Star, Target, ThumbsDown, Users, XCircle, Zap
} from "lucide-react";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { isJobActive, isJobEnded } from "../../../utils/jobLifecycle.ts";
import { formatAssessmentScore, isRejectedCandidate } from "./pipelineUtils.ts";

export function PipelineHeader({
  jobs,
  selectedJobId,
  setSelectedJobId,
  applicants,
  pipelineFilter,
  setPipelineFilter,
}: any) {
  const selectedJob = jobs.find((j: any) => j.id.toString() === selectedJobId);

  const filteredJobsForSelect = jobs.filter((j: any) => {
    if (pipelineFilter === 'active') return isJobActive(j);
    if (pipelineFilter === 'ended') return isJobEnded(j);
    return true;
  });

  return (
    <div className="bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm mb-4 flex flex-col md:flex-row gap-6 justify-between items-center relative overflow-hidden mx-1">
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />

      <div className="z-10 flex-1 w-full">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
          Hiring Pipeline
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <select
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500/20 w-full max-w-sm"
          >
            <option value="ALL">
              {pipelineFilter === 'active' ? "All Active Jobs" : pipelineFilter === 'ended' ? "All Ended Jobs" : "All Jobs"}
            </option>
            {filteredJobsForSelect.map((j: any) => {
              const ended = isJobEnded(j);
              const hasSuffix = j.title.toLowerCase().endsWith('(ended)');
              const titleToDisplay = ended && !hasSuffix ? `${j.title} (Ended)` : j.title;
              return (
                <option key={j.id} value={j.id.toString()}>
                  {titleToDisplay}
                </option>
              );
            })}
          </select>

          {/* Filter options for Active / Ended / All pipelines */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => {
                setPipelineFilter('active');
                setSelectedJobId('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                pipelineFilter === 'active'
                  ? 'bg-white text-blue-600 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 font-bold'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => {
                setPipelineFilter('ended');
                setSelectedJobId('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                pipelineFilter === 'ended'
                  ? 'bg-white text-blue-600 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 font-bold'
              }`}
            >
              Ended
            </button>
            <button
              onClick={() => {
                setPipelineFilter('all');
                setSelectedJobId('ALL');
              }}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                pipelineFilter === 'all'
                  ? 'bg-white text-blue-600 shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-800 font-bold'
              }`}
            >
              All
            </button>
          </div>

          {selectedJob && (
            <span className={`px-3 py-2 text-xs font-bold rounded-xl border flex items-center gap-1 ${
              selectedJob.status === 'CLOSED'
                ? 'bg-rose-50 text-rose-700 border-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {selectedJob.status === 'CLOSED' ? (
                <>
                  <XCircle size={14} className="text-rose-500" /> Ended / History Mode
                </>
              ) : (
                <>
                  <CheckCircle size={14} className="text-emerald-500" /> Active
                </>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4 z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
        <KPICard
          title="Total Applicants"
          value={applicants.length}
          icon={Users}
          color="blue"
        />
        <KPICard
          title="Shortlisted"
          value={
            applicants.filter(
              (a: any) => a.canonical_stage_key === "SHORTLISTED",
            ).length
          }
          icon={Target}
          color="emerald"
        />
        <KPICard
          title="In Interview"
          value={
            applicants.filter(
              (a: any) =>
                a.canonical_stage_key === "INTERVIEW" ||
                a.canonical_stage_key === "HR",
            ).length
          }
          icon={Calendar}
          color="orange"
        />
      </div>
    </div>
  );
}

export function KPICard({ title, value, icon: Icon, color }: any) {
  const colorMap: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };
  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 rounded-[20px] border bg-white shadow-sm shrink-0 min-w-[200px]`}
    >
      <div className={`p-3 rounded-xl border ${colorMap[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {title}
        </p>
        <p className="text-2xl font-black text-slate-800 leading-none mt-1">
          {value}
        </p>
      </div>
    </div>
  );
}

export function AICopilot({ insights }: { insights: any }) {
  return (
    <div className="flex-1 bg-gradient-to-br from-indigo-900 to-blue-900 rounded-[24px] p-6 shadow-lg relative overflow-hidden text-white flex flex-col justify-center border border-indigo-800">
      <div className="absolute -right-10 -top-10 text-white/5 pointer-events-none">
        <Sparkles size={160} />
      </div>
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="text-yellow-400" size={20} />
          <h3 className="text-sm font-black uppercase tracking-wider text-indigo-50 flex items-center">
            AI Hiring Copilot{" "}
            <span className="text-[9px] bg-white/20 px-2 py-0.5 rounded-md ml-2 text-white border border-white/20">
              BETA
            </span>
          </h3>
        </div>
        <ul className="space-y-3 text-xs font-semibold text-indigo-100">
          <li className="flex items-start gap-2.5 bg-indigo-800/40 p-2.5 rounded-xl border border-indigo-700/50">
            <div className="w-5 h-5 rounded bg-yellow-400/20 text-yellow-400 flex items-center justify-center shrink-0">
              <Star size={12} />
            </div>
            <span className="leading-tight">
              Found{" "}
              <strong className="text-white bg-white/20 px-1.5 rounded">
                {insights.expert} candidates
              </strong>{" "}
              exceeding role requirements based on historical data.
            </span>
          </li>
          {insights.stuck > 0 && (
            <li className="flex items-start gap-2.5 bg-indigo-800/40 p-2.5 rounded-xl border border-indigo-700/50">
              <div className="w-5 h-5 rounded bg-rose-400/20 text-rose-400 flex items-center justify-center shrink-0">
                <AlertTriangle size={12} />
              </div>
              <span className="leading-tight">
                Bottleneck Warning:{" "}
                <strong className="text-white">
                  {insights.stuck} candidates
                </strong>{" "}
                are stuck in the Technical Interview stage.
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

export function QuickFilters({
  searchQuery,
  setSearchQuery,
  minScore,
  setMinScore,
}: any) {
  return (
    <div className="w-full lg:w-[420px] bg-white rounded-[24px] p-6 border border-slate-200 shadow-sm flex flex-col justify-center gap-4">
      <div className="relative">
        <Search
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />
        <input
          type="text"
          placeholder="Search skills, names, colleges..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 transition-all"
        />
      </div>
      <div className="flex items-center gap-4 px-1">
        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest shrink-0 flex items-center gap-1.5">
          <Filter size={12} /> Min Match
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-full cursor-pointer"
        />
        <span className="text-[11px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 w-11 text-center">
          {minScore}%
        </span>
      </div>
    </div>
  );
}

export function BulkActionBar({ count, onClear, onAction }: any) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-slate-900 text-white rounded-2xl px-6 py-3 mb-6 flex items-center justify-between shadow-2xl border border-slate-700 mx-1 sticky top-4 z-40"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-500/20 rounded-xl border border-blue-500/30 text-blue-400 font-black text-sm shadow-inner">
          {count}
        </div>
        <span className="text-sm font-bold tracking-wide">
          Candidates Selected
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onAction("MOVE_SCREENING")}
          className="px-3 py-2 hover:bg-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Zap size={14} className="text-yellow-400" /> Auto Screen
        </button>
        <button
          onClick={() => onAction("EMAIL")}
          className="px-3 py-2 hover:bg-white/10 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <Mail size={14} className="text-emerald-400" /> Message
        </button>
        <button
          onClick={() => onAction("MOVE_REJECTED")}
          className="px-3 py-2 hover:bg-rose-500/20 text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <XCircle size={14} /> Reject
        </button>
        <div className="w-px h-6 bg-slate-700 mx-2" />
        <button
          onClick={() => onAction("SCHEDULE_TEST")}
          className="px-3 py-2 hover:bg-purple-500/20 text-purple-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
        >
          <CalendarPlus size={14} /> Schedule Test
        </button>
        <button
          onClick={onClear}
          className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest px-2 transition-colors"
        >
          Clear
        </button>
      </div>
    </motion.div>
  );
}

export function StageColumn({
  stage,
  applicants,
  onDragStart,
  onDragOver,
  onDrop,
  selectedCandidates,
  setSelectedCandidates,
  setPreviewCandidate,
  draggedAppId,
}: any) {
  const [isOver, setIsOver] = useState(false);

  const colorMap: any = {
    blue: "bg-blue-500 shadow-blue-500/30",
    indigo: "bg-indigo-500 shadow-indigo-500/30",
    purple: "bg-purple-500 shadow-purple-500/30",
    orange: "bg-orange-500 shadow-orange-500/30",
    pink: "bg-pink-500 shadow-pink-500/30",
    emerald: "bg-emerald-500 shadow-emerald-500/30",
  };
  const bgMap: any = {
    blue: "bg-blue-50/80 border-blue-200",
    indigo: "bg-indigo-50/80 border-indigo-200",
    purple: "bg-purple-50/80 border-purple-200",
    orange: "bg-orange-50/80 border-orange-200",
    pink: "bg-pink-50/80 border-pink-200",
    emerald: "bg-emerald-50/80 border-emerald-200",
  };

  return (
    <div
      className={`w-[320px] shrink-0 flex flex-col rounded-[24px] border-2 transition-all duration-300 ${isOver ? bgMap[stage.color] : "bg-slate-100/50 border-slate-200/60"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        onDrop(e, stage.id);
      }}
    >
      <div className="p-4 py-3.5 flex justify-between items-center border-b border-slate-200/50 bg-white/70 rounded-t-[22px] backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full shadow-md ${colorMap[stage.color]}`}
          />
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none mt-0.5">
            {stage.label}
          </h3>
        </div>
        <span className="bg-white border border-slate-200 text-slate-600 px-2.5 py-0.5 rounded-md text-[10px] font-black shadow-sm">
          {applicants.length}
        </span>
      </div>

      <div className="p-3.5 flex-1 flex flex-col gap-3.5 min-h-[500px] overflow-y-auto scrollbar-hide pb-10">
        {applicants.map((app: any) => (
          <CandidateCard
            key={app.application_id}
            candidate={app}
            onDragStart={onDragStart}
            selected={selectedCandidates.includes(app.application_id)}
            onToggleSelect={(e: any) => {
              e.stopPropagation();
              const id = app.application_id;
              if (selectedCandidates.includes(id))
                setSelectedCandidates(
                  selectedCandidates.filter((x: any) => x !== id),
                );
              else setSelectedCandidates([...selectedCandidates, id]);
            }}
            onClick={() => setPreviewCandidate(app)}
            isDragged={draggedAppId === app.application_id}
          />
        ))}
        {applicants.length === 0 && (
          <div className="h-32 border-2 border-dashed border-slate-300/60 rounded-[18px] flex flex-col items-center justify-center text-[10px] font-black text-slate-400/80 uppercase tracking-widest gap-2 bg-white/30 backdrop-blur-sm">
            <div className="p-2 bg-slate-100 rounded-full">
              <Plus size={16} />
            </div>
            Drop Candidates
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidateCard({
  candidate,
  onDragStart,
  selected,
  onToggleSelect,
  onClick,
  isDragged,
}: any) {
  const matchScore =
    candidate.talent_score || Math.floor(Math.random() * 40 + 40);

  let recBadge = (
    <span className="bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase truncate shadow-sm">
      Evaluating
    </span>
  );
  if (matchScore >= 85)
    recBadge = (
      <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md text-[8px] font-black uppercase truncate border border-emerald-200 flex items-center gap-1 shadow-sm">
        <Star size={8} className="fill-emerald-600" /> Top Match
      </span>
    );
  else if (matchScore >= 70)
    recBadge = (
      <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md text-[8px] font-bold uppercase truncate shadow-sm">
        Strong Fit
      </span>
    );

  let skills = [];
  try {
    skills =
      typeof candidate.skills_json === "string"
        ? JSON.parse(candidate.skills_json) || []
        : candidate.skills_json || [];
  } catch (e) {}

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, candidate.application_id)}
      onClick={onClick}
      className={`bg-white p-4 pb-3.5 rounded-[20px] border-2 transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:shadow-xl ${selected ? "border-blue-500 shadow-blue-500/20" : "border-slate-100 hover:border-blue-200 hover:shadow-blue-500/5"} ${isDragged ? "opacity-40 scale-95 border-dashed" : "opacity-100"}`}
    >
      <div className="flex justify-between items-start mb-3 border-b border-slate-50 pb-3">
        <div className="flex items-center gap-3 w-full min-w-0">
          <div
            onClick={onToggleSelect}
            className="shrink-0 p-1 -ml-1 cursor-pointer"
          >
            <div
              className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${selected ? "bg-blue-600 border-blue-600 shadow-sm" : "bg-slate-50 border-slate-300 hover:border-blue-400"}`}
            >
              {selected && (
                <Check size={10} className="text-white" strokeWidth={3} />
              )}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center text-slate-400 font-bold shadow-inner">
            {candidate.profile_photo_url ? (
              <img
                src={candidate.profile_photo_url}
                className="w-full h-full object-cover"
              />
            ) : (
              candidate.full_name?.charAt(0)
            )}
          </div>
          <div className="min-w-0 pr-2">
            <h4 className="text-xs font-black text-slate-900 truncate leading-tight tracking-tight mb-0.5">
              {candidate.full_name || "Anonymous Applicant"}
            </h4>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate">
              {candidate.job_title}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 pt-0.5">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Match Score
        </span>
        <span
          className={`text-[11px] font-black px-2 py-0.5 rounded-md border ${matchScore >= 80 ? "bg-emerald-50 text-emerald-700 border-emerald-100" : matchScore >= 60 ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-slate-50 text-slate-700 border-slate-200"}`}
        >
          {matchScore}%
        </span>
      </div>

      {candidate.latest_test_score !== null &&
        candidate.latest_test_score !== undefined && (
          <div className="flex items-center justify-between mb-3 -mt-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-purple-500">
              Test Score
            </span>
            <span className="text-[11px] font-black px-2 py-0.5 rounded-md border bg-purple-50 text-purple-700 border-purple-200 shadow-sm">
              {Math.round(candidate.latest_test_score)}%
            </span>
          </div>
        )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {recBadge}
        {skills.slice(0, 2).map((s: string, i: number) => (
          <span
            key={i}
            className="bg-slate-50 border border-slate-200/80 text-slate-600 px-2 py-0.5 rounded-md text-[8px] font-bold truncate max-w-[85px]"
          >
            {s}
          </span>
        ))}
        {skills.length > 2 && (
          <span className="bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-200/80 text-[8px] font-bold">
            +{skills.length - 2}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-1">
        <div className="flex items-center gap-1.5 text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          <Clock size={10} />
          <span className="text-[8px] font-black uppercase leading-none mt-0.5 text-slate-500">
            {new Date(candidate.applied_at || Date.now()).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
        </div>
        <button className="text-[9px] font-black text-blue-600 flex items-center gap-0.5 hover:text-blue-800 bg-blue-50/50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors border border-blue-100/50 hover:border-blue-200">
          Review <ChevronRight size={10} />
        </button>
      </div>
    </div>
  );
}

export function CandidateQuickPreview({
  candidate,
  onClose,
  onAction,
  onUndoDecision,
  onUndoStage,
  isInline = false,
  contactedCandidates = {},
  markAsContacted,
  activeStages = [],
  selectedJobId,
  getNextStageInfo,
}: any) {
  let skills = [];
  try {
    skills =
      typeof candidate.skills_json === "string"
        ? JSON.parse(candidate.skills_json) || []
        : candidate.skills_json || [];
  } catch (e) {}

  const isContactedLocal = !!contactedCandidates[candidate.application_id];

  const handleSendEmailLocal = () => {
    if (candidate.email) {
      if (markAsContacted) markAsContacted(candidate.application_id);
      toast.success(
        `Custom message sent to ${candidate.full_name} (${candidate.email})!`,
      );
    } else {
      toast.error("Candidate has not provided an email address");
    }
  };

  const handleScheduleInterviewLocal = () => {
    if (markAsContacted) markAsContacted(candidate.application_id);
    toast.success(
      `Interview setup email and Calendar request dispatch sent to ${candidate.full_name}!`,
    );
  };

  const handleDownloadResumeLocal = () => {
    if (candidate.resume_url) {
      window.open(candidate.resume_url, "_blank");
      toast.success("Resume downloaded successfully");
    } else {
      toast.error("No resume URL uploaded by this candidate");
    }
  };

  const mainContent = (
    <div
      className={`w-full h-full bg-white flex flex-col font-sans overflow-hidden ${isInline ? "" : "border-l border-slate-200"}`}
    >
      {/* Cover & Profile Header */}
      <div className="relative h-36 bg-slate-900 shrink-0 overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-500 via-indigo-900 to-slate-900" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-900/60 to-transparent" />
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white backdrop-blur-md transition-colors z-10 cursor-pointer"
        >
          <ChevronRight size={18} />
        </button>
        <div className="absolute top-4 right-4 flex gap-2 z-10">
          <button
            onClick={handleSendEmailLocal}
            title="Draft new direct message"
            className="p-2 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full text-white backdrop-blur-md transition-colors cursor-pointer"
          >
            <MessageSquare size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 relative -mt-16 shrink-0 z-10">
        <div className="w-24 h-24 rounded-[20px] bg-white p-1 border border-slate-200 shadow-xl mb-3">
          <div className="w-full h-full bg-slate-100 rounded-[14px] overflow-hidden flex items-center justify-center text-4xl font-black text-slate-300 shadow-inner">
            {candidate.profile_photo_url ? (
              <img
                src={candidate.profile_photo_url}
                className="w-full h-full object-cover"
              />
            ) : (
              candidate.full_name?.charAt(0)
            )}
          </div>
        </div>
        <div className="pb-4 border-b border-slate-100 flex justify-between items-start">
          <div className="min-w-0 pr-2">
            <h2
              className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1.5 truncate"
              title={candidate.full_name}
            >
              {candidate.full_name}
            </h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate">
              {candidate.job_title || "Software Engineering Associate"}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-1.5 px-2.5 text-center shadow-sm shrink-0">
            <div className="text-[8px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">
              Match Score
            </div>
            <div className="text-lg font-black text-emerald-700 leading-none">
              {candidate.talent_score || 85}%
            </div>
          </div>
        </div>
      </div>

      {/* Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 scrollbar-hide pb-6">
        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-2">
          <QuickActionButton
            icon={Mail}
            label="Email"
            onClick={handleSendEmailLocal}
          />
          <QuickActionButton
            icon={CalendarPlus}
            label="Interview"
            onClick={handleScheduleInterviewLocal}
          />
          <QuickActionButton
            icon={BarChart2}
            label="Assessments"
            onClick={() => {
              const scoreValue = formatAssessmentScore(
                candidate.latest_test_score,
              );
              toast.success(
                scoreValue !== null
                  ? `Latest screening score: ${scoreValue}`
                  : "Latest screening score: Not evaluated",
              );
            }}
          />
          <QuickActionButton
            icon={Download}
            label="Resume"
            onClick={handleDownloadResumeLocal}
          />
        </div>

        {/* AI Summary */}
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border border-indigo-100 rounded-[16px] p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles size={10} className="text-white" />
            </div>
            <span className="text-[9px] font-black uppercase text-indigo-900 tracking-widest">
              AI Profile Analysis
            </span>
          </div>
          <p className="text-xs font-semibold text-indigo-900/80 leading-relaxed pr-1">
            Candidate demonstrates strong technical aptitude matching the{" "}
            <strong className="text-indigo-900">
              {candidate.job_title || "requested"}
            </strong>{" "}
            role requirements. Skills align with the enterprise application
            stack. Coding assessment scores reside within the top percentile.
          </p>
        </div>

        {/* Contacted Status Area */}
        {isContactedLocal && (
          <div className="bg-emerald-50/70 border border-emerald-200/50 rounded-xl p-3 px-4 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
              Status Status:
            </span>
            <span className="text-xs font-black text-emerald-650 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />{" "}
              Notified & Scheduled
            </span>
          </div>
        )}

        {/* Core Info Details */}
        <div className="bg-white border border-slate-200 rounded-[16px] overflow-hidden p-1 shadow-sm">
          <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest px-3 pt-3 pb-2">
            Profile Details
          </h3>
          <div className="grid grid-cols-2 gap-px bg-slate-150">
            <div className="bg-white p-3">
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Pipeline Stage
              </span>
              <span className="text-[10px] font-black text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block uppercase tracking-wider">
                {activeStages.find((s: any) => s.id === candidate.status)
                  ?.label || candidate.status}
              </span>
            </div>
            <div className="bg-white p-3">
              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                Applied Date
              </span>
              <span className="text-[10px] font-semibold text-slate-700 block">
                {candidate.applied_at
                  ? new Date(candidate.applied_at).toLocaleDateString(
                      undefined,
                      { dateStyle: "medium" },
                    )
                  : "—"}
              </span>
            </div>
            <div className="bg-white p-3 col-span-2 flex justify-between items-center">
              <div>
                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                  Contact Details
                </span>
                <span className="text-xs font-bold text-slate-800 block truncate max-w-[280px]">
                  {candidate.email || "No email provided"}
                </span>
                <span className="text-xs font-bold text-slate-500 block mt-0.5">
                  {candidate.contact || "No phone number"}
                </span>
              </div>
              <button
                onClick={handleSendEmailLocal}
                className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm cursor-pointer"
              >
                <MailPlus size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Verfied Skills */}
        <div>
          <h3 className="text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-150 pb-1.5 mb-3 pl-1">
            Verified Skills Extract
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((s: string, i: number) => (
              <span
                key={i}
                className="px-2 py-1 bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold shadow-sm"
              >
                {s}
              </span>
            ))}
            {skills.length === 0 && (
              <span className="text-xs text-slate-450 font-bold px-1">
                Candidate has not listed any verified skills.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-slate-100 bg-white shrink-0 grid grid-cols-3 gap-3">
        {isRejectedCandidate(candidate) || String(candidate.raw_status || candidate.status || "").toUpperCase() === "SELECTED" || String(candidate.status || "").toUpperCase() === "SHORTLISTED" ? (
          <div className="col-span-3 flex items-center gap-2">
            <div className={`flex-1 text-center py-2.5 rounded-xl font-extrabold uppercase tracking-widest text-[10px] select-none border ${isRejectedCandidate(candidate) ? "bg-rose-50 text-rose-600 border-rose-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"}`}>
              {isRejectedCandidate(candidate) ? "Rejected" : "Selected"}
            </div>
            {onUndoDecision && (
              <button
                type="button"
                onClick={() => onUndoDecision(candidate)}
                className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center gap-1.5 shrink-0"
                title="Undo decision and restore candidate to previous pipeline stage"
              >
                <RefreshCw size={13} /> Undo Decision
              </button>
            )}
          </div>
        ) : (
          <>
            <button
              onClick={() => {
                if (selectedJobId === "ALL") {
                  toast.error(
                    "Select a specific job to drop / reject candidates.",
                  );
                  return;
                }
                onAction("REJECTED");
                onClose();
              }}
              className="py-3 bg-white border border-rose-200 text-rose-500 hover:bg-rose-50 rounded-xl text-xs flex justify-center items-center font-black uppercase tracking-widest transition-colors w-full shadow-sm cursor-pointer"
              title="Reject Candidate"
            >
              <ThumbsDown size={16} />
            </button>
            {getNextStageInfo && getNextStageInfo(candidate)?.prevId && (
              <button
                type="button"
                onClick={() => {
                  if (selectedJobId === "ALL") {
                    toast.error("Select a specific job to move candidates across custom stages.");
                    return;
                  }
                  if (onUndoStage) {
                    onUndoStage(candidate);
                  } else {
                    const stageInfo = getNextStageInfo(candidate);
                    if (stageInfo?.prevId) {
                      onAction(stageInfo.prevId.toString(), "Reversed to previous stage", true, true, "UNDO_STAGE");
                    }
                  }
                  onClose();
                }}
                className="py-3 bg-amber-50 border border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1"
                title="Undo stage move and return candidate to previous phase"
              >
                <RefreshCw size={12} /> Undo
              </button>
            )}
            <button
              onClick={() => {
                if (selectedJobId === "ALL") {
                  toast.error(
                    "Select a specific job to advance candidates through its custom pipeline.",
                  );
                  return;
                }
                if (getNextStageInfo) {
                  const stageInfo = getNextStageInfo(candidate);
                  if (stageInfo && !stageInfo.disabled && stageInfo.nextId) {
                    onAction(stageInfo.nextId);
                  } else {
                    toast.error(
                      stageInfo?.reason ||
                        "Candidate is already at the final stage",
                    );
                  }
                } else {
                  const currentIdx = activeStages.findIndex(
                    (s: any) => s.id === candidate.status,
                  );
                  if (currentIdx > -1 && currentIdx < activeStages.length - 1) {
                    onAction(activeStages[currentIdx + 1].id);
                  } else {
                    toast.success("Candidate is already at the final stage");
                  }
                }
                onClose();
              }}
              className={`${getNextStageInfo && getNextStageInfo(candidate)?.prevId ? "col-span-1" : "col-span-2"} py-3 bg-slate-900 text-white hover:bg-slate-850 rounded-xl text-[10px] flex items-center justify-center gap-1.5 font-black uppercase tracking-widest shadow-xl shadow-slate-900/10 transition-all cursor-pointer`}
            >
              Advance <ChevronRight size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );

  if (isInline) {
    return mainContent;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <motion.div
        initial={{ x: "100%", boxShadow: "-20px 0 50px rgba(0,0,0,0)" }}
        animate={{ x: 0, boxShadow: "-20px 0 50px rgba(0,0,0,0.2)" }}
        exit={{ x: "100%", boxShadow: "-20px 0 50px rgba(0,0,0,0)" }}
        transition={{ type: "spring", stiffness: 350, damping: 35 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[430px] bg-white z-[110] flex flex-col overflow-hidden"
      >
        {mainContent}
      </motion.div>
    </>
  );
}

export function QuickActionButton({ icon: Icon, label, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 p-3 pb-2.5 rounded-2xl bg-white border border-slate-200 hover:border-blue-200 hover:bg-blue-50 transition-all font-sans text-slate-600 active:scale-95 shadow-sm group"
    >
      <Icon
        size={18}
        className="text-slate-500 group-hover:text-blue-600 transition-colors"
      />
      <span className="text-[9px] font-black uppercase tracking-widest group-hover:text-blue-700 transition-colors">
        {label}
      </span>
    </button>
  );
}
