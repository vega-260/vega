import { Briefcase, Code, GraduationCap, Layout, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { CustomSections } from "./TemplateShared.tsx";

export const HybridATSPremiumTemplate = ({ data, summary }: any) => (
  <div id="resume-content" className="bg-white p-12 text-slate-900 font-serif leading-normal w-[210mm] min-h-[297mm] mx-auto shadow-sm">
    <div className="text-center pb-4 mb-6 border-b border-slate-300">
      <h1 className="text-3xl font-bold uppercase tracking-tight mb-2 text-slate-900">{data.full_name}</h1>
      <div className="text-xs space-x-2 text-slate-700 font-mono">
        <span>{data.email}</span>
        <span>•</span>
        <span>{data.contact}</span>
        <span>•</span>
        <span>{data.address}</span>
      </div>
      <div className="text-xs flex justify-center gap-4 mt-2 font-mono text-indigo-800">
         {data.social_links_json?.linkedin && <a href={data.social_links_json.linkedin} className="underline" target="_blank" rel="noreferrer">LinkedIn</a>}
         {data.social_links_json?.github && <a href={data.social_links_json.github} className="underline" target="_blank" rel="noreferrer">GitHub</a>}
      </div>
    </div>

    <section className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2">Professional Summary</h3>
      <p className="text-xs leading-relaxed text-slate-800">{summary}</p>
    </section>

    <section className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2">Technical Skills</h3>
      <div className="grid grid-cols-1 gap-2 text-xs">
        <div>
          <span className="font-bold">Primary Skills: </span>
          {data.skills_json?.join(", ")}
        </div>
        <div>
          <span className="font-bold">Frameworks & Methodologies: </span>
          React, Node.js, Express, REST APIs, UI Design, Unit Testing
        </div>
        <div>
          <span className="font-bold">Databases & Tools: </span>
          MySQL, PostgreSQL, MongoDB, Git, Docker, Cloud Platforms
        </div>
      </div>
    </section>

    <section className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2">Professional Experience</h3>
      <div className="space-y-4 font-serif">
        {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
          <div key={i} className="text-xs">
            <div className="flex justify-between font-bold text-slate-900">
              <span>{exp.company} — {exp.role}</span>
              <span>{exp.duration}</span>
            </div>
            <p className="text-slate-700 leading-relaxed mt-1">{exp.desc}</p>
            <ul className="list-disc pl-5 mt-1 text-[11px] text-slate-805 space-y-0.5">
              <li>Utilized software engineering workflows to deliver performant full-stack modules.</li>
              <li>Collaborated within multi-disciplinary agile squads to optimize product execution SLAs by 15%.</li>
            </ul>
          </div>
        ))}
        {(!data.experience_json || data.experience_json.length === 0 || data.experience_type === 'FRESHER') && (
          <div className="text-xs text-slate-500 italic">
            Upcoming engineering specialist with strong project-driven research background. Practiced in modern continuous integration pipelines and automated testing schedules.
          </div>
        )}
      </div>
    </section>

    <section className="mb-6">
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2">Academic History</h3>
      <div className="space-y-3 font-serif">
        {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
          <div key={i} className="text-xs">
            <div className="flex justify-between font-bold text-slate-900">
              <span>{edu.level === 'Degree' ? edu.board : edu.school}</span>
              <span>{edu.year}</span>
            </div>
            <p>{edu.level === 'Degree' ? 'Bachelor of Technology' : edu.level} • Score Cumulative: {edu.percentage || edu.cgpa || edu.grade}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2">Technical Projects</h3>
      <div className="space-y-4 font-serif">
        {(Array.isArray(data?.projects_json) ? data.projects_json : []).map((p: any, i: number) => (
          <div key={i} className="text-xs">
             <div className="flex justify-between font-bold text-slate-900 mb-1">
                <span className="uppercase">{p.name}</span>
                <span className="font-mono text-[10px] text-indigo-700">{p.tech_stack}</span>
             </div>
             <p className="text-slate-700 leading-relaxed">{p.description}</p>
             <ul className="list-disc pl-5 mt-1 text-[11px] text-slate-805 space-y-0.5">
                <li>Architected full features using industry standards with comprehensive type checks.</li>
                <li>Pioneered responsive client-side layout adjustments ensuring cross-platform browser compatibility.</li>
             </ul>
          </div>
        ))}
      </div>
    </section>

    <CustomSections data={data} headingClass="text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-3 mt-6" bodyClass="text-xs text-slate-700 leading-relaxed whitespace-pre-line mt-1.5" />
  </div>
);

