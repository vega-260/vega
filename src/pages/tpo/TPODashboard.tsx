import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Award, 
  BrainCircuit,
  BarChart3,
  Target,
  AlertCircle,
  Plus,
  Calendar,
  UserPlus,
  BarChart2,
  BookOpen,
  FileText,
  Code2,
  MessageSquare,
  Database,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Megaphone,
  Sparkles,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

function TPOActivityCalendar({ activities = [], navigate }: { activities: any[]; navigate: any }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevMonthTotalDays = new Date(year, month, 0).getDate();

  const gridCells = [];

  // Previous month trailing days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = prevMonthTotalDays - i;
    const prevMonthDate = new Date(year, month - 1, dayNum);
    const dateKey = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    gridCells.push({
      dateKey,
      dayNum,
      isCurrentMonth: false
    });
  }

  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    gridCells.push({
      dateKey,
      dayNum: d,
      isCurrentMonth: true
    });
  }

  // Next month leading days to complete 35 or 42 cells
  const targetTotal = gridCells.length <= 35 ? 35 : 42;
  const remainingCells = targetTotal - gridCells.length;
  for (let n = 1; n <= remainingCells; n++) {
    const nextMonthDate = new Date(year, month + 1, n);
    const dateKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
    gridCells.push({
      dateKey,
      dayNum: n,
      isCurrentMonth: false
    });
  }

  // Group activities by date
  const activitiesByDate: Record<string, any[]> = {};
  activities.forEach(act => {
    if (act.date) {
      if (!activitiesByDate[act.date]) activitiesByDate[act.date] = [];
      activitiesByDate[act.date].push(act);
    }
  });

  const todayStr = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;

  return (
    <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between relative">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black shrink-0">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight">TPO Activity Calendar</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scheduled Drives, Tests & Notices</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button 
              type="button"
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-black text-slate-800 min-w-[105px] text-center">
              {monthNames[month]} {year}
            </span>
            <button 
              type="button"
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
            <button 
              type="button"
              onClick={() => setCurrentDate(new Date())}
              className="px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between gap-3 mb-3 text-[10px] font-black uppercase tracking-wider text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <span>Tests</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
              <span>Events & Drives</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Notices</span>
            </div>
          </div>
          <span className="text-indigo-600 font-extrabold">{activities.length} Total</span>
        </div>

        {/* Days of Week */}
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>

        {/* Grid Cells */}
        <div className="grid grid-cols-7 gap-1">
          {gridCells.map((cell, idx) => {
            const dayActs = activitiesByDate[cell.dateKey] || [];
            const isToday = cell.dateKey === todayStr;
            const isHovered = cell.dateKey === hoveredDateKey;
            const isSelected = cell.dateKey === selectedDateKey;
            const hasActs = dayActs.length > 0;

            return (
              <div
                key={idx}
                onMouseEnter={() => setHoveredDateKey(cell.dateKey)}
                onMouseLeave={() => setHoveredDateKey(null)}
                onClick={() => setSelectedDateKey(selectedDateKey === cell.dateKey ? null : cell.dateKey)}
                className={`relative h-13 p-1 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  !cell.isCurrentMonth ? 'opacity-30 bg-slate-50 border-slate-100' : 'bg-white border-slate-100/90 hover:border-indigo-300 hover:shadow-xs'
                } ${isToday ? 'ring-2 ring-blue-500/80 bg-blue-50/20' : ''} ${
                  isSelected ? 'ring-2 ring-indigo-600 bg-indigo-50/40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-black px-1 rounded-md ${
                    isToday ? 'bg-blue-600 text-white' : cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                  }`}>
                    {cell.dayNum}
                  </span>
                  {hasActs && (
                    <span className="text-[8px] font-black px-1.5 py-0.2 rounded-full bg-indigo-100 text-indigo-800">
                      {dayActs.length}
                    </span>
                  )}
                </div>

                {/* Activity Badge indicators */}
                <div className="space-y-0.5 overflow-hidden">
                  {dayActs.slice(0, 1).map((act: any, i: number) => {
                    const bgClass = act.type === 'TEST' ? 'bg-blue-600' : act.type === 'EVENT' ? 'bg-purple-600' : 'bg-amber-500';
                    return (
                      <div 
                        key={i} 
                        className={`text-[8px] font-black text-white px-1 py-0.2 rounded truncate ${bgClass}`}
                      >
                        {act.title}
                      </div>
                    );
                  })}
                  {dayActs.length > 1 && (
                    <div className="text-[7px] font-extrabold text-indigo-600 leading-none">
                      +{dayActs.length - 1} more
                    </div>
                  )}
                </div>

                {/* Hover Popover Tooltip for Date Cell */}
                {isHovered && hasActs && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-400">
                        {new Date(cell.dateKey).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                        {dayActs.length} {dayActs.length === 1 ? 'Scheduled' : 'Scheduled'}
                      </span>
                    </div>

                    <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                      {dayActs.map((act: any, aIdx: number) => (
                        <div key={aIdx} className="bg-slate-800/90 p-2.5 rounded-xl border border-slate-700/60 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${
                              act.type === 'TEST' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                              act.type === 'EVENT' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {act.category || act.type}
                            </span>
                            {act.time && (
                              <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                                <Clock size={10} /> {act.time}
                              </span>
                            )}
                          </div>

                          <h5 className="text-xs font-black text-white leading-tight">{act.title}</h5>

                          {act.department && (
                            <p className="text-[10px] text-slate-300 font-semibold">Dept: {act.department}</p>
                          )}
                          {act.location && (
                            <p className="text-[10px] text-slate-300 font-semibold flex items-center gap-1">
                              <MapPin size={10} className="text-purple-400 shrink-0" /> {act.location}
                            </p>
                          )}
                          {act.batch && (
                            <p className="text-[10px] text-slate-300 font-semibold">Audience: {act.batch}</p>
                          )}
                          {act.description && (
                            <p className="text-[10px] text-slate-400 font-medium line-clamp-2 italic">{act.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 absolute left-1/2 -bottom-1 -translate-x-1/2 border-r border-b border-slate-700"></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Selected Date Detail Cards */}
        {selectedDateKey && (
          <div className="mt-4 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl relative animate-in fade-in">
            <button 
              type="button"
              onClick={() => setSelectedDateKey(null)}
              className="absolute top-2.5 right-2.5 text-slate-400 hover:text-slate-700 font-bold text-xs"
            >
              ✕
            </button>
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar size={13} className="text-indigo-600" />
              {new Date(selectedDateKey).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </h4>

            {(activitiesByDate[selectedDateKey] || []).length === 0 ? (
              <p className="text-xs text-slate-500 font-semibold">No activity scheduled for this date.</p>
            ) : (
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                {(activitiesByDate[selectedDateKey] || []).map((act: any, idx: number) => (
                  <div key={idx} className="bg-white p-2.5 rounded-xl border border-indigo-100/80 shadow-2xs flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.2 rounded ${
                          act.type === 'TEST' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          act.type === 'EVENT' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {act.category || act.type}
                        </span>
                        <span className="text-[10px] font-bold text-slate-500 truncate">{act.time}</span>
                      </div>
                      <h5 className="text-xs font-black text-slate-900 truncate">{act.title}</h5>
                      {act.department && <p className="text-[10px] text-slate-500 font-medium truncate">{act.department}</p>}
                      {act.location && <p className="text-[10px] text-indigo-600 font-bold truncate">{act.location}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Quick Actions */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
        <button 
          type="button"
          onClick={() => navigate('/tpo/events')} 
          className="text-purple-600 hover:text-purple-700 flex items-center gap-1 font-extrabold cursor-pointer"
        >
          <Plus size={14} /> Create Event
        </button>
        <button 
          type="button"
          onClick={() => navigate('/tpo/assessments')} 
          className="text-blue-600 hover:text-blue-700 flex items-center gap-1 font-extrabold cursor-pointer"
        >
          <Plus size={14} /> Schedule Test
        </button>
      </div>
    </div>
  );
}

export default function TPODashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAtRiskModal, setShowAtRiskModal] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Filters state
  const [trendFilter, setTrendFilter] = useState('Monthly');
  const [perfFilter, setPerfFilter] = useState('This Month');

  useEffect(() => {
    fetchStats();
  }, [trendFilter, perfFilter]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/tpo/dashboard-stats', {
        params: { trendFilter, perfFilter }
      });
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching TPO stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAtRiskList = async () => {
    setShowAtRiskModal(true);
    setLoadingStudents(true);
    try {
      const response = await api.get('/tpo/students');
      if (response.data.success) {
        setStudents(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load students for risk monitoring:', error);
      toast.error('Failed to load student profiles');
    } finally {
      setLoadingStudents(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-96 space-y-3">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      <p className="text-slate-500 font-bold text-sm">Loading TPO Analytics Dashboard...</p>
    </div>
  );

  const metrics = stats?.metrics || {};
  const collegeAnalytics = stats?.collegeAnalytics || [];
  const assessmentTrends = stats?.assessmentTrends || [
    { month: 'Dec', Created: 5, Completed: 2 },
    { month: 'Jan', Created: 11, Completed: 5 },
    { month: 'Feb', Created: 15, Completed: 10 },
    { month: 'Mar', Created: 13, Completed: 8 },
    { month: 'Apr', Created: 17, Completed: 11 },
    { month: 'May', Created: 20, Completed: 15 },
  ];
  const upcomingAssessments = stats?.upcomingAssessments || [];
  const batchPerformance = stats?.batchPerformance || [];
  const assessmentPerformance = stats?.assessmentPerformance || {
    total: 18,
    breakdown: [
      { name: 'Upcoming', count: 6, percentage: 33, color: '#2563eb' },
      { name: 'Live', count: 2, percentage: 11, color: '#16a34a' },
      { name: 'Completed', count: 10, percentage: 55, color: '#f97316' },
      { name: 'Draft', count: 0, percentage: 0, color: '#9333ea' },
      { name: 'Cancelled', count: 0, percentage: 0, color: '#dc2626' },
    ]
  };
  const recentAssessments = stats?.recentAssessments || [];

  const atRiskList = students.filter(student => (student.talent_score || 0) < 45 || (student.completeness_score || 0) < 60);

  const trendTotalCreated = assessmentTrends.reduce((acc: number, curr: any) => acc + (curr.Created || 0), 0);
  const trendTotalCompleted = assessmentTrends.reduce((acc: number, curr: any) => acc + (curr.Completed || 0), 0);
  const trendCompletionRate = trendTotalCreated > 0 ? Math.round((trendTotalCompleted / trendTotalCreated) * 100) : 0;

  let trendPeakMonth = 'N/A';
  let trendPeakVal = 0;
  assessmentTrends.forEach((curr: any) => {
    const val = (curr.Created || 0) + (curr.Completed || 0);
    if (val > trendPeakVal) {
      trendPeakVal = val;
      trendPeakMonth = curr.month;
    }
  });

  const statCards = [
    { label: 'Total Students', value: metrics.totalStudents, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Students', value: metrics.activeStudents, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Placed Students', value: metrics.placedStudents, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Placement Rate', value: `${metrics.placementRate?.toFixed(1)}%`, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Top Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">{stat.label}</p>
                <h3 className="text-3xl font-black text-slate-900 mt-1">{stat.value}</h3>
              </div>
              <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                <stat.icon size={22} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 2. Top Row: Assessment Trend & Activity Calendar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Assessment Trend Card */}
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">Assessment Trend</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Test creation vs student completion velocity</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs font-bold">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <span>Created</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span>Completed</span>
                  </div>
                </div>

                <div className="relative">
                  <select
                    value={trendFilter}
                    onChange={(e) => setTrendFilter(e.target.value)}
                    className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-1.5 pr-7 focus:outline-none cursor-pointer transition-colors"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Quick Metrics Badges */}
            <div className="grid grid-cols-3 gap-3 my-3">
              <div className="bg-blue-50/70 border border-blue-100/90 p-2.5 rounded-2xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold text-blue-700 uppercase tracking-wider truncate">Total Created</p>
                  <p className="text-sm font-black text-slate-900 leading-none mt-0.5">{trendTotalCreated}</p>
                </div>
              </div>

              <div className="bg-emerald-50/70 border border-emerald-100/90 p-2.5 rounded-2xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                  <CheckCircle2 size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold text-emerald-700 uppercase tracking-wider truncate">Total Completed</p>
                  <p className="text-sm font-black text-slate-900 leading-none mt-0.5">{trendTotalCompleted}</p>
                </div>
              </div>

              <div className="bg-purple-50/70 border border-purple-100/90 p-2.5 rounded-2xl flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                  <TrendingUp size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] font-extrabold text-purple-700 uppercase tracking-wider truncate">Completion Rate</p>
                  <p className="text-sm font-black text-slate-900 leading-none mt-0.5">{trendCompletionRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Area */}
          <div className="w-full flex-1 min-h-[220px] my-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={assessmentTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 'bold', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="Created" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#createdGrad)" dot={{ r: 4, fill: '#3b82f6', stroke: '#ffffff', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="Completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#completedGrad)" dot={{ r: 4, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Footer Highlights */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5 text-[11px]">
              <Sparkles size={14} className="text-indigo-600 shrink-0" />
              <span>Peak activity recorded in <strong className="text-slate-900">{trendPeakMonth}</strong>.</span>
            </div>
            <button 
              type="button"
              onClick={() => navigate('/tpo/analytics')}
              className="text-indigo-600 hover:text-indigo-700 font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
            >
              Detailed Analytics →
            </button>
          </div>
        </div>

        {/* Activity Calendar Block */}
        <TPOActivityCalendar activities={stats?.calendarActivities || []} navigate={navigate} />
      </div>

      {/* 3. Middle Row: Batch Performance | Assessment Performance | Recent Assessments */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* Batch Performance Table */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Batch Performance</h3>
              <button 
                onClick={() => navigate('/tpo/students')} 
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                View All
              </button>
            </div>

            <div className="overflow-x-auto">
              {batchPerformance.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-xs font-bold">No batch performance records found</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs font-semibold">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 uppercase tracking-wider text-[10px]">
                      <th className="pb-3 font-extrabold">Batch</th>
                      <th className="pb-3 font-extrabold">Students</th>
                      <th className="pb-3 font-extrabold">Avg. Score</th>
                      <th className="pb-3 font-extrabold">Pass Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {batchPerformance.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 font-bold text-slate-800">{item.batch_name}</td>
                        <td className="py-3 text-slate-600">{item.student_count}</td>
                        <td className="py-3 text-slate-600 font-bold">{item.avg_score}%</td>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-800 w-7">{item.pass_rate}%</span>
                            <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${item.pass_rate >= 65 ? 'bg-emerald-500' : 'bg-orange-500'}`} 
                                style={{ width: `${Math.min(item.pass_rate, 100)}%` }} 
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Assessment Performance Donut Chart */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Assessment Performance</h3>
              <div className="relative">
                <select
                  value={perfFilter}
                  onChange={(e) => setPerfFilter(e.target.value)}
                  className="appearance-none bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl px-3 py-1.5 pr-7 focus:outline-none cursor-pointer transition-colors"
                >
                  <option value="This Month">This Month</option>
                  <option value="Last Month">Last Month</option>
                  <option value="All Time">All Time</option>
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
              <div className="relative flex items-center justify-center w-40 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={assessmentPerformance.breakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="count"
                    >
                      {assessmentPerformance.breakdown.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-black text-slate-900">{assessmentPerformance.total}</span>
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
                </div>
              </div>

              <div className="space-y-2 text-xs font-bold text-slate-600">
                {assessmentPerformance.breakdown.map((item: any, i: number) => (
                  <div key={i} className="flex items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-slate-900 font-extrabold">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Assessments List */}
        <div className="lg:col-span-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-slate-900 tracking-tight">Recent Assessments</h3>
              <button 
                onClick={() => navigate('/tpo/assessments')} 
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                View All
              </button>
            </div>

            <div className="space-y-3">
              {recentAssessments.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-xs font-bold">No completed assessments yet</p>
                </div>
              ) : (
                recentAssessments.map((item: any, idx: number) => (
                  <div key={item.id || idx} className="flex items-center justify-between p-3 bg-slate-50/70 hover:bg-slate-50 rounded-2xl border border-slate-100/80 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl ${idx % 4 === 0 ? 'bg-teal-100/80 text-teal-600' : idx % 4 === 1 ? 'bg-purple-100/80 text-purple-600' : idx % 4 === 2 ? 'bg-amber-100/80 text-amber-600' : 'bg-blue-100/80 text-blue-600'}`}>
                        {idx % 4 === 0 ? <FileText size={18} /> : idx % 4 === 1 ? <Database size={18} /> : idx % 4 === 2 ? <Code2 size={18} /> : <FileText size={18} />}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm leading-tight">{item.title}</h4>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">{item.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                        {item.status || 'Completed'}
                      </span>
                      <span className="font-black text-slate-900 text-sm w-9 text-right">{item.score}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Actions */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="text-base font-black text-slate-900 tracking-tight mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/tpo/assessments')}
            className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <Plus size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">Create Assessment</h4>
              <p className="text-xs text-slate-400 font-medium">Build a new test</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/tpo/students')}
            className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <Users size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">View Students</h4>
              <p className="text-xs text-slate-400 font-medium">Monitor student profiles</p>
            </div>
          </button>

          <button
            onClick={() => navigate('/tpo/reports')}
            className="flex items-center gap-3.5 p-4 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/30 transition-all text-left group"
          >
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <BarChart2 size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">View Reports</h4>
              <p className="text-xs text-slate-400 font-medium">Download placement reports</p>
            </div>
          </button>
        </div>
      </div>



      {/* AI Placement Insights Section */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl shadow-blue-500/20">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-white/20 p-2 rounded-xl">
            <BrainCircuit size={24} />
          </div>
          <h3 className="text-xl font-black uppercase tracking-tight">AI Placement Insights</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <h4 className="font-bold text-blue-100 uppercase text-xs tracking-wider mb-2">College Strengths</h4>
              <p className="text-sm">Students across assigned colleges show exceptional proficiency in Data Structures and Algorithms with an average score of 82/100.</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10">
              <h4 className="font-bold text-orange-100 uppercase text-xs tracking-wider mb-2">Skill Gaps Identified</h4>
              <p className="text-sm">A 40% deficiency in Soft Skills and Corporate Etiquette has been detected across CSE departments. Recommended workshop: "Corporate Communication 101".</p>
            </div>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/10 flex flex-col justify-center items-center text-center">
            <AlertCircle size={48} className="text-blue-200 mb-4" />
            <h4 className="font-bold text-white uppercase tracking-wider mb-2">At-Risk Students</h4>
            <p className="text-sm text-blue-100 mb-4">{metrics.atRiskStudents || 0} students have a placement readiness score below 40%.</p>
            <button 
              onClick={handleOpenAtRiskList}
              className="bg-white text-blue-600 px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors"
            >
              View List
            </button>
          </div>
        </div>
      </div>

      {/* At-Risk Students Modal */}
      {showAtRiskModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <AlertCircle size={22} className="text-red-500" />
                  At-Risk Students Monitoring
                </h2>
                <p className="text-sm text-slate-500 font-medium">Students under assigned colleges with score below 45% or profile completeness below 60%</p>
              </div>
              <button 
                onClick={() => setShowAtRiskModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 p-2 rounded-full"
              >
                ✕
              </button>
            </div>
            
            <div className="p-8 space-y-4 overflow-y-auto flex-1">
              {loadingStudents ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mb-2"></div>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Syncing College Profiles...</p>
                </div>
              ) : atRiskList.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="font-bold text-lg">No students are currently at extreme placement risk!</p>
                  <p className="text-sm mt-1">Excellent job! All registered students meet or exceed readiness thresholds.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {atRiskList.map((st) => (
                    <div key={st.id} className="p-5 bg-red-50/50 border border-red-100 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div>
                        <h4 className="font-bold text-slate-900">{st.full_name}</h4>
                        <p className="text-xs font-medium text-slate-500">{st.college_name}</p>
                        <p className="text-xs text-slate-400 font-bold mt-1">{st.email} • {st.contact || 'No contact details'}</p>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Talent Score</p>
                          <span className="text-lg font-black text-red-600">{st.talent_score || 0}%</span>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Profile</p>
                          <span className="text-sm font-black text-slate-700">{st.completeness_score || 0}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                type="button" 
                onClick={() => setShowAtRiskModal(false)}
                className="px-6 py-3 font-bold bg-slate-800 text-white hover:bg-slate-900 transition-all rounded-xl text-xs uppercase tracking-wider"
              >
                Close List
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
