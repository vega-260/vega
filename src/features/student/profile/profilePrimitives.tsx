import React, { useEffect, useRef, useState } from "react";
import api from "../../../services/api.ts";
import { AlertCircle, CheckCircle, Pencil, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Shared profile types and UI primitives extracted from the route page.
export interface Education {
  id?: number;
  institution: string;
  degree: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  description?: string;
}

export interface Project {
  id?: number;
  title: string;
  description?: string;
  techStack?: string;
  link?: string;
  githubLink?: string;
}

export interface Experience {
  id?: number;
  company: string;
  role: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  isCurrent?: boolean;
  description?: string;
}

export interface Certification {
  id?: number;
  name: string;
  issuingOrganization: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface ExtracurricularActivity {
  id?: number;
  category: string;
  title: string;
  description?: string;
  organization_name?: string;
  participation_level?: string;
  achievement_rank?: string;
  activity_date?: string;
  certificate_url?: string;
  ai_analysis_json?: string;
}

// --- Components ---

export const CompletionBar = ({ score, nextStep }: { score: number, nextStep?: string }) => (
  <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 mb-8 overflow-hidden relative">
    <div className="flex justify-between items-end mb-4">
      <div>
        <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-1">Profile Strength</h4>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-black text-slate-900">{score}%</span>
          <span className="text-slate-400 font-bold text-sm">Complete</span>
        </div>
      </div>
      {nextStep && (
        <div className="text-right hidden md:block">
          <p className="text-xs font-bold text-slate-400 mb-1">Next Step</p>
          <p className="text-sm font-black text-blue-600">{nextStep}</p>
        </div>
      )}
    </div>
    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
      <motion.div 
        initial={{ width: 0 }}
        animate={{ width: `${score}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className={`h-full rounded-full ${
          score < 30 ? 'bg-red-500' : score < 70 ? 'bg-amber-500' : 'bg-emerald-500'
        }`}
      />
    </div>
    {score < 100 && (
      <div className="mt-4 flex items-center gap-2 text-amber-600">
        <AlertCircle size={14} />
        <p className="text-xs font-bold uppercase tracking-wide">Boost your profile to get 3x more recruiter views</p>
      </div>
    )}
  </div>
);

export const SectionCard = ({ 
  title, 
  icon: Icon, 
  children, 
  onEdit, 
  isCompleted = false,
  description
}: { 
  title: string, 
  icon: any, 
  children: React.ReactNode, 
  onEdit?: () => void,
  isCompleted?: boolean,
  description?: string
}) => (
  <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200 hover:border-slate-300 transition-all relative group" id={`section-${title.toLowerCase().replace(/\s+/g, '-')}`}>
    <div className="flex justify-between items-start mb-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
          <Icon size={24} />
        </div>
        <div>
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            {title}
            {isCompleted && <CheckCircle size={16} className="text-emerald-500" />}
          </h3>
          {description && <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">{description}</p>}
        </div>
      </div>
      {onEdit && (
        <button 
          onClick={onEdit}
          className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:bg-blue-50 hover:text-blue-600 transition-all"
        >
          <Pencil size={20} />
        </button>
      )}
    </div>
    <div className="space-y-4">
      {children}
    </div>
  </div>
);

export const EditModal = ({ title, isOpen, onClose, onSave, children, isSaveDisabled }: { 
  title: string, 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: () => void,
  children: React.ReactNode,
  isSaveDisabled?: boolean
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
        >
          <div className="px-10 py-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{title}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600"><X size={24} /></button>
          </div>
          <div className="p-10 max-h-[70vh] overflow-y-auto">
            {children}
          </div>
          <div className="p-8 border-t border-slate-100 flex gap-4 bg-slate-50/50">
            <button 
              onClick={onClose}
              className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={onSave}
              disabled={isSaveDisabled}
              className={`flex-1 py-4 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all ${isSaveDisabled ? 'bg-slate-300 shadow-none cursor-not-allowed text-slate-500' : 'bg-blue-600 shadow-blue-500/20 hover:bg-blue-700'}`}
            >
              Save Changes
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// Autocomplete lists for India and localized schools/colleges
export const COLLEGE_SUGGESTIONS = [
  "BRACT'S Vishwakarma Global Business School(VGBS), Pune",
  "BRACT's Vishwakarma Institute of Information Technology, Pune",
  "BRACTS Vishwakarma Institute Of Management, Pune",
  "Brahamdeo Muni Udasin Sanskrit College, Vaishali",
  "Brahma Kumaris University, Delhi",
  "Brahmachari Wadi Trust Institute of Business Administration, Ahmedabad",
  "Solapur Institute of Technology, Solapur",
  "Walchand Institute of Technology (WIT), Solapur",
  "Orchid College of Engineering, Solapur",
  "Indian Institute of Technology (IIT) Bombay, Mumbai",
  "Indian Institute of Technology (IIT) Delhi",
  "Indian Institute of Technology (IIT) Madras",
  "Indian Institute of Technology (IIT) Kharagpur",
  "Indian Institute of Technology (IIT) Roorkee",
  "Birla Institute of Technology and Science (BITS), Pilani",
  "Delhi University, Delhi",
  "Savitribai Phule Pune University, Pune",
  "College of Engineering Pune (COEP), Pune",
  "Veermata Jijabai Technological Institute (VJTI), Mumbai",
  "National Institute of Technology (NIT) Trichy",
  "Vellore Institute of Technology (VIT), Vellore",
  "Manipal Institute of Technology, Manipal",
  "Symbiosis International University, Pune",
  "Pune University, Pune",
  "Mumbai University, Mumbai",
  "Sharda University, Greater Noida",
  "Amity University, Noida",
  "Lovely Professional University (LPU), Phagwara",
  "Symbiosis Institute of Technology, Pune",
  "Nirma University, Ahmedabad",
  "RV College of Engineering, Bengaluru",
  "PES University, Bengaluru",
  "MS Ramaiah Institute of Technology, Bengaluru",
  "SRM Institute of Science and Technology, Chennai",
  "Kalinga Institute of Industrial Technology (KIIT), Bhubaneswar",
  "Thapar Institute of Engineering and Technology, Patiala",
  "PSG College of Technology, Coimbatore",
  "DA-IICT, Gandhinagar"
];

export const SCHOOL_SUGGESTIONS = [
  "Central Board of Secondary Education (CBSE)",
  "Indian Certificate of Secondary Education (ICSE)",
  "Maharashtra State Board of Secondary and Higher Secondary Education (MSBSHSE)",
  "Solapur High School, Solapur",
  "Little Flower Convent School, Solapur",
  "DAV Public School, Pune",
  "St. Xavier's High School, Mumbai",
  "Ryan International School, Mumbai",
  "Delhi Public School (DPS), Delhi",
  "Army Public School, Pune",
  "Kendriya Vidyalaya, Solapur",
  "Podar International School, Solapur",
  "Loyola High School, Pune",
  "The Bishop's School, Pune",
  "St. Vincent's High School, Pune",
  "Cathedral and John Connon School, Mumbai",
  "Dhirubhai Ambani International School, Mumbai",
  "The Doon School, Dehradun",
  "La Martiniere College, Lucknow"
];

interface AutocompleteInputProps {
  value: string;
  onChange: (val: string) => void;
  suggestions?: string[];
  type?: "school" | "college";
  placeholder?: string;
  className?: string;
  id?: string;
}

export function AutocompleteInput({
  value,
  onChange,
  suggestions = [],
  type,
  placeholder = "",
  className = "",
  id
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [suggestionsList, setSuggestionsList] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<any>(null);

  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setSuggestionsList([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    if (type) {
      // DYNAMIC FETCH MODE WITH DEBOUNCE
      setIsLoading(true);
      setIsOpen(true);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const response = await api.get(`/students/suggest-institutions`, {
            params: { q: value, type }
          });
          if (response.data && response.data.success) {
            setSuggestionsList(response.data.suggestions || []);
          }
        } catch (err) {
          console.error("Institution dynamic suggestions failed", err);
          // Safe client-side fallback matching
          const matched = suggestions.filter(item => 
            item.toLowerCase().includes(value.toLowerCase())
          ).slice(0, 8);
          setSuggestionsList(matched);
        } finally {
          setIsLoading(false);
        }
      }, 300);
    } else {
      // BACKWARDS COMPATIBLE STATIC FILTER MODE
      const valUpper = value.toUpperCase();
      const filtered = suggestions.filter(item => 
        item.toUpperCase().includes(valUpper)
      ).slice(0, 8);

      setSuggestionsList(filtered);
      setIsOpen(filtered.length > 0);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, type, suggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestionsList.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(prev => (prev + 1) % suggestionsList.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(prev => (prev - 1 + suggestionsList.length) % suggestionsList.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && activeIdx < suggestionsList.length) {
        onChange(suggestionsList[activeIdx]);
        setIsOpen(false);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const highLightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, "gi"));
    return (
      <span>
        {parts.map((part, index) => 
          part.toLowerCase() === query.toLowerCase() ? (
            <strong key={index} className="text-blue-600 font-extrabold">{part}</strong>
          ) : (
            <span key={index} className="font-normal text-slate-700">{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => {
          if (value && value.trim().length > 0) {
            setIsOpen(true);
          }
        }}
        onKeyDown={handleKeyDown}
        className={`w-full px-4 py-3 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`}
      />
      
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-[20px] shadow-2xl z-[99] max-h-60 overflow-y-auto divide-y divide-slate-50 border-t border-b border-l border-r border-slate-200">
          {isLoading && (
            <div className="px-4 py-3.5 text-[10px] uppercase font-black tracking-widest text-slate-450 flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-200 border-t-blue-500 animate-spin"></span>
              Searching all institutions across India...
            </div>
          )}
          
          {!isLoading && suggestionsList.length === 0 && (
            <div className="px-5 py-4 text-[10px] uppercase font-black tracking-widest text-slate-400">
              No exact matches. Keep typing to fetch from Indian directories...
            </div>
          )}

          {!isLoading && suggestionsList.map((item, idx) => (
            <div
              key={idx}
              onClick={() => {
                onChange(item);
                setIsOpen(false);
              }}
              onMouseEnter={() => setActiveIdx(idx)}
              className={`px-4 py-3.5 cursor-pointer text-xs transition-colors flex items-center justify-between text-left ${
                idx === activeIdx ? "bg-blue-50/70" : "bg-white hover:bg-slate-50"
              }`}
            >
              <span className="font-bold text-slate-800 block truncate leading-tight">
                {highLightText(item, value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const PREDEFINED_SKILLS = [
  // Technical skills
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "Spring Boot", "SQL", "MySQL", "MongoDB", "Docker", "Kubernetes", "AWS", "Azure", "Git", "HTML", "CSS", "Tailwind CSS", "FastAPI", "Express.js",
  // Communication skills
  "Communication", "Public Speaking", "Presentation", "Negotiation", "Business Writing", "Email Etiquette", "Client Communication",
  // Sales skills
  "Lead Generation", "CRM", "Cold Calling", "B2B Sales", "B2C Sales", "Inside Sales", "Field Sales", "Sales Strategy", "Customer Handling",
  // Finance skills
  "Accounting", "Tally", "GST", "Taxation", "Financial Analysis", "Excel", "Budgeting", "Auditing", "Payroll", "Investment Analysis",
  // Marketing skills
  "Digital Marketing", "SEO", "SEM", "Social Media Marketing", "Content Marketing", "Email Marketing", "Branding", "Market Research",
  // HR skills
  "Recruitment", "Screening", "Interviewing", "Onboarding", "HR Operations", "Employee Engagement",
  // Design skills
  "UI Design", "UX Design", "Figma", "Adobe XD", "Photoshop", "Illustrator", "Canva",
  // Operations skills
  "Operations Management", "Vendor Management", "Inventory Management", "MIS Reporting", "Process Improvement",
  // Data skills
  "Data Analysis", "Power BI", "Tableau", "Pandas", "NumPy", "Machine Learning", "Data Visualization",
  // Soft skills
  "Leadership", "Teamwork", "Problem Solving", "Critical Thinking", "Time Management", "Adaptability"
];
