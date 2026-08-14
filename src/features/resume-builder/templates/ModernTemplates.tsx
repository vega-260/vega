import { Briefcase, Code, GraduationCap, Layout, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { CustomSections } from "./TemplateShared.tsx";

export const TechnicalEliteTemplate = ({ data, summary, photo }: any) => (
   <div id="resume-content" className="bg-[#FAFAFA] w-[210mm] min-h-[297mm] mx-auto shadow-sm font-mono text-[#2D3436] p-10">
      <div className="bg-white border-2 border-slate-900 rounded-[40px] overflow-hidden flex flex-col min-h-[calc(297mm-80px)]">
         <header className="bg-slate-900 text-emerald-400 p-10 flex justify-between items-center">
            <div>
               <h2 className="text-xs font-black tracking-[0.5em] uppercase mb-4 opacity-70">Resident Specialist</h2>
               <h1 className="text-4xl font-black tracking-tight uppercase">{data.full_name}</h1>
               <div className="mt-6 flex gap-6 text-[10px] font-bold">
                  <span>/ {data.email}</span>
                  <span>/ {data.contact}</span>
               </div>
            </div>
            {photo && <img src={photo} crossOrigin="anonymous" className="w-24 h-24 rounded-2xl border-2 border-emerald-400 grayscale contrast-125 hover:grayscale-0 transition-all cursor-crosshair object-cover" />}
         </header>

         <div className="flex-1 flex">
            {/* Sidebar */}
            <aside className="w-1/3 border-r-2 border-slate-900 p-10 space-y-12">
               <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Stack.config</h4>
                  <div className="space-y-4">
                     {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                        <div key={s} className="flex flex-col gap-1">
                           <span className="text-[10px] uppercase font-bold">{s}</span>
                           <div className="flex gap-1">
                              {[1,2,3,4,5].map(v => (
                                 <div key={v} className={`w-3 h-3 rounded-sm ${v <= 4 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]' : 'bg-slate-100'}`} />
                              ))}
                           </div>
                        </div>
                     ))}
                  </div>
               </section>

               <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-6">Info.sys</h4>
                  <div className="space-y-4 text-[11px] font-bold">
                     <div>
                        <p className="text-slate-400 uppercase text-[9px] mb-1">Status</p>
                        <p className="uppercase">Available for Hire</p>
                     </div>
                     <div>
                        <p className="text-slate-400 uppercase text-[9px] mb-1">Education</p>
                        <ul className="space-y-2">
                           {(Array.isArray(data?.education_json) ? data.education_json : []).slice(0, 2).map((edu: any, i: number) => (
                              <li key={i} className="uppercase leading-tight">{edu.board || edu.school} <br /><span className="text-emerald-500">[{edu.year}]</span></li>
                           ))}
                        </ul>
                     </div>
                  </div>
               </section>
            </aside>

            {/* Main */}
            <main className="flex-1 p-10 space-y-12">
               <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 px-4 py-1 bg-slate-100 rounded inline-block">Profile.log</h4>
                  <p className="text-xs font-bold leading-relaxed text-slate-500 italic">
                     {summary}
                  </p>
               </section>

               <section>
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-6 px-4 py-1 bg-slate-100 rounded inline-block">Deployments.active</h4>
                  <div className="space-y-8">
                     {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                        <div key={i} className="relative pl-6 border-l-2 border-emerald-400">
                           <h5 className="text-[11px] font-black uppercase mb-2">{p.name}</h5>
                           <p className="text-[11px] font-bold text-slate-500 leading-relaxed mb-3">{p.description}</p>
                           <div className="text-[9px] font-black text-emerald-600 bg-emerald-50 inline-block px-2 py-0.5 rounded uppercase">{p.tech_stack}</div>
                        </div>
                     ))}
                  </div>
               </section>
            </main>
         </div>

         <footer className="bg-slate-50 p-6 flex justify-between items-center text-[9px] font-black uppercase tracking-widest border-t-2 border-slate-900">
            <span>Verified VEGA Artifact</span>
            <span>Generated: {new Date().toLocaleDateString()}</span>
            <span>Ref: {data.user_id}-ELITE</span>
         </footer>
      </div>
   </div>
);


