import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  TrendingUp, 
  Users, 
  Building2,
  Download,
  Filter,
  Search,
  Award,
  BookOpen,
  CheckCircle2,
  Briefcase,
  Star,
  Target,
  FileSpreadsheet,
  Layers,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  Legend,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function TPOAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedBatch, setSelectedBatch] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'placements' | 'assessments' | 'talent' | 'students'>('overview');

  // Pagination State for Student Roster Matrix
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Reset pagination on filter or data update
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBatch, selectedCategory, searchQuery, data]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedBatch, selectedCategory]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tpo/analytics', {
        params: {
          batchId: selectedBatch,
          category: selectedCategory,
          search: searchQuery
        }
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics', error);
      toast.error('Failed to load placement analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAnalytics();
  };

  const handleExportPDF = async () => {
    toast.success('Generating PDF report...', { icon: '📊' });
    try {
      const response = await api.get('/tpo/reports/download?type=analytics', {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `tpo_analytics_report_${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      toast.error('Failed to download analytics PDF');
    }
  };

  const handleExportCSV = () => {
    if (!data || !data.studentLeaderboard || data.studentLeaderboard.length === 0) {
      toast.error('No student records to export');
      return;
    }

    const headers = ['ID', 'Student Name', 'Roll Number', 'Assigned Batch', 'Talent Score', 'Assessment Avg %', 'Placement Status', 'Company', 'Package Offered'];
    const rows = data.studentLeaderboard.map((s: any) => [
      s.id,
      `"${s.name}"`,
      `"${s.rollNumber}"`,
      `"${s.batchName}"`,
      s.talentScore,
      `${s.assessmentAvg}%`,
      s.placementStatus,
      `"${s.company}"`,
      `"${s.packageOffered}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `student_analytics_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast.success('CSV Export downloaded successfully!');
  };

  const batches = data?.filters?.batches || [{ id: 'all', name: 'All Assigned Batches' }];
  const categories = data?.filters?.categories || ['All Categories', 'Aptitude', 'Coding / Technical', 'Soft Skills', 'Domain Specific'];

  const metrics = data?.metrics || {
    totalStudents: 0,
    placedStudents: 0,
    placementRate: 0,
    avgPackage: '0.0 LPA',
    avgAssessmentScore: 0,
    avgTalentScore: 0,
    starPerformers: 0
  };

  const leaderboard = data?.studentLeaderboard || [];
  const totalStudents = leaderboard.length;
  const totalPages = Math.max(1, Math.ceil(totalStudents / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalStudents);
  const paginatedStudents = leaderboard.slice(startIndex, endIndex);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-black uppercase tracking-wider">TPO Ecosystem Analytics</span>
            <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
              <Sparkles size={12} /> Live Sync
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-1">Placement Analytics</h1>
          <p className="text-sm font-medium text-slate-500">
            Real-time analytics across student placement status, assignment scores, talent metrics & batch filters.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl font-bold text-sm transition-all"
          >
            <FileSpreadsheet size={16} />
            Export CSV
          </button>
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-bold text-sm shadow-md shadow-blue-500/20 transition-all"
          >
            <Download size={16} />
            Export PDF
          </button>
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-sm font-black text-slate-900 uppercase tracking-wider">
            <Filter size={16} className="text-blue-600" />
            Advanced Filter Controls
          </div>
          {(selectedBatch !== 'all' || selectedCategory !== 'all' || searchQuery) && (
            <button 
              onClick={() => {
                setSelectedBatch('all');
                setSelectedCategory('all');
                setSearchQuery('');
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Batch Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assigned Batch</label>
            <div className="relative">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {batches.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Assessment Category Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Assessment Category</label>
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
              >
                {categories.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Search Input */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Search Roster</label>
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                placeholder="Student name or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </form>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Students Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-blue-200 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Total Roster</span>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Users size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{metrics.totalStudents}</div>
          <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1">
            <ShieldCheck size={14} className="text-emerald-500" /> Filtered Student Base
          </p>
        </div>

        {/* Placement Rate Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Placement Rate</span>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <Briefcase size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{metrics.placementRate}%</div>
            <span className="text-xs font-extrabold text-emerald-600">({metrics.placedStudents} Placed)</span>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-2">
            Avg Package Offered: <strong className="text-slate-900">{metrics.avgPackage}</strong>
          </p>
        </div>

        {/* Avg Assessment Score Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Assessment Average</span>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <BookOpen size={20} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight">{metrics.avgAssessmentScore}%</div>
          <p className="text-xs font-bold text-slate-500 mt-2 flex items-center gap-1">
            <CheckCircle2 size={14} className="text-amber-500" /> Avg Score Across Assignments
          </p>
        </div>

        {/* Avg Talent Score Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden group hover:border-purple-200 transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">Talent Index</span>
            <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
              <Star size={20} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-slate-900 tracking-tight">{metrics.avgTalentScore}</div>
            <span className="text-xs font-bold text-slate-400">/ 100</span>
          </div>
          <p className="text-xs font-bold text-purple-600 mt-2">
            {metrics.starPerformers} Star Performers (80+)
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 size={16} /> Overview & Placements
        </button>
        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'assessments'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen size={16} /> Assignments & Tests
        </button>
        <button
          onClick={() => setActiveTab('talent')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'talent'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Target size={16} /> Talent & Skill Matrix
        </button>
        <button
          onClick={() => setActiveTab('students')}
          className={`px-5 py-3 rounded-2xl font-bold text-sm whitespace-nowrap transition-all flex items-center gap-2 ${
            activeTab === 'students'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users size={16} /> Student Roster ({leaderboard.length})
        </button>
      </div>

      {loading ? (
        <div className="bg-white p-16 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-center text-slate-400 font-bold">
          Loading Placement Intelligence Data...
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & PLACEMENTS */}
          {(activeTab === 'overview' || activeTab === 'placements') && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Monthly Placement Trend */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <TrendingUp className="text-blue-600" size={20} />
                      Monthly Placement Velocity
                    </h3>
                    <span className="text-xs font-bold text-slate-400">Selections per Month</span>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data?.placementAnalytics?.monthlyTrend || []}>
                        <defs>
                          <linearGradient id="colorPlaced" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Area type="monotone" dataKey="placed" name="Students Placed" stroke="#2563eb" strokeWidth={3} fillOpacity={1} fill="url(#colorPlaced)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Batch Wise Selection */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <PieChartIcon className="text-blue-600" size={20} />
                      Batch Wise Distribution
                    </h3>
                    <span className="text-xs font-bold text-slate-400">Student Share</span>
                  </div>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={data?.placementAnalytics?.batchBreakdown || data?.placementAnalytics?.deptBreakdown || []}
                          innerRadius={65}
                          outerRadius={105}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {(data?.placementAnalytics?.batchBreakdown || data?.placementAnalytics?.deptBreakdown || []).map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Top Recruiters Bar Chart */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <Building2 className="text-emerald-600" size={20} />
                    Top Recruiting Partners & Offers
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.placementAnalytics?.topRecruiters || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="company" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="offers" name="Offers Issued" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Package Distribution Chart */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <Award className="text-amber-500" size={20} />
                    Salary Package Distribution (LPA)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.placementAnalytics?.packageDistribution || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="count" name="Students" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ASSIGNMENTS & ASSESSMENTS */}
          {(activeTab === 'assessments') && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Category Average Performance */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <BookOpen className="text-blue-600" size={20} />
                    Average Score by Assessment Category
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.assessmentAnalytics?.categoryScores || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="avgScore" name="Avg Score (%)" fill="#2563eb" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Score Range Distribution */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <BarChart3 className="text-purple-600" size={20} />
                    Score Bracket Distribution
                  </h3>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.assessmentAnalytics?.scoreDistribution || []} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <YAxis dataKey="range" type="category" axisLine={false} tickLine={false} width={130} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="count" name="Students" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TALENT & SKILL MATRIX */}
          {(activeTab === 'talent') && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Talent Tier Distribution */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <Star className="text-amber-500" size={20} />
                    Talent Readiness Tiers
                  </h3>
                  <div className="space-y-4">
                    {(data?.talentMatrix?.tiers || []).map((t: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{t.tier}</h4>
                          <p className="text-xs text-slate-400 font-medium">{t.count} Students ({t.percentage}%)</p>
                        </div>
                        <div className="w-32 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 rounded-full" 
                            style={{ width: `${Math.min(100, t.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Skill Domain Radar */}
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                  <h3 className="text-base font-black text-slate-900 tracking-tight mb-6 flex items-center gap-2">
                    <Target className="text-blue-600" size={20} />
                    Average Skill Pillar Scores
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { pillar: 'Aptitude', score: data?.talentMatrix?.skillAverages?.aptitude || 76 },
                        { pillar: 'Technical / Coding', score: data?.talentMatrix?.skillAverages?.technical || 71 },
                        { pillar: 'Communication', score: data?.talentMatrix?.skillAverages?.communication || 80 },
                        { pillar: 'Soft Skills', score: data?.talentMatrix?.skillAverages?.softskills || 82 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="pillar" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 'bold', fontSize: 11}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Bar dataKey="score" name="Avg Skill Index" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STUDENT ROSTER & LEADERBOARD */}
          {(activeTab === 'students' || activeTab === 'overview') && (
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mt-8">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Users className="text-blue-600" size={20} />
                    Student Roster Analytics Matrix
                  </h3>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    Individual performance across talent score, test scores & active placement status.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl">
                    {totalStudents > 0 ? `Showing ${startIndex + 1}–${endIndex} of ${totalStudents} Students` : '0 Students Displayed'}
                  </span>
                </div>
              </div>

              {totalStudents === 0 ? (
                <div className="p-12 text-center text-slate-400 font-bold text-sm">
                  No student records match the active filter criteria.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                          <th className="py-4 px-6">Student Name</th>
                          <th className="py-4 px-6">Assigned Batch</th>
                          <th className="py-4 px-6 text-center">Talent Score</th>
                          <th className="py-4 px-6 text-center">Assessment Avg</th>
                          <th className="py-4 px-6 text-right">Placement Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm font-medium text-slate-700">
                        {paginatedStudents.map((student: any) => (
                          <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-4 px-6">
                              <div className="font-bold text-slate-900">{student.name}</div>
                              <div className="text-xs text-slate-400 font-medium">{student.rollNumber}</div>
                            </td>
                            <td className="py-4 px-6 text-slate-700 font-bold">
                              {student.batchName}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black ${
                                student.talentScore >= 80 
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : student.talentScore >= 60
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                <Star size={12} className={student.talentScore >= 80 ? "fill-purple-500 text-purple-500" : ""} />
                                {student.talentScore} / 100
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center font-black text-slate-900">
                              {student.assessmentAvg}%
                            </td>
                            <td className="py-4 px-6 text-right">
                              {student.placementStatus === 'PLACED' ? (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 size={12} /> Placed ({student.company} • {student.packageOffered})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                  Unplaced / In Drives
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer Controls */}
                  <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
                      <span>
                        Showing <strong className="text-slate-900">{startIndex + 1}</strong> to <strong className="text-slate-900">{endIndex}</strong> of <strong className="text-slate-900">{totalStudents}</strong> students
                      </span>
                      <div className="flex items-center gap-1.5 sm:ml-2">
                        <span className="text-slate-400 font-medium">Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={30}>30</option>
                          <option value={50}>50</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                        title="First Page"
                      >
                        <ChevronsLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                        <span>Previous</span>
                      </button>

                      <div className="flex items-center gap-1 px-1">
                        {getPageNumbers().map((pageNum, idx) => (
                          typeof pageNum === 'number' ? (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setCurrentPage(pageNum)}
                              className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                currentPage === pageNum
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pageNum}
                            </button>
                          ) : (
                            <span key={idx} className="px-1 text-slate-400 font-extrabold text-xs">...</span>
                          )
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm flex items-center gap-1 cursor-pointer"
                        title="Next Page"
                      >
                        <span>Next</span>
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm cursor-pointer"
                        title="Last Page"
                      >
                        <ChevronsRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
