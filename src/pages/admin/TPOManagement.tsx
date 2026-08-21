import React, { useEffect, useState } from 'react';
import { 
  Plus, 
  Building2, 
  Users, 
  Mail, 
  Phone, 
  Trash2, 
  ExternalLink, 
  ShieldCheck, 
  ArrowRight, 
  Upload, 
  FileSpreadsheet, 
  AlertCircle,
  GraduationCap,
  Layers,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  Search,
  CheckCircle,
  Settings,
  Database,
  History,
  Activity,
  UserCheck,
  Edit2,
  FileText
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { isValidEmail, isValidName } from '../../utils/validators';
import { CollegeModal } from '../../components/admin/CollegeModal';
import { TpoModal } from '../../components/admin/TpoModal';

const PaginationControl = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}) => {
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems <= 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 text-xs font-semibold text-slate-600">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-slate-500 font-bold">
          Showing <span className="text-slate-900 font-black">{startItem}</span> to <span className="text-slate-900 font-black">{endItem}</span> of <span className="text-slate-900 font-black">{totalItems}</span> entries
        </span>
        <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
          <span className="text-slate-400 font-medium">Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          title="First page"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Previous page"
        >
          <ChevronLeft size={14} />
        </button>

        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) => (
            typeof p === 'number' ? (
              <button
                key={idx}
                type="button"
                onClick={() => onPageChange(p)}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-bold transition-all ${
                  currentPage === p
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {p}
              </button>
            ) : (
              <span key={idx} className="px-1 text-slate-400 font-extrabold">...</span>
            )
          ))}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Next page"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          title="Last page"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default function TPOManagement() {
  // Global View tabs
  const [activeTab, setActiveTab] = useState<'tree' | 'colleges' | 'tpos' | 'batches' | 'onboard' | 'logs'>('tree');
  
  // Data lists
  const [colleges, setColleges] = useState<any[]>([]);
  const [tpos, setTpos] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [treeData, setTreeData] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({
    totalColleges: 0,
    totalTPOs: 0,
    totalBatches: 0,
    totalStudents: 0,
    totalPlaced: 0,
    overallPlacementRate: '0.0'
  });

  // UI state managers
  const [loading, setLoading] = useState(true);
  const [expandedColleges, setExpandedColleges] = useState<Record<number, boolean>>({});
  const [expandedBatches, setExpandedBatches] = useState<Record<number, boolean>>({});
  const [treeSearch, setTreeSearch] = useState('');
  const [collegesSearch, setCollegesSearch] = useState('');
  const [tposSearch, setTposSearch] = useState('');
  const [batchesSearch, setBatchesSearch] = useState('');
  const [logsSearch, setLogsSearch] = useState('');

  // Pagination state
  const [pageSize, setPageSize] = useState(10);
  const [treePage, setTreePage] = useState(1);
  const [collegesPage, setCollegesPage] = useState(1);
  const [tposPage, setTposPage] = useState(1);
  const [batchesPage, setBatchesPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);

  useEffect(() => {
    setTreePage(1);
    setCollegesPage(1);
    setTposPage(1);
    setBatchesPage(1);
    setLogsPage(1);
  }, [treeSearch, collegesSearch, tposSearch, batchesSearch, logsSearch, activeTab, pageSize]);

  // Modals visibility
  const [showCollegeModal, setShowCollegeModal] = useState(false);
  const [showTpoModal, setShowTpoModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);

  // Edit contexts
  const [editingCollege, setEditingCollege] = useState<any | null>(null);
  const [editingTpo, setEditingTpo] = useState<any | null>(null);
  const [editingBatch, setEditingBatch] = useState<any | null>(null);

  const [batchForm, setBatchForm] = useState({
    college_id: '',
    batch_name: '',
    department: '',
    academic_year: '',
    semester: '',
    assigned_tpo_id: '',
    status: 'ACTIVE'
  });

  // Bulk student onboarding form
  const [bulkCollegeId, setBulkCollegeId] = useState('');
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [bulkDepartment, setBulkDepartment] = useState('');
  const [studentsText, setStudentsText] = useState('');
  const [parsedStudents, setParsedStudents] = useState<{ name: string; email: string; department?: string }[]>([]);
  const [onboardingInProgress, setOnboardingInProgress] = useState(false);

  // Selected batch for students view / manual additions
  const [selectedBatchForStudents, setSelectedBatchForStudents] = useState<any | null>(null);
  const [batchStudents, setBatchStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [manualStudentForm, setManualStudentForm] = useState({ name: '', email: '', department: '' });
  const [savingManualStudent, setSavingManualStudent] = useState(false);
  const [savingBatch, setSavingBatch] = useState(false);

  const savingBatchRef = React.useRef(false);
  const savingManualStudentRef = React.useRef(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [collegesRes, tposRes, batchesRes, treeRes, analyticsRes, logsRes] = await Promise.all([
        api.get('/admin/colleges'),
        api.get('/admin/tpos'),
        api.get('/admin/batches'),
        api.get('/admin/college-tree'),
        api.get('/admin/college-analytics'),
        api.get('/admin/audit-logs')
      ]);

      let fetchedCollegesCount = 0;
      if (collegesRes.data.success) {
        setColleges(collegesRes.data.data);
        fetchedCollegesCount = Array.isArray(collegesRes.data.data) ? collegesRes.data.data.length : 0;
      }
      if (tposRes.data.success) setTpos(tposRes.data.data);
      if (batchesRes.data.success) setBatches(batchesRes.data.data);
      if (treeRes.data.success) setTreeData(treeRes.data.data);
      if (analyticsRes.data.success) {
        setAnalytics({
          ...analyticsRes.data.data,
          totalColleges: fetchedCollegesCount || analyticsRes.data.data.totalColleges
        });
      }
      if (logsRes.data.success) setAuditLogs(logsRes.data.data);
    } catch (error) {
      console.error('Error fetching CMS details:', error);
      toast.error('Could not fetch College Management System data');
    } finally {
      setLoading(false);
    }
  };

  // Parser helper function for students text / CSV
  const parseStudentsFromRawText = (text: string) => {
    if (!text || typeof text !== 'string') return [];
    
    // Quick binary / replacement character check - reject string if it contains null bytes, binary control characters, or Unicode replacement characters (\uFFFD / )
    if (text.includes('\uFFFD') || text.includes('') || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text.slice(0, 5000))) {
      return [];
    }

    const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    // Valid student name regex: letters, numbers, spaces, dots, hyphens, apostrophes, ampersands, and parentheses
    const VALID_NAME_REGEX = /^[a-zA-Z0-9\s.,'()&/-]{2,100}$/;

    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const list: { name: string; email: string; department?: string }[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes('email') && line.toLowerCase().includes('name')) continue;
      
      // Skip lines with unprintable binary characters or XML/zip garbage
      if (line.includes('\uFFFD') || line.includes('') || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(line)) continue;
      if (line.includes('xmlns:') || line.includes('http://') || line.includes('https://') || line.includes('<') || line.includes('>')) continue;

      const parts = line.split(/,|\t|;/).map(p => p.trim());
      if (parts.length >= 2) {
        const emailIndex = parts.findIndex(part => EMAIL_REGEX.test(part.trim()));
        if (emailIndex !== -1) {
          const email = parts[emailIndex].trim();
          const nonEmailParts = parts.filter((_, idx) => idx !== emailIndex);
          const rawName = nonEmailParts[0]?.replace(/["']/g, '').trim() || '';
          const rawDept = nonEmailParts[1]?.replace(/["']/g, '').trim() || '';
          const name = rawName.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          const dept = rawDept.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
          if (name && email && VALID_NAME_REGEX.test(name)) {
            list.push({ name, email, department: dept || undefined });
          }
        }
      } else if (parts.length === 1 && EMAIL_REGEX.test(parts[0].trim())) {
        const email = parts[0].trim();
        const deducedName = email.split('@')[0].split(/[._+-]+/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
        if (VALID_NAME_REGEX.test(deducedName)) {
          list.push({ name: deducedName, email });
        }
      }
    }
    return list;
  };

  const handleStudentsTextChange = (text: string) => {
    // Sanitize binary control characters and replacement characters if pasted directly
    if (text.includes('\uFFFD') || text.includes('') || /[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text.slice(0, 2000))) {
      toast.error('Invalid text format. Binary or unsupported characters detected.');
      setStudentsText('');
      setParsedStudents([]);
      return;
    }
    setStudentsText(text);
    const parsed = parseStudentsFromRawText(text);
    setParsedStudents(parsed);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = (file.name || '').toLowerCase();
    const fileExt = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const allowedExtensions = ['csv', 'txt'];

    const unsupportedExts = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z', 'exe', 'rtf', 'odt', 'pages'];
    const isUnsupportedDoc = unsupportedExts.includes(fileExt) || 
      file.type.includes('word') || 
      file.type.includes('officedocument') || 
      file.type.includes('pdf') ||
      file.type.includes('excel') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('zip');

    if (!allowedExtensions.includes(fileExt) || isUnsupportedDoc || (!fileName.endsWith('.csv') && !fileName.endsWith('.txt'))) {
      toast.error('Invalid file format. Only .csv and .txt files are supported.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;

      // Binary / Word document content check: test for null bytes, control characters, or Unicode Replacement Characters (\uFFFD / )
      if (!text || text.includes('\uFFFD') || text.includes('') || /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/.test(text.slice(0, 5000))) {
        toast.error('Invalid file format. Only .csv and .txt files are supported.');
        setStudentsText('');
        setParsedStudents([]);
        e.target.value = '';
        return;
      }

      const parsed = parseStudentsFromRawText(text);
      if (parsed.length === 0) {
        toast.error('Invalid file format or no valid student entries found in the file. Only .csv and .txt files are supported.');
        setStudentsText('');
        setParsedStudents([]);
        e.target.value = '';
        return;
      }

      setStudentsText(text);
      setParsedStudents(parsed);
      toast.success(`Successfully parsed ${parsed.length} student${parsed.length === 1 ? '' : 's'} from roster file.`);
      e.target.value = '';
    };

    reader.onerror = () => {
      toast.error('Error reading file.');
      e.target.value = '';
    };

    reader.readAsText(file);
  };

  const handleEditCollegeClick = (col: any) => {
    setEditingCollege(col);
    setShowCollegeModal(true);
  };

  const handleDeleteCollege = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this college record?')) return;
    try {
      const res = await api.delete(`/admin/colleges/${id}`);
      if (res.data.success) {
        toast.success('College deleted successfully');
        fetchInitialData();
      }
    } catch (err: any) {
      toast.error('Error deleting college');
    }
  };

  // CRUD handlers - TPOs
  const handleEditTpoClick = (tpo: any) => {
    const assignedIds = tpo.assigned_college_ids ? String(tpo.assigned_college_ids).split(',').map(Number) : [];
    setEditingTpo({
      ...tpo,
      college_ids: assignedIds
    });
    setShowTpoModal(true);
  };

  const handleDeleteTpo = async (id: number) => {
    if (!window.confirm('Are you sure you want to completely delete this TPO account? This is irreversible.')) return;
    try {
      const res = await api.delete(`/admin/tpos/${id}`);
      if (res.data.success) {
        toast.success('TPO account and profile deleted successfully');
        fetchInitialData();
      }
    } catch (err: any) {
      toast.error('Error deleting TPO account');
    }
  };

  // CRUD handlers - Batches
  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingBatch || savingBatchRef.current) return;

    if (!batchForm.college_id) {
      toast.error('Please select a target college');
      return;
    }
    if (!batchForm.batch_name || !batchForm.batch_name.trim()) {
      toast.error('Please enter a valid batch name');
      return;
    }

    savingBatchRef.current = true;
    setSavingBatch(true);
    try {
      if (editingBatch) {
        const res = await api.put(`/admin/batches/${editingBatch.id}`, batchForm);
        if (res.data.success) {
          toast.success('Academic batch updated');
          setShowBatchModal(false);
          fetchInitialData();
        } else {
          toast.error(res.data.message || 'Failed to update academic batch');
        }
      } else {
        const res = await api.post('/admin/batches', batchForm);
        if (res.data.success) {
          toast.success('Academic batch created successfully');
          setShowBatchModal(false);
          fetchInitialData();
        } else {
          toast.error(res.data.message || 'Failed to create academic batch');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving academic batch');
    } finally {
      savingBatchRef.current = false;
      setSavingBatch(false);
    }
  };

  const handleEditBatchClick = (bat: any) => {
    setEditingBatch(bat);
    setBatchForm({
      college_id: String(bat.college_id),
      batch_name: bat.batch_name || '',
      department: bat.department || '',
      academic_year: bat.academic_year || '',
      semester: bat.semester || '',
      assigned_tpo_id: bat.assigned_tpo_id ? String(bat.assigned_tpo_id) : '',
      status: bat.status || 'ACTIVE'
    });
    setShowBatchModal(true);
  };

  const handleDeleteBatch = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this batch? All student relationships will be unlinked.')) return;
    try {
      const res = await api.delete(`/admin/batches/${id}`);
      if (res.data.success) {
        toast.success('Batch deleted successfully');
        fetchInitialData();
      }
    } catch (err: any) {
      toast.error('Error deleting batch');
    }
  };

  // Bulk student onboarding submit
  const handleBulkOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkCollegeId || !bulkBatchId || parsedStudents.length === 0) {
      toast.error('Please specify the Target College, Batch and supply a non-empty student roster.');
      return;
    }

    setOnboardingInProgress(true);
    try {
      const res = await api.post('/admin/onboard-batch', {
        college_id: Number(bulkCollegeId),
        batch_id: Number(bulkBatchId),
        department: bulkDepartment || undefined,
        students: parsedStudents
      });

      if (res.data.success) {
        toast.success(`Batch successfully onboarded! dispatched credentials via SMTP.`);
        setStudentsText('');
        setParsedStudents([]);
        setBulkCollegeId('');
        setBulkBatchId('');
        setBulkDepartment('');
        fetchInitialData();
        setActiveTab('tree');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error during batch student onboarding');
    } finally {
      setOnboardingInProgress(false);
    }
  };

  const handleViewStudentsClick = async (batch: any) => {
    setSelectedBatchForStudents(batch);
    setManualStudentForm({ name: '', email: '', department: batch.department || '' });
    setLoadingStudents(true);
    try {
      const res = await api.get(`/admin/batches/${batch.id}/students`);
      if (res.data.success) {
        setBatchStudents(res.data.data);
      } else {
        toast.error('Failed to load batch students');
      }
    } catch (error) {
      console.error(error);
      toast.error('Error loading batch students');
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleAddManualStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchForStudents || savingManualStudent || savingManualStudentRef.current) return;

    const trimmedName = manualStudentForm.name ? manualStudentForm.name.trim() : '';
    const trimmedEmail = manualStudentForm.email ? manualStudentForm.email.trim() : '';
    const trimmedDept = manualStudentForm.department ? manualStudentForm.department.trim() : '';

    if (!trimmedName) {
      toast.error('Please enter student full name');
      return;
    }

    if (!isValidName(trimmedName)) {
      toast.error('Please enter a valid student name (letters, spaces, dots, hyphens only)');
      return;
    }

    if (!trimmedEmail) {
      toast.error('Please enter student email address');
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      toast.error('Please enter a valid official email address (e.g. student@college.edu)');
      return;
    }

    savingManualStudentRef.current = true;
    setSavingManualStudent(true);
    try {
      const res = await api.post(`/admin/batches/${selectedBatchForStudents.id}/students`, {
        name: trimmedName,
        email: trimmedEmail,
        department: trimmedDept
      });
      if (res.data.success) {
        toast.success('Student added successfully to the batch');
        setManualStudentForm({ name: '', email: '', department: selectedBatchForStudents.department || '' });
        // Refresh the student list
        const studentsRes = await api.get(`/admin/batches/${selectedBatchForStudents.id}/students`);
        if (studentsRes.data.success) {
          setBatchStudents(studentsRes.data.data);
        }
        // Refresh the main batches list too, to update counts
        const batchesRes = await api.get('/admin/batches');
        if (batchesRes.data.success) {
          setBatches(batchesRes.data.data);
        }
      } else {
        toast.error(res.data.message || 'Failed to add student');
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Error adding student');
    } finally {
      savingManualStudentRef.current = false;
      setSavingManualStudent(false);
    }
  };

  // UI accordion toggle helpers
  const toggleCollegeExpand = (id: number) => {
    setExpandedColleges(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleBatchExpand = (id: number) => {
    setExpandedBatches(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Search filters
  const filteredTree = treeData.filter(col => {
    if (!treeSearch.trim()) return true;
    const searchLower = treeSearch.toLowerCase();
    return (
      (col.college_name && col.college_name.toLowerCase().includes(searchLower)) ||
      (col.college_code && col.college_code.toLowerCase().includes(searchLower)) ||
      (col.district && col.district.toLowerCase().includes(searchLower)) ||
      (col.state && col.state.toLowerCase().includes(searchLower))
    );
  });

  const filteredColleges = colleges.filter(col => {
    if (!collegesSearch.trim()) return true;
    const s = collegesSearch.toLowerCase();
    return (
      (col.college_name && col.college_name.toLowerCase().includes(s)) ||
      (col.college_code && col.college_code.toLowerCase().includes(s)) ||
      (col.university && col.university.toLowerCase().includes(s)) ||
      (col.district && col.district.toLowerCase().includes(s)) ||
      (col.state && col.state.toLowerCase().includes(s)) ||
      (col.official_email && col.official_email.toLowerCase().includes(s)) ||
      (col.principal_name && col.principal_name.toLowerCase().includes(s)) ||
      (col.placement_head && col.placement_head.toLowerCase().includes(s))
    );
  });

  const filteredTpos = tpos.filter(tpo => {
    if (!tposSearch.trim()) return true;
    const s = tposSearch.toLowerCase();
    return (
      (tpo.full_name && tpo.full_name.toLowerCase().includes(s)) ||
      (tpo.email && tpo.email.toLowerCase().includes(s)) ||
      (tpo.contact_number && tpo.contact_number.toLowerCase().includes(s)) ||
      (tpo.designation && tpo.designation.toLowerCase().includes(s)) ||
      (tpo.employee_id && tpo.employee_id.toLowerCase().includes(s)) ||
      (tpo.assigned_colleges && String(tpo.assigned_colleges).toLowerCase().includes(s))
    );
  });

  const filteredBatches = batches.filter(batch => {
    if (!batchesSearch.trim()) return true;
    const s = batchesSearch.toLowerCase();
    return (
      (batch.batch_name && batch.batch_name.toLowerCase().includes(s)) ||
      (batch.department && batch.department.toLowerCase().includes(s)) ||
      (batch.academic_year && batch.academic_year.toLowerCase().includes(s)) ||
      (batch.college_name && batch.college_name.toLowerCase().includes(s)) ||
      (batch.tpo_name && batch.tpo_name.toLowerCase().includes(s))
    );
  });

  const filteredLogs = auditLogs.filter(log => {
    if (!logsSearch.trim()) return true;
    const s = logsSearch.toLowerCase();
    return (
      (log.action && log.action.toLowerCase().includes(s)) ||
      (log.admin_email && log.admin_email.toLowerCase().includes(s)) ||
      (log.details && log.details.toLowerCase().includes(s)) ||
      (log.ip_address && log.ip_address.toLowerCase().includes(s))
    );
  });

  // Paginated Slices
  const paginatedTree = filteredTree.slice((treePage - 1) * pageSize, treePage * pageSize);
  const paginatedColleges = filteredColleges.slice((collegesPage - 1) * pageSize, collegesPage * pageSize);
  const paginatedTpos = filteredTpos.slice((tposPage - 1) * pageSize, tposPage * pageSize);
  const paginatedBatches = filteredBatches.slice((batchesPage - 1) * pageSize, batchesPage * pageSize);
  const paginatedLogs = filteredLogs.slice((logsPage - 1) * pageSize, logsPage * pageSize);

  return (
    <div className="w-full max-w-full min-w-0 text-slate-800 font-sans selection:bg-blue-500 selection:text-white">
      {/* Header */}
      <header className="mb-8 flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-200/80 pb-6 w-full min-w-0">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="px-3 py-1 text-xs font-black bg-blue-50 text-blue-600 rounded-full border border-blue-100 uppercase tracking-widest">
              Core Ecosystem
            </span>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
            VEGA College Management System
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Enterprise authority node for managing institutes, TPOs, academic batches, and automated student dispatches.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            id="register-new-college-btn"
            onClick={() => {
              setEditingCollege(null);
              setShowCollegeModal(true);
            }} 
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-600/15"
          >
            <Building2 size={16} /> Register New College
          </button>

          <button 
            id="register-new-tpo-btn"
            onClick={() => {
              setEditingTpo(null);
              setShowTpoModal(true);
            }} 
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm"
          >
            <Users size={16} /> Register TPO
          </button>

          <button 
            id="create-new-batch-btn"
            onClick={() => {
              setEditingBatch(null);
              setBatchForm({
                college_id: '', batch_name: '', department: '', academic_year: '',
                semester: '', assigned_tpo_id: '', status: 'ACTIVE'
              });
              setShowBatchModal(true);
            }} 
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/15"
          >
            <Layers size={16} /> Create Batch
          </button>
        </div>
      </header>

      {/* Analytics Bento Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-4 mb-8 w-full min-w-0">
        <div className="bg-white border border-slate-200/65 shadow-sm p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:shadow-md">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
            <Building2 size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block truncate">Colleges</span>
            <span className="text-xl lg:text-2xl font-black text-slate-900">{colleges.length > 0 ? colleges.length : analytics.totalColleges}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/65 shadow-sm p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:shadow-md">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <UserCheck size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block truncate">Active TPOs</span>
            <span className="text-xl lg:text-2xl font-black text-slate-900">{analytics.totalTPOs}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/65 shadow-sm p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:shadow-md">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
            <Layers size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block truncate">Batches</span>
            <span className="text-xl lg:text-2xl font-black text-slate-900">{analytics.totalBatches}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/65 shadow-sm p-4 rounded-2xl flex items-center gap-3.5 transition-all hover:shadow-md">
          <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block truncate">Students</span>
            <span className="text-xl lg:text-2xl font-black text-slate-900">{analytics.totalStudents}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200/65 shadow-sm p-4 rounded-2xl col-span-2 sm:col-span-1 flex items-center gap-3.5 transition-all hover:shadow-md">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
            <Activity size={20} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block truncate">Placement Rate</span>
            <span className="text-xl lg:text-2xl font-black text-slate-900">{analytics.overallPlacementRate}%</span>
          </div>
        </div>
      </section>

      {/* Main Panel Tabs */}
      <div className="flex border-b border-slate-200 mb-8 overflow-x-auto gap-2 scrollbar-none w-full min-w-0 max-w-full">
        <button 
          onClick={() => setActiveTab('tree')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'tree' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Database size={16} /> College Organizational Tree
        </button>

        <button 
          onClick={() => setActiveTab('colleges')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'colleges' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Building2 size={16} /> Manage Colleges
        </button>

        <button 
          onClick={() => setActiveTab('tpos')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'tpos' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Users size={16} /> Manage TPOs
        </button>

        <button 
          onClick={() => setActiveTab('batches')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'batches' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <Layers size={16} /> Academic Batches
        </button>

        <button 
          onClick={() => setActiveTab('onboard')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'onboard' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <FileSpreadsheet size={16} /> Bulk Student Onboarding
        </button>

        <button 
          onClick={() => setActiveTab('logs')}
          className={`px-5 py-4 font-bold text-sm flex items-center gap-2 transition-all border-b-2 whitespace-nowrap ${activeTab === 'logs' ? 'border-blue-600 text-blue-600 bg-blue-50/30' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
        >
          <History size={16} /> Audit Logs
        </button>
      </div>

      {/* RENDER CONTENT PANEL */}
      {loading ? (
        <div className="space-y-4 py-10">
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse"></div>
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse"></div>
          <div className="h-40 bg-slate-100 rounded-xl animate-pulse"></div>
        </div>
      ) : (
        <div className="transition-all duration-300">
          
          {/* TAB 1: ORGANIZATIONAL TREE */}
          {activeTab === 'tree' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Fuzzy search college, region, code..." 
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder-slate-400 transition-all"
                    value={treeSearch}
                    onChange={e => setTreeSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Structure: Admin &rarr; College &rarr; Batch &rarr; Students
                </div>
              </div>

              {filteredTree.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Building2 className="mx-auto text-slate-300 mb-4" size={48} />
                  <h3 className="text-lg font-bold text-slate-800 mb-1">No colleges matching roster search</h3>
                  <p className="text-slate-400 text-xs">Create colleges or try another keyword</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {paginatedTree.map(college => (
                    <div key={college.id} className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm transition-all duration-200 hover:border-slate-300 hover:shadow-md">
                      
                      {/* College Accordion Header */}
                      <div 
                        onClick={() => toggleCollegeExpand(college.id)}
                        className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50/55 transition-all select-none"
                      >
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
                            <Building2 size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-extrabold text-slate-800">{college.college_name}</h3>
                              <span className="px-2 py-0.5 text-[10px] bg-slate-100 border border-slate-200 text-slate-600 font-black rounded uppercase">
                                {college.college_code}
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 mt-0.5 block font-semibold">
                              {college.district ? `${college.district}, ` : ''}{college.state || 'Maharashtra'} &bull; {college.batches?.length || 0} Batches Registered
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${college.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                            {college.status}
                          </span>
                          {expandedColleges[college.id] ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                        </div>
                      </div>

                      {/* College Accordion Body */}
                      {expandedColleges[college.id] && (
                        <div className="border-t border-slate-100 bg-slate-50/35 p-6 space-y-6">
                          
                          {/* Batches Section */}
                          <div>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                                <Layers size={14} className="text-amber-500" /> Academic Batches ({college.batches?.length || 0})
                              </h4>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBatchForm({
                                    college_id: String(college.id), batch_name: '', department: '',
                                    academic_year: '', semester: '', assigned_tpo_id: '', status: 'ACTIVE'
                                  });
                                  setEditingBatch(null);
                                  setShowBatchModal(true);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-500 font-bold flex items-center gap-1"
                              >
                                <Plus size={14} /> New Batch
                              </button>
                            </div>

                            {(!college.batches || college.batches.length === 0) ? (
                              <div className="p-6 text-center bg-slate-100/60 rounded-xl border border-slate-200 text-slate-500 text-xs">
                                No active academic batches defined for this college.
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {college.batches.map((batch: any) => (
                                  <div key={batch.id} className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
                                    
                                    {/* Batch Accordion Header */}
                                    <div 
                                      onClick={() => toggleBatchExpand(batch.id)}
                                      className="p-4 flex items-center justify-between hover:bg-slate-50/50 cursor-pointer select-none"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-extrabold text-sm text-slate-800">{batch.batch_name}</span>
                                          <span className="text-[10px] font-black text-slate-500 uppercase bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                                            {batch.department || 'General'}
                                          </span>
                                        </div>
                                        <span className="text-[11px] text-slate-500 font-semibold block mt-1">
                                          TPO: <span className="text-slate-800 font-bold">{batch.tpo_name || 'Not Assigned'}</span> &bull; {batch.student_count || 0} Students
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setBulkCollegeId(String(college.id));
                                            setBulkBatchId(String(batch.id));
                                            setStudentsText('');
                                            setParsedStudents([]);
                                            setActiveTab('onboard');
                                          }}
                                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded text-[10px] font-black border border-blue-100 tracking-wider uppercase transition-all"
                                        >
                                          Import
                                        </button>
                                        {expandedBatches[batch.id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                                      </div>
                                    </div>

                                     {/* Batch Accordion Body (Students List) */}
                                    {expandedBatches[batch.id] && (
                                      <div className="bg-slate-50/50 border-t border-slate-100 p-3">
                                        {(!batch.students || batch.students.length === 0) ? (
                                          <div className="p-4 text-center text-slate-500 text-[11px] font-semibold flex flex-col items-center gap-2">
                                            <span>No students onboarded in this academic batch.</span>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleViewStudentsClick({
                                                  ...batch,
                                                  college_name: college.college_name
                                                });
                                              }}
                                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wide transition-all"
                                            >
                                              + Add Student Manually
                                            </button>
                                          </div>
                                        ) : (
                                          <div>
                                            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                                              {batch.students.map((student: any) => (
                                                <div key={student.id} className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-100/50 transition-all rounded">
                                                  <div>
                                                    <div className="font-extrabold text-slate-800">{student.full_name}</div>
                                                    <div className="text-[10px] text-slate-500 font-mono mt-0.5">{student.email}</div>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                    {student.talent_score && (
                                                      <span className="px-1.5 py-0.5 bg-sky-50 text-sky-600 border border-sky-100 rounded font-black text-[9px]">
                                                        TS: {student.talent_score}
                                                      </span>
                                                    )}
                                                    <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${student.user_status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                                      {student.user_status}
                                                    </span>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                            <div className="pt-2.5 mt-1 border-t border-slate-150 flex justify-end">
                                              <button 
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleViewStudentsClick({
                                                    ...batch,
                                                    college_name: college.college_name
                                                  });
                                                }}
                                                className="text-[10px] text-blue-600 hover:text-blue-500 font-extrabold flex items-center gap-1 bg-blue-50/50 hover:bg-blue-50 px-2.5 py-1 rounded-md transition-all uppercase tracking-wider"
                                              >
                                                Manage &bull; Add Manual
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      )}
                    </div>
                  ))}
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                    <PaginationControl 
                      currentPage={treePage} 
                      totalItems={filteredTree.length} 
                      pageSize={pageSize} 
                      onPageChange={setTreePage} 
                      onPageSizeChange={setPageSize} 
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MANAGE COLLEGES */}
          {activeTab === 'colleges' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search college, region, code, contact..." 
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder-slate-400 transition-all"
                    value={collegesSearch}
                    onChange={e => setCollegesSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Colleges: Showing {filteredColleges.length} of {colleges.length}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Building2 className="text-blue-600" /> College Directory Database
                  </h2>
                  <div className="text-xs text-slate-500 font-bold">
                    Total College Records: {filteredColleges.length}
                  </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full min-w-0">
                  {filteredColleges.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <Building2 className="mx-auto text-slate-300 mb-3" size={40} />
                      <p className="font-bold text-sm text-slate-600">No colleges matching search query</p>
                      <p className="text-xs text-slate-400 mt-1">Try another search keyword</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[800px] text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider">
                          <th className="p-4">College details</th>
                          <th className="p-4">College Code</th>
                          <th className="p-4">Location</th>
                          <th className="p-4">Primary Contact</th>
                          <th className="p-4">Authorities</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedColleges.map(college => (
                          <tr key={college.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-4">
                              <div>
                                <div className="font-extrabold text-slate-850 text-sm">{college.college_name}</div>
                                <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{college.university}</div>
                                {college.website && (
                                  <a href={college.website} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                                    {college.website} <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg font-black text-xs border border-slate-200/80 uppercase tracking-wider inline-block">
                                {college.college_code}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-bold text-xs">{college.district || 'Not specified'}</div>
                              <div className="text-slate-500 text-[11px] mt-0.5">{college.state || 'Maharashtra'}, {college.country || 'India'}</div>
                            </td>
                            <td className="p-4">
                              {college.official_email && (
                                <div className="flex items-center gap-1.5 text-slate-700 text-xs">
                                  <Mail size={12} className="text-slate-400" /> {college.official_email}
                                </div>
                              )}
                              {college.contact_number && (
                                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mt-1">
                                  <Phone size={12} className="text-slate-400" /> {college.contact_number}
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              {college.principal_name && (
                                <div className="text-slate-700 text-xs font-semibold">
                                  Prin: <span className="font-bold">{college.principal_name}</span>
                                </div>
                              )}
                              {college.placement_head && (
                                <div className="text-slate-500 text-[11px] mt-0.5 font-semibold">
                                  Head: <span className="font-bold">{college.placement_head}</span>
                                </div>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${college.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                {college.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleEditCollegeClick(college)}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 text-blue-600 rounded-lg transition-all border border-slate-200"
                                  title="Edit College Profile"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCollege(college.id)}
                                  className="p-2 bg-slate-50 hover:bg-red-50 text-red-600 rounded-lg transition-all border border-slate-200 hover:border-red-100"
                                  title="Deactivate College"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <PaginationControl 
                  currentPage={collegesPage} 
                  totalItems={filteredColleges.length} 
                  pageSize={pageSize} 
                  onPageChange={setCollegesPage} 
                  onPageSizeChange={setPageSize} 
                />
              </div>
            </div>
          )}

          {/* TAB 3: MANAGE TPOS */}
          {activeTab === 'tpos' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search TPO officer, email, phone, college..." 
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder-slate-400 transition-all"
                    value={tposSearch}
                    onChange={e => setTposSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Officers: Showing {filteredTpos.length} of {tpos.length}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Users className="text-blue-600" /> Training & Placement Officer (TPO) Registry
                  </h2>
                  <div className="text-xs text-slate-500 font-bold">
                    Total Registrants: {filteredTpos.length}
                  </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full min-w-0">
                  {filteredTpos.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <Users className="mx-auto text-slate-300 mb-3" size={40} />
                      <p className="font-bold text-sm text-slate-600">No TPOs matching search query</p>
                      <p className="text-xs text-slate-400 mt-1">Try another search keyword</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[720px] text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider">
                          <th className="p-4">Officer profile</th>
                          <th className="p-4">Designation & ID</th>
                          <th className="p-4">Contact Detail</th>
                          <th className="p-4">Assigned Institutes</th>
                          <th className="p-4">Ecosystem Status</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedTpos.map(tpo => (
                          <tr key={tpo.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-4">
                              <div className="font-extrabold text-slate-850 text-sm">{tpo.full_name}</div>
                              <div className="text-[11px] text-blue-600 font-semibold mt-0.5 flex items-center gap-1">
                                <Mail size={10} /> {tpo.email}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-bold text-xs">{tpo.designation || 'TPO Head'}</div>
                              <div className="text-slate-500 text-[11px] mt-0.5">Emp ID: {tpo.employee_id || 'N/A'}</div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-1.5 text-slate-700 text-xs">
                                <Phone size={12} className="text-slate-400" /> {tpo.contact_number || 'No contact info'}
                              </div>
                            </td>
                            <td className="p-4">
                              {tpo.assigned_colleges ? (
                                <div className="flex flex-wrap gap-1.5 max-w-xs">
                                  {String(tpo.assigned_colleges).split(',').map((name, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-slate-105 border border-slate-200 text-slate-600 rounded font-bold text-[10px] tracking-wide whitespace-nowrap">
                                      {name.trim()}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs italic">No colleges allocated</span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${tpo.user_status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                {tpo.user_status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleEditTpoClick(tpo)}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 text-blue-600 rounded-lg transition-all border border-slate-200"
                                  title="Edit Profile & Allocations"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTpo(tpo.id)}
                                  className="p-2 bg-slate-50 hover:bg-red-50 text-red-600 rounded-lg transition-all border border-slate-200 hover:border-red-100"
                                  title="Delete TPO Account"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <PaginationControl 
                  currentPage={tposPage} 
                  totalItems={filteredTpos.length} 
                  pageSize={pageSize} 
                  onPageChange={setTposPage} 
                  onPageSizeChange={setPageSize} 
                />
              </div>
            </div>
          )}

          {/* TAB 4: ACADEMIC BATCHES */}
          {activeTab === 'batches' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search batch name, department, year, college, TPO..." 
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder-slate-400 transition-all"
                    value={batchesSearch}
                    onChange={e => setBatchesSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Batches: Showing {filteredBatches.length} of {batches.length}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="text-blue-600" /> Academic Batches Directory
                  </h2>
                  <div className="text-xs text-slate-500 font-bold">
                    Total Batches: {filteredBatches.length}
                  </div>
                </div>

                <div className="overflow-x-auto w-full max-w-full min-w-0">
                  {filteredBatches.length === 0 ? (
                    <div className="text-center py-16 text-slate-400">
                      <Layers className="mx-auto text-slate-300 mb-3" size={40} />
                      <p className="font-bold text-sm text-slate-600">No batches matching search query</p>
                      <p className="text-xs text-slate-400 mt-1">Try another search keyword</p>
                    </div>
                  ) : (
                    <table className="w-full min-w-[720px] text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-500 font-bold text-xs uppercase tracking-wider">
                          <th className="p-4">Batch details</th>
                          <th className="p-4">Parent College</th>
                          <th className="p-4">Assigned TPO</th>
                          <th className="p-4">Roster Strength</th>
                          <th className="p-4">Status</th>
                          <th className="p-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedBatches.map(batch => (
                          <tr key={batch.id} className="hover:bg-slate-50/30 transition-all">
                            <td className="p-4">
                              <div className="font-extrabold text-slate-850 text-sm">{batch.batch_name}</div>
                              <div className="text-[11px] text-slate-500 font-semibold mt-1">
                                Dept: <span className="text-slate-800 font-bold">{batch.department || 'N/A'}</span> &bull; Year: {batch.academic_year || 'N/A'} &bull; Sem: {batch.semester || 'N/A'}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 font-bold text-xs">{batch.college_name}</div>
                            </td>
                            <td className="p-4">
                              <div className="text-slate-800 text-xs font-semibold flex items-center gap-1.5">
                                <UserCheck size={12} className="text-slate-400" /> {batch.tpo_name || <span className="text-rose-600 font-bold">Unassigned</span>}
                              </div>
                            </td>
                            <td className="p-4">
                              <button
                                onClick={() => handleViewStudentsClick(batch)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded border border-blue-100 hover:border-blue-200 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer"
                                title="Click to view and manage batch roster"
                              >
                                <Users size={12} />
                                {batch.student_count || 0} students
                              </button>
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 text-[10px] font-black rounded-full border ${batch.status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                {batch.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button 
                                  onClick={() => handleViewStudentsClick(batch)}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-all border border-slate-200"
                                  title="View & Manage Students"
                                >
                                  <Users size={14} />
                                </button>
                                <button 
                                  onClick={() => handleEditBatchClick(batch)}
                                  className="p-2 bg-slate-50 hover:bg-slate-100 text-blue-600 rounded-lg transition-all border border-slate-200"
                                  title="Edit Academic Batch"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteBatch(batch.id)}
                                  className="p-2 bg-slate-50 hover:bg-red-50 text-red-600 rounded-lg transition-all border border-slate-200 hover:border-red-100"
                                  title="Deactivate Academic Batch"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <PaginationControl 
                  currentPage={batchesPage} 
                  totalItems={filteredBatches.length} 
                  pageSize={pageSize} 
                  onPageChange={setBatchesPage} 
                  onPageSizeChange={setPageSize} 
                />
              </div>
            </div>
          )}

          {/* TAB 5: BULK STUDENT ONBOARDING */}
          {activeTab === 'onboard' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden p-8 shadow-sm">
              <div className="border-b border-slate-200 pb-6 mb-8">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <FileSpreadsheet className="text-emerald-600" /> Transactional Roster Onboarding Engine
                </h2>
                <p className="text-slate-500 text-xs mt-1">
                  Submit student email rosters to dynamically initiate core logins, inject starter XP balances, and trigger security dispatch systems.
                </p>
              </div>

              <form onSubmit={handleBulkOnboard} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Target Institutional College</label>
                    <select 
                      required
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                      value={bulkCollegeId}
                      onChange={e => {
                        setBulkCollegeId(e.target.value);
                        setBulkBatchId('');
                        setBulkDepartment('');
                      }}
                    >
                      <option value="">Select Target College...</option>
                      {colleges.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.college_name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Target Academic Batch</label>
                    <select 
                      required
                      disabled={!bulkCollegeId}
                      className="w-full p-3 bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                      value={bulkBatchId}
                      onChange={e => {
                        setBulkBatchId(e.target.value);
                        const b = batches.find(item => String(item.id) === String(e.target.value));
                        if (b?.department) setBulkDepartment(b.department);
                      }}
                    >
                      <option value="">Select Academic Batch...</option>
                      {batches
                        .filter(b => String(b.college_id) === String(bulkCollegeId) && b.status === 'ACTIVE')
                        .map(b => <option key={b.id} value={b.id}>{b.batch_name} {b.department ? `(${b.department})` : ''}</option>)
                      }
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Default Department (Optional Fallback)</label>
                    <input 
                      type="text"
                      placeholder="e.g. Computer Science (if not in CSV)..."
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-medium focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
                      value={bulkDepartment}
                      onChange={e => setBulkDepartment(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-555 uppercase tracking-widest flex items-center gap-1.5">
                      Option A: File Upload
                      <span className="text-[10px] text-emerald-600 font-black bg-emerald-50 px-2 py-0.5 border border-emerald-200 rounded uppercase">Roster CSV / TXT</span>
                    </label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Select any roster <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono text-[10px]">.csv</code> file with columns: <span className="font-bold text-slate-700">Name, Email, Department</span>.
                    </p>
                    <div className="relative flex items-center justify-center border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl bg-slate-50 p-8 text-center cursor-pointer transition-all duration-200 hover:bg-emerald-50/10">
                      <input 
                        type="file" 
                        accept=".csv,.txt"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={handleFileUpload}
                      />
                      <div className="space-y-2">
                        <Upload size={28} className="text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-750">Choose Student Roster File</p>
                        <p className="text-[10px] text-slate-400 font-medium">Supports multi-department CSVs in a single batch</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Option B: Copy-Paste Spreadsheet Rows</label>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      Paste rows directly from Excel/Sheets (<span className="font-bold text-slate-700">Name, Email, Department</span>):
                    </p>
                    <textarea 
                      placeholder="Rahul Sharma, rahul@college.edu, CSE&#10;Sneha Patil, sneha@college.edu, Mechanical&#10;Amit Shinde, amit@college.edu, Electrical"
                      rows={6}
                      className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800 resize-none"
                      value={studentsText}
                      onChange={(e) => handleStudentsTextChange(e.target.value)}
                    />
                  </div>
                </div>

                {parsedStudents.length > 0 && (
                  <div className="bg-blue-50/50 border border-blue-100 p-6 rounded-2xl space-y-3 mt-6">
                    <div className="flex justify-between items-center text-blue-600 font-black text-xs uppercase tracking-wider">
                      <span>Detected Student Roster ({parsedStudents.length} Students)</span>
                      <span className="text-[10px] bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded font-black border border-blue-100 uppercase">Multi-Department Parsed</span>
                    </div>
                    <div className="max-h-[240px] overflow-y-auto border border-slate-200 rounded-xl bg-white text-xs divide-y divide-slate-100">
                      <div className="bg-slate-100/90 sticky top-0 px-4 py-2.5 flex justify-between text-[11px] font-black text-slate-500 uppercase tracking-wider">
                        <span className="w-1/3">Student Name</span>
                        <span className="w-1/3">Email Address</span>
                        <span className="w-1/3 text-right">Assigned Department</span>
                      </div>
                      {parsedStudents.map((st, i) => (
                        <div key={i} className="px-4 py-2.5 flex justify-between items-center font-semibold">
                          <span className="w-1/3 text-slate-800 font-bold">{st.name}</span>
                          <span className="w-1/3 text-slate-500 font-mono text-[11px]">{st.email}</span>
                          <span className="w-1/3 text-right">
                            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-[10px] font-black uppercase tracking-wider">
                              {st.department || bulkDepartment || 'Batch Default'}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-blue-50/40 p-4 border border-blue-100 rounded-xl flex items-start gap-3 mt-6">
                  <AlertCircle className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                    Each valid student account is automatically registered with active status, credited with <span className="text-blue-600 font-black">100 bonus XP</span>, and dispatched security credentials via the enterprise SMTP module.
                  </p>
                </div>

                <div className="flex justify-end gap-4 pt-6 border-t border-slate-100">
                  <button 
                    type="submit" 
                    disabled={onboardingInProgress || parsedStudents.length === 0}
                    className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/15 transition-all flex items-center gap-2"
                  >
                    <FileSpreadsheet size={16} /> {onboardingInProgress ? 'Dispatched and processing emails...' : `Onboard ${parsedStudents.length} Students`}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: AUDIT LOGS */}
          {activeTab === 'logs' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
                <div className="relative w-full md:w-96">
                  <Search className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <input 
                    type="text" 
                    placeholder="Search action, admin email, details..." 
                    className="w-full bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 font-medium placeholder-slate-400 transition-all"
                    value={logsSearch}
                    onChange={e => setLogsSearch(e.target.value)}
                  />
                </div>
                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                  Logs: Showing {filteredLogs.length} of {auditLogs.length}
                </div>
              </div>

              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-slate-200/80 flex justify-between items-center bg-slate-50/50">
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <History className="text-blue-600" /> Enterprise Audit Trails & Action Logs
                  </h2>
                  <div className="text-xs text-slate-500 font-bold">
                    Total Logs: {filteredLogs.length}
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-400 text-sm">
                    No system logs matching search query
                  </div>
                ) : (
                  <>
                    <div className="divide-y divide-slate-100 font-mono text-xs">
                      {paginatedLogs.map(log => (
                        <div key={log.id} className="p-4 hover:bg-slate-50/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 text-slate-650">
                          <div className="flex items-start gap-3">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-500 rounded text-[10px] font-bold block shrink-0 mt-0.5">
                              #{log.id}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-blue-600 text-xs uppercase bg-blue-50 border border-blue-100 px-1.5 rounded">
                                  {log.action}
                                </span>
                                <span className="text-slate-400 text-[10px]">{log.admin_email}</span>
                              </div>
                              <div className="text-slate-500 text-[11px] mt-1 break-all">
                                Payload: {log.details || '{}'}
                              </div>
                              {log.ip_address && (
                                <div className="text-[10px] text-slate-400 mt-0.5">
                                  IP: {log.ip_address} &bull; Browser: {log.user_agent}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right text-slate-400 text-[10px] shrink-0 font-bold">
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                    <PaginationControl 
                      currentPage={logsPage} 
                      totalItems={filteredLogs.length} 
                      pageSize={pageSize} 
                      onPageChange={setLogsPage} 
                      onPageSizeChange={setPageSize} 
                    />
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      )}

      {/* COLLEGE MODAL */}
      <CollegeModal
        isOpen={showCollegeModal}
        onClose={() => {
          setShowCollegeModal(false);
          setEditingCollege(null);
        }}
        onSuccess={() => {
          fetchInitialData();
        }}
        editingCollege={editingCollege}
      />

      {/* TPO REGISTER / EDIT MODAL */}
      <TpoModal
        isOpen={showTpoModal}
        onClose={() => {
          setShowTpoModal(false);
          setEditingTpo(null);
        }}
        onSuccess={(message?: string) => {
          if (message) {
            toast.success(message);
          } else {
            toast.success('TPO registered successfully');
          }
          fetchInitialData();
        }}
        editingTpo={editingTpo}
        colleges={colleges}
      />

      {/* BATCH MODAL */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider flex items-center gap-2">
                <Layers className="text-blue-600" />
                {editingBatch ? 'Update Academic Batch' : 'Create Academic Batch'}
              </h2>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-600 font-extrabold text-sm">✕</button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-6 space-y-4 text-sm">
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Target College / Institute</label>
                <select 
                  required
                  disabled={!!editingBatch}
                  className="w-full p-3 bg-slate-50 disabled:opacity-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={batchForm.college_id}
                  onChange={e => setBatchForm({...batchForm, college_id: e.target.value})}
                >
                  <option value="">Select College...</option>
                  {colleges.filter(c => c.status === 'ACTIVE').map(c => <option key={c.id} value={c.id}>{c.college_name}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Batch Name</label>
                <input 
                  required 
                  type="text" 
                  placeholder="e.g. Batch of 2026 CS-A" 
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  value={batchForm.batch_name} 
                  onChange={e => setBatchForm({...batchForm, batch_name: e.target.value})} 
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Department</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Computer Science" 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={batchForm.department} 
                    onChange={e => setBatchForm({...batchForm, department: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Academic Year</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2025-2026" 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={batchForm.academic_year} 
                    onChange={e => setBatchForm({...batchForm, academic_year: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Semester</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Semester VIII" 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    value={batchForm.semester} 
                    onChange={e => setBatchForm({...batchForm, semester: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Assigned TPO Officer</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={batchForm.assigned_tpo_id}
                    onChange={e => setBatchForm({...batchForm, assigned_tpo_id: e.target.value})}
                  >
                    <option value="">Select TPO...</option>
                    {tpos.filter(t => t.status === 'ACTIVE' || t.user_status === 'ACTIVE').map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Status Node</label>
                  <select 
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-850 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={batchForm.status}
                    onChange={e => setBatchForm({...batchForm, status: e.target.value})}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowBatchModal(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:text-slate-700 font-sans cursor-pointer">Cancel</button>
                <button 
                  type="submit" 
                  disabled={savingBatch}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-blue-500/10 flex items-center gap-2 font-sans cursor-pointer transition-all"
                >
                  {savingBatch ? 'Saving Batch...' : 'Save Batch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BATCH STUDENTS VIEW & MANUAL REGISTER MODAL */}
      {selectedBatchForStudents && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl shadow-xl overflow-hidden h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-950 uppercase tracking-wider flex items-center gap-2 font-sans">
                  <Layers className="text-blue-600" />
                  {selectedBatchForStudents.batch_name} Students Directory
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-semibold">
                  Dept: {selectedBatchForStudents.department || 'N/A'} &bull; Year: {selectedBatchForStudents.academic_year || 'N/A'} &bull; College: {selectedBatchForStudents.college_name || 'N/A'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedBatchForStudents(null)} 
                className="text-slate-400 hover:text-slate-600 font-extrabold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: Add manual student */}
              <div className="lg:border-r lg:border-slate-100 lg:pr-6 space-y-4">
                <div className="bg-slate-50/50 border border-slate-100 p-4 rounded-2xl">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 mb-3 font-sans">
                    <Plus size={16} className="text-blue-600" /> Add Student Manually
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-normal mb-4 font-semibold">
                    Register a single student into this academic batch. Login credentials will be instantly sent to their email.
                  </p>

                  <form onSubmit={handleAddManualStudent} className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Student Full Name</label>
                      <input 
                        required 
                        type="text" 
                        placeholder="e.g. Rahul Sharma" 
                        className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-slate-850 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={manualStudentForm.name} 
                        onChange={e => setManualStudentForm({...manualStudentForm, name: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Department Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Computer Science, Mechanical..." 
                        className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-slate-850 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={manualStudentForm.department} 
                        onChange={e => setManualStudentForm({...manualStudentForm, department: e.target.value})} 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Email Address</label>
                      <input 
                        required 
                        type="email" 
                        placeholder="e.g. rahul@wit.edu" 
                        className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-slate-850 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        value={manualStudentForm.email} 
                        onChange={e => setManualStudentForm({...manualStudentForm, email: e.target.value})} 
                      />
                    </div>

                    <button 
                      type="submit" 
                      disabled={savingManualStudent}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 transition-all font-sans cursor-pointer"
                    >
                      {savingManualStudent ? 'Saving...' : 'Add Student Node'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right columns: Batch Students Table */}
              <div className="lg:col-span-2 flex flex-col h-full space-y-4">
                <div className="flex justify-between items-center bg-slate-50 border border-slate-100 px-4 py-3 rounded-xl shrink-0">
                  <div className="text-xs text-slate-600 font-extrabold uppercase tracking-wide font-sans">
                    Enrolled Students ({batchStudents.length})
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Batch Code: #{selectedBatchForStudents.id}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl bg-white min-h-[250px]">
                  {loadingStudents ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <span className="text-xs font-semibold">Fetching batch roster...</span>
                    </div>
                  ) : batchStudents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-center px-4">
                      <Users size={32} className="text-slate-300 mb-2" />
                      <span className="text-xs font-black text-slate-500 uppercase tracking-wider font-sans">No Students Found</span>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xs font-semibold">
                        This batch is currently empty. Use the manual form on the left or Bulk Onboarding tab to populate this roster.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-150 bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="p-3">Student Name</th>
                          <th className="p-3">Email Address</th>
                          <th className="p-3">Department</th>
                          <th className="p-3 text-center">Talent Score</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {batchStudents.map(student => (
                          <tr key={student.id} className="hover:bg-slate-50/40 transition-all font-semibold">
                            <td className="p-3">
                              <div className="font-extrabold text-slate-850 text-sm">{student.full_name}</div>
                            </td>
                            <td className="p-3">
                              <div className="text-slate-500 font-mono text-xs">{student.email}</div>
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded text-[11px] font-bold">
                                {student.department || selectedBatchForStudents.department || 'General'}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              {student.talent_score !== null && student.talent_score !== undefined ? (
                                <span className="px-2 py-1 bg-sky-50 text-sky-600 border border-sky-100 rounded font-black text-[10px]">
                                  {student.talent_score}
                                </span>
                              ) : (
                                <span className="text-slate-400">&mdash;</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${student.user_status === 'ACTIVE' ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-rose-50 border-rose-200 text-rose-600'}`}>
                                {student.user_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedBatchForStudents(null)} 
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