export const SiliconValleyTechTemplate = ({ data, summary }: any) => (
  <div id="resume-content" className="bg-white p-12 text-slate-900 font-sans leading-normal w-[210mm] min-h-[297mm] mx-auto shadow-sm">
    <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">{data.full_name}</h1>
        <p className="text-sm font-extrabold text-indigo-600 uppercase tracking-widest mt-1">Software Engineer Specialist</p>
      </div>
      <div className="text-right text-xs font-semibold text-slate-605 space-y-1">
         <p>{data.email}</p>
         <p>{data.contact}</p>
         <p>{data.address?.split(',').slice(-2).join(', ') || 'Remote / Eligible'}</p>
         <div className="flex justify-end gap-3 text-indigo-600 font-bold mt-1">
            {data.social_links_json?.linkedin && <a href={data.social_links_json.linkedin} className="hover:underline" target="_blank" rel="noreferrer">linkedin</a>}
            {data.social_links_json?.linkedin && data.social_links_json?.github && <span>•</span>}
            {data.social_links_json?.github && <a href={data.social_links_json.github} className="hover:underline" target="_blank" rel="noreferrer">github</a>}
         </div>
      </div>
    </div>

    <section className="mb-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5">01 / Summary</h3>
      <p className="text-xs leading-relaxed text-slate-700">{summary}</p>
    </section>

    <section className="mb-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5">02 / Technical Skills</h3>
      <div className="flex flex-wrap gap-2">
         {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
            <span key={s} className="px-2.5 py-1 bg-slate-100 text-slate-800 rounded font-mono text-[10px] font-bold border border-slate-200/50">
               {s}
            </span>
         ))}
         <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px] font-bold border border-indigo-100/50">System Architecture</span>
         <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px] font-bold border border-indigo-100/50">CI/CD Pipelines</span>
         <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded font-mono text-[10px] font-bold border border-indigo-100/50">Git Workflows</span>
      </div>
    </section>

    <section className="mb-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5">03 / Key Projects</h3>
      <div className="space-y-4">
         {(Array.isArray(data?.projects_json) ? data.projects_json : []).map((p: any, i: number) => (
            <div key={i}>
               <div className="flex justify-between items-baseline">
                  <h4 className="text-sm font-bold text-slate-900">{p.name}</h4>
                  <span className="text-[10px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">{p.tech_stack}</span>
               </div>
               <p className="text-xs text-slate-605 mt-1 leading-relaxed">{p.description}</p>
               <div className="grid grid-cols-2 gap-x-4 text-[10px] text-slate-500 mt-1.5 font-medium">
                  <div className="flex items-center gap-1.5">⚡ Optimized performance and reduced page rendering cycles by 30%.</div>
                  <div className="flex items-center gap-1.5">🛠️ Maintained 95%+ code coverage using comprehensive modern unit tests.</div>
               </div>
            </div>
         ))}
      </div>
    </section>

    <section className="mb-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5">04 / Experience</h3>
      <div className="space-y-4">
         {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
            <div key={i}>
               <div className="flex justify-between items-baseline font-bold text-slate-900 text-xs">
                  <span>{exp.company} — {exp.role}</span>
                  <span className="font-mono text-slate-500 font-normal">{exp.duration}</span>
               </div>
               <p className="text-xs text-slate-600 leading-relaxed mt-1">{exp.desc}</p>
            </div>
         ))}
         {(!data.experience_json || data.experience_json.length === 0 || data.experience_type === 'FRESHER') && (
            <div className="text-xs text-slate-500 italic">
               fresher software architect. Completed intensive bootcamps focused on distributed systems, enterprise databases, and clean code principles. Ready to contribute code immediately.
            </div>
         )}
      </div>
    </section>

    <section className="mb-6">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5">05 / Education</h3>
      <div className="space-y-3">
         {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
            <div key={i} className="flex justify-between items-baseline text-xs">
               <div>
                  <span className="font-bold text-slate-900">{edu.level === 'Degree' ? 'Bachelor of Technology in CS / IT' : edu.level}</span>
                  <span className="text-slate-500 text-[11px]"> ({edu.board || edu.school})</span>
               </div>
               <div className="text-right font-mono">
                  <span className="font-bold text-slate-800">{edu.year}</span>
                  <span className="text-slate-400"> | CGPA {edu.percentage || edu.cgpa || edu.grade}</span>
               </div>
            </div>
         ))}
      </div>
    </section>

    <CustomSections data={data} headingClass="text-xs font-black uppercase tracking-[0.2em] text-slate-450 border-b border-slate-200 pb-1 mb-2.5 mt-6" bodyClass="text-xs text-slate-705 leading-relaxed whitespace-pre-line mt-1.5" />
  </div>
);

