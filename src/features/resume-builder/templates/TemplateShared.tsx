export const CustomSections = ({ data, headingClass, bodyClass }: { data: any, headingClass?: string, bodyClass?: string }) => {
  if (!data?.custom_sections_json || data.custom_sections_json.length === 0) return null;
  return (
    <>
      {(Array.isArray(data?.custom_sections_json) ? data.custom_sections_json : []).map((section: any, idx: number) => {
        if (!section || !section.title) return null;
        return (
          <section key={section.id || idx} className="mt-5 mb-5 last:mb-0">
            <h3 className={headingClass || "text-sm font-bold uppercase tracking-widest text-slate-800 border-b-2 border-slate-900 pb-1 mb-2"}>
              {section.title}
            </h3>
            <div className={bodyClass || "text-xs text-slate-700 leading-relaxed whitespace-pre-line mt-1.5"}>
              {section.content}
            </div>
          </section>
        );
      })}
    </>
  );
};
