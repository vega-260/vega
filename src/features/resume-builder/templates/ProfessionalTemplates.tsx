import { Briefcase, Code, GraduationCap, Layout, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import { CustomSections } from "./TemplateShared.tsx";

export const ClassicATSTemplate = ({ data, summary, photo }: any) => (
  <div id="resume-content" className="bg-white p-12 text-slate-900 font-serif leading-relaxed w-[210mm] min-h-[297mm] mx-auto shadow-sm">
    <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
      <div className="flex-1">
        <h1 className="text-4xl font-black uppercase tracking-tight mb-2">{data.full_name}</h1>
        <div className="text-xs space-y-1 text-slate-600">
          <p>{data.email} • {data.contact}</p>
          <p>{data.address}</p>
          <div className="flex gap-3">
             {data.social_links_json?.linkedin && <span>LinkedIn: {data.social_links_json.linkedin}</span>}
             {data.social_links_json?.github && <span>GitHub: {data.social_links_json.github}</span>}
          </div>
        </div>
      </div>
      {photo && (
        <img src={photo} crossOrigin="anonymous" className="w-24 h-24 rounded shadow-sm grayscale ml-6 object-cover" />
      )}
    </div>

    <section className="mb-8">
      <h3 className="text-sm font-black uppercase tracking-widest border-b border-slate-200 mb-3">Professional Summary</h3>
      <p className="text-xs leading-relaxed italic">{summary}</p>
    </section>

    <section className="mb-8">
      <h3 className="text-sm font-black uppercase tracking-widest border-b border-slate-200 mb-3">Core Expertise</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
          <span key={s} className="font-bold">• {s}</span>
        ))}
      </div>
    </section>

    <section className="mb-8">
      <h3 className="text-sm font-black uppercase tracking-widest border-b border-slate-200 mb-3">Work Experience</h3>
      <div className="space-y-4">
        {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
          <div key={i} className="text-xs">
            <div className="flex justify-between font-black uppercase">
              <span>{exp.company}</span>
              <span>{exp.duration}</span>
            </div>
            <p className="font-bold text-slate-600 italic mb-1">{exp.role}</p>
            <p className="text-slate-500">{exp.desc}</p>
          </div>
        ))}
        {data.experience_type === 'FRESHER' && <p className="text-xs text-slate-400 italic">No formal work experience (Fresher status)</p>}
      </div>
    </section>

    <section className="mb-8">
      <h3 className="text-sm font-black uppercase tracking-widest border-b border-slate-200 mb-3">Education</h3>
      <div className="space-y-3">
        {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
          <div key={i} className="text-xs">
            <div className="flex justify-between font-black">
              <span>{edu.level === 'Degree' ? edu.board : edu.school}</span>
              <span>{edu.year}</span>
            </div>
            <p>{edu.level === 'Degree' ? 'Bachelor Degree' : edu.level} • {edu.percentage || edu.cgpa || edu.grade}</p>
          </div>
        ))}
      </div>
    </section>

    <section>
      <h3 className="text-sm font-black uppercase tracking-widest border-b border-slate-200 mb-3">Key Projects</h3>
      <div className="space-y-4">
        {(Array.isArray(data?.projects_json) ? data.projects_json : []).map((p: any, i: number) => (
          <div key={i} className="text-xs">
             <p className="font-black uppercase mb-1">{p.name}</p>
             <p className="text-slate-600">{p.description}</p>
             <div className="flex gap-2 mt-1">
                {p.tech_stack?.split(',').map((t: string) => (
                  <span key={t} className="text-[10px] font-bold text-slate-400">#{t.trim()}</span>
                ))}
             </div>
          </div>
        ))}
      </div>
    </section>
  </div>
);