const DYNAMIC_STYLE_CONFIGS: Record<string, any> = {
  "isabel-sales": {
    layout: "double-column",
    headerBg: "bg-slate-900 text-white rounded-xl py-3 px-4 mb-4",
    sectionTitleClass: "text-xs font-black bg-slate-800 text-white px-3 py-1 rounded uppercase tracking-wider mb-3",
    bulletStyle: "circle",
    accentColor: "slate-900"
  },
  "olivia-bba-marketing": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-blue-900 text-white p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-blue-900 tracking-wider border-b-2 border-blue-900/20 pb-1 mb-3",
    accentColor: "blue-900"
  },
  "olivia-marketing-projects": {
    layout: "clean-single-col",
    borderTop: "border-t-4 border-blue-600",
    sectionTitleClass: "text-xs font-black uppercase text-blue-900 tracking-wider pb-1 mb-3 border-b-2 border-blue-105",
    accentColor: "blue-600"
  },
  "aaron-stats-analyst": {
    layout: "clean-single-col",
    headerBg: "bg-sky-50 p-6 rounded-2xl border border-sky-101",
    sectionTitleClass: "text-xs font-bold text-sky-900 tracking-widest border-b-2 border-sky-200 pb-1 uppercase mb-3",
    accentColor: "sky-600"
  },
  "aaron-data-projects": {
    layout: "clean-single-col",
    borderLeft: "border-l-4 border-sky-500 pl-4",
    sectionTitleClass: "text-xs font-bold uppercase text-sky-800 tracking-widest pb-1 mb-4 border-b border-sky-100",
    accentColor: "sky-500"
  },
  "daniel-gallego-hr": {
    layout: "clean-single-col",
    fontFamily: "font-sans",
    borderTop: "border-t-4 border-amber-600",
    sectionTitleClass: "text-xs font-black uppercase tracking-widest text-amber-800 border-b border-amber-100 pb-1 mb-3",
    accentColor: "amber-600"
  },
  "daniel-hr-achievements": {
    layout: "double-column",
    sectionTitleClass: "text-xs font-black uppercase text-amber-900 border-b border-amber-205 pb-1 mb-3",
    accentColor: "amber-700"
  },
  "drew-business-consultant": {
    layout: "clean-single-col",
    headerBg: "bg-slate-50 border-b-2 border-slate-900 p-8",
    sectionTitleClass: "text-xs font-black uppercase text-slate-950 tracking-widest border-b border-slate-300 pb-1 mb-3",
    accentColor: "slate-900"
  },
  "drew-consultant-projects": {
    layout: "double-column",
    sectionTitleClass: "text-xs font-bold text-slate-900 uppercase border-b-2 border-slate-200 pb-1 mb-3",
    accentColor: "slate-800"
  },
  "noah-sales-expert": {
    layout: "clean-single-col",
    headerBg: "bg-amber-50/50 border-l-4 border-amber-500 p-6 rounded-r-xl",
    sectionTitleClass: "text-xs font-bold uppercase tracking-wider text-amber-700 border-b border-amber-200/50 pb-1 mb-3",
    accentColor: "amber-500"
  },
  "noah-sales-achievements": {
    layout: "clean-single-col",
    sectionTitleClass: "text-xs font-extrabold uppercase text-amber-900 border-b-2 border-amber-400 pb-1 mb-3",
    accentColor: "amber-600"
  },
  "dani-ux-designer": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-stone-900 text-stone-100 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black tracking-wider text-stone-900 border-b border-stone-200 pb-1 mb-3 uppercase",
    accentColor: "stone-900"
  },
  "korina-ux-designer": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-slate-100 text-slate-800 p-6 border-r border-slate-200",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black text-slate-900 border-b-2 border-indigo-600 pb-1 mb-3 uppercase",
    accentColor: "indigo-600"
  },
  "samira-it-security": {
    layout: "clean-single-col",
    borderTop: "border-t-8 border-indigo-500",
    headerBg: "bg-gradient-to-r from-indigo-50 to-indigo-100/30 p-6 rounded-b-2xl",
    sectionTitleClass: "text-xs font-extrabold text-indigo-900 border-b border-indigo-200 pb-1 uppercase tracking-wider mb-3",
    accentColor: "indigo-600"
  },
  "rufus-stewart-yellow": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-yellow-500 text-slate-950 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-slate-950 tracking-wider bg-yellow-105 px-3 py-1 rounded mb-3",
    accentColor: "yellow-500"
  },
  "rufus-stewart-cyan": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-cyan-500 text-slate-950 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-slate-950 tracking-wider bg-cyan-105 px-3 py-1 rounded mb-3",
    accentColor: "cyan-500"
  },
  "rufus-stewart-navy": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-indigo-950 text-white p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-indigo-100 tracking-wider bg-indigo-900/40 px-3 py-1 rounded mb-3",
    accentColor: "indigo-950"
  },
  "rufus-stewart-slate": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-slate-700 text-white p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-slate-900 tracking-wider bg-slate-100 px-3 py-1 rounded mb-3",
    accentColor: "slate-700"
  },
  "samira-hadid-border": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-stone-50 text-stone-800 p-6 border-r border-stone-100",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold text-stone-900 tracking-wide border-b border-stone-200 pb-1 uppercase mb-3",
    accentColor: "stone-700"
  },
  "olivia-wilson-manager": {
    layout: "split-sidebar-right",
    sidebarBg: "bg-slate-50 text-slate-800 p-6 border-l border-slate-100",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-extrabold text-slate-900 border-b border-slate-200 pb-1 uppercase mb-3",
    accentColor: "slate-800"
  },
  "olivia-sanchez": {
    layout: "clean-single-col",
    borderTop: "border-t-4 border-indigo-700",
    sectionTitleClass: "text-xs font-black bg-indigo-50 text-indigo-900 py-1.5 px-3 rounded uppercase mb-3",
    accentColor: "indigo-700"
  },
  "richard-sanchez-gray": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-zinc-850 text-zinc-100 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold uppercase tracking-wider text-zinc-900 border-b-2 border-zinc-200 pb-1 mb-3",
    accentColor: "zinc-800"
  },
  "olivia-wilson-orange": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-zinc-900 text-zinc-101 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black text-amber-500 border-b-2 border-amber-500 pb-1 uppercase tracking-widest mb-3",
    accentColor: "amber-500"
  },
  "samira-hadid-gm": {
    layout: "top-banner",
    bannerBg: "bg-teal-950 text-white p-8",
    sectionTitleClass: "text-xs font-black tracking-widest text-teal-950 border-b-2 border-teal-800/30 pb-1 uppercase mb-3",
    accentColor: "teal-950"
  },
  "hannah-morales-nurse": {
    layout: "clean-single-col",
    borderTop: "border-t-4 border-rose-500",
    sectionTitleClass: "text-xs font-extrabold text-rose-700 border-b border-rose-100 pb-1 uppercase mb-3",
    accentColor: "rose-500"
  },
  "hannah-morales-details": {
    layout: "double-column",
    sectionTitleClass: "text-xs font-black uppercase text-rose-900 border-b border-rose-200 pb-1 mb-3",
    accentColor: "rose-800"
  },
  "rachel-akinwale": {
    layout: "clean-single-col",
    background: "bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-3xl border border-blue-100",
    sectionTitleClass: "text-xs font-black bg-white rounded-xl shadow-sm border border-blue-50 px-4 py-2 uppercase text-blue-900 mb-3",
    accentColor: "blue-800"
  },
  "helene-paquet": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-orange-50 text-orange-950 p-6 border-r border-orange-100",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold text-orange-900 border-b-2 border-orange-400 pb-1 uppercase tracking-wider mb-3",
    accentColor: "orange-500"
  },
  "brigitte-schwartz": {
    layout: "top-banner",
    bannerBg: "bg-cyan-50 border-b-2 border-cyan-100 p-8 text-cyan-950",
    sectionTitleClass: "text-xs font-bold text-cyan-900 uppercase tracking-widest border-b border-cyan-200 pb-1 mb-3",
    accentColor: "cyan-600"
  },
  "estelle-darcy": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-stone-100 text-stone-950 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold text-stone-900 uppercase tracking-widest mb-3 border-b-2 border-stone-300 pb-1",
    accentColor: "stone-800"
  },
  "richard-sanchez-gold": {
    layout: "top-banner",
    bannerBg: "bg-amber-950 text-amber-50 p-8",
    sectionTitleClass: "text-xs font-black text-amber-900 border-b border-amber-200 pb-1 mb-3 uppercase tracking-wider",
    accentColor: "amber-800"
  },
  "richard-sanchez-teal": {
    layout: "top-banner",
    bannerBg: "bg-teal-900 text-teal-50 p-8",
    sectionTitleClass: "text-xs font-black text-teal-800 border-b border-teal-200 pb-1 mb-3 uppercase tracking-wider",
    accentColor: "teal-700"
  },
  "donna-stroupe": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-zinc-800 text-zinc-100 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-extrabold uppercase text-indigo-600 tracking-wider mb-3 border-b-2 border-indigo-200 pb-1",
    accentColor: "indigo-600"
  },
  "lorna-villanueva": {
    layout: "top-banner",
    bannerBg: "bg-blue-600 text-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-blue-900 border-b border-blue-200 pb-1 mb-3",
    accentColor: "blue-600"
  },
  "dani-martinez-marketing": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-slate-800 text-slate-100 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold text-slate-800 border-b-2 border-slate-800 pb-1 mb-3 uppercase",
    accentColor: "slate-800"
  },
  "devi-chaudhry": {
    layout: "clean-single-col",
    background: "bg-stone-50 border-8 border-double border-amber-800 p-8",
    sectionTitleClass: "text-xs font-serif font-black tracking-widest text-amber-800 border-b border-amber-850 pb-1 uppercase mb-3",
    accentColor: "amber-800"
  },
  "anna-katrina-preschool": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-rose-50 text-slate-800 p-6 border-r border-rose-100",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-extrabold text-rose-800 uppercase tracking-widest mb-3 bg-rose-100 text-rose-900 rounded-lg px-2.5 py-1",
    accentColor: "rose-600"
  },
  "samira-hadid-navy": {
    layout: "top-banner",
    bannerBg: "bg-indigo-950 text-white p-8",
    sectionTitleClass: "text-xs font-black uppercase tracking-widest text-indigo-950 border-b-2 border-amber-400 pb-1 mb-3",
    accentColor: "indigo-950"
  },
  "sacha-dubois": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-slate-900 text-white p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black text-slate-900 border-b-2 border-slate-900 pb-1 mb-3 uppercase",
    accentColor: "slate-900"
  },
  "estela-dominguez": {
    layout: "split-sidebar-right",
    sidebarBg: "bg-emerald-50 text-emerald-950 p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-black uppercase text-emerald-900 border-b border-emerald-200 pb-1 mb-3",
    accentColor: "emerald-800"
  },
  "ricardo-soto": {
    layout: "split-sidebar-left",
    sidebarBg: "bg-indigo-600 text-white p-6",
    mainBg: "bg-white p-8",
    sectionTitleClass: "text-xs font-bold text-indigo-900 border-b border-indigo-200 pb-1 mb-3 uppercase",
    accentColor: "indigo-600"
  },
  "maanvita-kumari-designer": {
    layout: "clean-single-col",
    borderLeft: "border-l-4 border-slate-900 pl-4",
    sectionTitleClass: "text-xs font-extrabold text-slate-950 border-b border-slate-200 pb-1 mb-3 uppercase",
    accentColor: "slate-900"
  },
  "isabel-schumacher-sales": {
    layout: "double-column",
    sectionTitleClass: "text-xs font-black text-slate-800 border-b-2 border-slate-300 pb-1 mb-3 uppercase",
    accentColor: "slate-800"
  },
  "greta-manager": {
    layout: "clean-single-col",
    headerBg: "bg-stone-50 p-8 border-b-4 border-stone-800",
    sectionTitleClass: "text-xs font-black text-stone-900 uppercase tracking-widest mb-3 border-b border-stone-300 pb-1",
    accentColor: "stone-800"
  },
  "olivia-wilson-thai": {
    layout: "clean-single-col",
    background: "bg-gradient-to-tr from-sky-50 via-pink-50 to-teal-50 p-8 rounded-3xl",
    sectionTitleClass: "text-xs font-extrabold text-sky-950 border-b-2 border-sky-300 pb-1 mb-3 uppercase",
    accentColor: "sky-600"
  },
  "adora-montini": {
    layout: "clean-single-col",
    background: "bg-[#faf8f5] p-8 border border-stone-200 rounded-3xl shadow-sm",
    sectionTitleClass: "text-xs font-serif font-black tracking-widest text-[#8a7258] border-b border-[#8a7258]/35 pb-1 uppercase mb-3",
    accentColor: "stone-700"
  },
  "kumberry-ngian": {
    layout: "clean-single-col",
    background: "bg-[#fffaf0] p-8 border-2 border-orange-200 rounded-2xl",
    sectionTitleClass: "text-xs font-black text-orange-600 tracking-wider uppercase border-b-2 border-orange-100 pb-1 mb-3",
    accentColor: "orange-600"
  },
  "creative-pastel-frame": {
    layout: "double-column",
    background: "bg-gradient-to-br from-pink-50 to-cyan-50 p-8 rounded-3xl border border-pink-100",
    sectionTitleClass: "text-xs font-black text-pink-700 uppercase bg-white/70 px-3 py-1 rounded inline-block mb-3",
    accentColor: "pink-600"
  }
};

