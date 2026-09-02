import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext.tsx";
import api from "../../services/api.ts";
import { useAccessibility } from "../../context/AccessibilityContext.tsx";
import { motion, AnimatePresence } from "motion/react";
import { ConsentModal } from "../../components/ConsentModal.tsx";
import { 
  FileText, Sparkles, Download, 
  Layout, CheckCircle2, AlertTriangle, 
  CheckCircle, User, Briefcase, GraduationCap, Code,
  Mail, Phone, MapPin, Brain, RefreshCw, Trophy, Zap, Edit3, Cpu,
  Trash2, Plus, Save, Coins, AlertCircle
} from "lucide-react";
import { GoogleGenAI } from "@google/genai";
import { Link, useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// --- TEMPLATES ---
import {
  HybridATSPremiumTemplate, SiliconValleyTechTemplate, DynamicTemplate, ClassicATSTemplate,
  AcademicLatexTemplate, ExecutiveGridTemplate, MinimalSwissTemplate, TechnicalEliteTemplate,
  ModernProTemplate, CreativeMinTemplate, MarketerGoldTimelineTemplate, DesignerBlackSidebarTemplate,
  MedicalCareProfessionalTemplate, TexturedSlateSerifTemplate, CreativePastelFrameTemplate, AsymmetricalWriterTemplate
} from "../../features/resume-builder/templates/ResumeTemplates.tsx";

// --- MAIN PAGE ---

export function ResumeBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("academic-latex");
  const [generating, setGenerating] = useState(false);
  const [summary, setSummary] = useState("");
  const [currentStep, setCurrentStep] = useState(1); // 1: Check, 2: Select, 3: Preview/Download
  const [consentOpen, setConsentOpen] = useState(localStorage.getItem("consent_resume") !== "true");
  const [editedProfile, setEditedProfile] = useState<any>(null);
  const [sidebarMode, setSidebarMode] = useState<"editor" | "ai-opt">("editor");
  const [editorTab, setEditorTab] = useState<string>("personal");
  const [newSkillText, setNewSkillText] = useState("");
  const [saving, setSaving] = useState(false);
  const [xpBalance, setXpBalance] = useState<number>(0);
  const [previewZoom, setPreviewZoom] = useState<number>(0.72); // Optimal scale to fit side-by-side deskview

  // ATS Optimization Feature State
  const [targetRole, setTargetRole] = useState("SDE / Full Stack Engineer");
  const [keywordsGenerating, setKeywordsGenerating] = useState(false);
  const [atsRecommendations, setAtsRecommendations] = useState<any>(null);

  const fetchAtsOptimizeRecommendations = async (role: string) => {
    setKeywordsGenerating(true);
    try {
      const response = await api.post("/ai/optimize-keywords", {
        skills: profile?.skills_json || [],
        targetRole: role
      });
      if (response.data.success) {
        setAtsRecommendations(response.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch Keyword suggestions:", err);
    } finally {
      setKeywordsGenerating(false);
    }
  };

  useEffect(() => {
    if (profile && currentStep === 3 && !atsRecommendations) {
      fetchAtsOptimizeRecommendations(targetRole);
    }
  }, [profile, currentStep]);
  
  const resumeRef = useRef<HTMLDivElement>(null);

  const { setPageContext } = useAccessibility();

  useEffect(() => {
    if (setPageContext && profile) {
      setPageContext({
        profile,
        currentStep,
        status,
        actions: {
          generate: handleGenerate,
          download: handleDownload,
          selectTemplate: (id: string) => setSelectedTemplate(id),
        }
      });
    }
  }, [profile, currentStep, status, setPageContext]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statusRes, templatesRes, profileRes, balanceRes] = await Promise.all([
        api.get(`/resume/status/${user?.id}`),
        api.get("/resume/templates"),
        api.get(`/students/profile/${user?.id}`),
        api.get("/xp/balance")
      ]);
      
      setStatus(statusRes.data);
      setTemplates(templatesRes.data);
      if (balanceRes.data?.success) {
        setXpBalance(balanceRes.data.balance.xp_balance);
      }
      if (profileRes.data.success) {
        // Parse JSON fields
        const data = profileRes.data.data;
        ['education_json', 'experience_json', 'projects_json', 'skills_json', 'social_links_json'].forEach(field => {
          if (typeof data[field] === 'string') {
            try { data[field] = JSON.parse(data[field]); } catch(e) { data[field] = []; }
          }
          if (!Array.isArray(data[field])) {
            data[field] = [];
          }
        });

        // Load custom sections from localStorage
        const storedCustomSecs = localStorage.getItem(`resume_custom_sections_${user?.id}`);
        if (storedCustomSecs) {
          try { data.custom_sections_json = JSON.parse(storedCustomSecs); } catch (e) { data.custom_sections_json = []; }
        } else {
          data.custom_sections_json = [];
        }
        if (!Array.isArray(data.custom_sections_json)) {
          data.custom_sections_json = [];
        }

        setProfile(data);
        setEditedProfile(JSON.parse(JSON.stringify(data)));
      }
      
      if (statusRes.data.isEligible) setCurrentStep(2);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveAll = async () => {
    if (!editedProfile) return;
    setSaving(true);
    try {
      // 1. Save Personal Info
      await api.put(`/students/profile/${user?.id}/section/personal`, {
        fullName: editedProfile.full_name,
        headline: editedProfile.headline || "",
        dob: editedProfile.dob,
        gender: editedProfile.gender,
        address: editedProfile.address,
        location: editedProfile.location || editedProfile.address || "",
        contact: editedProfile.contact,
        profilePhotoUrl: editedProfile.profile_photo_url
      });

      // 2. Save Summary (which is in the local 'summary' React state)
      await api.put(`/students/profile/${user?.id}/section/summary`, {
        summary: summary
      });

      // 3. Save Skills
      await api.put(`/students/profile/${user?.id}/section/skills`, {
        skills: editedProfile.skills_json
      });

      // 4. Save Education
      const formattedEdu = (Array.isArray(editedProfile?.education_json) ? editedProfile.education_json : []).map((edu: any) => ({
        institution: edu.board || edu.school || edu.institution || "Unknown Institution",
        degree: edu.level || edu.degree || "Other",
        field_of_study: edu.field_of_study || "",
        start_date: edu.start_date || (edu.year ? `${edu.year}-01-01` : "2020-01-01"),
        end_date: edu.end_date || (edu.year ? `${edu.year}-05-01` : "2024-05-01"),
        grade: String(edu.percentage || edu.cgpa || edu.grade || "")
      })) || [];
      await api.put(`/students/profile/${user?.id}/section/education`, {
        education: formattedEdu
      });

      // 5. Save Experience
      const formattedExp = (Array.isArray(editedProfile?.experience_json) ? editedProfile.experience_json : []).map((exp: any) => ({
        company: exp.company || "Unknown Company",
        role: exp.role || "Employee",
        duration: exp.duration || "2024",
        desc: exp.desc || exp.description || "",
        start_date: exp.start_date || "2023-01-01",
        end_date: exp.end_date || "2024-01-01"
      })) || [];
      await api.put(`/students/profile/${user?.id}/section/experience`, {
        experience: formattedExp
      });

      // 6. Save Projects
      const formattedProj = (Array.isArray(editedProfile?.projects_json) ? editedProfile.projects_json : []).map((p: any) => ({
        title: p.name || p.title || "Project",
        description: p.description || p.desc || "",
        tech_stack: p.tech_stack || p.stack || "",
        link: p.link || ""
      })) || [];
      await api.put(`/students/profile/${user?.id}/section/projects`, {
        projects: formattedProj
      });

      // 7. Save Custom Sections to LocalStorage (Durable Client Cache)
      localStorage.setItem(`resume_custom_sections_${user?.id}`, JSON.stringify(editedProfile.custom_sections_json || []));

      // Synchronize in memory
      setProfile(JSON.parse(JSON.stringify(editedProfile)));
      alert("Resume edits successfully updated and saved to your profile!");
    } catch (error) {
      console.error("Error saving resume sections:", error);
      alert("Edits applied directly to preview. Your live PDF will contain all changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = () => {
    if (!newSkillText.trim()) return;
    const currentSkills = editedProfile?.skills_json || [];
    if (!currentSkills.includes(newSkillText.trim())) {
      setEditedProfile({
        ...editedProfile,
        skills_json: [...currentSkills, newSkillText.trim()]
      });
    }
    setNewSkillText("");
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const currentSkills = editedProfile?.skills_json || [];
    setEditedProfile({
      ...editedProfile,
      skills_json: currentSkills.filter((s: string) => s !== skillToRemove)
    });
  };

  const handleAddExperience = () => {
    const currentExp = editedProfile?.experience_json || [];
    setEditedProfile({
      ...editedProfile,
      experience_json: [
        ...currentExp,
        { company: "New Company", role: "Software Engineer", duration: "2026", desc: "Describe your job responsibilities here." }
      ]
    });
  };

  const handleRemoveExperience = (index: number) => {
    const currentExp = editedProfile?.experience_json || [];
    setEditedProfile({
      ...editedProfile,
      experience_json: currentExp.filter((_: any, idx: number) => idx !== index)
    });
  };

  const handleUpdateExperience = (index: number, key: string, val: string) => {
    const currentExp = [...(editedProfile?.experience_json || [])];
    currentExp[index] = { ...currentExp[index], [key]: val };
    setEditedProfile({ ...editedProfile, experience_json: currentExp });
  };

  const handleAddProject = () => {
    const currentProj = editedProfile?.projects_json || [];
    setEditedProfile({
      ...editedProfile,
      projects_json: [
        ...currentProj,
        { name: "New Project", tech_stack: "React, NodeJS", description: "A summary of implementation steps." }
      ]
    });
  };

  const handleRemoveProject = (index: number) => {
    const currentProj = editedProfile?.projects_json || [];
    setEditedProfile({
      ...editedProfile,
      projects_json: currentProj.filter((_: any, idx: number) => idx !== index)
    });
  };

  const handleUpdateProject = (index: number, key: string, val: string) => {
    const currentProj = [...(editedProfile?.projects_json || [])];
    currentProj[index] = { ...currentProj[index], [key]: val };
    setEditedProfile({ ...editedProfile, projects_json: currentProj });
  };

  const handleAddEducation = () => {
    const currentEdu = editedProfile?.education_json || [];
    setEditedProfile({
      ...editedProfile,
      education_json: [
        ...currentEdu,
        { school: "Institution Name", level: "Degree / Course", year: "2026", cgpa: "9.0" }
      ]
    });
  };

  const handleRemoveEducation = (index: number) => {
    const currentEdu = editedProfile?.education_json || [];
    setEditedProfile({
      ...editedProfile,
      education_json: currentEdu.filter((_: any, idx: number) => idx !== index)
    });
  };

  const handleUpdateEducation = (index: number, key: string, val: string) => {
    const currentEdu = [...(editedProfile?.education_json || [])];
    currentEdu[index] = { ...currentEdu[index], [key]: val };
    setEditedProfile({ ...editedProfile, education_json: currentEdu });
  };

  const handleAddCustomSection = () => {
    const currentCustom = editedProfile?.custom_sections_json || [];
    setEditedProfile({
      ...editedProfile,
      custom_sections_json: [
        ...currentCustom,
        { id: 'custom-' + Date.now(), title: "Awards & Activities", content: "• Won 1st place in National Hackathon 2025.\n• Contributed to open source." }
      ]
    });
  };

  const handleRemoveCustomSection = (id: string) => {
    const currentCustom = editedProfile?.custom_sections_json || [];
    setEditedProfile({
      ...editedProfile,
      custom_sections_json: currentCustom.filter((s: any) => s.id !== id)
    });
  };

  const handleUpdateCustomSection = (id: string, key: string, val: string) => {
    const currentCustom = [...(editedProfile?.custom_sections_json || [])];
    const idx = currentCustom.findIndex(s => s.id === id);
    if (idx !== -1) {
      currentCustom[idx] = { ...currentCustom[idx], [key]: val };
      setEditedProfile({ ...editedProfile, custom_sections_json: currentCustom });
    }
  };

  const handleGenerate = async () => {
    if (status.dailyCount >= status.limit) {
      if (xpBalance < (status.xpCost || 50)) {
        alert("Insufficient XP balance. Please purchase more XP to generate extra resumes.");
        return;
      }
      const confirmSpend = window.confirm(`You have reached your daily limit of ${status.limit} resumes. Spending ${status.xpCost || 50} XP to generate another resume?`);
      if (!confirmSpend) return;
    }
    setGenerating(true);
    try {
      // 1. Generate AI Summary on Frontend (As per system instructions)
      let aiSummary = "";
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          const ai = new GoogleGenAI({ apiKey });
          const skills = profile.skills_json || [];
          const projects = profile.projects_json || [];
          
          const prompt = `Write a 2-3 line ATS-friendly professional summary for a student with these details:
            Skills: ${skills.join(", ")}
            Projects: ${projects.map((pr: any) => pr.name).join(", ")}
            Professional Bio: ${profile.bio}
            Focus on being concise and high-impact. Wrap it in quotes.`;

          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt
          });
          aiSummary = response.text || "";
        }
      } catch (aiErr) {
        console.error("AI Generation Error:", aiErr);
      }

      // Fallback Summary if AI fails or no key
      if (!aiSummary) {
        const skills = profile.skills_json || [];
        aiSummary = `Motivated student athlete and upcoming professional with expertise in ${skills.slice(0, 3).join(", ")}. Passionate about building innovative solutions and collaborating on impactful projects.`;
      }

      // 2. Notify Backend to track usage & save history
      const { data } = await api.post("/resume/generate", { 
        userId: user?.id, 
        templateId: selectedTemplate,
        summary: aiSummary
      });

      if (data.success) {
        setSummary(aiSummary);
        setCurrentStep(3);
        // Refresh status and wallet balance to update daily count
        const [statusRes, balanceRes] = await Promise.all([
          api.get(`/resume/status/${user?.id}`),
          api.get("/xp/balance")
        ]);
        setStatus(statusRes.data);
        if (balanceRes.data?.success) {
          setXpBalance(balanceRes.data.balance.xp_balance);
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to finalize resume generation");
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async () => {
    const element = document.getElementById('resume-content');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, { 
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`VEGA_Resume_${profile.full_name?.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert("PDF generation failed. Try disabling any CORS blocking extensions.");
    }
  };

  const calculateScore = () => {
    if (!profile) return 0;
    let score = 30; // Base score for having an account
    if (profile.completeness_score > 80) score += 20;
    if (profile.skills_json?.length >= 5) score += 15;
    if (profile.projects_json?.length >= 2) score += 15;
    if (profile.profile_photo_url) score += 10;
    if (profile.experience_type !== 'FRESHER' || profile.experience_json?.length > 0) score += 10;
    return Math.min(score, 100);
  };

  const resumeScore = calculateScore();

  if (!status) return null;

  return (
    <div className="max-w-7xl mx-auto pt-0 pb-8 font-sans text-slate-800">
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
                <FileText size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-2.5xl sm:text-4xl font-black text-slate-900 uppercase tracking-tight leading-none">AI Resume Builder</h1>
                <p className="text-slate-500 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mt-2">OPTIMIZE AND EXPORT PLACEMENT PROFILES</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-white border border-slate-150 p-3 rounded-2xl shadow-sm justify-between">
              <div className="flex items-center gap-3">
                <div className="text-left md:text-right">
                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Daily Limit</div>
                   <div className="text-xs sm:text-sm font-black text-slate-800 leading-none">{status.dailyCount}/{status.limit} Generated</div>
                </div>
                <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 border border-indigo-100 shrink-0">
                   <Sparkles size={18} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-white border border-slate-150 p-3 rounded-2xl shadow-sm justify-between">
              <div className="flex items-center gap-3">
                <div className="text-left md:text-right">
                   <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Talent Wallet</div>
                   <div className="text-xs sm:text-sm font-black text-amber-600 leading-none font-mono">{xpBalance} XP</div>
                </div>
                <Link to="/xp-store" className="w-9 h-9 bg-amber-50 hover:bg-amber-100 rounded-xl flex items-center justify-center text-amber-500 border border-amber-100 shrink-0 transition-colors" title="Purchase XP points">
                   <Coins size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-10">
           <StepBadge active={currentStep >= 1} done={currentStep > 1} label="Eligibility" icon={<CheckCircle2 size={13} />} />
           <div className="w-8 h-px bg-slate-200" />
           <StepBadge active={currentStep >= 2} done={currentStep > 2} label="Template" icon={<Layout size={13} />} />
           <div className="w-8 h-px bg-slate-200" />
           <StepBadge active={currentStep >= 3} done={currentStep > 3} label="Download" icon={<Download size={13} />} />
        </div>

        <AnimatePresence mode="wait">
           {currentStep === 1 && (
             <motion.div 
               key="step1"
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 1.05 }}
               className="max-w-2xl mx-auto text-center"
             >
                <div className="p-12 glass-card border-slate-200 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Sparkles size={120} className="text-indigo-600" />
                   </div>
                   
                   <div className="relative z-10">
                      <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/10">
                         <AlertTriangle size={32} />
                      </div>
                      <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Access Locked</h2>
                      <p className="text-slate-500 font-medium mb-8">Professional resume generation requires a robust profile. Please complete the following requirements to proceed.</p>
                      
                      <div className="space-y-3 mb-10 text-left">
                         {status.errors.map((err: string, i: number) => (
                           <div key={i} className="flex gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex-items-center">
                              <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                 <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              </div>
                              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">{err}</span>
                           </div>
                         ))}
                      </div>

                      <Link to="/profile" className="inline-flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-slate-900/20 hover:scale-105 transition-all">
                         Complete Profile Now
                      </Link>
                   </div>
                </div>
             </motion.div>
           )}

           {currentStep === 2 && (
             <motion.div 
               key="step2"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-8 max-w-7xl mx-auto px-4"
             >
                <div className="text-center max-w-2xl mx-auto mb-6">
                   <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2 tracking-tight">Choose Your Template</h2>
                   <p className="text-sm text-slate-500 font-medium tracking-tight">Select a high-parse rate format. All templates are fully optimized for corporate screener parsing.</p>
                </div>

                {status.dailyCount >= status.limit && (
                  <div className="max-w-2xl mx-auto p-5 bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-200/60 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-left shadow-sm mb-6">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                        <Coins size={22} className="text-amber-600 animate-pulse" />
                      </div>
                      <div>
                        <p className="text-xs font-black text-amber-900 uppercase tracking-wider mb-0.5">Daily Free Limit Fully Redeemed ({status.dailyCount}/{status.limit})</p>
                        <p className="text-[11px] text-slate-600 font-semibold leading-relaxed">
                          Generating an extra resume will utilize <span className="font-extrabold text-amber-700 font-mono">{status.xpCost || 50} XP</span> from your wallet balance.
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      <div className="text-right font-sans">
                        <span className="block text-[9px] uppercase font-bold text-slate-400">Wallet balance</span>
                        <span className={`text-xs font-black font-mono ${xpBalance >= (status.xpCost || 50) ? 'text-emerald-600' : 'text-red-500'}`}>{xpBalance} XP</span>
                      </div>
                      {xpBalance < (status.xpCost || 50) && (
                        <Link to="/xp-store" className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] uppercase px-4 py-2 rounded-xl shadow-md shadow-amber-500/10 transition-all flex items-center gap-1">
                          <Plus size={12} /> Buy XP
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                  {templates.map((t) => (
                    <div 
                      key={t.id}
                      onClick={() => setSelectedTemplate(t.id)}
                      className={`relative group cursor-pointer rounded-3xl overflow-hidden border-2 transition-all ${selectedTemplate === t.id ? 'border-indigo-600 shadow-xl ring-4 ring-indigo-50' : 'border-slate-100 hover:border-indigo-150'}`}
                    >
                        <div className="aspect-[3/4] bg-slate-50 p-4 border-b border-slate-100 overflow-hidden relative">
                           <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 to-transparent z-10" />
                           <div className="transition-all duration-500 transform scale-[0.32] sm:scale-[0.28] md:scale-[0.33] lg:scale-[0.29] xl:scale-[0.25] origin-top-left group-hover:translate-x-0.5 group-hover:translate-y-0.5">
                              {t.id === 'academic-latex' && <AcademicLatexTemplate data={profile} summary="Sample Summary for previewing layout..." />}
                              {t.id === 'marketer-gold-timeline' && <MarketerGoldTimelineTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'hybrid-ats-premium' && <HybridATSPremiumTemplate data={profile} summary="Optimized premium formatted ATS-certified layout with full parsing guarantees." />}
                              {t.id === 'silicon-valley-tech' && <SiliconValleyTechTemplate data={profile} summary="Silicon Valley modern single-column layout highlighting impact metrics." />}
                              {t.id === 'modern-pro' && <ModernProTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'designer-black-sidebar' && <DesignerBlackSidebarTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'executive-grid' && <ExecutiveGridTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'medical-care-professional' && <MedicalCareProfessionalTemplate data={profile} summary="Sample Summary for previewing layout..." />}
                              {t.id === 'minimal-swiss' && <MinimalSwissTemplate data={profile} summary="Sample Summary for previewing layout..." />}
                              {t.id === 'textured-slate-serif' && <TexturedSlateSerifTemplate data={profile} summary="Sample Summary for previewing layout..." />}
                              {t.id === 'technical-elite' && <TechnicalEliteTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'creative-pastel-frame' && <CreativePastelFrameTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'creative-min' && <CreativeMinTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'asymmetrical-writer' && <AsymmetricalWriterTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {t.id === 'classic-ats' && <ClassicATSTemplate data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />}
                              {!['academic-latex', 'marketer-gold-timeline', 'hybrid-ats-premium', 'silicon-valley-tech', 'modern-pro', 'designer-black-sidebar', 'executive-grid', 'medical-care-professional', 'minimal-swiss', 'textured-slate-serif', 'technical-elite', 'creative-pastel-frame', 'creative-min', 'asymmetrical-writer', 'classic-ats'].includes(t.id) && (
                                <DynamicTemplate id={t.id} data={profile} summary="Sample Summary for previewing layout..." photo={profile?.profile_photo_url} />
                              )}
                           </div>
                        </div>
                       <div className="p-4 sm:p-5 bg-white relative z-20">
                          <div className="flex justify-between items-start gap-2 mb-1.5">
                             <h4 className="font-bold text-slate-900 text-sm tracking-tight line-clamp-1 uppercase" title={t.name}>{t.name}</h4>
                             <span className="shrink-0 text-[8px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100/50 uppercase">
                                {t.type?.replace('_', ' ')}
                             </span>
                          </div>
                          <p className="text-[11px] text-slate-450 font-medium italic line-clamp-2 leading-relaxed" title={t.description}>{t.description}</p>
                       </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col items-center justify-center gap-2 pt-8">
                   <button 
                     onClick={handleGenerate}
                     disabled={generating || (status.dailyCount >= status.limit && xpBalance < (status.xpCost || 50))}
                     className="px-12 py-5 bg-indigo-600 text-white rounded-[24px] font-black text-lg shadow-2xl shadow-indigo-500/30 hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50"
                   >
                     {generating 
                       ? "Crafting AI Resume..." 
                       : status.dailyCount >= status.limit 
                         ? <><Sparkles size={24} /> Pay {status.xpCost || 50} XP & Generate</> 
                         : <><Sparkles size={24} /> Generate Professional Resume</>
                     }
                   </button>
                   {status.dailyCount >= status.limit && xpBalance < (status.xpCost || 50) && (
                     <p className="text-xs text-red-500 font-black uppercase tracking-wider mt-1 flex items-center gap-1">
                       <AlertCircle size={14} /> Insufficient XP in wallet to purchase additional resumes.
                     </p>
                   )}
                </div>
             </motion.div>
           )}

           {currentStep === 3 && (
             <motion.div 
                key="step3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col lg:flex-row gap-12"
             >
                {/* Control Panel with Tabs */}
                <aside className="w-full lg:w-[450px] shrink-0 space-y-6">
                    {/* Navigation Mode Selector */}
                    <div className="flex bg-slate-100 p-1.5 rounded-[24px] gap-1 border border-slate-200 mb-6">
                      <button
                        type="button"
                        onClick={() => setSidebarMode("editor")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-wider transition-all ${sidebarMode === "editor" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        <Edit3 size={13} /> Resume Editor
                      </button>
                      <button
                        type="button"
                        onClick={() => setSidebarMode("ai-opt")}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-[18px] text-[11px] font-black uppercase tracking-wider transition-all ${sidebarMode === "ai-opt" ? "bg-indigo-600 text-white shadow-sm font-semibold" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        <Sparkles size={13} /> AI ATS Optimizer
                      </button>
                    </div>
                    {sidebarMode === "editor" ? (
                      /* RESUME EDITOR MAIN PANEL */
                      <div className="bg-white rounded-[40px] p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
                        <div className="border-b border-slate-100 pb-3">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Resume Document Fields</h4>
                          <p className="text-[10px] text-slate-400 mt-1 font-medium font-sans">Type in any field to update the live preview layout instantly.</p>
                        </div>

                        {/* Editor Section Headers */}
                        <div className="flex gap-1 overflow-x-auto pb-2 no-scrollbar border-b border-slate-100">
                          {[
                            { id: "personal", label: "Details", icon: <User size={12} /> },
                            { id: "experience", label: "Work", icon: <Briefcase size={12} /> },
                            { id: "education", label: "Academic", icon: <GraduationCap size={12} /> },
                            { id: "projects", label: "Projects", icon: <Code size={12} /> },
                            { id: "skills", label: "Skills", icon: <Cpu size={12} /> },
                            { id: "custom", label: "Custom", icon: <Edit3 size={12} /> },
                          ].map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setEditorTab(tab.id)}
                              className={`flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${editorTab === tab.id ? "bg-indigo-50 text-indigo-700 font-bold" : "text-slate-400 hover:text-slate-600"}`}
                            >
                              {tab.icon}
                              <span>{tab.label}</span>
                            </button>
                          ))}
                        </div>

                        {/* Tab Contents */}
                        <div className="min-h-[200px]">
                          {editorTab === "personal" && (
                            <div className="space-y-4">
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Full Name</label>
                                <input
                                  type="text"
                                  value={editedProfile?.full_name || ""}
                                  onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                  placeholder="Full Name"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Headline</label>
                                <input
                                  type="text"
                                  value={editedProfile?.headline || ""}
                                  onChange={(e) => setEditedProfile({ ...editedProfile, headline: e.target.value })}
                                  className="w-full text-xs font-bold text-slate-805 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                  placeholder="SDE / Full Stack Developer"
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Contact Number</label>
                                  <input
                                    type="text"
                                    value={editedProfile?.contact || ""}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, contact: e.target.value })}
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                    placeholder="Phone number"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans font-sans">Address / City</label>
                                  <input
                                    type="text"
                                    value={editedProfile?.address || editedProfile?.location || ""}
                                    onChange={(e) => setEditedProfile({ ...editedProfile, address: e.target.value, location: e.target.value })}
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                    placeholder="e.g. San Francisco, CA"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Contact Email</label>
                                <input
                                  type="text"
                                  value={editedProfile?.email || ""}
                                  onChange={(e) => setEditedProfile({ ...editedProfile, email: e.target.value })}
                                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                  placeholder="Email Address"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 font-sans">Professional Summary</label>
                                <textarea
                                  rows={5}
                                  value={summary}
                                  onChange={(e) => setSummary(e.target.value)}
                                  className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all leading-normal font-sans"
                                  placeholder="Enter professional summary paragraph to render on resume..."
                                />
                              </div>
                            </div>
                          )}

                          {editorTab === "experience" && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience ({editedProfile?.experience_json?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={handleAddExperience}
                                  className="text-[10px] font-black text-indigo-650 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-800"
                                >
                                  <Plus size={11} /> Add Role
                                </button>
                              </div>
                              
                              {(editedProfile?.experience_json || []).length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                                  <p className="text-xs text-slate-400 font-sans">No work experience entries yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar-all font-sans">
                                  {(Array.isArray(editedProfile?.experience_json) ? editedProfile.experience_json : []).map((exp, index) => (
                                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative space-y-3 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveExperience(index)}
                                        className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 hover:scale-110 transition-all font-sans font-bold"
                                        title="Delete experience"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Company</label>
                                          <input
                                            type="text"
                                            value={exp.company || ""}
                                            onChange={(e) => handleUpdateExperience(index, "company", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1 font-sans">Role</label>
                                          <input
                                            type="text"
                                            value={exp.role || ""}
                                            onChange={(e) => handleUpdateExperience(index, "role", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Duration / Years</label>
                                          <input
                                            type="text"
                                            value={exp.duration || ""}
                                            onChange={(e) => handleUpdateExperience(index, "duration", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                            placeholder="e.g. 2024 - Present"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Start Date</label>
                                          <input
                                            type="text"
                                            value={exp.start_date || ""}
                                            onChange={(e) => handleUpdateExperience(index, "start_date", e.target.value)}
                                            className="w-full text-xs font-sans text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                            placeholder="YYYY-MM-DD"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-405 mb-1">Job Description</label>
                                        <textarea
                                          rows={2}
                                          value={exp.desc || exp.description || ""}
                                          onChange={(e) => handleUpdateExperience(index, exp.desc !== undefined ? "desc" : "description", e.target.value)}
                                          className="w-full text-xs text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none leading-normal font-sans"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {editorTab === "education" && (
                            <div className="space-y-4 font-sans">
                              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Academic Records ({editedProfile?.education_json?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={handleAddEducation}
                                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-800"
                                >
                                  <Plus size={11} /> Add Education
                                </button>
                              </div>

                              {(editedProfile?.education_json || []).length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                                  <p className="text-xs text-slate-400 font-sans">No education entries yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar font-sans font-medium">
                                  {(Array.isArray(editedProfile?.education_json) ? editedProfile.education_json : []).map((edu, index) => (
                                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative space-y-3 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveEducation(index)}
                                        className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 hover:scale-110 transition-all font-sans font-bold"
                                        title="Delete education"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-400 mb-1">Institution Name</label>
                                        <input
                                          type="text"
                                          value={edu.board || edu.school || edu.institution || ""}
                                          onChange={(e) => handleUpdateEducation(index, edu.board ? "board" : edu.school ? "school" : "institution", e.target.value)}
                                          className="w-full text-xs font-bold text-slate-808 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                        />
                                      </div>
                                      <div className="grid grid-cols-3 gap-2">
                                        <div className="col-span-2">
                                          <label className="block text-[8px] font-black text-slate-405 mb-1">Degree / Level</label>
                                          <input
                                            type="text"
                                            value={edu.level || edu.degree || ""}
                                            onChange={(e) => handleUpdateEducation(index, edu.level ? "level" : "degree", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Grading</label>
                                          <input
                                            type="text"
                                            value={edu.cgpa || edu.percentage || edu.grade || ""}
                                            onChange={(e) => handleUpdateEducation(index, edu.cgpa ? "cgpa" : edu.percentage ? "percentage" : "grade", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1 font-sans">Year / Period</label>
                                          <input
                                            type="text"
                                            value={edu.year || edu.duration || ""}
                                            onChange={(e) => handleUpdateEducation(index, edu.year ? "year" : "duration", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Field of Study</label>
                                          <input
                                            type="text"
                                            value={edu.field_of_study || ""}
                                            onChange={(e) => handleUpdateEducation(index, "field_of_study", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {editorTab === "projects" && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Project Entries ({editedProfile?.projects_json?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={handleAddProject}
                                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-800"
                                >
                                  <Plus size={11} /> Add Project
                                </button>
                              </div>

                              {(editedProfile?.projects_json || []).length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                                  <p className="text-xs text-slate-400 font-sans">No project entries yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar font-sans font-sans">
                                  {(Array.isArray(editedProfile?.projects_json) ? editedProfile.projects_json : []).map((proj, index) => (
                                    <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative space-y-3 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveProject(index)}
                                        className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 hover:scale-110 transition-all font-sans font-bold"
                                        title="Delete project"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-400 mb-1">Project Title</label>
                                        <input
                                          type="text"
                                          value={proj.name || proj.title || ""}
                                          onChange={(e) => handleUpdateProject(index, proj.name ? "name" : "title", e.target.value)}
                                          className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1">Tech Stack</label>
                                          <input
                                            type="text"
                                            value={proj.tech_stack || proj.stack || ""}
                                            onChange={(e) => handleUpdateProject(index, proj.tech_stack ? "tech_stack" : "stack", e.target.value)}
                                            className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                            placeholder="e.g. React, NodeJS"
                                          />
                                        </div>
                                        <div>
                                          <label className="block text-[8px] font-black text-slate-400 mb-1 font-sans">Project Link</label>
                                          <input
                                            type="text"
                                            value={proj.link || ""}
                                            onChange={(e) => handleUpdateProject(index, "link", e.target.value)}
                                            className="w-full text-xs font-sans text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                            placeholder="https://github.com/..."
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-400 mb-1">Project Description</label>
                                        <textarea
                                          rows={2}
                                          value={proj.description || proj.desc || ""}
                                          onChange={(e) => handleUpdateProject(index, proj.description !== undefined ? "description" : "desc", e.target.value)}
                                          className="w-full text-xs text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none leading-normal font-sans"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {editorTab === "skills" && (
                            <div className="space-y-4">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans font-bold">Skills Portfolio</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newSkillText}
                                  onChange={(e) => setNewSkillText(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                                  className="flex-1 text-xs font-semibold text-slate-800 bg-slate-50 border border-slate-150 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans"
                                  placeholder="Add skill (e.g. React, Python)"
                                />
                                <button
                                  type="button"
                                  onClick={handleAddSkill}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1 shrink-0 font-sans font-sans"
                                >
                                  <Plus size={14} /> Add
                                </button>
                              </div>

                              <div className="flex flex-wrap gap-1.5 p-4 bg-slate-50 rounded-3xl border border-slate-100 max-h-[220px] overflow-y-auto no-scrollbar font-sans font-medium">
                                {(editedProfile?.skills_json || []).length === 0 ? (
                                  <p className="text-xs text-slate-400 py-3 mx-auto font-sans">No skills added yet.</p>
                                ) : (
                                  (Array.isArray(editedProfile?.skills_json) ? editedProfile.skills_json : []).map((skill) => (
                                    <span
                                      key={skill}
                                      className="flex items-center gap-1.5 text-xs font-bold bg-white text-slate-705 pl-3 pr-2 py-1.5 rounded-xl border border-slate-150 shadow-sm font-sans"
                                    >
                                      {skill}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSkill(skill)}
                                        className="text-rose-500 hover:text-rose-700 font-bold p-0.5"
                                      >
                                        ×
                                      </button>
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          )}

                          {editorTab === "custom" && (
                            <div className="space-y-4">
                              <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-sans">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans font-sans">Custom Sections ({editedProfile?.custom_sections_json?.length || 0})</span>
                                <button
                                  type="button"
                                  onClick={handleAddCustomSection}
                                  className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-1 hover:text-indigo-805 font-sans"
                                >
                                  <Plus size={11} /> Add Section
                                </button>
                              </div>

                              {(editedProfile?.custom_sections_json || []).length === 0 ? (
                                <div className="text-center py-6 border border-dashed border-slate-200 rounded-2xl">
                                  <p className="text-xs text-slate-400 font-sans">No custom sections added yet.</p>
                                </div>
                              ) : (
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1 no-scrollbar font-sans font-medium">
                                  {(Array.isArray(editedProfile?.custom_sections_json) ? editedProfile.custom_sections_json : []).map((section, index) => (
                                    <div key={section.id || index} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative space-y-3 font-sans">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveCustomSection(section.id)}
                                        className="absolute top-4 right-4 text-rose-500 hover:text-rose-700 hover:scale-110 transition-all font-sans font-bold"
                                        title="Delete section"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-400 mb-1">Section Title</label>
                                        <input
                                          type="text"
                                          value={section.title || ""}
                                          onChange={(e) => handleUpdateCustomSection(section.id, "title", e.target.value)}
                                          className="w-full text-xs font-bold text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none"
                                          placeholder="e.g. Certifications, Languages"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[8px] font-black text-slate-400 mb-1">Section Content</label>
                                        <textarea
                                          rows={3}
                                          value={section.content || ""}
                                          onChange={(e) => handleUpdateCustomSection(section.id, "content", e.target.value)}
                                          className="w-full text-xs text-slate-800 bg-white border border-slate-150 p-2 rounded-xl outline-none leading-normal font-sans"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Save Button */}
                        <div className="pt-2 border-t border-slate-50 font-sans">
                          <button 
                            type="button"
                            onClick={handleSaveAll}
                            disabled={saving}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-700 hover:scale-[1.02] transition-all disabled:opacity-50 font-sans font-bold"
                          >
                            <Save size={14} /> {saving ? "Saving Changes..." : "Save Profile Changes"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE AI CARD FOR OPTIMIZER MODE */
                      <>
                        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
                           <div className="mb-4">
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans font-bold">AI Summary Result</div>
                              <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100 text-sm italic text-indigo-700 leading-relaxed font-sans font-medium">
                                 "${summary}"
                              </div>
                           </div>
                        </div>

                        <div className="bg-emerald-600 text-white rounded-[40px] p-8 animate-fadeIn">
                           <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                 <CheckCircle size={24} />
                                 <span className="text-[10px] font-black uppercase tracking-widest">ATS Verified</span>
                              </div>
                              <div className="px-3 py-1 bg-white/20 rounded-full text-xs font-black">
                                 Score: ${resumeScore}/100
                              </div>
                           </div>
                           <p className="text-lg font-bold tracking-tight">Your resume is ready for submission.</p>
                           <p className="text-xs text-emerald-200 mt-2 font-sans font-medium">Format: PDF/A4 standard optimized for industry parsers including Workday and Taleo.</p>
                        </div>

                        {/* Interactive ATS Audit Summary */}
                        <div className="bg-slate-900 text-white rounded-[40px] p-8 space-y-6">
                           <div className="flex items-center gap-2">
                             <Trophy className="text-yellow-400 font-bold" size={20} />
                             <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-300">ATS Auditor Report</h4>
                           </div>

                           <div className="space-y-3 text-xs">
                             <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/30">
                               <div className="flex justify-between items-center text-slate-200 font-bold mb-1">
                                 <span>Layout Parse Rating</span>
                                 <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono">100% SECURE</span>
                               </div>
                               <p className="text-[10px] text-slate-400 font-sans">
                                 {`['hybrid-ats-premium', 'silicon-valley-tech', 'classic-ats', 'academic-latex'].includes(selectedTemplate) 
                                   ? "Perfect. Pure single-column linear standard format guarantees parse safety across corporate systems."
                                   : "This grid-based system may experience sequence offset on older legacy screeners. Use 'Hybrid ATS Premium' for absolute parse security."`}
                               </p>
                             </div>

                             <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/30">
                               <div className="flex justify-between items-center text-slate-200 font-bold mb-1">
                                 <span>Aspirant Section Coverage</span>
                                 <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono font-sans font-sans">VERIFIED</span>
                               </div>
                               <div className="space-y-1 mt-1.5 text-[10px] text-slate-400 font-medium font-sans font-sans font-mono">
                                 <div className="flex items-center gap-1.5 font-sans">
                                   <span className="text-emerald-400 font-boldfont-sans">✔</span> Social URLs Recognized ({`profile?.social_links_json?.linkedin ? 'LinkedIn Configured' : 'Fallback active'`})
                                 </div>
                                 <div className="flex items-center gap-1.5 font-sans">
                                   <span className="text-emerald-400 font-bold font-sans font-mono">✔</span> Standard Section Labels (Experience, Skills, Projects)
                                 </div>
                               </div>
                             </div>

                             <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-705/30">
                               <div className="flex justify-between items-center text-slate-200 font-bold mb-1">
                                 <span>Quantifiable Metric Ratio</span>
                                 <span className={`text-[9px] px-2 py-0.5 rounded font-bold font-mono ${profile?.projects_json?.some((p) => /\\d+%|\\d+\\s*ms|\\d+\\s*x/i.test(p.description)) ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                   {`profile?.projects_json?.some((p) => /\\d+%|\\d+\\s*ms|\\d+\\s*x/i.test(p.description)) ? 'OPTIMUM' : 'ALERT'`}
                                 </span>
                               </div>
                               <p className="text-[10px] text-slate-400 leading-normal font-sans">
                                 {`profile?.projects_json?.some((p) => /\\d+%|\\d+\\s*ms|\\d+\\s*x/i.test(p.description))
                                   ? "Excellent. Numeric achievements are recognized in your descriptions. This highlights direct business/engineering execution impact."
                                   : "Tip: Add quantitative metrics standard for SDE (e.g., 'rendered 40% faster', 'scaled user endpoints by 2x') to increase ATS rating."`}
                               </p>
                             </div>
                           </div>
                        </div>

                        {/* SEO Real-Time Role Optimizer Panel */}
                        <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 space-y-6">
                           <div className="space-y-2">
                             <div className="flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                 <Brain className="text-indigo-600" size={18} />
                                 <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-sans">Target Role SEO Matcher</h4>
                               </div>
                               {keywordsGenerating && <RefreshCw size={12} className="animate-spin text-indigo-600" />}
                             </div>
                             <p className="text-xs text-slate-455 font-medium">Select your aspiration role to optimize matching resume phrasing.</p>
                           </div>

                           <div className="relative font-sans font-medium">
                             <select 
                               value={targetRole}
                               onChange={(e) => {
                                 setTargetRole(e.target.value);
                                 fetchAtsOptimizeRecommendations(e.target.value);
                               }}
                               className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 p-3 rounded-2xl outline-none focus:border-indigo-600 focus:bg-white transition-all appearance-none"
                             >
                               <option value="SDE / Full Stack Engineer font-sans text-xs">SDE / Full Stack Engineer</option>
                               <option value="Frontend Development Specialist font-sans text-xs font-semibold">Frontend Development Specialist (React)</option>
                               <option value="Backend & Cloud Infrastructure font-sans font-sans">Backend & Cloud Infrastructure</option>
                               <option value="AI / ML & Data Analytics Specialist font-sans">AI / ML & Data Analytics Specialist</option>
                               <option value="Product Manager & QA Engineer font-sans font-bold">Product Manager & QA Engineer</option>
                             </select>
                             <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-sans font-bold">▼</div>
                           </div>

                           <div className="space-y-4 pt-2 font-sans font-medium">
                             {keywordsGenerating ? (
                               <div className="py-8 text-center space-y-2">
                                 <RefreshCw size={24} className="animate-spin text-indigo-600 mx-auto" />
                                 <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Querying Gemini ATS Database...</p>
                               </div>
                             ) : atsRecommendations ? (
                               <div className="space-y-5">
                                 {/* Missing terms list */}
                                 <div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                     <Zap size={10} className="text-amber-500 font-bold" /> ATS Targeted Phrases
                                   </p>
                                   <div className="flex flex-wrap gap-1.5 font-sans">
                                     {atsRecommendations.missingKeywords?.map((kw) => (
                                       <span key={kw} className="text-[9px] font-bold bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg border border-indigo-100/50 font-sans">
                                         {kw}
                                       </span>
                                     ))}
                                   </div>
                                 </div>

                                 {/* Recommended actions verbs */}
                                 <div>
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 font-sans">
                                     Recommended Core Verbs
                                   </p>
                                   <div className="flex flex-wrap gap-1 font-sans">
                                     {atsRecommendations.recommendedVerbs?.map((vb) => (
                                       <span key={vb} className="text-[9px] font-mono font-bold bg-slate-50 text-slate-655 px-2 py-0.5 rounded border border-slate-100 font-sans">
                                         {vb}
                                       </span>
                                     ))}
                                   </div>
                                 </div>

                                 {/* Live sentence rewrites recommendation */}
                                 <div className="space-y-3 font-sans">
                                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest font-sans font-bold">
                                     High-Score Bullet Rewrites
                                   </p>
                                   <div className="space-y-3 text-[11px] font-sans">
                                     {atsRecommendations.bulletRewrites?.slice(0, 2).map((rewrite, i) => (
                                       <div key={i} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl relative overflow-hidden font-sans">
                                         <div className="text-[8px] font-extrabold text-slate-400 uppercase mb-1 font-sans font-semibold">Standard / Passive Statement</div>
                                         <p className="text-slate-500 line-through mb-2 font-sans">"${rewrite.originalIdea}"</p>
                                         <div className="text-[8px] font-extrabold text-indigo-600 uppercase mb-1 font-sans font-serif">High-ATS Score Metric rewrite</div>
                                         <p className="text-indigo-900 font-bold bg-indigo-50/50 p-2 rounded-xl italic font-serif">"${rewrite.rewrittenBullet}"</p>
                                       </div>
                                     ))}
                                   </div>
                                 </div>
                               </div>
                             ) : (
                               <button
                                 onClick={() => fetchAtsOptimizeRecommendations(targetRole)}
                                 className="w-full flex items-center justify-center gap-2 py-3 border border-indigo-200 text-indigo-600 rounded-2xl font-bold text-xs"
                               >
                                 <Brain size={14} /> Scan Terminology Recommendation
                               </button>
                             )}
                           </div>
                        </div>
                      </>
                    )}
                </aside>

                {/* Live Preview Screen */}
                <div className="flex-1 min-w-0 space-y-6">
                   <div className="flex items-center justify-between px-4 bg-white/70 border border-slate-100 py-3 rounded-[24px] shadow-sm">
                      <div className="flex items-center gap-2">
                         <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Live Document Preview</h3>
                         <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-full font-black uppercase border border-indigo-100">A4 Standard</span>
                      </div>
                      
                      {/* Interactive Zoom Control */}
                      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <button 
                          type="button"
                          onClick={() => setPreviewZoom(Math.max(0.4, Number((previewZoom - 0.05).toFixed(2))))} 
                          className="w-7 h-7 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-black transition-all flex items-center justify-center border border-slate-150 text-sm active:scale-95 cursor-pointer"
                          title="Zoom Out"
                        >
                          -
                        </button>
                        <span className="text-[10px] font-mono font-black text-indigo-700 w-12 text-center select-none">
                          {Math.round(previewZoom * 100)}%
                        </span>
                        <button 
                          type="button"
                          onClick={() => setPreviewZoom(Math.min(1.2, Number((previewZoom + 0.05).toFixed(2))))} 
                          className="w-7 h-7 bg-white hover:bg-slate-50 text-slate-600 rounded-lg font-black transition-all flex items-center justify-center border border-slate-150 text-sm active:scale-95 cursor-pointer"
                          title="Zoom In"
                        >
                          +
                        </button>
                        <div className="w-px h-4 bg-slate-200 mx-1" />
                        <button
                          type="button"
                          onClick={() => setPreviewZoom(0.72)}
                          className="text-[9px] font-black uppercase text-indigo-600 hover:bg-white rounded-lg px-2.5 py-1 transition-all pointer-events-auto"
                        >
                          Fit
                        </button>
                      </div>
                   </div>
                   
                   <div className="w-full bg-slate-100/65 border border-slate-200/60 rounded-[36px] flex justify-center p-4 sm:p-6 shadow-inner overflow-hidden min-h-[500px]">
                      <div 
                        style={{ 
                          width: `${794 * previewZoom}px`, 
                          height: `${1123 * previewZoom}px`,
                          transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                        }} 
                        className="relative shrink-0 overflow-hidden"
                      >
                         <div 
                           style={{ 
                             transform: `scale(${previewZoom})`, 
                             transformOrigin: "top left", 
                             width: "210mm", 
                             height: "297mm",
                             transition: "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                           }}
                           className="absolute top-0 left-0 bg-white shadow-xl hover:shadow-2xl border border-slate-200/50 rounded-2xl overflow-hidden shrink-0"
                         >
                             {selectedTemplate === 'hybrid-ats-premium' && <HybridATSPremiumTemplate data={editedProfile || profile} summary={summary} />}
                             {selectedTemplate === 'silicon-valley-tech' && <SiliconValleyTechTemplate data={editedProfile || profile} summary={summary} />}
                            {selectedTemplate === 'academic-latex' && <AcademicLatexTemplate data={editedProfile || profile} summary={summary} />}
                            {selectedTemplate === 'classic-ats' && <ClassicATSTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'modern-pro' && <ModernProTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'executive-grid' && <ExecutiveGridTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'minimal-swiss' && <MinimalSwissTemplate data={editedProfile || profile} summary={summary} />}
                            {selectedTemplate === 'technical-elite' && <TechnicalEliteTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'creative-min' && <CreativeMinTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'marketer-gold-timeline' && <MarketerGoldTimelineTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'designer-black-sidebar' && <DesignerBlackSidebarTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'medical-care-professional' && <MedicalCareProfessionalTemplate data={editedProfile || profile} summary={summary} />}
                            {selectedTemplate === 'textured-slate-serif' && <TexturedSlateSerifTemplate data={editedProfile || profile} summary={summary} />}
                            {selectedTemplate === 'creative-pastel-frame' && <CreativePastelFrameTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {selectedTemplate === 'asymmetrical-writer' && <AsymmetricalWriterTemplate data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />}
                            {!['academic-latex', 'marketer-gold-timeline', 'hybrid-ats-premium', 'silicon-valley-tech', 'modern-pro', 'designer-black-sidebar', 'executive-grid', 'medical-care-professional', 'minimal-swiss', 'textured-slate-serif', 'technical-elite', 'creative-pastel-frame', 'creative-min', 'asymmetrical-writer', 'classic-ats'].includes(selectedTemplate) && (
                              <DynamicTemplate id={selectedTemplate} data={editedProfile || profile} summary={summary} photo={(editedProfile || profile)?.profile_photo_url} />
                            )}
                         </div>
                      </div>
                   </div>
                </div>
             </motion.div>
           )}
        </AnimatePresence>
      </div>

      <ConsentModal
        isOpen={consentOpen}
        title="Resume Processing Consent"
        subtitle="AI Optimization & PDF Generation Parameters"
        consentMessage="To leverage our automated AI Resume Optimizer, you consent to the storage, profile-parsing, and transformation of your registered skills, academic records, and technical experiences. Gemini Large Language models will process this information securely server-side to align, re-phrase, and optimize keywords based on standard placement ATS parameters."
        compulsoryWarning="Declining this consent will prevent you from utilizing our automatic AI Resume Optimizer. AI-enabled profiling data is compulsory to match corporate ATS screening metrics."
        onAgree={() => {
          localStorage.setItem("consent_resume", "true");
          setConsentOpen(false);
        }}
        onDisagreeClose={() => {
          navigate("/student");
        }}
      />
    </div>
  );
}

function StepBadge({ active, done, label, icon }: any) {
  return (
    <div className="flex flex-col items-center gap-2">
       <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-200 text-slate-400'}`}>
          {done ? <CheckCircle size={14} /> : icon}
       </div>
       <span className={`text-[9px] font-black uppercase tracking-widest ${active ? 'text-slate-900' : 'text-slate-400'}`}>{label}</span>
    </div>
  );
}