export const ModernProTemplate = ({ data, summary, photo }: any) => (
  <div id="resume-content" className="bg-white flex w-[210mm] min-h-[297mm] mx-auto shadow-sm overflow-hidden font-sans">
    {/* Left Sidebar */}
    <div className="w-1/3 bg-slate-900 text-white p-8 space-y-10">
      <div className="text-center">
        {photo && (
          <img src={photo} crossOrigin="anonymous" className="w-32 h-32 rounded-3xl border-4 border-slate-800 mx-auto mb-4 object-cover" />
        )}
        <h2 className="text-lg font-black uppercase tracking-tight">{data.full_name}</h2>
        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mt-1">Aspiring Professional</p>
      </div>

      <section>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Contact</h3>
        <div className="space-y-3 text-[10px]">
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center shrink-0">
                <Mail size={12} className="text-blue-400" />
             </div>
             <span className="truncate">{data.email}</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center shrink-0">
                <Phone size={12} className="text-blue-400" />
             </div>
             <span>{data.contact}</span>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-6 h-6 bg-slate-800 rounded flex items-center justify-center shrink-0">
                <MapPin size={12} className="text-blue-400" />
             </div>
             <span>{data.address}</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Skills</h3>
        <div className="flex flex-wrap gap-2">
          {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
            <span key={s} className="px-2 py-1 bg-slate-800 rounded text-[9px] font-bold">{s}</span>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Certificates</h3>
        <div className="space-y-3">
           <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-800 text-[9px]">
              <p className="font-bold text-blue-300">VEGA AI Certified</p>
              <p className="text-slate-500 mt-1">Verification Code: TB-{data.user_id}</p>
           </div>
        </div>
      </section>
    </div>

    {/* Right Content */}
    <div className="flex-1 p-12 space-y-10">
      <section>
        <div className="flex items-center gap-3 mb-4">
           <Sparkles size={16} className="text-blue-600" />
           <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Professional Summary</h3>
        </div>
        <p className="text-xs leading-relaxed text-slate-700 font-medium italic">
          "{summary}"
        </p>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
           <GraduationCap size={16} className="text-blue-600" />
           <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Education</h3>
        </div>
        <div className="space-y-6">
          {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
            <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-2 before:w-2 before:h-2 before:bg-blue-600 before:rounded-full">
              <div className="flex justify-between items-start mb-1">
                <h4 className="text-[11px] font-black uppercase">{edu.level === 'Degree' ? edu.board : edu.school}</h4>
                <span className="text-[9px] font-black text-slate-400 px-2 py-0.5 bg-slate-50 border border-slate-100 rounded">{edu.year}</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold uppercase">{edu.level} • Score: {edu.percentage || edu.cgpa || edu.grade}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-3 mb-6">
           <Code size={16} className="text-blue-600" />
           <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Projects & Experience</h3>
        </div>
        <div className="space-y-6">
          {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
            <div key={i} className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
               <h4 className="text-[11px] font-black uppercase mb-2 text-blue-600">{p.name}</h4>
               <p className="text-[10px] text-slate-600 leading-relaxed mb-3">{p.description}</p>
               <div className="flex flex-wrap gap-2">
                 {p.tech_stack?.split(',').map((t: string) => (
                   <span key={t} className="text-[8px] font-black bg-white px-2 py-0.5 rounded border border-slate-200 uppercase text-slate-400">{t.trim()}</span>
                 ))}
               </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </div>
);

export const CreativeMinTemplate = ({ data, summary, photo }: any) => (
  <div id="resume-content" className="bg-slate-50 p-12 w-[210mm] min-h-[297mm] mx-auto shadow-sm font-sans flex flex-col gap-8">
     {/* Header Card */}
     <div className="bg-white rounded-[40px] p-10 flex items-center justify-between shadow-sm border border-slate-100">
        <div>
           <h1 className="text-5xl font-black tracking-tighter text-slate-900 mb-2">{data.full_name?.split(' ')[0]}<br /><span className="text-indigo-600">{data.full_name?.split(' ')[1] || ''}</span></h1>
           <div className="flex items-center gap-4 mt-6">
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{data.email}</p>
              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{data.contact}</p>
           </div>
        </div>
        {photo && (
          <div className="relative group">
             <div className="absolute inset-0 bg-indigo-600 rounded-[35px] rotate-6 group-hover:rotate-0 transition-transform duration-500 shadow-xl shadow-indigo-200" />
             <img src={photo} crossOrigin="anonymous" className="relative w-36 h-36 rounded-[35px] object-cover border-4 border-white grayscale hover:grayscale-0 transition-all duration-500" />
          </div>
        )}
     </div>

     {/* Summary Card */}
     <div className="bg-indigo-600 text-white rounded-[40px] p-10 shadow-xl shadow-indigo-200">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-200 mb-4">Professional Insight</h3>
        <p className="text-xl font-medium leading-relaxed tracking-tight italic">
          "{summary}"
        </p>
     </div>

     {/* Bottom Grid */}
     <div className="grid grid-cols-2 gap-8 flex-1">
        <div className="space-y-8">
           <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <Layout size={16} className="text-indigo-600" /> Key Projects
              </h3>
              <div className="space-y-6">
                 {(Array.isArray(data?.projects_json) ? data.projects_json : []).map((p: any, i: number) => (
                   <div key={i}>
                      <p className="text-xs font-black text-slate-800 mb-2">{p.name}</p>
                      <p className="text-[10px] text-slate-500 leading-relaxed">{p.description}</p>
                   </div>
                 ))}
              </div>
           </section>

           <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <Code size={16} className="text-indigo-600" /> Expert Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                 {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                   <span key={s} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">
                      {s}
                   </span>
                 ))}
              </div>
           </section>
        </div>

        <div className="space-y-8">
            <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                 <GraduationCap size={16} className="text-indigo-600" /> Background
              </h3>
              <div className="space-y-6">
                  {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
                    <div key={i} className="flex gap-4">
                       <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100">
                          {edu.year % 100}
                       </div>
                       <div>
                          <p className="text-xs font-black text-slate-800">{edu.level === 'Degree' ? 'Bachelors Degree' : edu.level}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight truncate max-w-[150px]">{edu.level === 'Degree' ? edu.board : edu.school}</p>
                       </div>
                    </div>
                  ))}
              </div>
            </section>

            <section className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-100 flex-1 flex flex-col justify-center items-center text-center">
               <div className="w-16 h-16 bg-slate-50 rounded-[20px] flex items-center justify-center mb-4">
                  <Briefcase size={24} className="text-indigo-200" />
               </div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Connect</p>
               <p className="text-xs font-bold text-slate-800 mt-1">{data.email}</p>
               <p className="text-[9px] text-indigo-600 font-bold mt-4 uppercase tracking-tighter">TB ID: #{data.user_id}</p>
            </section>
        </div>
     </div>
  </div>
);