export const AcademicLatexTemplate = ({ data, summary }: any) => (
  <div id="resume-content" className="bg-white p-[10mm] text-[#000000] font-serif w-[210mm] min-h-[297mm] mx-auto shadow-sm leading-[1.2]">
    {/* Header */}
    <div className="text-center mb-4">
      <h1 className="text-[24pt] font-bold uppercase mb-1">{data.full_name}</h1>
      <div className="text-[10pt] flex items-center justify-center gap-2 flex-wrap">
        <span>{data.contact}</span>
        <span>•</span>
        <a href={`mailto:${data.email}`} className="text-blue-700 underline">{data.email}</a>
        <span>•</span>
        <span>{data.address?.split(',').pop()?.trim() || 'Location'}</span>
      </div>
      <div className="text-[10pt] flex items-center justify-center gap-2 mt-1">
        {data.social_links_json?.github && <a href={data.social_links_json.github} className="text-blue-700 underline">github.com/{data.social_links_json.github.split('/').pop()}</a>}
        {data.social_links_json?.github && data.social_links_json?.linkedin && <span>•</span>}
        {data.social_links_json?.linkedin && <a href={data.social_links_json.linkedin} className="text-blue-700 underline">linkedin.com/in/{data.social_links_json.linkedin.split('/').pop()}</a>}
      </div>
    </div>

    {/* Professional Summary */}
    <section className="mb-4">
      <h2 className="text-[14pt] font-bold border-b border-black mb-1 w-full pb-0.5">Professional Summary</h2>
      <p className="text-[10.9pt] text-justify leading-[1.3]">{summary || data.bio}</p>
    </section>

    {/* Education */}
    <section className="mb-4">
      <h2 className="text-[14pt] font-bold border-b border-black mb-1 w-full pb-0.5">Education</h2>
      <div className="space-y-1">
        {(Array.isArray(data?.education_json) ? [...data.education_json] : []).sort((a: any, b: any) => (b.year || 0) - (a.year || 0)).map((edu: any, i: number) => (
          <div key={i} className="flex justify-between items-baseline">
            <div>
              <span className="font-bold">{edu.level === 'Degree' ? 'B.Tech - Computer Science and Engineering' : edu.level}</span>
              <br />
              <span className="italic">{edu.level === 'Degree' ? edu.board : edu.school}</span>
            </div>
            <div className="text-right">
              <span className="font-bold">{edu.year - 4} -- {edu.year}</span>
              <br />
              <span className="italic">CGPA: {edu.cgpa || edu.percentage || edu.grade} / 10.0</span>
            </div>
          </div>
        ))}
      </div>
    </section>

    {/* Skills */}
    <section className="mb-4">
      <h2 className="text-[14pt] font-bold border-b border-black mb-1 w-full pb-0.5">Technical Skills</h2>
      <ul className="list-disc pl-5 text-[10.9pt] space-y-0.5">
        <li><span className="font-bold">Languages:</span> {(Array.isArray(data?.skills_json) ? data.skills_json : []).slice(0, 5).join(', ')}</li>
        <li><span className="font-bold">Frameworks & Libraries:</span> React, Node.js, Express, Tailwind CSS</li>
        <li><span className="font-bold">Databases:</span> MySQL, PostgreSQL, MongoDB</li>
        <li><span className="font-bold">Tools & Cloud:</span> Git, Docker, AWS, Vercel</li>
      </ul>
    </section>

    {/* Projects */}
    <section className="mb-4">
      <h2 className="text-[14pt] font-bold border-b border-black mb-1 w-full pb-0.5">Projects</h2>
      <div className="space-y-3">
        {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
          <div key={i}>
            <div className="flex justify-between font-bold text-[10.9pt]">
              <span>{p.name}</span>
              <span className="italic font-normal">Django, MySQL, REST API</span>
            </div>
            <ul className="list-disc pl-5 text-[10.9pt] mt-1">
              <li>{p.description}</li>
            </ul>
          </div>
        ))}
      </div>
    </section>

    {/* Achievements */}
    <section>
      <h2 className="text-[14pt] font-bold border-b border-black mb-1 w-full pb-0.5">Achievements & Activities</h2>
      <ul className="list-disc pl-5 text-[10.9pt] space-y-0.5">
        <li>Maintaining Top 5% academic ranking in department with CGPA of {data.education_json?.[0]?.cgpa || '9.64'}.</li>
        <li>Active contributor to open-source projects on GitHub.</li>
        <li>Participated in various state-level innovation competitions.</li>
      </ul>
    </section>
  </div>
);

