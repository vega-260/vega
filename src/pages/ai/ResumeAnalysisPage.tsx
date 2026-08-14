import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, Sparkles, AlertTriangle, CheckCircle2, XCircle, 
  Award, Shield, Zap, TrendingUp, BarChart2, Eye, Download, RefreshCw, 
  Layers, Code, Server, Database, Cloud, Cpu, ArrowUpRight, Check, AlertCircle,
  HelpCircle, Search, Terminal, ChevronRight, FileCheck, Lock, Activity, RefreshCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell 
} from 'recharts';
import toast from 'react-hot-toast';
import api from '../../services/api.ts';
import { useAuth } from '../../context/AuthContext.tsx';

const TARGET_ROLES = [
  "Java Developer",
  "Frontend Developer",
  "Backend Developer",
  "Full Stack Engineer",
  "Python Developer",
  "Data Analyst",
  "AI Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "QA Engineer",
  "Cybersecurity Engineer",
  "Business Analyst",
  "Product Manager",
  "Custom Role"
];

export function ResumeAnalysisPage() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedRole, setSelectedRole] = useState<string>("Java Developer");
  const [customRoleInput, setCustomRoleInput] = useState<string>("");
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("Initializing Security Audit...");
  const [progressPercent, setProgressPercent] = useState<number>(0);

  const [analysis, setAnalysis] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'radar' | 'skillgap' | 'projects' | 'grammar' | 'recruiter' | 'plan' | 'history'>('breakdown');
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  useEffect(() => {
    if (user?.id) {
      fetchLatestAnalysis();
      fetchHistory();
    }
  }, [user?.id]);

  const fetchLatestAnalysis = async () => {
    try {
      const res = await api.get(`/resume/intelligence/latest/${user?.id}`);
      if (res.data?.success && res.data?.data) {
        setAnalysis(res.data.data);
      }
    } catch (err) {
      console.warn("No prior resume analysis found.");
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await api.get(`/resume/intelligence/history/${user?.id}`);
      if (res.data?.success && Array.isArray(res.data?.data)) {
        setHistory(res.data.data);
      }
    } catch (err) {
      console.warn("Failed to fetch history");
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx' && ext !== 'doc') {
      toast.error("Invalid file format. Please select a PDF or DOCX file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size exceeds 5 MB limit.");
      return;
    }
    setSelectedFile(file);
    toast.success(`Selected file: ${file.name}`);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Please select or drop a resume file (PDF or DOCX).");
      return;
    }

    if (!user?.id) {
      toast.error("User authentication session expired. Please sign in again.");
      return;
    }

    const targetRole = selectedRole === "Custom Role" ? (customRoleInput.trim() || "Software Engineer") : selectedRole;

    setAnalyzing(true);
    setProgressPercent(10);
    setAnalysisProgress("Simulating OWASP Antivirus & File Integrity Scan...");

    const progressTimer = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev >= 90) {
          clearInterval(progressTimer);
          return 90;
        }
        if (prev === 20) setAnalysisProgress("Extracting & Normalizing Resume Typography...");
        if (prev === 40) setAnalysisProgress("Executing VEGA ATS Scoring Matrix Algorithms...");
        if (prev === 60) setAnalysisProgress("Cross-referencing Skill Gap with Coding & Quiz Engines...");
        if (prev === 80) setAnalysisProgress("Generating Recruiter Screener Impressions & Action Plan...");
        return prev + 15;
      });
    }, 600);

    try {
      const formData = new FormData();
      formData.append("resume", selectedFile);
      formData.append("userId", String(user.id));
      formData.append("targetRole", targetRole);

      const res = await api.post("/resume/analyze-intelligence", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      clearInterval(progressTimer);
      setProgressPercent(100);

      if (res.data?.success && res.data?.data) {
        setAnalysis(res.data.data);
        toast.success("VEGA AI Resume Intelligence Analysis Complete!");
        setSelectedFile(null);
        fetchHistory();
      } else {
        toast.error(res.data?.message || "Failed to analyze resume.");
      }
    } catch (err: any) {
      clearInterval(progressTimer);
      console.error("Resume Analysis failed:", err);
      toast.error(err?.response?.data?.message || "Failed to process resume file. Ensure file is a clean PDF/DOCX.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'Excellent':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', icon: CheckCircle2 };
      case 'Good':
        return { bg: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', icon: CheckCircle2 };
      case 'Average':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: AlertTriangle };
      case 'Needs Improvement':
        return { bg: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-500', icon: AlertCircle };
      default:
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', icon: XCircle };
    }
  };

  // Recharts Radar Dataset
  const radarData = analysis?.scores ? [
    { category: 'Structure', score: Math.round((analysis.scores.structure / 15) * 100) },
    { category: 'Completeness', score: Math.round((analysis.scores.completeness / 15) * 100) },
    { category: 'Keywords', score: Math.round((analysis.scores.keyword / 15) * 100) },
    { category: 'Skills', score: Math.round((analysis.scores.skills / 15) * 100) },
    { category: 'Grammar', score: Math.round((analysis.scores.grammar / 10) * 100) },
    { category: 'Formatting', score: Math.round((analysis.scores.formatting / 10) * 100) },
    { category: 'Projects', score: Math.round((analysis.scores.projects / 10) * 100) },
    { category: 'Action Verbs', score: Math.round((analysis.scores.actionVerbs / 5) * 100) }
  ] : [];

  return (
    <div className="min-h-screen bg-slate-50/50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Top Header Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl opacity-60 pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold uppercase tracking-wider">
                  <Sparkles size={13} className="text-indigo-600" /> VEGA AI Intelligence Engine
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                  <Shield size={12} className="text-emerald-600" /> OWASP Security Verified
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                Enterprise AI Resume Analysis Platform
              </h1>
              <p className="text-slate-600 text-sm max-w-2xl font-normal leading-relaxed">
                Parse, evaluate, and benchmark candidate resumes against recruiter criteria, ATS keywords, skill gaps, and quantifiable project impact.
              </p>
            </div>

            {/* Target Role & Quick Status */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex flex-col">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Target Job Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                >
                  {TARGET_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                {selectedRole === "Custom Role" && (
                  <input
                    type="text"
                    placeholder="e.g. Lead iOS Developer"
                    value={customRoleInput}
                    onChange={(e) => setCustomRoleInput(e.target.value)}
                    className="mt-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upload Dropzone Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload size={18} className="text-indigo-600" /> Upload Candidate Resume
            </h2>
            <span className="text-xs font-medium text-slate-500">PDF, DOCX or DOC (Max 5 MB)</span>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
              ${dragActive ? 'border-indigo-500 bg-indigo-50/40 scale-[1.005]' : 'border-slate-200 hover:border-indigo-300 bg-slate-50/50 hover:bg-slate-50'}
              ${selectedFile ? 'border-emerald-400 bg-emerald-50/20' : ''}
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={handleFileChange}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
                  <FileCheck size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedFile.name}</p>
                  <p className="text-xs text-slate-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for VEGA AI Evaluation</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="mt-2 text-xs font-semibold text-rose-600 hover:text-rose-700 underline"
                >
                  Remove & Select Different File
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-sm">
                  <Upload size={22} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">
                    Drag and drop resume document here, or <span className="text-indigo-600 hover:underline">Browse File</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Supports PDF & Microsoft Word formats • Securely encrypted upload</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Lock size={13} className="text-slate-400" /> Confidential & Encrypted</span>
              <span className="flex items-center gap-1.5"><Terminal size={13} className="text-slate-400" /> Auto Temp File Cleanup</span>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={analyzing || !selectedFile}
              className={`
                w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm
                ${analyzing || !selectedFile 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 hover:shadow-indigo-300 hover:scale-[1.01]'}
              `}
            >
              {analyzing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Analyzing Document...
                </>
              ) : (
                <>
                  <Sparkles size={15} /> Run VEGA AI Analysis
                </>
              )}
            </button>
          </div>

          {/* Progress Modal / Banner */}
          <AnimatePresence>
            {analyzing && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-6 bg-slate-900 text-white rounded-2xl p-5 space-y-3"
              >
                <div className="flex justify-between items-center text-xs font-medium text-slate-300">
                  <span className="flex items-center gap-2"><RefreshCw size={13} className="animate-spin text-indigo-400" /> {analysisProgress}</span>
                  <span className="font-bold text-indigo-400">{progressPercent}%</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dashboard Results Section */}
        {analysis ? (
          <div className="space-y-8">
            
            {/* Top Key Result Banner */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
                
                {/* Circular Score Gauge */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                  <div className="relative w-36 h-36 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="currentColor"
                        strokeWidth="12"
                        className="text-slate-200"
                        fill="transparent"
                      />
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="currentColor"
                        strokeWidth="12"
                        strokeDasharray={377}
                        strokeDashoffset={377 - (377 * (analysis.overallAtsScore || 0)) / 100}
                        strokeLinecap="round"
                        className="text-indigo-600 transition-all duration-1000 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-black text-slate-900">{analysis.overallAtsScore}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">out of 100</span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col items-center gap-1">
                    {(() => {
                      const badge = getHealthBadge(analysis.healthLevel);
                      const Icon = badge.icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-extrabold ${badge.bg}`}>
                          <Icon size={13} /> VEGA ATS Score: {analysis.healthLevel}
                        </span>
                      );
                    })()}
                    <span className="text-[11px] text-slate-500 font-medium">Target Role: <strong className="text-slate-800">{analysis.targetRole}</strong></span>
                  </div>
                </div>

                {/* Score Summary Metrics */}
                <div className="md:col-span-8 space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Role Match</p>
                      <p className="text-xl font-black text-indigo-600 mt-1">{analysis.roleMatch?.matchPercentage || 0}%</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Target Job Fit</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Keywords Detected</p>
                      <p className="text-xl font-black text-emerald-600 mt-1">{analysis.keywords?.detected?.length || 0}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Technical & Soft</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Deductions</p>
                      <p className="text-xl font-black text-amber-600 mt-1">{analysis.scores?.deductions?.length || 0}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Points Lost Reasons</p>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Recruiter Screener</p>
                      <p className="text-xl font-black text-indigo-700 mt-1">{analysis.aiFeedback?.recruiterView?.wouldShortlist || 'Yes'}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Shortlist Probability</p>
                    </div>
                  </div>

                  {/* Summary Feedback Callout */}
                  <div className="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-xs text-indigo-950 leading-relaxed font-medium">
                    <strong className="font-bold text-indigo-900 block mb-1 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-indigo-600" /> AI Executive Summary:
                    </strong>
                    {analysis.aiFeedback?.summaryFeedback || "Strong technical foundation. Optimize keywords and quantifiable project metrics to maximize ATS parsing index."}
                  </div>
                </div>

              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-sm overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {[
                  { id: 'breakdown', label: 'ATS Score Breakdown', icon: BarChart2 },
                  { id: 'radar', label: 'Radar & Keywords', icon: Layers },
                  { id: 'skillgap', label: 'Skill Gap Engine', icon: Cpu },
                  { id: 'projects', label: 'Projects & Experience', icon: Code },
                  { id: 'grammar', label: 'Grammar & Format', icon: FileCheck },
                  { id: 'recruiter', label: 'Recruiter View', icon: Eye },
                  { id: 'plan', label: 'Improvement Plan', icon: TrendingUp },
                  { id: 'history', label: 'Version History', icon: Activity },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`
                        px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer
                        ${isActive 
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' 
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}
                      `}
                    >
                      <Icon size={14} /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Contents */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm">
              
              {/* TAB 1: ATS SCORE BREAKDOWN */}
              {activeTab === 'breakdown' && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">10-Category Transparent Scoring Scheme</h3>
                    <p className="text-xs text-slate-500">Total Score: 100 Points. Every deduction includes a transparent reason.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: 'Resume Structure', score: analysis.scores?.structure, max: 15, desc: 'Logical flow, standard headers, section order' },
                      { label: 'Section Completeness', score: analysis.scores?.completeness, max: 15, desc: 'Education, Experience, Projects, Skills, Contact' },
                      { label: 'Keyword Optimization', score: analysis.scores?.keyword, max: 15, desc: `Density of keywords for ${analysis.targetRole}` },
                      { label: 'Skills Match', score: analysis.scores?.skills, max: 15, desc: 'Relevance of technical and soft skills' },
                      { label: 'Grammar & Language', score: analysis.scores?.grammar, max: 10, desc: 'Spelling, typos, active voice, sentence structure' },
                      { label: 'Formatting & Readability', score: analysis.scores?.formatting, max: 10, desc: 'Margins, fonts, ATS parser readability' },
                      { label: 'Projects & Experience', score: analysis.scores?.projects, max: 10, desc: 'Complexity, tech stack, architecture' },
                      { label: 'Action Verbs & Impact', score: analysis.scores?.actionVerbs, max: 5, desc: 'Strong action verbs (Engineered, Architected)' },
                      { label: 'Achievements & Metrics', score: analysis.scores?.achievements, max: 3, desc: 'Quantifiable metrics (%, ms, throughput)' },
                      { label: 'Contact & Links', score: analysis.scores?.links, max: 2, desc: 'Phone, Email, LinkedIn, GitHub URLs' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-800">{item.label}</span>
                          <span className="text-indigo-600">{item.score} / {item.max} Pts</span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full"
                            style={{ width: `${(item.score / item.max) * 100}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Deductions Callout */}
                  {analysis.scores?.deductions && analysis.scores.deductions.length > 0 && (
                    <div className="pt-6 border-t border-slate-100 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                        <AlertTriangle size={15} /> Specific Deductions & Improvement Reasons:
                      </h4>
                      <div className="space-y-2">
                        {analysis.scores.deductions.map((d: any, i: number) => (
                          <div key={i} className="p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-xl text-xs text-amber-950 flex items-start gap-3">
                            <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-bold text-[10px] shrink-0 mt-0.5">
                              -{d.deduction} Pts
                            </span>
                            <div>
                              <strong className="font-bold">{d.category}:</strong> {d.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: RADAR & KEYWORDS */}
              {activeTab === 'radar' && (
                <div className="space-y-8">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Radar Chart */}
                    <div className="lg:col-span-6 space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">Competency Radar Matrix</h3>
                      <p className="text-xs text-slate-500">Visual mapping of resume strengths across 8 dimensions.</p>
                      <div className="w-full h-72 sm:h-80 bg-slate-50 rounded-2xl border border-slate-100 p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="category" tick={{ fill: '#475569', fontSize: 11, fontWeight: '600' }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                            <Radar name="Candidate Score" dataKey="score" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.4} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Detected Keywords Heatmap */}
                    <div className="lg:col-span-6 space-y-3">
                      <h3 className="text-sm font-bold text-slate-900">Detected ATS Keywords</h3>
                      <p className="text-xs text-slate-500">High-value keywords extracted from document text.</p>

                      <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        {analysis.keywords?.detected?.length > 0 ? (
                          analysis.keywords.detected.map((kw: string, i: number) => (
                            <span key={i} className="px-3 py-1 bg-white border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold shadow-2xs">
                              {kw}
                            </span>
                          ))
                        ) : (
                          <p className="text-xs text-slate-400">No keywords detected.</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Missing Keywords Categorized */}
                  <div className="pt-6 border-t border-slate-100 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-600" /> Missing High-Priority Keywords for {analysis.targetRole}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(analysis.keywords?.missing || {}).map(([cat, list]: any) => (
                        <div key={cat} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 capitalize">{cat}</h4>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.isArray(list) && list.length > 0 ? (
                              list.map((item: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-semibold rounded">
                                  + {item}
                                </span>
                              ))
                            ) : (
                              <span className="text-[11px] text-slate-400">No missing terms</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: SKILL GAP ENGINE */}
              {activeTab === 'skillgap' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Cross-Engine Candidate Skill Gap Intelligence</h3>
                    <p className="text-xs text-slate-500">Cross-referencing resume text with VEGA Coding Platform, AI Quiz, and Mock Interview performance.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider">AI Quiz Avg Score</span>
                      <p className="text-2xl font-black text-indigo-900">{analysis.aiFeedback?.skillGapAnalysis?.quizPerformance?.score || 0}%</p>
                      <p className="text-[10px] text-indigo-600 font-medium">{analysis.aiFeedback?.skillGapAnalysis?.quizPerformance?.totalQuizzes || 0} Quizzes Attempted</p>
                    </div>

                    <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Mock Interview Score</span>
                      <p className="text-2xl font-black text-purple-900">{analysis.aiFeedback?.skillGapAnalysis?.interviewPerformance?.avgScore || 0}%</p>
                      <p className="text-[10px] text-purple-600 font-medium">{analysis.aiFeedback?.skillGapAnalysis?.interviewPerformance?.totalSessions || 0} AI Sessions Completed</p>
                    </div>

                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-1">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Target Role Match</span>
                      <p className="text-2xl font-black text-emerald-900">{analysis.roleMatch?.matchPercentage || 0}%</p>
                      <p className="text-[10px] text-emerald-600 font-medium">{analysis.targetRole} Fit Index</p>
                    </div>
                  </div>

                  {/* Recommended Learning Path */}
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <TrendingUp size={15} className="text-indigo-600" /> Recommended Actionable Learning Roadmap:
                    </h4>

                    <div className="space-y-3">
                      {analysis.roleMatch?.learningPath?.map((pathItem: any, idx: number) => (
                        <div key={idx} className="p-4 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${pathItem.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                                {pathItem.priority} Priority
                              </span>
                              <h5 className="text-xs font-bold text-slate-900">{pathItem.topic}</h5>
                            </div>
                            <p className="text-xs text-slate-600 font-normal">{pathItem.description}</p>
                          </div>

                          <button className="self-start sm:self-center px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer">
                            Start Topic <ArrowUpRight size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: PROJECTS & EXPERIENCE */}
              {activeTab === 'projects' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Project Depth & Architectural Evaluation</h3>
                    <p className="text-xs text-slate-500">Evaluates complexity, tech stack, business value, and deployment links.</p>
                  </div>

                  <div className="space-y-4">
                    {analysis.aiFeedback?.projectEvaluations?.map((proj: any, idx: number) => (
                      <div key={idx} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">{proj.title}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{proj.problemStatement}</p>
                          </div>
                          <span className="px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-lg text-xs font-bold self-start sm:self-auto">
                            Complexity: {proj.complexity || 'Medium-High'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase">Tech Stack</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Array.isArray(proj.techStack) && proj.techStack.map((t: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 font-semibold">{t}</span>
                              ))}
                            </div>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase">Architecture</span>
                            <p className="text-slate-800 font-medium mt-1">{proj.architecture}</p>
                          </div>

                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase">Business Impact</span>
                            <p className="text-slate-800 font-medium mt-1">{proj.impact}</p>
                          </div>
                        </div>

                        {/* Project Suggestions */}
                        {Array.isArray(proj.suggestions) && proj.suggestions.length > 0 && (
                          <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
                            <span className="font-bold text-indigo-700 text-[11px] block">AI Enhancements:</span>
                            <ul className="list-disc list-inside space-y-0.5">
                              {proj.suggestions.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: GRAMMAR & FORMAT */}
              {activeTab === 'grammar' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Formatting, Grammar & ATS Parser Check</h3>
                    <p className="text-xs text-slate-500">Detects passive voice, weak action verbs, typos, multi-column layouts, and font consistency.</p>
                  </div>

                  {/* Format Overview Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 font-bold text-[10px] uppercase block">ATS Compatibility</span>
                      <span className="text-sm font-bold text-emerald-700 mt-1 block">{analysis.aiFeedback?.formattingAnalysis?.atsCompatibility || 'HIGH'}</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 font-bold text-[10px] uppercase block">Margins</span>
                      <span className="text-sm font-bold text-slate-800 mt-1 block">{analysis.aiFeedback?.formattingAnalysis?.margins || 'Standard'}</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 font-bold text-[10px] uppercase block">Typography</span>
                      <span className="text-sm font-bold text-slate-800 mt-1 block">{analysis.aiFeedback?.formattingAnalysis?.fonts || 'Sans-Serif'}</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <span className="text-slate-400 font-bold text-[10px] uppercase block">Multi-Column Layout</span>
                      <span className="text-sm font-bold text-slate-800 mt-1 block">{analysis.aiFeedback?.formattingAnalysis?.multiColumnLayout ? 'Yes (Warning)' : 'No (Clean Single Column)'}</span>
                    </div>
                  </div>

                  {/* Corrected Grammar & Action Verbs */}
                  <div className="space-y-3 pt-4 border-t border-slate-100">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Sparkles size={15} className="text-indigo-600" /> AI Bullet Point Rewrites & Grammar Improvements:
                    </h4>

                    <div className="space-y-3">
                      {analysis.aiFeedback?.grammarAnalysis?.correctedVersions?.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold">{item.issueType}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 font-bold block text-[10px] uppercase">Original:</span>
                            <p className="text-slate-600 line-through mt-0.5">{item.original}</p>
                          </div>
                          <div>
                            <span className="text-emerald-700 font-bold block text-[10px] uppercase">AI Rewritten (Metric-Driven):</span>
                            <p className="text-emerald-900 font-medium mt-0.5">{item.corrected}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: RECRUITER VIEW & ATS PREVIEW */}
              {activeTab === 'recruiter' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Simulated Recruiter Screener Impression</h3>
                    <p className="text-xs text-slate-500">How an enterprise recruiter views this candidate resume during a 15-second screener.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recruiter Evaluation Card */}
                    <div className="p-6 bg-slate-900 text-white rounded-2xl space-y-4 shadow-md">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Eye size={15} /> Screener Card
                        </span>
                        <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
                          Shortlist: {analysis.aiFeedback?.recruiterView?.wouldShortlist || 'Yes'}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">First Impression:</span>
                        <p className="text-xs text-slate-200 leading-relaxed">{analysis.aiFeedback?.recruiterView?.firstImpression}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Confidence</span>
                          <p className="text-lg font-black text-indigo-400">{analysis.aiFeedback?.recruiterView?.confidencePercentage || 85}%</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Est. Read Time</span>
                          <p className="text-lg font-black text-slate-200">{analysis.aiFeedback?.recruiterView?.estimatedReadingTimeSeconds || 15}s</p>
                        </div>
                      </div>
                    </div>

                    {/* ATS Parsed Text Snippet */}
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Terminal size={15} className="text-slate-600" /> ATS Plain Text Parser Preview:
                      </h4>
                      <p className="text-[11px] text-slate-500 font-mono bg-white p-3 rounded-xl border border-slate-200 max-h-48 overflow-y-auto leading-relaxed">
                        {analysis.aiFeedback?.atsPreview?.parsedTextSnippet || "Parsed text snippet clean."}
                      </p>
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className="text-slate-600 font-bold">Detected Sections:</span>
                        {analysis.aiFeedback?.atsPreview?.detectedSections?.map((s: string, i: number) => (
                          <span key={i} className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: IMPROVEMENT PLAN */}
              {activeTab === 'plan' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-1">Prioritized AI Improvement Plan</h3>
                    <p className="text-xs text-slate-500">Action items sorted by estimated ATS score impact.</p>
                  </div>

                  <div className="space-y-3">
                    {analysis.aiFeedback?.improvementPlan?.map((item: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-slate-900">{item.task}</p>
                            <span className="text-[10px] text-slate-500 font-medium">Category: {item.category}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.priority === 'HIGH' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'}`}>
                            {item.priority}
                          </span>
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold">
                            +{item.estimatedScoreImpact} Pts
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 8: VERSION HISTORY */}
              {activeTab === 'history' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-base font-bold text-slate-900 mb-1">Resume Version & Score History</h3>
                      <p className="text-xs text-slate-500">Track candidate ATS score progress over time.</p>
                    </div>
                    <button
                      onClick={fetchHistory}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <RefreshCcw size={13} /> Refresh
                    </button>
                  </div>

                  {loadingHistory ? (
                    <p className="text-xs text-slate-500 py-4">Loading version history...</p>
                  ) : history.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Date</th>
                            <th className="py-3 px-4">File Name</th>
                            <th className="py-3 px-4">Target Role</th>
                            <th className="py-3 px-4">ATS Score</th>
                            <th className="py-3 px-4">Health</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {history.map((h: any, idx: number) => (
                            <tr key={h.id || idx} className="hover:bg-slate-50/80">
                              <td className="py-3 px-4 text-slate-500">{new Date(h.created_at).toLocaleDateString()}</td>
                              <td className="py-3 px-4 text-slate-900 font-bold">{h.file_name}</td>
                              <td className="py-3 px-4 text-slate-700">{h.target_role}</td>
                              <td className="py-3 px-4 font-black text-indigo-600">{h.overall_ats_score} / 100</td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                                  {h.health_level}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 py-4">No previous resume analysis versions found.</p>
                  )}
                </div>
              )}

            </div>

          </div>
        ) : (
          /* Empty Initial State Banner */
          <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto shadow-inner">
              <FileText size={32} />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-black text-slate-900">No Resume Analyzed Yet</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Upload a candidate resume above to evaluate VEGA ATS score (0-100), transparent deductions, recruiter impression, keyword optimization, and cross-engine skill gaps.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
export default ResumeAnalysisPage;
