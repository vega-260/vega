import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  Clock,
  FileText,
  Eye,
  XCircle,
  LayoutGrid,
  ArrowLeft,
  GraduationCap
} from 'lucide-react';
import api from '../../services/api';

import { toast } from 'react-hot-toast';

export default function TPOStudents() {
  const [viewMode, setViewMode] = useState<'BATCHES' | 'STUDENTS'>('BATCHES');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    dept: '',
    year: '',
    status: '',
    batch: ''
  });
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [passoutModalBatch, setPassoutModalBatch] = useState<any>(null);
  const [passoutLoading, setPassoutLoading] = useState(false);

  const handleConfirmPassout = async () => {
    if (!passoutModalBatch) return;
    setPassoutLoading(true);
    try {
      const res = await api.post('/tpo/batches/passout', { batch_name: passoutModalBatch.name });
      if (res.data.success) {
        toast.success(`Batch ${passoutModalBatch.name} moved to Alumni tab!`);
        setPassoutModalBatch(null);
        fetchStudents();
      } else {
        toast.error(res.data.message || 'Failed to update batch');
      }
    } catch (error) {
      console.error('Error marking batch as passout:', error);
      toast.error('Error marking batch as passout');
    } finally {
      setPassoutLoading(false);
    }
  };

  const handleNotImplemented = (feature: string) => {
    toast(`${feature} feature is coming soon!`, {
      icon: '🚀',
      style: {
        borderRadius: '16px',
        background: '#333',
        color: '#fff',
      },
    });
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const [studentsRes, batchesRes] = await Promise.all([
        api.get('/tpo/students'),
        api.get('/tpo/batches')
      ]);
      if (studentsRes.data.success) {
        setStudents(studentsRes.data.data);
      }
      if (batchesRes.data.success) {
        setBatches(batchesRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching students and batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReadinessBadge = (score: number) => {
    if (score >= 80) return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">High Readiness</span>;
    if (score >= 50) return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase">Medium Readiness</span>;
    return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase">At Risk</span>;
  };

  const batchStats = useMemo(() => {
    const stats = new Map();
    
    // Pre-populate with actual academic batches from TPO/Admin
    batches.forEach(b => {
      stats.set(b.batch_name, {
        id: b.batch_name,
        name: b.batch_name,
        status: b.status || 'ACTIVE',
        count: 0,
        deptCounts: {},
        department: b.department,
        academic_year: b.academic_year
      });
    });

    // Default No Batch Assigned card
    stats.set('UNASSIGNED', { id: 'UNASSIGNED', name: 'No Batch Assigned', status: 'ACTIVE', count: 0, deptCounts: {} });
    
    students.forEach(s => {
      const bId = s.batch_name || s.batch || 'UNASSIGNED';
      if (!stats.has(bId)) {
        stats.set(bId, { id: bId, name: s.batch_name || s.batch || bId, status: s.batch_status || 'ACTIVE', count: 0, deptCounts: {} });
      }
      const b = stats.get(bId);
      b.count++;

      let studentDept = (s.department || '').trim();
      if (!studentDept) {
        try {
          const edu = typeof s.education_json === 'string' ? JSON.parse(s.education_json) : (s.education_json || {});
          studentDept = (edu.department || edu.branch || '').trim();
        } catch (e) {}
      }
      if (!studentDept && b.department) {
        studentDept = b.department.trim();
      }
      if (!studentDept) {
        studentDept = 'General';
      }

      if (!b.deptCounts) {
        b.deptCounts = {};
      }
      b.deptCounts[studentDept] = (b.deptCounts[studentDept] || 0) + 1;
    });

    // For batches with no students yet, set default dept if specified
    stats.forEach(b => {
      if (b.count === 0 && b.department && b.department.trim()) {
        b.deptCounts[b.department.trim()] = 0;
      }
    });

    const result = Array.from(stats.values()).filter(b => b.status !== 'PASSOUT' && (b.count > 0 || b.id !== 'UNASSIGNED'));
    return result.sort((a, b) => {
      if (a.id === 'UNASSIGNED') return 1;
      if (b.id === 'UNASSIGNED') return -1;
      return a.name.localeCompare(b.name);
    });
  }, [students, batches]);

  const batchesForFilter = batchStats.filter(b => b.id !== 'UNASSIGNED');

  const activeBatch = selectedBatchId || filters.batch;

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();

    students.forEach(s => {
      if (activeBatch) {
        const sBatch = s.batch_name || s.batch || 'UNASSIGNED';
        if (sBatch !== activeBatch) return;
      }

      let edu: any = {};
      try { edu = typeof s.education_json === 'string' ? JSON.parse(s.education_json) : s.education_json || {}; } catch(e) {}
      const d = (s.department || edu.department || '').trim();
      if (d) set.add(d);
    });

    if (activeBatch && set.size === 0) {
      const bObj = batches.find(b => b.batch_name === activeBatch || String(b.id) === String(activeBatch));
      if (bObj?.department && bObj.department.trim()) {
        set.add(bObj.department.trim());
      }
    }

    return Array.from(set).sort();
  }, [students, batches, activeBatch]);

  const passoutBatchNames = useMemo(() => {
    const set = new Set<string>();
    batches.forEach(b => {
      if (b.status === 'PASSOUT') set.add(b.batch_name);
    });
    return set;
  }, [batches]);

  const filteredStudents = students.filter(s => {
    const sBatchId = s.batch_name || s.batch || 'UNASSIGNED';

    if (s.batch_status === 'PASSOUT' || passoutBatchNames.has(sBatchId)) {
      return false;
    }

    if (activeBatch) {
      if (sBatchId !== activeBatch) return false;
    }

    const matchesSearch = s.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.college_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Parse education_json for dept/year fallback
    let edu: any = {};
    try { edu = typeof s.education_json === 'string' ? JSON.parse(s.education_json) : s.education_json || {}; } catch(e) {}
    
    const studentDept = (s.department || edu.department || '').trim();
    const matchesDept = !filters.dept || studentDept.toLowerCase() === filters.dept.toLowerCase() || studentDept.toLowerCase().includes(filters.dept.toLowerCase());
    const matchesYear = !filters.year || edu.year === filters.year;
    
    const matchesStatus = !filters.status || (
      filters.status === 'high' ? ((s.talent_score || 0) >= 80) :
      filters.status === 'medium' ? ((s.talent_score || 0) >= 50 && (s.talent_score || 0) < 80) :
      filters.status === 'at-risk' ? ((s.talent_score || 0) < 50) : true
    );
    
    return matchesSearch && matchesDept && matchesYear && matchesStatus;
  });

  const handleBatchClick = (batchId: string) => {
    setSelectedBatchId(batchId);
    setFilters(prev => ({ ...prev, batch: batchId, dept: '' }));
    setViewMode('STUDENTS');
  };

  const handleBackToBatches = () => {
    setSelectedBatchId(null);
    setFilters(prev => ({ ...prev, batch: '', dept: '' }));
    setViewMode('BATCHES');
  };

  return (
    <div className="space-y-8">
      {viewMode === 'BATCHES' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
            <div>
              <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">Student Monitoring</h1>
              <p className="text-sm font-bold text-slate-500 mt-1">Select a batch to monitor active students or mark batch as passout</p>
            </div>
            <div className="flex items-center gap-3">
              <Link 
                to="/tpo/alumni"
                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-sm shrink-0"
              >
                <GraduationCap size={16} /> Alumni Directory
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              <div className="col-span-full text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-sm">
                Loading Batches...
              </div>
            ) : batchStats.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 font-bold uppercase tracking-wider text-sm">
                No Batches Found
              </div>
            ) : (
              batchStats.map(batch => (
                <div 
                  key={batch.id}
                  onClick={() => handleBatchClick(batch.id)}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-[280px]"
                >
                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                        <Users size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        {batch.status === 'PASSOUT' ? (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <GraduationCap size={12} />
                            Passout
                          </span>
                        ) : batch.status === 'INACTIVE' ? (
                          <span className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle size={12} />
                            Disabled
                          </span>
                        ) : batch.id === 'UNASSIGNED' ? (
                          <span className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            Default
                          </span>
                        ) : (
                          <span className="bg-green-50 text-green-600 border border-green-100 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
                            Active
                          </span>
                        )}

                        {batch.id !== 'UNASSIGNED' && batch.status !== 'PASSOUT' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPassoutModalBatch(batch);
                            }}
                            className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500 text-amber-700 hover:text-white border border-amber-200/80 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shrink-0 shadow-sm"
                            title="Mark Batch as Passout & Move to Alumni"
                          >
                            <GraduationCap size={13} />
                            Passout
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="font-black text-lg text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight">
                      {batch.name}
                    </h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      {batch.count} {batch.count === 1 ? 'Student' : 'Students'} Total
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">
                      Departments ({Object.keys(batch.deptCounts || {}).length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto pr-1">
                      {Object.keys(batch.deptCounts || {}).length === 0 ? (
                        <div className="col-span-2 text-xs text-slate-400 font-medium italic p-2 bg-slate-50/80 rounded-xl text-center border border-dashed border-slate-200">
                          No departments recorded
                        </div>
                      ) : (
                        Object.entries(batch.deptCounts || {}).map(([dept, count]: [string, any]) => (
                          <div 
                            key={dept} 
                            className="flex items-center justify-between bg-slate-50 rounded-xl px-2.5 py-2 border border-slate-100 hover:border-slate-200 transition-colors"
                          >
                            <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider truncate mr-1" title={dept}>
                              {dept}
                            </span>
                            <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 font-mono shrink-0">
                              {Number(count)} {Number(count) === 1 ? 'Std' : 'Stds'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              onClick={handleBackToBatches}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm uppercase tracking-wider transition-colors w-fit"
            >
              <ArrowLeft size={16} /> Back to Batches
            </button>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {!activeBatch ? 'All Students' : activeBatch === 'UNASSIGNED' ? 'Unassigned Students' : (batchStats.find(b => b.id === activeBatch || b.name === activeBatch)?.name || activeBatch)}
            </h2>
          </div>

          {/* Filters & Search */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name, email, college or batch..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border-none bg-slate-50 focus:ring-2 focus:ring-blue-500 font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-xs uppercase tracking-widest text-slate-600 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
              value={filters.dept}
              onChange={(e) => setFilters({...filters, dept: e.target.value})}
            >
              <option value="">All Departments</option>
              {availableDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
               <ChevronRight className="rotate-90 text-slate-400" size={14} />
            </div>
          </div>

          <div className="relative group">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-xs uppercase tracking-widest text-slate-600 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
              value={filters.batch || selectedBatchId || ''}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedBatchId(val || null);
                setFilters(prev => ({ ...prev, batch: val, dept: '' }));
              }}
            >
              <option value="">All Batches</option>
              {batchesForFilter.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.status === 'INACTIVE' ? '(INACTIVE)' : ''}
                </option>
              ))}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
               <ChevronRight className="rotate-90 text-slate-400" size={14} />
            </div>
          </div>

          <div className="relative group">
            <AlertTriangle className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors" size={16} />
            <select 
              className="w-full pl-10 pr-4 py-3 rounded-xl border-none bg-slate-50 focus:ring-2 focus:ring-blue-500 font-bold text-xs uppercase tracking-widest text-slate-600 appearance-none cursor-pointer hover:bg-slate-100 transition-all"
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
            >
              <option value="">All Readiness</option>
              <option value="high">High Readiness</option>
              <option value="medium">Medium Readiness</option>
              <option value="at-risk">At Risk</option>
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
               <ChevronRight className="rotate-90 text-slate-400" size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Student Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">College & Batch</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Talent Score</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Placement Readiness</th>
                <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">Loading students...</td></tr>
              ) : filteredStudents.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-500 font-medium">No students found</td></tr>
              ) : (
                filteredStudents.map((student) => {
                  let studentDepartment = student.department;
                  if (!studentDepartment) {
                    try {
                      const edu = typeof student.education_json === 'string' ? JSON.parse(student.education_json) : (student.education_json || {});
                      studentDepartment = edu.department || edu.branch;
                    } catch (e) {}
                  }
                  if (!studentDepartment) {
                    studentDepartment = batches.find(b => b.batch_name === (student.batch_name || student.batch))?.department;
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-black">
                            {student.full_name?.[0] || 'S'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{student.full_name || 'Incomplete Profile'}</p>
                            <p className="text-xs text-slate-500 font-medium">{student.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-700">{student.college_name}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                            {studentDepartment || 'General'}
                          </span>
                          {student.batch_status === 'INACTIVE' ? (
                            <span className="bg-red-50 text-red-600 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-100">
                              {student.batch_name || student.batch || 'Batch Inactive'}
                            </span>
                          ) : (student.batch_name || student.batch) ? (
                            <span className="bg-blue-50 text-blue-600 text-[10px] font-black uppercase px-2 py-0.5 rounded">
                              {student.batch_name || student.batch}
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-400 text-[10px] font-bold px-2 py-0.5 rounded">
                              No Batch Assigned
                            </span>
                          )}
                        </div>
                      </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500" 
                            style={{width: `${student.talent_score || 0}%`}}
                          />
                        </div>
                        <span className="text-sm font-black text-slate-700">{student.talent_score || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getReadinessBadge(student.talent_score || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedStudent(student)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="View Student details"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xl shadow-inner">
                  {selectedStudent.full_name?.[0] || 'S'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">{selectedStudent.full_name || 'Incomplete Profile'}</h3>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">{selectedStudent.email}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedStudent(null)}
                className="text-slate-400 hover:text-slate-600 font-bold bg-white border border-slate-200 hover:bg-slate-50 p-2.5 rounded-full"
              >
                ✕
              </button>
            </div>

            <div className="p-8 space-y-6 overflow-y-auto flex-1">
              {selectedStudent.batch_status === 'INACTIVE' && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3">
                  <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-black text-red-900 text-xs uppercase tracking-wider">Academic Batch Disabled</h5>
                    <p className="text-[11px] text-red-700 font-semibold mt-1">
                      This student belongs to an INACTIVE academic batch ({selectedStudent.batch_name || selectedStudent.batch}). TPO side interactions and placement operations are currently suspended.
                    </p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Institutional Affiliation</h4>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-xs font-black text-slate-900 uppercase">{selectedStudent.college_name}</p>
                    <p className="text-xs font-bold text-slate-500 mt-2">
                      Department: {(() => {
                        try {
                          const edu = typeof selectedStudent.education_json === 'string' ? JSON.parse(selectedStudent.education_json) : selectedStudent.education_json;
                          return edu?.department || 'Computer Science & Engineering';
                        } catch (e) {
                          return 'Computer Science & Engineering';
                        }
                      })()}
                    </p>
                    <p className="text-xs text-slate-400 font-bold mt-1">Status: Regular / Final Year</p>
                    {selectedStudent.batch && (
                      <p className="text-xs mt-2">
                        <span className="font-bold text-slate-500">Batch:</span>{' '}
                        <span className="bg-blue-50 border border-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-black uppercase inline-block">
                          {selectedStudent.batch_name || selectedStudent.batch}
                        </span>
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Placement Readiness</h4>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-500">Talent Assessment Score</span>
                        <span className="text-xs font-black text-blue-600">{selectedStudent.talent_score || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{width: `${selectedStudent.talent_score || 0}%`}} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-500">Profile Completeness</span>
                        <span className="text-xs font-black text-green-600">{selectedStudent.completeness_score || 0}%</span>
                      </div>
                      <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500" style={{width: `${selectedStudent.completeness_score || 0}%`}} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Skills Inventory</h4>
                <div className="flex flex-wrap gap-2">
                  {(() => {
                    try {
                      const arr = typeof selectedStudent.skills_json === 'string' ? JSON.parse(selectedStudent.skills_json) : (selectedStudent.skills_json || []);
                      if (Array.isArray(arr) && arr.length > 0) {
                        return arr.map((sk: string, idx) => (
                          <span key={idx} className="bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-xl">
                            {sk}
                          </span>
                        ));
                      }
                    } catch(e) {}
                    return ['React', 'Node.js', 'SQL', 'Python', 'Critical Thinking'].map((sk, idx) => (
                      <span key={idx} className="bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded-xl">
                        {sk}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Professional Documents</h4>
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Standard Resume Document</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide mt-0.5">Format: PDF (A4 Single page)</p>
                    </div>
                  </div>
                  {selectedStudent.resume_url ? (
                    <a 
                      href={selectedStudent.resume_url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow hover:bg-blue-700 transition"
                    >
                      View Resume
                    </a>
                  ) : (
                    <button 
                      onClick={() => toast('No resume file has been uploaded by the student yet.')}
                      className="px-4 py-2 bg-slate-200 text-slate-500 rounded-xl text-xs font-bold uppercase tracking-wider cursor-not-allowed"
                    >
                      Unavailable
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setSelectedStudent(null)}
                className="px-6 py-3 font-bold bg-slate-800 hover:bg-slate-900 text-white transition-all rounded-xl text-xs uppercase tracking-wider"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Passout Confirmation Modal */}
      {passoutModalBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <GraduationCap size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mark Batch as Passout?</h3>
              <p className="text-slate-500 text-sm leading-relaxed">
                Are you sure you want to move <strong>{passoutModalBatch.name}</strong> to the <strong>Alumni Directory</strong>?
              </p>
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-3.5 text-amber-900 text-xs font-semibold space-y-1 mt-2">
                <p className="font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Alumni Mode Rules
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                  <li>The batch will be moved to the Alumni page.</li>
                  <li>No active tasks, assignments, or placement drives can be allocated to this batch.</li>
                  <li>TPO can view full detailed information of all students in Alumni anytime.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPassoutModalBatch(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={passoutLoading}
                onClick={handleConfirmPassout}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center gap-2"
              >
                {passoutLoading ? 'Moving to Alumni...' : 'Confirm Passout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