export const ExecutiveGridTemplate = ({ data, summary, photo }: any) => (
  <div id="resume-content" className="bg-[#FFFFFF] w-[210mm] min-h-[297mm] mx-auto shadow-sm font-sans text-[#1A1A1A]">
    <div className="grid grid-cols-12 min-h-[297mm]">
      {/* Left Column (Main) */}
      <div className="col-span-8 p-12 space-y-10">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 border-l-4 border-indigo-600 pl-6">{data.full_name}</h1>
          <p className="mt-4 text-sm text-slate-500 font-medium leading-relaxed">{summary}</p>
        </div>

        <section>
          <div className="flex items-center gap-3 mb-6">
             <div className="w-1.5 h-6 bg-indigo-600" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Professional Experience</h3>
          </div>
          <div className="space-y-8">
            {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
              <div key={i} className="group">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="text-sm font-bold text-slate-800">{exp.company}</h4>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full uppercase">{exp.duration}</span>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{exp.role}</p>
                <p className="text-xs text-slate-500 leading-relaxed group-hover:text-slate-700 transition-colors">{exp.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-3 mb-6">
             <div className="w-1.5 h-6 bg-indigo-600" />
             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Key Projects</h3>
          </div>
          <div className="grid grid-cols-2 gap-6">
             {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 4).map((p: any, i: number) => (
               <div key={i} className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h4 className="text-xs font-black text-slate-800 uppercase mb-2">{p.name}</h4>
                  <p className="text-[10px] text-slate-500 leading-relaxed mb-4 line-clamp-3">{p.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {p.tech_stack?.split(',').map((t: string) => (
                      <span key={t} className="text-[8px] font-black text-indigo-400 uppercase tracking-tighter">#{t.trim()}</span>
                    ))}
                  </div>
               </div>
             ))}
          </div>
        </section>
      </div>

      {/* Right Column (Info) */}
      <div className="col-span-4 bg-slate-900 p-10 text-white space-y-10">
        {photo && (
          <img src={photo} crossOrigin="anonymous" className="w-full aspect-square rounded-[32px] object-cover mb-8 border-2 border-slate-800" />
        )}

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 underline decoration-indigo-600 underline-offset-8">Information</h3>
          <div className="space-y-4">
             <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">Email</p>
                <p className="text-[11px] font-medium truncate">{data.email}</p>
             </div>
             <div className="space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase">Contact</p>
                <p className="text-[11px] font-medium">{data.contact}</p>
             </div>
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 underline decoration-indigo-600 underline-offset-8">Competencies</h3>
          <div className="space-y-6">
             {(Array.isArray(data?.skills_json) ? data.skills_json : []).slice(0, 8).map((s: string) => (
                <div key={s} className="space-y-2">
                   <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-300">
                      <span>{s}</span>
                      <span>Expert</span>
                   </div>
                   <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-600 w-[90%]" />
                   </div>
                </div>
             ))}
          </div>
        </section>

        <section>
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-6 underline decoration-indigo-600 underline-offset-8">Education</h3>
          <div className="space-y-6">
             {(Array.isArray(data?.education_json) ? data.education_json : []).map((edu: any, i: number) => (
                <div key={i}>
                   <p className="text-xs font-black text-white uppercase">{edu.level}</p>
                   <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{edu.board || edu.school}</p>
                   <p className="text-[10px] text-indigo-400 font-black mt-1">{edu.year}</p>
                </div>
             ))}
          </div>
        </section>
      </div>
    </div>
  </div>
);

export const MinimalSwissTemplate = ({ data, summary }: any) => (
  <div id="resume-content" className="bg-white p-16 text-[#000000] font-sans w-[210mm] min-h-[297mm] mx-auto shadow-sm tracking-tight">
    <header className="mb-20">
      <h1 className="text-7xl font-black uppercase tracking-tighter leading-[0.9] mb-8">{data.full_name?.split(' ')[0]}<br />{data.full_name?.split(' ')[1] || ''}</h1>
      <div className="grid grid-cols-4 gap-8 text-[11px] font-bold uppercase tracking-widest text-slate-400">
         <div>
            <p className="mb-2">Contact</p>
            <p className="text-black">{data.contact}</p>
         </div>
         <div>
            <p className="mb-2">Network</p>
            <p className="text-black">{data.email}</p>
         </div>
         <div className="col-span-2">
            <p className="mb-2">Objective</p>
            <p className="text-black normal-case leading-relaxed font-medium tracking-normal text-sm">{summary}</p>
         </div>
      </div>
    </header>

    <div className="grid grid-cols-4 gap-12">
       <div className="col-span-1 space-y-12">
          <section>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6">Expertise</h3>
             <div className="space-y-2 text-sm font-bold uppercase text-slate-400">
                {(Array.isArray(data?.skills_json) ? data.skills_json : []).map((s: string) => (
                   <p key={s} className="text-black">{s}</p>
                ))}
             </div>
          </section>

          <section>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-6">Learning</h3>
             <div className="space-y-6">
                {(Array.isArray(data?.education_json) ? data.education_json : []).map((edu: any, i: number) => (
                   <div key={i}>
                      <p className="text-[10px] font-black text-slate-300 mb-1">{edu.year}</p>
                      <p className="text-xs font-bold uppercase">{edu.level}</p>
                   </div>
                ))}
             </div>
          </section>
       </div>

       <div className="col-span-3 space-y-16">
          <section>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 border-b-4 border-black pb-4">Selected Projects</h3>
             <div className="space-y-12">
                {(Array.isArray(data?.projects_json) ? data.projects_json : []).slice(0, 3).map((p: any, i: number) => (
                   <div key={i} className="grid grid-cols-3 gap-6">
                      <div className="text-xs font-black uppercase leading-tight">{p.name}</div>
                      <div className="col-span-2 text-sm font-medium text-slate-600 leading-relaxed tracking-normal">{p.description}</div>
                   </div>
                ))}
             </div>
          </section>

          <section>
             <h3 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 border-b-4 border-black pb-4">Background</h3>
             <div className="space-y-12">
                {(Array.isArray(data?.experience_json) ? data.experience_json : []).map((exp: any, i: number) => (
                   <div key={i} className="grid grid-cols-3 gap-6">
                      <div className="text-xs font-black uppercase leading-tight">{exp.company} <br /><span className="text-slate-300">{exp.duration}</span></div>
                      <div className="col-span-2 text-sm font-medium text-slate-600 leading-relaxed tracking-normal">
                         <p className="font-bold text-black mb-2 uppercase text-[10px] tracking-widest">{exp.role}</p>
                         {exp.desc}
                      </div>
                   </div>
                ))}
             </div>
          </section>
       </div>
    </div>
  </div>
);
