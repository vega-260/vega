import { Briefcase, Code, GraduationCap, Layout, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { CustomSections } from "./TemplateShared.tsx";

export const DesignerBlackSidebarTemplate = ({ data, summary, photo }: any) => {
  const references = data?.references_json || [
    { name: "Ar. Samira Hadid", title: "Founder", company: "Thynk Unlimited", contact: "+123-456-7890" }
  ];
  return (
    <div id="resume-content" className="bg-white flex w-[210mm] min-h-[297mm] mx-auto shadow-sm overflow-hidden font-sans text-left">
      {/* Black Left Sidebar */}
      <div className="w-1/3 bg-slate-900 text-white p-8 flex flex-col justify-between shrink-0">
        <div className="space-y-10">
          <div className="text-center">
            {photo ? (
              <img src={photo} crossOrigin="anonymous" className="w-24 h-24 rounded-full border-4 border-slate-800 mx-auto mb-4 object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-full bg-slate-800 text-slate-100 flex items-center justify-center font-bold text-3xl mx-auto mb-4">
                {data?.full_name?.charAt(0) || "U"}
              </div>
            )}
            <h2 className="text-base font-black uppercase tracking-tight text-white leading-tight">{data?.full_name || "Applicant Name"}</h2>
            <p className="text-[9px] text-amber-400 font-extrabold uppercase tracking-[0.25em] mt-2">{data?.headline || "Creative Specialist"}</p>
          </div>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-800 pb-2 mb-4">Contact Details</h3>
            <div className="space-y-3 text-[10px] text-slate-350 font-medium font-mono">
              <p className="truncate">✉ {data?.email}</p>
              <p>☎ {data?.contact}</p>
              <p className="leading-tight">⌖ {data?.address}</p>
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-800 pb-2 mb-4">Education</h3>
            <div className="space-y-4">
              {(Array.isArray(data?.education_json) ? data.education_json : []).slice(0, 3).map((edu: any, i: number) => (
                <div key={i} className="text-[10px] text-slate-300 space-y-0.5">
                  <p className="font-extrabold text-white text-[11px]">{edu.level === 'Degree' ? 'Bachelors' : edu.level}</p>
                  <p className="font-bold text-slate-400 leading-tight">{edu.board || edu.school}</p>
                  <p className="font-mono text-amber-400 text-[9px] font-bold">{edu.year} (CGPA: {edu.cgpa || edu.percentage || edu.grade})</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-800 pb-2 mb-4">Expertise Set</h3>
            <div className="flex flex-wrap gap-1.5">
              {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                <span key={s} className="px-2 py-0.5 bg-slate-800 text-slate-300 border border-slate-700/50 rounded font-mono text-[9px] font-bold">
                  {s}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="pt-6 border-t border-slate-800 text-center text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">
          VEGA Design Catalog
        </div>
      </div>

      {/* Right Content */}
      <div className="flex-1 p-10 flex flex-col justify-between">
        <div className="space-y-10">
          <div>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight leading-none uppercase">{data?.full_name || "Applicant Name"}</h1>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mt-3">Portfolio Executive Summary</p>
          </div>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">01 / Profile</h3>
            <p className="text-xs leading-relaxed text-slate-600 font-medium italic">
              "{summary}"
            </p>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">02 / Experience</h3>
            <div className="space-y-6">
              {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between items-baseline font-bold text-slate-950 mb-1">
                    <span className="uppercase">{exp.company} — {exp.role}</span>
                    <span className="font-mono text-slate-450 text-[10px]">{exp.duration}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed font-sans">{exp.desc}</p>
                </div>
              ))}
              {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
                <p className="text-xs text-slate-400 italic">Pre-vetted engineering and design practitioner with structured academy level project capabilities.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">03 / Projects</h3>
            <div className="space-y-6">
              {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="text-xs">
                  <div className="flex justify-between items-baseline font-bold text-slate-950 mb-1">
                    <span className="uppercase font-black text-slate-800">{p.name}</span>
                    <span className="font-mono text-indigo-600 text-[9px] bg-slate-100 px-2 py-0.5 rounded">{p.tech_stack}</span>
                  </div>
                  <p className="text-slate-600 leading-relaxed mt-1 font-sans">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">Professional References</h3>
          <div className="grid grid-cols-2 gap-4">
            {references.slice(0, 2).map((ref: any, i: number) => (
              <div key={i} className="text-[10px] text-slate-500 font-medium">
                <p className="font-extrabold text-slate-800 leading-none">{ref.name}</p>
                <p className="text-[9px] text-slate-450 uppercase font-bold mt-1">{ref.title} @ {ref.company}</p>
                <p className="font-mono text-[9px] mt-0.5">{ref.contact}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const MedicalCareProfessionalTemplate = ({ data, summary }: any) => {
  const certifications = data?.certifications_json || [
    "Registered Professional Certificate - VEGA Verification",
    "Basic Life Support (BLS) - Active Recruiter Certification"
  ];
  return (
    <div id="resume-content" className="bg-white p-12 text-slate-800 font-sans leading-normal w-[210mm] min-h-[297mm] mx-auto shadow-sm text-left">
      {/* Top Header Bar */}
      <div className="bg-sky-650 text-white bg-sky-600 rounded-3xl p-8 mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center relative overflow-hidden gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-white">{data?.full_name || "Applicant Name"}</h1>
          <p className="text-xs font-black text-sky-100 uppercase tracking-widest mt-2">{data?.headline || "Licensed Nursing & Care Specialist"}</p>
        </div>
        <div className="text-xs font-mono text-sky-50 text-left sm:text-right space-y-1 sm:border-l border-sky-400/50 sm:pl-6 shrink-0 w-full sm:w-auto">
          <p>✉ {data?.email}</p>
          <p>☎ {data?.contact}</p>
          <p>⌖ {data?.address}</p>
        </div>
      </div>

      <div className="space-y-6">
        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#0369a1] bg-[#f0f9ff] px-4 py-1.5 rounded-xl inline-block mb-3">Clinical Profile</h3>
          <p className="text-xs leading-relaxed text-slate-650 font-medium font-sans">
            {summary}
          </p>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#0369a1] bg-[#f0f9ff] px-4 py-1.5 rounded-xl inline-block mb-4">Competency Directory</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">Core Clinical Expertise</span>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(data?.skills_json) ? data.skills_json : []).slice(0, 5).map((s: string) => (
                  <span key={s} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-lg">{s}</span>
                ))}
              </div>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] uppercase font-black text-slate-400 block mb-2">Patient Care Technologies</span>
              <div className="flex flex-wrap gap-1.5">
                <span className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-lg">Operating Syringe Pumps</span>
                <span className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-lg">Diagnostic Tools</span>
                <span className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold px-2.5 py-0.5 rounded-lg">Electronic Health Records</span>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#0369a1] bg-[#f0f9ff] px-4 py-1.5 rounded-xl inline-block mb-4">Professional History</h3>
          <div className="space-y-4">
            {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
              <div key={i} className="text-xs border-l-2 border-sky-500 pl-4 py-0.5">
                <div className="flex justify-between font-bold text-slate-905 mb-1">
                  <span>{exp.company} — {exp.role}</span>
                  <span className="font-mono text-slate-450 font-normal shrink-0">{exp.duration}</span>
                </div>
                <p className="text-slate-650 leading-relaxed font-sans">{exp.desc}</p>
              </div>
            ))}
            {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
              <p className="text-xs text-slate-450 italic pl-1">Internship candidate with certified rotation hours across departments including oncology, general medicine, and emergency care.</p>
            )}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#0369a1] bg-[#f0f9ff] px-4 py-1.5 rounded-xl inline-block mb-4">Academic Qualifications</h3>
          <div className="space-y-3">
            {(Array.isArray(data?.education_json) ? data.education_json : []).map((edu: any, i: number) => (
              <div key={i} className="flex justify-between items-baseline text-xs bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="font-bold text-slate-900">{edu.level === 'Degree' ? 'Bachelor of Science / Professional Degree' : edu.level}</span>
                  <p className="text-slate-500 leading-tight text-[11px] font-sans font-medium mt-1">{edu.board || edu.school}</p>
                </div>
                <div className="text-right font-mono text-[11px] font-semibold shrink-0">
                  <span className="text-sky-600 block">{edu.year}</span>
                  <span className="text-slate-400">Score: {edu.cgpa || edu.percentage || edu.grade}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-black uppercase tracking-widest text-[#0369a1] bg-[#f0f9ff] px-4 py-1.5 rounded-xl inline-block mb-3">Licensing & Certifications</h3>
          <ul className="list-disc pl-5 text-[11px] text-slate-600 font-medium space-y-1">
            {certifications.map((cert: string, idx: number) => (
              <li key={idx}>{cert}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export const TexturedSlateSerifTemplate = ({ data, summary }: any) => {
  return (
    <div id="resume-content" className="bg-slate-100 p-10 text-slate-900 font-serif leading-relaxed w-[210mm] min-h-[297mm] mx-auto shadow-sm flex flex-col gap-6 text-left">
      {/* Editorial Header */}
      <div className="bg-white rounded-3xl p-8 border border-slate-205/60 shadow-xs text-center">
        <h1 className="text-4xl font-extrabold text-slate-950 tracking-tight leading-none mb-3">{data?.full_name || "Applicant Name"}</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 font-sans">{data?.headline || "Communications & Business Strategy"}</p>
        <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] font-medium font-sans text-slate-500 mt-6 border-t border-slate-100 pt-4">
          <span>✉ {data?.email}</span>
          <span>☎ {data?.contact}</span>
          <span>⌖ {data?.address}</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1">
        {/* Left column */}
        <div className="col-span-12 md:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-205/60 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-405 font-sans mb-3">About Me</h3>
            <p className="text-[11px] leading-relaxed text-slate-600 font-sans">{summary}</p>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-205/60 shadow-xs">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-405 font-sans mb-4">Skills</h3>
            <div className="flex flex-wrap gap-1.5 font-sans">
              {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                <span key={s} className="bg-slate-50 text-slate-705 text-[10px] font-bold border border-slate-100 rounded-lg px-2.5 py-1">
                  {s}
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-205/60 shadow-xs space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-405 font-sans mb-2">Education</h3>
            {(Array.isArray(data?.education_json) ? data.education_json : []).slice(0, 3).map((edu: any, i: number) => (
              <div key={i} className="text-[11px] font-serif border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                <span className="text-slate-400 tracking-wider font-mono text-[9px] block">{edu.year}</span>
                <p className="font-extrabold text-slate-800">{edu.level === 'Degree' ? 'Bachelors' : edu.level}</p>
                <p className="text-slate-500 leading-tight text-[10px] font-sans mt-0.5">{edu.board || edu.school}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className="col-span-12 md:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-slate-205/60 shadow-xs space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-405 font-sans border-b border-slate-100 pb-3">Experiences</h3>
            <div className="space-y-6">
              {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                <div key={i} className="text-[11px]">
                  <div className="flex justify-between items-baseline mb-2 text-slate-900 font-extrabold">
                    <span className="uppercase text-xs font-black">{exp.company} — {exp.role}</span>
                    <span className="font-mono text-slate-400 text-[9px] font-bold shrink-0">{exp.duration}</span>
                  </div>
                  <p className="text-slate-655 font-sans leading-relaxed">{exp.desc}</p>
                </div>
              ))}
              {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
                <p className="text-xs text-slate-400 italic">Self-guided student developer with high technical readiness capabilities.</p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-slate-205/60 shadow-xs space-y-4 font-serif">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-405 font-sans border-b border-slate-100 pb-3">Selected Projects</h3>
            {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
              <div key={i} className="text-[11px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-black text-slate-900 uppercase font-sans tracking-tight">{p.name}</span>
                  <span className="text-[9px] font-bold font-mono text-slate-450 uppercase tracking-tighter">#{p.tech_stack}</span>
                </div>
                <p className="text-slate-610 font-sans leading-normal">{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const CreativePastelFrameTemplate = ({ data, summary, photo }: any) => {
  return (
    <div id="resume-content" className="bg-gradient-to-br from-pink-50 to-cyan-50 p-6 w-[210mm] min-h-[297mm] mx-auto shadow-sm flex flex-col gap-6 font-sans text-left">
      <div className="bg-white/85 backdrop-blur-md rounded-[32px] p-8 border border-white/60 shadow-lg flex-1 flex flex-col gap-6">
        {/* Top Split */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-slate-150 pb-6">
          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo} crossOrigin="anonymous" className="w-16 h-16 rounded-2xl border-2 border-pink-200 shadow-sm object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-400 to-indigo-500 text-white flex items-center justify-center font-bold text-2xl shadow-sm">
                {data?.full_name?.charAt(0) || "U"}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">{data?.full_name || "Applicant Name"}</h1>
              <p className="text-xs font-extrabold text-indigo-500 uppercase tracking-wider mt-2">{data?.headline || "UI/UX & Product Design Specialist"}</p>
            </div>
          </div>
          <div className="text-[10px] font-mono text-slate-500 space-y-0.5 text-left sm:text-right shrink-0">
            <p>✉ {data?.email}</p>
            <p>☎ {data?.contact}</p>
            <p>⌖ {data?.address}</p>
          </div>
        </div>

        {/* Profile */}
        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">01 / Profile</h3>
          <p className="text-xs font-semibold leading-relaxed text-slate-700 italic">
            "{summary}"
          </p>
        </section>

        {/* Two Equal Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
          {/* Left Column */}
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 mb-4">02 / Skills & Tools</h3>
              <div className="flex flex-wrap gap-1.5">
                {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                  <span key={s} className="px-3 py-1 bg-white border border-pink-100 text-slate-700 rounded-full text-[10px] font-extrabold shadow-sm">
                    {s}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 mb-4">03 / Education</h3>
              <div className="space-y-4">
                {(Array.isArray(data?.education_json) ? data.education_json : []).slice(0, 3).map((edu: any, i: number) => (
                  <div key={i} className="text-xs bg-white/50 p-4 rounded-2xl border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-mono text-indigo-550 font-black">{edu.year}</p>
                    <h4 className="font-extrabold text-slate-800 mt-1 uppercase">{edu.level === 'Degree' ? 'Bachelors Degree' : edu.level}</h4>
                    <p className="text-slate-500 text-[10px] font-medium leading-tight mt-0.5">{edu.board || edu.school}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">GPA Score: {edu.cgpa || edu.percentage || edu.grade}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 mb-4">04 / Experience</h3>
              <div className="space-y-4">
                {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                  <div key={i} className="text-xs bg-white/50 p-4 rounded-2xl border border-slate-100 shadow-sm font-sans">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-extrabold text-slate-850 uppercase tracking-tight">{exp.company}</h4>
                      <span className="font-mono text-slate-405 text-[9px] shrink-0">{exp.duration}</span>
                    </div>
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-wider mb-2">{exp.role}</p>
                    <p className="text-slate-600 leading-normal font-sans">{exp.desc}</p>
                  </div>
                ))}
                {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
                  <p className="text-xs text-slate-400 italic">No formal prior jobs recorded. Solid experience in hands-on design models.</p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b border-slate-100 pb-2 mb-4">05 / Projects</h3>
              <div className="space-y-3">
                {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                  <div key={i} className="text-xs font-sans">
                    <h5 className="font-extrabold text-slate-800 uppercase leading-snug">{p.name}</h5>
                    <p className="text-slate-550 leading-relaxed text-[11px] mt-1 font-sans">{p.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AsymmetricalWriterTemplate = ({ data, summary, photo }: any) => {
  return (
    <div id="resume-content" className="bg-white flex w-[210mm] min-h-[297mm] mx-auto shadow-sm overflow-hidden font-sans text-left">
      {/* Dark Navy Sidebar */}
      <div className="w-1/3 bg-[#1e272e] text-white p-8 space-y-8 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="text-center">
            {photo ? (
              <img src={photo} crossOrigin="anonymous" className="w-[110px] h-[110px] rounded-full border-4 border-slate-700/80 mx-auto object-cover" />
            ) : (
              <div className="w-[110px] h-[110px] rounded-full bg-slate-700 text-white flex items-center justify-center font-bold text-3xl mx-auto">
                {data?.full_name?.charAt(0) || "U"}
              </div>
            )}
            <h2 className="text-lg font-black uppercase tracking-tight text-white mt-4 leading-none">{data?.full_name || "Applicant Name"}</h2>
            <p className="text-[10px] text-cyan-400 font-extrabold uppercase tracking-widest mt-2">{data?.headline || "Content Specialist"}</p>
          </div>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400 border-b border-slate-700 pb-1 mb-3">About Me</h3>
            <p className="text-[11px] leading-relaxed text-slate-350 font-medium">{summary}</p>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400 border-b border-slate-700 pb-1 mb-3">Academics</h3>
            <div className="space-y-4">
              {(Array.isArray(data?.education_json) ? data.education_json : []).slice(0, 2).map((edu: any, i: number) => (
                <div key={i} className="text-[10px] text-slate-300">
                  <span className="font-bold text-white uppercase text-[11px] block">{edu.level === 'Degree' ? 'Bachelors' : edu.level}</span>
                  <span className="font-medium text-slate-400 leading-tight block mt-0.5">{edu.board || edu.school}</span>
                  <span className="font-mono text-cyan-400 text-[9px] font-bold block mt-1">{edu.year} | Grade: {edu.cgpa || edu.percentage || edu.grade}</span>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-400 border-b border-slate-700 pb-1 mb-3">Core Skills</h3>
            <div className="flex flex-wrap gap-1 font-sans">
              {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                <span key={s} className="px-2 py-0.5 bg-slate-800 text-slate-205 border border-slate-700 rounded font-mono text-[9px] font-bold">
                  {s}
                </span>
              ))}
            </div>
          </section>
        </div>

        <div className="text-[8px] font-black text-slate-500 uppercase tracking-widest text-center border-t border-slate-800 pt-4 leading-none">
          VEGA Registry File
        </div>
      </div>

      {/* Main Column */}
      <div className="flex-1 p-10 flex flex-col justify-between">
        <div className="space-y-10">
          <div>
            <span className="text-[9px] font-black text-cyan-600 uppercase tracking-widest bg-cyan-50 px-2.5 py-1 rounded">Resume Document</span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight uppercase mt-4 leading-none">{data?.full_name || "Applicant Name"}</h1>
          </div>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">Contact Info</h3>
            <div className="grid grid-cols-2 gap-4 text-xs font-sans font-medium text-slate-600">
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                <p className="text-slate-800 truncate font-semibold mt-0.5">{data?.email}</p>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                <p className="text-slate-800 font-semibold mt-0.5">{data?.contact}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Residential Location</p>
                <p className="text-slate-800 font-semibold mt-0.5">{data?.address}</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">Active Deployments</h3>
            <div className="space-y-6">
              {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                <div key={i} className="text-xs font-sans">
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="font-extrabold text-slate-850 uppercase tracking-tight">{exp.company}</h4>
                    <span className="font-mono text-slate-405 text-[9px] shrink-0">{exp.duration}</span>
                  </div>
                  <p className="text-[10px] text-cyan-600 font-black uppercase tracking-wider mb-2">{exp.role}</p>
                  <p className="text-slate-600 leading-relaxed font-sans">{exp.desc}</p>
                </div>
              ))}
              {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
                <p className="text-xs text-slate-450 italic">Dynamic fresher specialized in tech content development, keyword research, and copywriting.</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b-2 border-slate-900 pb-2 mb-4">Key Projects</h3>
            <div className="space-y-5">
              {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="text-xs font-sans">
                  <div className="flex justify-between items-baseline mb-1">
                    <h5 className="font-extrabold text-slate-855 uppercase font-sans">{p.name}</h5>
                    <span className="font-mono text-slate-400 text-[9px]">{p.tech_stack}</span>
                  </div>
                  <p className="text-slate-550 leading-relaxed text-[11px] font-sans">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
