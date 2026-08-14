import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Download, 
  PieChart, 
  Users, 
  TrendingUp,
  FileSpreadsheet,
  ArrowRight,
  Shield,
  Building2,
  GraduationCap,
  Sparkles,
  Filter,
  CheckCircle2,
  XCircle,
  Search,
  Printer,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Award,
  BookOpen,
  UserCheck,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { exportToPDF, exportToExcel, exportToCSV, ReportData } from '../../utils/reportExporter';

interface ReportMeta {
  batches: string[];
  departments: string[];
  students: Array<{
    id: number;
    full_name: string;
    roll_number: string;
    department: string;
    batch_name: string;
    email: string;
  }>;
  tests: Array<{
    id: number;
    title: string;
    category: string;
    submission_count: number;
    avg_score: number;
    created_at: string;
  }>;
}

export default function TPOReports() {
  const [meta, setMeta] = useState<ReportMeta>({ batches: [], departments: [], students: [], tests: [] });
  const [loadingMeta, setLoadingMeta] = useState(true);

  // Active Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>('ASSESSMENT');
  const [selectedType, setSelectedType] = useState<string>('MASTER_BLUEPRINT');
  const [selectedBatch, setSelectedBatch] = useState<string>('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [placementStatus, setPlacementStatus] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);

  // Search filter inside result table
  const [tableSearch, setTableSearch] = useState<string>('');

  // Generated Report Data
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Report Metadata (Batches, Departments, Students, Tests)
  useEffect(() => {
    fetchMeta();
  }, []);

  const fetchMeta = async () => {
    setLoadingMeta(true);
    try {
      const res = await api.get('/tpo/reports/meta');
      if (res.data?.success) {
        setMeta(res.data.data);
      }
    } catch (err) {
      console.error('Error loading report metadata:', err);
    } finally {
      setLoadingMeta(false);
    }
  };

  // Generate Report Action
  const handleGenerateReport = async (
    overrideCategory?: string,
    overrideType?: string,
    overrideTestId?: string,
    overrideStudentId?: string
  ) => {
    const cat = overrideCategory || selectedCategory;
    const type = overrideType || selectedType;
    const tId = overrideTestId !== undefined ? overrideTestId : selectedTestId;
    const sId = overrideStudentId !== undefined ? overrideStudentId : selectedStudentId;

    setIsGenerating(true);
    try {
      const payload = {
        reportCategory: cat,
        reportType: type,
        batch: selectedBatch,
        department: selectedDepartment,
        studentId: sId ? Number(sId) : null,
        testId: tId ? Number(tId) : null,
        placementStatus,
        minScore
      };

      const res = await api.post('/tpo/reports/generate', payload);
      if (res.data?.success) {
        setReportData(res.data.data);
        setIsModalOpen(true);
        toast.success('Report generated successfully with dynamic live data!', {
          icon: '✨',
          style: { borderRadius: '16px' }
        });
      } else {
        toast.error(res.data?.message || 'Failed to generate report');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Error generating report from database');
    } finally {
      setIsGenerating(false);
    }
  };

  // Quick preset triggers
  const openGeneratorForTemplate = (cat: string, type: string) => {
    setSelectedCategory(cat);
    setSelectedType(type);
    let tId = selectedTestId;
    let sId = selectedStudentId;

    if (type === 'COMPLETED_TEST' && meta.tests.length > 0 && !tId) {
      tId = String(meta.tests[0].id);
      setSelectedTestId(tId);
    }
    if (type === 'INDIVIDUAL_STUDENT' && meta.students.length > 0 && !sId) {
      sId = String(meta.students[0].id);
      setSelectedStudentId(sId);
    }
    handleGenerateReport(cat, type, tId, sId);
  };

  // Category Cards matching screenshot
  const reportCategories = [
    {
      id: 'ASSESSMENT',
      title: 'Assessment Reports',
      icon: PieChart,
      color: 'bg-emerald-50 border-emerald-100 text-emerald-600',
      btnColor: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      subTypes: [
        { label: 'Master Placement Blueprint', type: 'MASTER_BLUEPRINT' },
        { label: 'Placement Performance Summary', type: 'PLACEMENT_SUMMARY' },
        { label: 'Completed Test / Assignment Results', type: 'COMPLETED_TEST' }
      ]
    },
    {
      id: 'STUDENT',
      title: 'Student Reports',
      icon: GraduationCap,
      color: 'bg-blue-50 border-blue-100 text-blue-600',
      btnColor: 'bg-blue-600 hover:bg-blue-700 text-white',
      subTypes: [
        { label: 'Student Eligibility List', type: 'STUDENT_ELIGIBILITY' },
        { label: 'Individual Student 360° Dossier', type: 'INDIVIDUAL_STUDENT' },
        { label: 'Complete Student Academic Roster', type: 'STUDENT_ROSTER' }
      ]
    },
    {
      id: 'BATCH',
      title: 'Batch Reports',
      icon: Users,
      color: 'bg-indigo-50 border-indigo-100 text-indigo-600',
      btnColor: 'bg-indigo-600 hover:bg-indigo-700 text-white',
      subTypes: [
        { label: 'Batch-Wise Placement Performance', type: 'BATCH_REPORT' }
      ]
    },
    {
      id: 'DEPARTMENT',
      title: 'Department Reports',
      icon: Building2,
      color: 'bg-amber-50 border-amber-100 text-amber-600',
      btnColor: 'bg-amber-600 hover:bg-amber-700 text-white',
      subTypes: [
        { label: 'Department Wise Placement Matrix', type: 'DEPARTMENT_REPORT' }
      ]
    },
    {
      id: 'PLACEMENT',
      title: 'Placement Reports',
      icon: Award,
      color: 'bg-rose-50 border-rose-100 text-rose-600',
      btnColor: 'bg-rose-600 hover:bg-rose-700 text-white',
      subTypes: [
        { label: 'Recruiter Offers & Salary Packages', type: 'RECRUITER_PLACEMENT' }
      ]
    },
    {
      id: 'AI_INSIGHTS',
      title: 'AI Insights Reports',
      icon: Sparkles,
      color: 'bg-purple-50 border-purple-100 text-purple-600',
      btnColor: 'bg-purple-600 hover:bg-purple-700 text-white',
      subTypes: [
        { label: 'Skill Gap & Training Needs', type: 'SKILL_GAP' }
      ]
    }
  ];

  // Filtered Roster inside Modal
  const filteredRoster = reportData?.studentRoster?.filter(s => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(term) ||
      s.rollNumber.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      s.company.toLowerCase().includes(term)
    );
  }) || [];

  const filteredTestResults = reportData?.studentResults?.filter(s => {
    if (!tableSearch) return true;
    const term = tableSearch.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(term) ||
      s.rollNumber.toLowerCase().includes(term) ||
      s.department.toLowerCase().includes(term) ||
      s.status.toLowerCase().includes(term)
    );
  }) || [];

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-12 pointer-events-none">
          <FileText size={240} />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles size={14} className="text-blue-400" />
            Official TPO Report Generator
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Institutional Placement & Assessment Reports
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Generate, preview, and export comprehensive official reports in both <span className="text-blue-300 font-bold">PDF Document</span> and <span className="text-emerald-300 font-bold">Excel Spreadsheet (.xlsx)</span> formats. Filter by batch, department, individual student, or completed assessment test.
          </p>
        </div>
      </div>



      {/* 6 Category Report Templates Grid (Matching Screenshot) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reportCategories.map((category) => {
          const Icon = category.icon;
          return (
            <div 
              key={category.id} 
              className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3.5 rounded-2xl border ${category.color}`}>
                    <Icon size={24} />
                  </div>
                  <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                    PDF + EXCEL
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                  {category.title}
                </h3>

                <div className="mt-4 space-y-2">
                  {category.subTypes.map((st) => (
                    <button
                      key={st.type}
                      onClick={() => openGeneratorForTemplate(category.id, st.type)}
                      className="w-full text-left flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors group/item cursor-pointer"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Shield size={14} className="text-slate-400 group-hover/item:text-blue-500" />
                        <span className="truncate">{st.label}</span>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover/item:translate-x-0.5 transition-transform" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => openGeneratorForTemplate(category.id, category.subTypes[0].type)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${category.btnColor}`}
                >
                  <FileText size={15} />
                  View Reports
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* REPORT PREVIEW MODAL / DRAWER */}
      {isModalOpen && reportData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden my-8">
            
            {/* Modal Top Action Bar */}
            <div className="bg-slate-900 text-white p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800">
              <div>
                <div className="text-xs font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={14} />
                  {reportData.collegeName}
                </div>
                <h2 className="text-xl font-black text-white mt-1">
                  {reportData.reportTitle}
                </h2>
                <div className="text-xs text-slate-400 mt-1">
                  Generated at {new Date(reportData.generatedAt).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => exportToPDF(reportData)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <Download size={14} />
                  PDF
                </button>
                <button
                  onClick={() => exportToExcel(reportData)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <FileSpreadsheet size={14} />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={() => exportToCSV(reportData)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  <FileText size={14} />
                  CSV
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
                  title="Print Report"
                >
                  <Printer size={16} />
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer ml-2"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body / Report Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Applied Filters Badge Bar */}
              {reportData.appliedFilters && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-bold">
                    <Filter size={15} className="text-blue-600" />
                    <span>Applied Filters:</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                      Batch: <strong>{reportData.appliedFilters.batch || 'ALL'}</strong>
                    </span>
                    <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                      Department: <strong>{reportData.appliedFilters.department || 'ALL'}</strong>
                    </span>
                    <span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-semibold">
                      Status: <strong>{reportData.appliedFilters.placementStatus || 'ALL'}</strong>
                    </span>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              {reportData.summaryMetrics && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Students</div>
                    <div className="text-xl font-black text-slate-900 mt-1">{reportData.summaryMetrics.totalStudents}</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Placed Students</div>
                    <div className="text-xl font-black text-emerald-700 mt-1">{reportData.summaryMetrics.placedStudents}</div>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Placement Rate</div>
                    <div className="text-xl font-black text-blue-700 mt-1">{reportData.summaryMetrics.placementRate}</div>
                  </div>
                  <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Avg Assessment</div>
                    <div className="text-xl font-black text-indigo-700 mt-1">{reportData.summaryMetrics.avgAssessmentScore}</div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Top Package</div>
                    <div className="text-xl font-black text-amber-700 mt-1">{reportData.summaryMetrics.topPackage}</div>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-2xl p-3.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Unplaced</div>
                    <div className="text-xl font-black text-purple-700 mt-1">{reportData.summaryMetrics.unplacedStudents}</div>
                  </div>
                </div>
              )}

              {/* If Test Summary exists */}
              {reportData.testSummary && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Assessment Details</div>
                      <h3 className="text-lg font-black text-slate-900 mt-0.5">{reportData.testSummary.title}</h3>
                    </div>
                    <span className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase">
                      Pass Rate: {reportData.testSummary.passRate}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-blue-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Total Submissions</div>
                      <div className="text-base font-black text-slate-900">{reportData.testSummary.totalSubmissions}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-blue-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Passed</div>
                      <div className="text-base font-black text-emerald-600">{reportData.testSummary.passedCount}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-blue-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Failed</div>
                      <div className="text-base font-black text-rose-600">{reportData.testSummary.failedCount}</div>
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-blue-100">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Average Score</div>
                      <div className="text-base font-black text-blue-600">{reportData.testSummary.avgScore}%</div>
                    </div>
                  </div>
                </div>
              )}

              {/* If Individual Student Dossier exists */}
              {reportData.studentProfile && (
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                        360° Student Dossier
                      </span>
                      <h3 className="text-2xl font-black text-slate-900 mt-2">
                        {reportData.studentProfile.fullName}
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Roll: {reportData.studentProfile.rollNumber} • Dept: {reportData.studentProfile.department} • Batch: {reportData.studentProfile.batchName}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
                      <div className="text-[10px] font-bold text-slate-500 uppercase">Talent Score</div>
                      <div className="text-3xl font-black text-blue-600 mt-0.5">{reportData.studentProfile.talentScore}%</div>
                    </div>
                  </div>

                  {/* Skills Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Skill Pillar Analysis</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Aptitude</div>
                        <div className="text-lg font-black text-slate-800">{reportData.studentProfile.skillBreakdown.aptitude}%</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Technical / Coding</div>
                        <div className="text-lg font-black text-slate-800">{reportData.studentProfile.skillBreakdown.technical}%</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Communication</div>
                        <div className="text-lg font-black text-slate-800">{reportData.studentProfile.skillBreakdown.communication}%</div>
                      </div>
                      <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="text-[10px] font-bold text-slate-500 uppercase">Soft Skills</div>
                        <div className="text-lg font-black text-slate-800">{reportData.studentProfile.skillBreakdown.softskills}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Table with Quick Search */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Detailed Report Records
                  </h3>
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search results..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Category Skill Matrix for Master Blueprint */}
                {reportData.categoryScores && reportData.categoryScores.length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Skill Category Performance Matrix</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {reportData.categoryScores.map((cat, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200">
                          <div className="text-[10px] font-bold text-slate-500 uppercase">{cat.category}</div>
                          <div className="text-xl font-black text-blue-600 mt-1">{cat.avgScore}% Avg</div>
                          <div className="text-[10px] text-slate-400 font-medium">{cat.attempts} assessment attempts</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table for Placement Performance Summary */}
                {reportData.placementSummaryList && reportData.placementSummaryList.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Roll Number</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Batch</th>
                          <th className="p-3">Placement Status</th>
                          <th className="p-3">Company</th>
                          <th className="p-3">Package Offered</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.placementSummaryList
                          .filter(st => !tableSearch || st.fullName.toLowerCase().includes(tableSearch.toLowerCase()) || st.company.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((st) => (
                            <tr key={st.rank} className="hover:bg-slate-50">
                              <td className="p-3 font-black text-slate-900">#{st.rank}</td>
                              <td className="p-3 font-bold text-slate-900">{st.fullName}</td>
                              <td className="p-3 text-slate-500">{st.rollNumber}</td>
                              <td className="p-3">{st.department}</td>
                              <td className="p-3 text-slate-500">{st.batchName}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  st.placementStatus === 'PLACED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {st.placementStatus}
                                </span>
                              </td>
                              <td className="p-3 font-bold text-slate-900">{st.company}</td>
                              <td className="p-3 font-bold text-emerald-600">{st.packageOffered}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Batch Breakdown */}
                {reportData.batchBreakdown && reportData.batchBreakdown.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Batch Name</th>
                          <th className="p-3">Total Students</th>
                          <th className="p-3">Placed</th>
                          <th className="p-3">Unplaced</th>
                          <th className="p-3">Placement Rate</th>
                          <th className="p-3">Avg Assessment</th>
                          <th className="p-3">Top Recruiters</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.batchBreakdown
                          .filter(b => !tableSearch || b.batchName.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((b, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{b.batchName}</td>
                              <td className="p-3 font-semibold text-slate-700">{b.totalStudents}</td>
                              <td className="p-3 font-bold text-emerald-600">{b.placedStudents}</td>
                              <td className="p-3 font-semibold text-purple-600">{b.unplacedStudents}</td>
                              <td className="p-3 font-black text-blue-600">{b.placementRate}</td>
                              <td className="p-3 font-bold text-indigo-600">{b.avgAssessmentScore}</td>
                              <td className="p-3 text-slate-600 truncate max-w-[200px]">{b.topCompany}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Department Breakdown */}
                {reportData.departmentBreakdown && reportData.departmentBreakdown.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Total Students</th>
                          <th className="p-3">Placed</th>
                          <th className="p-3">Unplaced</th>
                          <th className="p-3">Placement Rate</th>
                          <th className="p-3">Avg Score</th>
                          <th className="p-3">Highest Package</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.departmentBreakdown
                          .filter(d => !tableSearch || d.department.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((d, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{d.department}</td>
                              <td className="p-3 font-semibold text-slate-700">{d.totalStudents}</td>
                              <td className="p-3 font-bold text-emerald-600">{d.placedStudents}</td>
                              <td className="p-3 font-semibold text-purple-600">{d.unplacedStudents}</td>
                              <td className="p-3 font-black text-blue-600">{d.placementRate}</td>
                              <td className="p-3 font-bold text-indigo-600">{d.avgAssessmentScore}</td>
                              <td className="p-3 font-bold text-amber-600">{d.topPackage}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Recruiter & Offers */}
                {reportData.recruiterBreakdown && reportData.recruiterBreakdown.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Recruiter / Company Name</th>
                          <th className="p-3">Offers Issued</th>
                          <th className="p-3">Average Package</th>
                          <th className="p-3">Highest Package</th>
                          <th className="p-3">Hired Candidates Sample</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.recruiterBreakdown
                          .filter(r => !tableSearch || r.companyName.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((r, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{r.companyName}</td>
                              <td className="p-3 font-bold text-emerald-600">{r.offersGiven}</td>
                              <td className="p-3 font-semibold text-slate-700">{r.avgPackage}</td>
                              <td className="p-3 font-bold text-amber-600">{r.highestPackage}</td>
                              <td className="p-3 text-slate-500">{r.studentNamesSample || 'N/A'}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Skill Gap Matrix */}
                {reportData.skillGapMatrix && reportData.skillGapMatrix.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Skill Category</th>
                          <th className="p-3">Avg Student Score</th>
                          <th className="p-3">Industry Benchmark</th>
                          <th className="p-3">Skill Gap %</th>
                          <th className="p-3">Readiness Status</th>
                          <th className="p-3">Recommended Training Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.skillGapMatrix
                          .filter(sg => !tableSearch || sg.skillCategory.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((sg, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                              <td className="p-3 font-bold text-slate-900">{sg.skillCategory}</td>
                              <td className="p-3 font-bold text-blue-600">{sg.avgScore}</td>
                              <td className="p-3 font-semibold text-slate-500">{sg.benchmark}</td>
                              <td className="p-3 font-bold text-rose-600">{sg.gapPercentage}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  sg.readinessLevel === 'READY' ? 'bg-emerald-100 text-emerald-700' :
                                  sg.readinessLevel === 'MODERATE GAP' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {sg.readinessLevel}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 font-medium">{sg.recommendedAction}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Student Eligibility List */}
                {reportData.eligibilityList && reportData.eligibilityList.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Roll Number</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Batch</th>
                          <th className="p-3">Assessment Avg</th>
                          <th className="p-3">Eligibility Status</th>
                          <th className="p-3">Audit Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {reportData.eligibilityList
                          .filter(e => !tableSearch || e.fullName.toLowerCase().includes(tableSearch.toLowerCase()) || e.rollNumber.toLowerCase().includes(tableSearch.toLowerCase()))
                          .map((e) => (
                            <tr key={e.rank} className="hover:bg-slate-50">
                              <td className="p-3 font-black text-slate-900">#{e.rank}</td>
                              <td className="p-3 font-bold text-slate-900">{e.fullName}</td>
                              <td className="p-3 text-slate-500">{e.rollNumber}</td>
                              <td className="p-3">{e.department}</td>
                              <td className="p-3 text-slate-500">{e.batchName}</td>
                              <td className="p-3 font-bold text-blue-600">{e.assessmentAvg}</td>
                              <td className="p-3">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                  e.eligibilityStatus === 'ELIGIBLE' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                }`}>
                                  {e.eligibilityStatus}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{e.remark}</td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for Completed Test */}
                {reportData.studentResults && reportData.studentResults.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">Rank</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Roll Number</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Score</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredTestResults.map((st) => (
                          <tr key={st.rank} className="hover:bg-slate-50">
                            <td className="p-3 font-black text-slate-900">#{st.rank}</td>
                            <td className="p-3 font-bold text-slate-900">{st.fullName}</td>
                            <td className="p-3 text-slate-500">{st.rollNumber}</td>
                            <td className="p-3">{st.department}</td>
                            <td className="p-3 font-bold text-blue-600">{st.score}%</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                st.status === 'PASSED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {st.status}
                              </span>
                            </td>
                            <td className="p-3 text-slate-400">{st.submittedAt}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Table for General Student Roster */}
                {reportData.studentRoster && reportData.studentRoster.length > 0 && (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="p-3">#</th>
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Roll Number</th>
                          <th className="p-3">Department</th>
                          <th className="p-3">Batch</th>
                          <th className="p-3">Score</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Company</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {filteredRoster.map((st, idx) => (
                          <tr key={st.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900">{st.fullName}</td>
                            <td className="p-3 text-slate-500">{st.rollNumber}</td>
                            <td className="p-3">{st.department}</td>
                            <td className="p-3 text-slate-500">{st.batchName}</td>
                            <td className="p-3 font-bold text-blue-600">{st.assessmentAvg}%</td>
                            <td className="p-3">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                st.placementStatus === 'PLACED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {st.placementStatus}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-slate-800">{st.company}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">
                Official Institutional Record • VEGA Career Platform
              </span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
