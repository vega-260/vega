import React, { useEffect, useState, useMemo } from 'react';
import { 
  GraduationCap, 
  Search, 
  Filter, 
  Users, 
  ArrowLeft, 
  Eye, 
  Building2, 
  Mail, 
  Phone, 
  Award, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  RotateCcw,
  Sparkles,
  BookOpen,
  Briefcase
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export default function TPOAlumni() {
  const [viewMode, setViewMode] = useState<'BATCHES' | 'STUDENTS'>('BATCHES');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [reactivateModalBatch, setReactivateModalBatch] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
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
      console.error('Error fetching alumni data:', error);
      toast.error('Failed to load alumni data');
    } finally {
      setLoading(false);
    }
  };

  // Filter batches that are PASSOUT / ALUMNI
  const alumniBatches = useMemo(() => {
    const passoutSet = new Set<string>();
    batches.forEach(b => {
      if (b.status === 'PASSOUT') {
        passoutSet.add(b.batch_name);
      }
    });

    const stats = new Map<string, any>();

    // Include batches explicitly marked as PASSOUT
    batches.filter(b => b.status === 'PASSOUT').forEach(b => {
      stats.set(b.batch_name, {
        id: b.batch_name,
        name: b.batch_name,
        status: 'PASSOUT',
        count: 0,
        deptCounts: {},
        department: b.department,
        academic_year: b.academic_year
      });
    });

    // Accumulate students belonging to these passout batches
    students.forEach(s => {
      const bId = s.batch_name || s.batch;
      if (bId && (passoutSet.has(bId) || s.batch_status === 'PASSOUT')) {
        if (!stats.has(bId)) {
          stats.set(bId, {
            id: bId,
            name: bId,
            status: 'PASSOUT',
            count: 0,
            deptCounts: {}
          });
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
        if (!studentDept) studentDept = 'General';

        b.deptCounts[studentDept] = (b.deptCounts[studentDept] || 0) + 1;
      }
    });

    return Array.from(stats.values());
  }, [batches, students]);

  // Handle reactivating a batch from alumni back to active
  const handleReactivateBatch = async () => {
    if (!reactivateModalBatch) return;
    setActionLoading(true);
    try {
      const res = await api.post('/tpo/batches/reactivate', { batch_name: reactivateModalBatch.name });
      if (res.data.success) {
        toast.success(`Batch ${reactivateModalBatch.name} reactivated to Active Batches`);
        setReactivateModalBatch(null);
        fetchData();
      } else {
        toast.error(res.data.message || 'Failed to reactivate batch');
      }
    } catch (error) {
      console.error('Reactivate batch error:', error);
      toast.error('Error reactivating batch');
    } finally {
      setActionLoading(false);
    }
  };

  const activeBatch = selectedBatchId;

  // Filter students for selected alumni batch
  const filteredStudents = useMemo(() => {
    if (!activeBatch) return [];
    return students.filter(s => {
      const sBatch = s.batch_name || s.batch;
      if (sBatch !== activeBatch) return false;

      const matchesSearch = 
        (s.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.phone_number || '').includes(searchTerm);

      let studentDept = (s.department || '').trim();
      if (!studentDept) {
        try {
          const edu = typeof s.education_json === 'string' ? JSON.parse(s.education_json) : (s.education_json || {});
          studentDept = (edu.department || edu.branch || '').trim();
        } catch (e) {}
      }

      const matchesDept = !deptFilter || studentDept.toLowerCase().includes(deptFilter.toLowerCase());

      return matchesSearch && matchesDept;
    });
  }, [students, activeBatch, searchTerm, deptFilter]);

  const handleBatchClick = (batchId: string) => {
    setSelectedBatchId(batchId);
    setDeptFilter('');
    setViewMode('STUDENTS');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Alumni Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold uppercase tracking-wider">
              <GraduationCap size={14} /> Alumni & Passout Directory
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight italic">
              GRADUATED BATCHES & ALUMNI
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl font-medium">
              Historical archive of graduated academic batches. TPO can view full detailed profile records of alumni students. Task and assignment allocations are disabled for passout batches.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              <Award size={24} />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-400">{alumniBatches.length}</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Passout Batches</p>
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'BATCHES' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              <GraduationCap className="text-amber-500" size={20} />
              Alumni Batches ({alumniBatches.length})
            </h2>
          </div>

          {alumniBatches.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto">
                <GraduationCap size={32} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">No Passout Batches Yet</h3>
                <p className="text-slate-500 text-sm max-w-md mx-auto">
                  When a batch completes its academic tenure, click the <strong>Passout</strong> button on the Student Monitoring page to move the batch into this Alumni Directory.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {alumniBatches.map(batch => (
                <div 
                  key={batch.id}
                  onClick={() => handleBatchClick(batch.id)}
                  className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between h-[280px] relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none" />

                  <div>
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black group-hover:scale-110 transition-transform">
                        <GraduationCap size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={12} className="text-amber-600" />
                          Passout / Alumni
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setReactivateModalBatch(batch);
                          }}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Reactivate Batch"
                        >
                          <RotateCcw size={15} />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-black text-lg text-slate-900 group-hover:text-amber-600 transition-colors uppercase tracking-tight">
                      {batch.name}
                    </h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mt-0.5 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      {batch.count} {batch.count === 1 ? 'Alumnus' : 'Alumni Students'} Total
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-0.5">
                      Departments ({Object.keys(batch.deptCounts || {}).length})
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-24 overflow-y-auto pr-1">
                      {Object.keys(batch.deptCounts || {}).length === 0 ? (
                        <div className="col-span-2 text-xs text-slate-400 font-medium italic p-2 bg-slate-50/80 rounded-xl text-center border border-dashed border-slate-200">
                          No department breakdown
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
                            <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 font-mono shrink-0">
                              {Number(count)} {Number(count) === 1 ? 'Std' : 'Stds'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Students view for selected alumni batch */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setSelectedBatchId(null);
                  setViewMode('BATCHES');
                }}
                className="p-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-sm"
              >
                <ArrowLeft size={16} /> Back to Alumni Batches
              </button>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <GraduationCap size={20} className="text-amber-500" />
                {activeBatch} — Alumni List ({filteredStudents.length})
              </h2>
            </div>
          </div>

          {/* Archived Notice Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-amber-900 text-xs font-semibold">
            <AlertCircle className="text-amber-600 shrink-0" size={18} />
            <div>
              <span className="font-black uppercase tracking-wider block text-amber-800">GRADUATED / ARCHIVED BATCH</span>
              Tasks, skill assessments, and active placement drives cannot be assigned to alumni batches. Full student detail profiles are available for view and verification below.
            </div>
          </div>

          {/* Search & Filters */}
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="Search alumni by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl border-none bg-slate-50 focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-slate-700 placeholder-slate-400"
              />
            </div>
          </div>

          {/* Students Table */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Student</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Department & College</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Talent Score</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider">Placement Status</th>
                    <th className="p-4 text-[10px] font-black text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm font-semibold text-slate-700">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-wider">
                        No alumni records found matching criteria
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((student) => {
                      let edu = {};
                      try {
                        edu = typeof student.education_json === 'string' ? JSON.parse(student.education_json) : (student.education_json || {});
                      } catch (e) {}

                      const dept = student.department || (edu as any).department || 'General';

                      return (
                        <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-black uppercase text-sm shrink-0">
                                {student.full_name?.charAt(0) || 'S'}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{student.full_name || 'Unnamed Student'}</p>
                                <p className="text-xs text-slate-400 font-medium">{student.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-slate-800 uppercase text-xs">{student.college_name || 'College'}</p>
                            <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-black uppercase">
                              {dept}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div 
                                  className="bg-amber-500 h-full rounded-full" 
                                  style={{ width: `${Math.min(100, student.talent_score || 0)}%` }}
                                />
                              </div>
                              <span className="font-mono font-black text-xs text-slate-800">{student.talent_score || 0}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {student.placement_status === 'PLACED' ? (
                              <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase">
                                Placed
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-xl text-[10px] font-black uppercase">
                                Graduated
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => setSelectedStudent(student)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
                            >
                              <Eye size={14} /> Full Details
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
        </div>
      )}

      {/* Reactivate Confirmation Modal */}
      {reactivateModalBatch && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <RotateCcw size={24} />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Reactivate Batch?</h3>
              <p className="text-slate-500 text-sm">
                Are you sure you want to move <strong>{reactivateModalBatch.name}</strong> back to Active Batches?
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setReactivateModalBatch(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                disabled={actionLoading}
                onClick={handleReactivateBatch}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20"
              >
                {actionLoading ? 'Processing...' : 'Reactivate Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Full Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 space-y-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-2xl uppercase shadow-md shadow-amber-500/20">
                  {selectedStudent.full_name?.charAt(0) || 'S'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{selectedStudent.full_name}</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{selectedStudent.college_name || 'College Alumnus'}</p>
                  <span className="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] uppercase">
                    🎓 Alumni Batch: {selectedStudent.batch_name || selectedStudent.batch || 'Passout'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Content Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Information */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail size={12} /> Contact Information
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Email</span>
                    <span className="font-bold text-slate-900">{selectedStudent.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Phone Number</span>
                    <span className="font-bold text-slate-900">{selectedStudent.phone_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Academic & Department Info */}
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <BookOpen size={12} /> Academic Record
                </p>
                <div className="space-y-2 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Department</span>
                    <span className="font-bold text-slate-900">{selectedStudent.department || 'General'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Talent Overall Score</span>
                    <span className="font-mono font-black text-amber-600 text-sm">{selectedStudent.talent_score || 0} / 100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Placement Details */}
            <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Briefcase size={12} /> Placement Outcome
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-500">Status</span>
                  <p className="text-sm font-black text-slate-900">
                    {selectedStudent.placement_status === 'PLACED' ? 'PLACED IN CAMPUS DRIVE' : 'GRADUATED / HIGHER STUDIES / OFF-CAMPUS'}
                  </p>
                </div>
                {selectedStudent.placement_status === 'PLACED' && (
                  <span className="bg-green-100 text-green-800 font-bold px-3 py-1 rounded-xl text-xs uppercase">
                    Verified Placement
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-wider"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