export const DynamicTemplate = ({ id, data, summary, photo }: any) => {
  const config = DYNAMIC_STYLE_CONFIGS[id] || {
    layout: "clean-single-col",
    sectionTitleClass: "text-xs font-black uppercase tracking-wider text-slate-800 border-b-2 border-slate-200 pb-1 mb-3",
    accentColor: "slate-800"
  };

  const renderContactInfo = () => (
    <div className="text-[10px] space-y-1 text-slate-500 font-medium font-mono">
      <p className="flex items-center gap-1">📞 {data.contact}</p>
      <p className="flex items-center gap-1">✉️ {data.email}</p>
      <p className="flex items-center gap-1">📍 {data.address || "123 Anywhere St., Any City"}</p>
      {data.social_links_json?.linkedin && <p className="flex items-center gap-1">🔗 {data.social_links_json.linkedin}</p>}
      {data.social_links_json?.github && <p className="flex items-center gap-1">💻 {data.social_links_json.github}</p>}
    </div>
  );

  const renderSummary = () => (
    <section className="mb-5 last:mb-0">
      <h3 className={config.sectionTitleClass}>About Me / Profile</h3>
      <p className="text-xs text-slate-600 leading-relaxed italic pr-2">{summary || data.bio}</p>
    </section>
  );

  const renderSkills = () => (
    <section className="mb-5 last:mb-0">
      <h3 className={config.sectionTitleClass}>Skills & Expertise</h3>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((skill: any, i: number) => {
          const name = typeof skill === 'string' ? skill : (skill.name || skill);
          return (
            <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-800 text-[10px] font-bold rounded border border-slate-150 uppercase tracking-tight">
              {name}
            </span>
          );
        })}
      </div>
    </section>
  );

  const renderProjects = () => (
    <section className="mb-5 last:mb-0">
      <h3 className={config.sectionTitleClass}>Key Projects</h3>
      <div className="space-y-3">
        {(Array.isArray(data?.projects_json) ? data.projects_json : []).map((p: any, i: number) => (
          <div key={i} className="group">
            <div className="flex justify-between items-baseline font-bold text-slate-900 text-xs">
              <h4 className="uppercase tracking-tight">{p.name || p.title}</h4>
              <span className="text-[9px] font-mono text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.2 rounded font-bold uppercase">{p.tech_stack || p.stack}</span>
            </div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{p.description || p.desc}</p>
          </div>
        ))}
        {(!data.projects_json || data.projects_json.length === 0) && (
          <p className="text-[11px] text-slate-400 italic">Project records updated dynamically via editor panel.</p>
        )}
      </div>
    </section>
  );

  const renderExperience = () => (
    <section className="mb-5 last:mb-0">
      <h3 className={config.sectionTitleClass}>Work Experience</h3>
      <div className="space-y-3">
        {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
          <div key={i}>
            <div className="flex justify-between items-baseline font-bold text-slate-900 text-xs">
              <span className="uppercase tracking-tight">{exp.role} @ {exp.company}</span>
              <span className="font-mono text-[10px] text-slate-500 font-medium">{exp.duration}</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed mt-1">{exp.desc || exp.description}</p>
          </div>
        ))}
        {(!data.experience_json || data.experience_json.length === 0 || data.experience_type === 'FRESHER') && (
          <div className="text-[11px] text-slate-500 italic leading-relaxed">
            Fresher ready to execute core development duties. Highly skilled in frontend framework patterns, API state matching, and unit test compilation.
          </div>
        )}
      </div>
    </section>
  );

  const renderEducation = () => (
    <section className="mb-5 last:mb-0">
      <h3 className={config.sectionTitleClass}>Education & Training</h3>
      <div className="space-y-2">
        {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
          <div key={i} className="flex justify-between items-baseline text-xs">
            <div>
              <span className="font-extrabold text-slate-900 uppercase tracking-tight text-[11px]">{edu.level === 'Degree' ? 'Bachelor of Technology' : edu.level}</span>
              <span className="text-slate-500 text-[10px] font-medium font-mono"> ({edu.board || edu.school})</span>
            </div>
            <div className="text-right font-mono text-[10px] text-slate-700 font-bold">
              <span>{edu.year}</span>
              <span className="text-slate-400 font-normal"> | CGPA {edu.percentage || edu.cgpa || edu.grade || "8.5"}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <div 
      id="resume-content" 
      className={`bg-white p-12 text-slate-800 leading-relaxed w-[210mm] min-h-[297mm] mx-auto shadow-sm relative overflow-hidden font-sans border border-slate-100 ${config.background || ""}`}
    >
      {id.includes("orange") && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500 opacity-20 rounded-bl-full pointer-events-none" />
      )}
      {id.includes("cyan") && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500 opacity-20 rounded-bl-full pointer-events-none" />
      )}

      {config.layout === "split-sidebar-left" && (
        <div className="flex h-full gap-8">
          <div className={`w-[200px] shrink-0 rounded-2xl flex flex-col justify-between ${config.sidebarBg || "bg-slate-50"} p-5 min-h-[265mm]`}>
            <div className="space-y-6">
              <div className="space-y-4">
                {photo ? (
                  <img src={photo} crossOrigin="anonymous" className="w-28 h-28 rounded-full border-4 border-white shadow-md object-cover mx-auto" />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-slate-300 flex items-center justify-center font-bold text-slate-600 mx-auto text-xl uppercase">{data.full_name?.substring(0, 2)}</div>
                )}
                <div className="text-center">
                  <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase leading-tight">{data.full_name}</h1>
                  <p className="text-[10px] text-indigo-600 font-bold uppercase tracking-widest mt-1">{data.experience_type || "PROFESSIONAL"}</p>
                </div>
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">My Contact</h4>
                {renderContactInfo()}
              </div>

              <div className="border-t border-slate-200 pt-4">
                {renderSkills()}
              </div>
            </div>
            
            <div className="text-[9px] text-slate-400 text-center border-t border-slate-200 pt-3">
              Standard layout verified • Page 1 of 1
            </div>
          </div>

          <div className="flex-1 space-y-5">
            {renderSummary()}
            {renderExperience()}
            {renderProjects()}
            {renderEducation()}
            <CustomSections data={data} headingClass={config.sectionTitleClass} bodyClass="text-xs text-slate-705 leading-relaxed whitespace-pre-line mt-1.5" />
          </div>
        </div>
      )}

      {config.layout === "split-sidebar-right" && (
        <div className="flex h-full gap-8">
          <div className="flex-1 space-y-5">
            <div className="flex justify-between items-start pb-4 border-b border-slate-100">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900 leading-none">{data.full_name}</h1>
                <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest mt-1.5">{data.experience_type || "EXECUTIVE"}</p>
              </div>
              {photo && (
                <img src={photo} crossOrigin="anonymous" className="w-20 h-20 rounded shadow-md object-cover" />
              )}
            </div>
            {renderSummary()}
            {renderExperience()}
            {renderProjects()}
            {renderEducation()}
            <CustomSections data={data} headingClass={config.sectionTitleClass} bodyClass="text-xs text-slate-705 leading-relaxed whitespace-pre-line mt-1.5" />
          </div>

          <div className={`w-[200px] shrink-0 rounded-2xl flex flex-col justify-between ${config.sidebarBg || "bg-slate-50"} p-5 min-h-[265mm]`}>
            <div className="space-y-6">
              <div>
                <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">My Contact</h4>
                {renderContactInfo()}
              </div>
              
              <div className="border-t border-slate-200 pt-4">
                {renderSkills()}
              </div>
            </div>
          </div>
        </div>
      )}

      {config.layout === "double-column" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center pb-5 border-b-2 border-slate-300">
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-950">{data.full_name}</h1>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{data.experience_type || "EXECUTIVE"}</p>
            </div>
            <div className="flex items-center gap-4">
              {renderContactInfo()}
              {photo && <img src={photo} crossOrigin="anonymous" className="w-16 h-16 rounded-xl object-cover border border-slate-200 shadow-sm" />}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              {renderSummary()}
              {renderSkills()}
              {renderEducation()}
            </div>
            <div className="space-y-5">
              {renderExperience()}
              {renderProjects()}
              <CustomSections data={data} headingClass={config.sectionTitleClass} bodyClass="text-xs text-slate-750 leading-relaxed whitespace-pre-line mt-1.5" />
            </div>
          </div>
        </div>
      )}

      {config.layout === "top-banner" && (
        <div className="space-y-6">
          <div className={`rounded-2xl ${config.bannerBg || "bg-slate-900 text-white"} p-6 flex justify-between items-center relative overflow-hidden shadow-sm`}>
            <div>
              <h1 className="text-3xl font-black tracking-tight uppercase leading-none">{data.full_name}</h1>
              <p className="text-xs font-bold opacity-80 uppercase tracking-widest mt-1.5">{data.experience_type || "PROFESSIONAL"}</p>
              <div className="flex gap-4 mt-3 opacity-90 text-[10px] font-mono">
                <span>📞 {data.contact}</span>
                <span>✉️ {data.email}</span>
                <span>📍 {data.address || "123 Anywhere, Any City"}</span>
              </div>
            </div>
            {photo && (
              <img src={photo} crossOrigin="anonymous" className="w-16 h-16 rounded-xl border-2 border-white/40 shadow-md object-cover relative z-10" />
            )}
          </div>

          {renderSummary()}
          
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {renderExperience()}
              {renderProjects()}
              <CustomSections data={data} headingClass={config.sectionTitleClass} bodyClass="text-xs text-slate-705 leading-relaxed whitespace-pre-line mt-1.5" />
            </div>
            <div className="space-y-5">
              {renderSkills()}
              {renderEducation()}
            </div>
          </div>
        </div>
      )}

      {config.layout === "clean-single-col" && (
        <div className="space-y-5">
          <div className={`pb-5 border-b border-slate-100 flex justify-between items-start ${config.headerBg || ""}`}>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">{data.full_name}</h1>
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-widest mt-1">{data.experience_type || "ENGINEER"}</p>
            </div>
            <div className="flex items-center gap-4">
              {renderContactInfo()}
              {photo && <img src={photo} crossOrigin="anonymous" className="w-16 h-16 rounded-xl border shadow-sm object-cover" />}
            </div>
          </div>

          {renderSummary()}
          {renderExperience()}
          {renderProjects()}
          
          <div className="grid grid-cols-2 gap-6">
            {renderSkills()}
            {renderEducation()}
          </div>
          <CustomSections data={data} headingClass={config.sectionTitleClass} bodyClass="text-xs text-slate-705 leading-relaxed whitespace-pre-line mt-1.5" />
        </div>
      )}
    </div>
  );
};