export const MarketerGoldTimelineTemplate = ({ data, summary, photo }: any) => {
  const languages = data?.languages_json || ["English (Fluent)", "Spanish (Conversational)", "Hindi (Native)"];
  const references = data?.references_json || [
    { name: "Estelle Darcy", title: "Wardiere Inc. / CEO", company: "Wardiere Inc.", contact: "+123-456-7890" },
    { name: "Harper Russo", title: "Wardiere Inc. / CEO", company: "Wardiere Inc.", contact: "+123-456-7890" }
  ];
  return (
    <div id="resume-content" className="bg-[#fbfcfa] p-12 text-slate-800 font-sans leading-normal w-[210mm] min-h-[297mm] mx-auto shadow-sm relative overflow-hidden text-left">
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.04] rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-500/[0.02] rounded-full blur-3xl pointer-events-none" />

      {/* Header Band */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-4 border-slate-900 pb-6 mb-8 gap-4">
        <div className="flex items-center gap-4">
          {photo ? (
            <img src={photo} crossOrigin="anonymous" className="w-20 h-20 rounded-full border-4 border-amber-400 rotate-[-3deg] hover:rotate-0 transition-transform duration-300 shadow-md object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-3xl shadow-md">
              {data?.full_name?.charAt(0) || "U"}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black uppercase text-slate-900 tracking-tight leading-none">{data?.full_name || "Applicant Name"}</h1>
            <p className="text-xs font-black text-amber-500 uppercase tracking-widest mt-2">{data?.headline || "Product & Marketing Specialist"}</p>
          </div>
        </div>
        <div className="text-xs space-y-1 text-slate-600 font-medium font-mono text-left sm:text-right w-full sm:w-auto">
          <p className="flex items-center sm:justify-end gap-1"><span className="text-amber-500">■</span> {data?.email}</p>
          <p className="flex items-center sm:justify-end gap-1"><span className="text-amber-500">■</span> {data?.contact}</p>
          <p className="flex items-center sm:justify-end gap-1"><span className="text-amber-500">■</span> {data?.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Hand: Contact & Ratings */}
        <div className="col-span-12 md:col-span-5 space-y-8 border-r border-slate-100 pr-4">
          <section className="bg-slate-50 p-5 rounded-3xl border border-slate-100">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> About Me
            </h3>
            <p className="text-[11px] leading-relaxed text-slate-600 font-medium">{summary}</p>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Academic Profile
            </h3>
            <div className="space-y-4">
              {(Array.isArray(data?.education_json) ? data.education_json : []).map((edu: any, i: number) => (
                <div key={i} className="text-[11px] font-sans font-medium">
                  <span className="text-amber-500 font-bold block">{edu.year} • GPA {edu.percentage || edu.cgpa || edu.grade}</span>
                  <p className="font-bold text-slate-950">{edu.level === 'Degree' ? 'Bachelors Degree in CSE' : edu.level}</p>
                  <p className="text-slate-500 text-[10px] leading-tight mt-0.5">{edu.board || edu.school}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Languages
            </h3>
            <div className="space-y-2 text-[10px] uppercase font-bold text-slate-600">
              {languages.map((lang: string, i: number) => (
                <div key={i} className="flex justify-between items-center">
                  <span>{lang}</span>
                  <div className="h-1 w-24 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400" style={{ width: i === 0 ? "100%" : i === 1 ? "75%" : "50%" }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> References
            </h3>
            <div className="space-y-3">
              {references.map((ref: any, i: number) => (
                <div key={i} className="text-[10px] text-slate-500 border-l border-amber-300 pl-3">
                  <p className="font-extrabold text-slate-800">{ref.name}</p>
                  <p className="font-semibold text-slate-500 text-[9px]">{ref.title} @ {ref.company}</p>
                  <p className="font-medium text-slate-400 font-mono text-[9px]">{ref.contact}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Hand: Experience & Project Timeline */}
        <div className="col-span-12 md:col-span-7 space-y-8">
          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Core Competencies
            </h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {(Array.isArray(data?.skills_json) ? data.skills_json : []).slice(0, 8).map((s: string, idx: number) => (
                <div key={idx} className="space-y-1 font-sans">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-slate-700">
                    <span>{s}</span>
                    <span className="text-amber-500">Expert</span>
                  </div>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((dot) => (
                      <div 
                        key={dot} 
                        className={`w-2.5 h-2.5 rounded-full ${dot <= (5 - (idx % 2)) ? 'bg-amber-400 shadow-sm' : 'bg-slate-100'}`} 
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Work Timeline
            </h3>
            <div className="relative border-l border-slate-200 ml-2 pl-6 space-y-6">
              {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[29px] top-1.5 w-4 h-4 bg-white border-2 border-amber-400 rounded-full flex items-center justify-center shadow-sm">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  </span>
                  <div className="flex justify-between items-start mb-1 text-[11px]">
                    <div>
                      <h4 className="font-bold text-slate-800 uppercase">{exp.company}</h4>
                      <p className="text-[10px] text-amber-500 font-extrabold uppercase tracking-widest">{exp.role}</p>
                    </div>
                    <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-xl uppercase shrink-0">{exp.duration}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{exp.desc}</p>
                </div>
              ))}
              {(!data?.experience_json || data?.experience_json.length === 0 || data?.experience_type === 'FRESHER') && (
                <div className="relative text-[11px] text-slate-500 italic pl-1">
                  <span className="absolute -left-[29px] top-1.5 w-4 h-4 bg-white border-2 border-amber-400 rounded-full flex items-center justify-center shadow-sm">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                  </span>
                  No formal corporate records listed. Ready for placement deployment.
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Strategic Projects
            </h3>
            <div className="space-y-4">
              {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                <div key={i} className="p-4 bg-slate-105 rounded-2xl border border-slate-150 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-xl pointer-events-none" />
                  <div className="flex justify-between items-baseline mb-2">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-tight">{p.name}</h4>
                    <span className="text-[8px] font-black text-amber-600 bg-amber-50 p-1 rounded font-mono uppercase">{p.tech_stack}</span>
                  </div>
                  <p className="text-[11px] text-slate-550 leading-normal">{p.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
