import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Send, 
  Clock, 
  Megaphone, 
  Type, 
  AlignLeft, 
  Users,
  Trash2,
  Search,
  Filter,
  Eye,
  Tag,
  AlertCircle,
  Sparkles,
  Check,
  X,
  Layers,
  CheckCircle2,
  Building2,
  RefreshCw,
  Zap,
  Paperclip,
  Upload,
  FileText,
  Link as LinkIcon,
  ExternalLink,
  Download,
  FileCode,
  FilePlus,
  FolderPlus,
  Copy,
  HardDrive
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

export default function TPONotifications() {
  const [activeTab, setActiveTab] = useState<'notices' | 'materials' | 'system'>('notices');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Notice Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [batchName, setBatchName] = useState('ALL');
  const [category, setCategory] = useState('PLACEMENT');
  const [priority, setPriority] = useState('NORMAL');
  const [isPublic, setIsPublic] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Notice Attachment State
  const [attachmentMode, setAttachmentMode] = useState<'NONE' | 'LOCAL' | 'DRIVE_LINK'>('NONE');
  const [driveUrl, setDriveUrl] = useState('');
  const [localFile, setLocalFile] = useState<{ name: string; size: string; dataUrl: string; type: string } | null>(null);

  // Standalone Study Material Form State
  const [matTitle, setMatTitle] = useState('');
  const [matDesc, setMatDesc] = useState('');
  const [matCategory, setMatCategory] = useState('Aptitude & Reasoning');
  const [matBatch, setMatBatch] = useState('ALL');
  const [matAttachMode, setMatAttachMode] = useState<'LOCAL' | 'DRIVE_LINK'>('LOCAL');
  const [matDriveUrl, setMatDriveUrl] = useState('');
  const [matLocalFile, setMatLocalFile] = useState<{ name: string; size: string; dataUrl: string; type: string } | null>(null);
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // Search & Filters for Notices list
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBatchFilter, setSelectedBatchFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');

  // Search & Filters for Study Materials list
  const [matSearchQuery, setMatSearchQuery] = useState('');
  const [selectedMatCategoryFilter, setSelectedMatCategoryFilter] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [noticesRes, batchesRes, notifRes, materialsRes] = await Promise.allSettled([
        api.get('/tpo/notices'),
        api.get('/tpo/batches'),
        api.get('/notifications'),
        api.get('/tpo/study-materials')
      ]);

      if (noticesRes.status === 'fulfilled' && noticesRes.value.data?.success) {
        setNotices(noticesRes.value.data.data || []);
      }
      if (batchesRes.status === 'fulfilled' && batchesRes.value.data?.success) {
        setBatches(batchesRes.value.data.data || []);
      }
      if (notifRes.status === 'fulfilled' && notifRes.value.data?.success) {
        setNotifications(notifRes.value.data.data || []);
      }
      if (materialsRes.status === 'fulfilled' && materialsRes.value.data?.success) {
        setMaterials(materialsRes.value.data.data || []);
      }

    } catch (error) {
      console.error('Error fetching TPO notification data', error);
      toast.error("Failed to refresh notification data");
    } finally {
      setLoading(false);
    }
  };

  // Helper to format file sizes nicely
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Process Local File Selection for Notice
  const handleLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) { // 15MB limit
      toast.error("File size exceeds 15MB limit. Use Google Drive link for larger files.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLocalFile({
        name: file.name,
        size: formatFileSize(file.size),
        dataUrl: reader.result as string,
        type: file.type || 'application/octet-stream'
      });
      toast.success(`Attached "${file.name}" (${formatFileSize(file.size)})`);
    };
    reader.readAsDataURL(file);
  };

  // Process Local File Selection for Material
  const handleMatLocalFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size exceeds 15MB limit. Use Google Drive link for larger files.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setMatLocalFile({
        name: file.name,
        size: formatFileSize(file.size),
        dataUrl: reader.result as string,
        type: file.type || 'application/octet-stream'
      });
      toast.success(`Attached "${file.name}" (${formatFileSize(file.size)})`);
    };
    reader.readAsDataURL(file);
  };

  const handlePostNotice = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Please provide both a title and notice content");
      return;
    }

    if (attachmentMode === 'DRIVE_LINK' && !driveUrl.trim()) {
      toast.error("Please provide a valid Google Drive or document link");
      return;
    }

    if (attachmentMode === 'LOCAL' && !localFile) {
      toast.error("Please select a local document file to upload");
      return;
    }

    try {
      setSubmitting(true);

      let attachmentType = attachmentMode;
      let attachmentUrl = '';
      let attachmentName = '';
      let attachmentSize = '';

      if (attachmentMode === 'DRIVE_LINK') {
        attachmentUrl = driveUrl.trim();
        attachmentName = title.trim();
        attachmentSize = 'Drive Link';
      } else if (attachmentMode === 'LOCAL' && localFile) {
        attachmentUrl = localFile.dataUrl;
        attachmentName = localFile.name;
        attachmentSize = localFile.size;
      }

      const res = await api.post('/tpo/notices', { 
        title: title.trim(), 
        message: message.trim(), 
        batch_name: batchName,
        category,
        priority,
        is_public: isPublic,
        attachment_type: attachmentType,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_size: attachmentSize
      });

      if (res.data.success) {
        toast.success(res.data.message || "Notice posted successfully! In-app notifications sent to students.");
        setTitle('');
        setMessage('');
        setBatchName('ALL');
        setCategory('PLACEMENT');
        setPriority('NORMAL');
        setIsPublic(true);
        setAttachmentMode('NONE');
        setDriveUrl('');
        setLocalFile(null);
        setShowPreviewModal(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to post notice");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostStudyMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matTitle.trim()) {
      toast.error("Please enter a title for the study material");
      return;
    }

    if (matAttachMode === 'DRIVE_LINK' && !matDriveUrl.trim()) {
      toast.error("Please provide a valid Google Drive link");
      return;
    }

    if (matAttachMode === 'LOCAL' && !matLocalFile) {
      toast.error("Please select a local document file to upload");
      return;
    }

    try {
      setSubmittingMaterial(true);
      const res = await api.post('/tpo/study-materials', {
        title: matTitle.trim(),
        description: matDesc.trim(),
        category: matCategory,
        batch_name: matBatch,
        attachment_type: matAttachMode,
        attachment_url: matAttachMode === 'DRIVE_LINK' ? matDriveUrl.trim() : matLocalFile?.dataUrl,
        file_name: matAttachMode === 'DRIVE_LINK' ? matTitle.trim() : matLocalFile?.name,
        file_size: matAttachMode === 'DRIVE_LINK' ? 'Drive Link' : matLocalFile?.size
      });

      if (res.data.success) {
        toast.success(res.data.message || "Study material uploaded successfully!");
        setMatTitle('');
        setMatDesc('');
        setMatCategory('Aptitude & Reasoning');
        setMatBatch('ALL');
        setMatAttachMode('LOCAL');
        setMatDriveUrl('');
        setMatLocalFile(null);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload study material");
    } finally {
      setSubmittingMaterial(false);
    }
  };

  const handleDeleteNotice = async (noticeId: number) => {
    if (!window.confirm("Are you sure you want to remove this notice from the campus notice board?")) {
      return;
    }

    try {
      const res = await api.delete(`/tpo/notices/${noticeId}`);
      if (res.data.success) {
        toast.success("Notice removed successfully");
        setNotices(prev => prev.filter(n => n.id !== noticeId));
      }
    } catch (error) {
      toast.error("Failed to delete notice");
    }
  };

  const handleDeleteMaterial = async (matId: number) => {
    if (!window.confirm("Are you sure you want to delete this study material document?")) {
      return;
    }

    try {
      const res = await api.delete(`/tpo/study-materials/${matId}`);
      if (res.data.success) {
        toast.success("Study material removed successfully");
        setMaterials(prev => prev.filter(m => m.id !== matId));
      }
    } catch (error) {
      toast.error("Failed to delete study material");
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      toast.success('All system notifications marked as read');
    } catch (error) {
      toast.error('Failed to update notifications');
    }
  };

  // Filtered notices calculation
  const filteredNotices = notices.filter(n => {
    const matchesSearch = searchQuery === '' || 
      n.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesBatch = selectedBatchFilter === 'ALL' || n.batch_name === selectedBatchFilter;
    const matchesCategory = selectedCategoryFilter === 'ALL' || (n.category || 'GENERAL') === selectedCategoryFilter;

    return matchesSearch && matchesBatch && matchesCategory;
  });

  // Filtered study materials calculation
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = matSearchQuery === '' || 
      m.title?.toLowerCase().includes(matSearchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(matSearchQuery.toLowerCase());
    
    const matchesCategory = selectedMatCategoryFilter === 'ALL' || m.category === selectedMatCategoryFilter;

    return matchesSearch && matchesCategory;
  });

  const getPriorityBadge = (prio?: string) => {
    switch ((prio || '').toUpperCase()) {
      case 'URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 border border-rose-200">
            <AlertCircle size={11} className="animate-pulse" /> Urgent
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 border border-amber-200">
            <Zap size={11} /> High Priority
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
            Normal
          </span>
        );
    }
  };

  const getCategoryBadge = (cat?: string) => {
    const categoryName = (cat || 'GENERAL').toUpperCase();
    switch (categoryName) {
      case 'PLACEMENT':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-blue-100">Placement Drive</span>;
      case 'EXAM':
        return <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-purple-100">Exam & Assessment</span>;
      case 'ACADEMIC':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100">Academic Update</span>;
      case 'EVENT':
        return <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100">Workshop / Event</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-slate-200">General</span>;
    }
  };

  // Render attachment badge / component inside notice cards
  const renderNoticeAttachment = (n: any) => {
    if (!n.attachment_type || n.attachment_type === 'NONE' || !n.attachment_url) return null;

    if (n.attachment_type === 'DRIVE_LINK') {
      return (
        <div className="bg-blue-50/80 border border-blue-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <HardDrive size={18} />
            </div>
            <div className="truncate">
              <p className="text-xs font-extrabold text-blue-950 truncate">{n.attachment_name || 'Google Drive Document'}</p>
              <p className="text-[10px] font-bold text-blue-600">Google Drive / External Cloud Link</p>
            </div>
          </div>
          <a 
            href={n.attachment_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5"
          >
            Open Link <ExternalLink size={12} />
          </a>
        </div>
      );
    }

    if (n.attachment_type === 'LOCAL') {
      return (
        <div className="bg-indigo-50/80 border border-indigo-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <FileText size={18} />
            </div>
            <div className="truncate">
              <p className="text-xs font-extrabold text-indigo-950 truncate">{n.attachment_name || 'Attached Document'}</p>
              <p className="text-[10px] font-bold text-indigo-600">{n.attachment_size || 'Local File Attachment'}</p>
            </div>
          </div>
          <a 
            href={n.attachment_url} 
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5"
          >
            View <Eye size={12} />
          </a>
        </div>
      );
    }

    return null;
  };

  // Stats calculation
  const totalNotices = notices.length;
  const totalMaterialsCount = materials.length;
  const urgentCount = notices.filter(n => (n.priority || '').toUpperCase() === 'URGENT').length;
  const totalDelivered = notices.reduce((acc, curr) => acc + (curr.reach_count || 0), 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-4 md:p-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles size={11} className="animate-pulse" /> TPO Notice & Study Material Hub
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
              Campus Communications & Documents
            </h1>
            <p className="text-slate-300 text-xs md:text-sm max-w-2xl font-medium mt-1">
              Broadcast announcements and attach local device files or Google Drive links directly to student portal feeds and trigger instant in-app alerts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl border border-white/15 backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Sync Data
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Total Notices</p>
            <p className="text-xl font-black text-white mt-0.5">{totalNotices}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Study Documents</p>
            <p className="text-xl font-black text-indigo-400 mt-0.5">{totalMaterialsCount}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Urgent Broadcasts</p>
            <p className="text-xl font-black text-amber-400 mt-0.5">{urgentCount}</p>
          </div>
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3.5 border border-white/10">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">In-App Alerts Sent</p>
            <p className="text-xl font-black text-emerald-400 mt-0.5">{totalDelivered}</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex flex-wrap gap-6">
          <button
            onClick={() => setActiveTab('notices')}
            className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'notices' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Megaphone size={16} />
            Campus Notice Board
            {activeTab === 'notices' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('materials')}
            className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'materials' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <FileText size={16} />
            Study Materials & Documents ({materials.length})
            {activeTab === 'materials' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>
            )}
          </button>

          <button
            onClick={() => setActiveTab('system')}
            className={`pb-4 px-2 font-black text-xs uppercase tracking-widest transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'system' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Bell size={16} />
            System Notifications ({notifications.filter(n => !n.is_read).length})
            {activeTab === 'system' && (
              <div className="absolute bottom-0 left-0 w-full h-1 bg-blue-600 rounded-t-full"></div>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: CAMPUS NOTICES */}
      {activeTab === 'notices' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Post Notice Form (Left Column - 5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm h-max space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <Megaphone size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">Create Announcement</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Broadcast to student portal</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={handlePostNotice} className="space-y-5">
              
              {/* Target Batch Selector */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <Users size={12} /> Target Audience (Batch)
                </label>
                <select
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-700"
                >
                  <option value="ALL">All Registered Students</option>
                  {batches.map((b: any) => (
                    <option key={b.id || b.batch_name} value={b.batch_name}>
                      {b.batch_name} {b.department ? `(${b.department})` : ''} {b.student_count ? `• ${b.student_count} Students` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category & Priority in 2 columns */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Tag size={12} /> Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs text-slate-700"
                  >
                    <option value="PLACEMENT">Placement Drive</option>
                    <option value="EXAM">Exam / Assessment</option>
                    <option value="ACADEMIC">Academic Update</option>
                    <option value="EVENT">Workshop / Event</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <AlertCircle size={12} /> Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs text-slate-700"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High Priority</option>
                    <option value="URGENT">Urgent Alert</option>
                  </select>
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <Type size={12} /> Notice Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. TCS Placement Drive 2024 Schedule"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center ml-1">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <AlignLeft size={12} /> Notice Content
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">{message.length} chars</span>
                </div>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter notice details, instructions, eligibility criteria, or deadlines..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-sm text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>

              {/* Document Attachment Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    <Paperclip size={13} className="text-indigo-600" /> Attach Document / Material
                  </label>
                  <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">Optional</span>
                </div>

                {/* Mode Selector Radio Pills */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setAttachmentMode('NONE'); setDriveUrl(''); setLocalFile(null); }}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      attachmentMode === 'NONE'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    No File
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachmentMode('LOCAL')}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      attachmentMode === 'LOCAL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Upload size={12} /> Local File
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttachmentMode('DRIVE_LINK')}
                    className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      attachmentMode === 'DRIVE_LINK'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <HardDrive size={12} /> Drive Link
                  </button>
                </div>

                {/* Local File Attachment Controls */}
                {attachmentMode === 'LOCAL' && (
                  <div className="space-y-2 pt-1">
                    {!localFile ? (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white p-4 rounded-xl cursor-pointer transition-all text-center">
                        <Upload size={22} className="text-indigo-500 mb-1" />
                        <span className="text-xs font-bold text-slate-700">Click to attach document from device</span>
                        <span className="text-[10px] text-slate-400 font-medium">PDF, DOCX, PPTX, XLSX, Images, ZIP (Max 15MB)</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
                          onChange={handleLocalFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileText size={18} className="text-indigo-600 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-extrabold text-indigo-950 truncate">{localFile.name}</p>
                            <p className="text-[10px] font-bold text-indigo-600">{localFile.size}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLocalFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Google Drive Link Controls */}
                {attachmentMode === 'DRIVE_LINK' && (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <HardDrive size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500" />
                      <input
                        type="url"
                        value={driveUrl}
                        onChange={(e) => setDriveUrl(e.target.value)}
                        placeholder="Paste Google Drive, OneDrive, or External URL..."
                        className="w-full pl-9 pr-3 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {driveUrl && (
                      <div className="flex justify-between items-center text-[10px] font-bold text-blue-600 px-1">
                        <span>Ensure link sharing is set to "Anyone with link"</span>
                        <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          Test Link <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Checkboxes */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                <div>
                  <label htmlFor="isPublic" className="text-xs font-black text-slate-800 block cursor-pointer">
                    Public Notice Board
                  </label>
                  <p className="text-[10px] text-slate-500 font-semibold">Display on student Campus Updates page</p>
                </div>
                <input 
                  type="checkbox" 
                  id="isPublic"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </div>

              {/* Actions: Preview & Submit */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  disabled={!title || !message}
                  className="py-3.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-black text-xs rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye size={16} /> Preview
                </button>

                <button
                  type="submit"
                  disabled={submitting || !title.trim() || !message.trim()}
                  className="py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  {submitting ? (
                    <RefreshCw size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Send size={16} /> Broadcast Notice
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>

          {/* List of Previous Notices & Filters (Right Column - 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Search & Filtering Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
                  Recent Campus Notices
                  <span className="text-xs font-extrabold px-2.5 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                    {filteredNotices.length}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Search Box */}
                <div className="relative md:col-span-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notices..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Batch Filter */}
                <div>
                  <select
                    value={selectedBatchFilter}
                    onChange={(e) => setSelectedBatchFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Batches</option>
                    {batches.map((b: any) => (
                      <option key={b.id || b.batch_name} value={b.batch_name}>{b.batch_name}</option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="PLACEMENT">Placement Drive</option>
                    <option value="EXAM">Exam / Assessment</option>
                    <option value="ACADEMIC">Academic Update</option>
                    <option value="EVENT">Workshop / Event</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Notice Cards List */}
            {loading ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
                <RefreshCw size={28} className="mx-auto text-blue-600 animate-spin mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading campus notice board...</p>
              </div>
            ) : filteredNotices.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
                <Megaphone className="mx-auto text-slate-200 mb-4" size={56} />
                <h3 className="text-lg font-black text-slate-900">No Notices Found</h3>
                <p className="text-slate-500 text-xs mt-1 font-medium">No notices match your selected search or filter criteria.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredNotices.map((n) => (
                  <div 
                    key={n.id} 
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative hover:shadow-md transition-all space-y-4 group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoryBadge(n.category)}
                        {getPriorityBadge(n.priority)}
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-lg">
                          Target: {n.batch_name}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Clock size={12} />
                          {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => handleDeleteNotice(n.id)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Notice"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-slate-900 text-base leading-tight group-hover:text-blue-600 transition-colors">
                        {n.title}
                      </h4>
                      <p className="text-xs text-slate-600 font-medium mt-2 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-4 rounded-2xl border border-slate-100">
                        {n.message}
                      </p>

                      {/* Render Document / Drive Attachment */}
                      {renderNoticeAttachment(n)}
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        <CheckCircle2 size={13} />
                        <span>In-App Alert Broadcasted</span>
                      </div>
                      <span className="text-slate-400">
                        {n.is_public ? 'Visible on Student Feed' : 'Private'}
                      </span>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: STUDY MATERIALS & DOCUMENTS HUB */}
      {activeTab === 'materials' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Post Study Material Form (Left Column - 5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm h-max space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <FolderPlus size={22} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg tracking-tight">Upload Study Material</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Share notes, guides & templates</p>
                </div>
              </div>
            </div>

            <form onSubmit={handlePostStudyMaterial} className="space-y-5">
              
              {/* Document Title */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <Type size={12} /> Document Title
                </label>
                <input
                  type="text"
                  required
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="e.g. Complete Aptitude Formula Sheet & Practice Tests"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-sm text-slate-800 placeholder:text-slate-400"
                />
              </div>

              {/* Category & Target Batch */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Tag size={12} /> Category
                  </label>
                  <select
                    value={matCategory}
                    onChange={(e) => setMatCategory(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs text-slate-700"
                  >
                    <option value="Aptitude & Reasoning">Aptitude & Reasoning</option>
                    <option value="Technical & Coding">Technical & Coding</option>
                    <option value="Resume Templates">Resume Templates</option>
                    <option value="Interview Questions">Interview Questions</option>
                    <option value="Company Preparation">Company Preparation</option>
                    <option value="Placement Policy">Placement Policy</option>
                    <option value="General Material">General Notes</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                    <Users size={12} /> Target Batch
                  </label>
                  <select
                    value={matBatch}
                    onChange={(e) => setMatBatch(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs text-slate-700"
                  >
                    <option value="ALL">All Registered Students</option>
                    {batches.map((b: any) => (
                      <option key={b.id || b.batch_name} value={b.batch_name}>
                        {b.batch_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  <AlignLeft size={12} /> Description / Overview
                </label>
                <textarea
                  rows={3}
                  value={matDesc}
                  onChange={(e) => setMatDesc(e.target.value)}
                  placeholder="Provide a brief summary of what this document contains..."
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-xs text-slate-800 placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>

              {/* Attachment Mode Picker */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 text-[10px] font-black text-slate-700 uppercase tracking-widest">
                  <Paperclip size={13} className="text-indigo-600" /> Document Attachment Method
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMatAttachMode('LOCAL')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      matAttachMode === 'LOCAL'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <Upload size={14} /> From Local Device
                  </button>
                  <button
                    type="button"
                    onClick={() => setMatAttachMode('DRIVE_LINK')}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      matAttachMode === 'DRIVE_LINK'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <HardDrive size={14} /> Google Drive Link
                  </button>
                </div>

                {matAttachMode === 'LOCAL' ? (
                  <div className="pt-1">
                    {!matLocalFile ? (
                      <label className="flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-white p-5 rounded-2xl cursor-pointer transition-all text-center">
                        <Upload size={24} className="text-indigo-500 mb-1.5" />
                        <span className="text-xs font-extrabold text-slate-800">Select Document from Local Device</span>
                        <span className="text-[10px] text-slate-400 font-medium mt-0.5">PDF, DOCX, PPTX, XLSX, Images, ZIP (Max 15MB)</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.png,.jpg,.jpeg"
                          onChange={handleMatLocalFileSelect}
                          className="hidden"
                        />
                      </label>
                    ) : (
                      <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <FileText size={20} className="text-indigo-600 shrink-0" />
                          <div className="truncate">
                            <p className="text-xs font-black text-indigo-950 truncate">{matLocalFile.name}</p>
                            <p className="text-[10px] font-bold text-indigo-600">{matLocalFile.size}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMatLocalFile(null)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-1">
                    <div className="relative">
                      <HardDrive size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-500" />
                      <input
                        type="url"
                        value={matDriveUrl}
                        onChange={(e) => setMatDriveUrl(e.target.value)}
                        placeholder="Paste Google Drive, OneDrive, or Dropbox share link..."
                        className="w-full pl-9 pr-3 py-3 bg-white border border-blue-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {matDriveUrl && (
                      <div className="flex justify-between items-center text-[10px] font-bold text-blue-600 px-1">
                        <span>Ensure link sharing permissions are enabled for students</span>
                        <a href={matDriveUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                          Test Drive Link <ExternalLink size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingMaterial || !matTitle.trim()}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
              >
                {submittingMaterial ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <>
                    <FilePlus size={16} /> Publish Material to Students
                  </>
                )}
              </button>

            </form>
          </div>

          {/* List of Study Materials (Right Column - 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Search & Filter Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-lg tracking-tight flex items-center gap-2">
                  Published Student Resources
                  <span className="text-xs font-extrabold px-2.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                    {filteredMaterials.length}
                  </span>
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={matSearchQuery}
                    onChange={(e) => setMatSearchQuery(e.target.value)}
                    placeholder="Search documents by title or topic..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <select
                    value={selectedMatCategoryFilter}
                    onChange={(e) => setSelectedMatCategoryFilter(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ALL">All Resource Categories</option>
                    <option value="Aptitude & Reasoning">Aptitude & Reasoning</option>
                    <option value="Technical & Coding">Technical & Coding</option>
                    <option value="Resume Templates">Resume Templates</option>
                    <option value="Interview Questions">Interview Questions</option>
                    <option value="Company Preparation">Company Preparation</option>
                    <option value="Placement Policy">Placement Policy</option>
                    <option value="General Material">General Notes</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Document List Cards */}
            {loading ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
                <RefreshCw size={28} className="mx-auto text-indigo-600 animate-spin mb-3" />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Loading study materials...</p>
              </div>
            ) : filteredMaterials.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-3xl border border-slate-200">
                <FolderPlus className="mx-auto text-slate-200 mb-4" size={56} />
                <h3 className="text-lg font-black text-slate-900">No Study Materials Uploaded</h3>
                <p className="text-slate-500 text-xs mt-1 font-medium">Use the form on the left to upload study materials, guides, or Google Drive links for your students.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMaterials.map((mat) => (
                  <div 
                    key={mat.id}
                    className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all space-y-4 group"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-indigo-100">
                          {mat.category || 'General'}
                        </span>
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-lg">
                          Target: {mat.batch_name || 'ALL'}
                        </span>
                        {mat.attachment_type === 'DRIVE_LINK' ? (
                          <span className="px-2.5 py-1 bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-blue-100 flex items-center gap-1">
                            <HardDrive size={11} /> Google Drive
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg border border-emerald-100 flex items-center gap-1">
                            <FileText size={11} /> Local Attachment
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <Clock size={12} />
                          {new Date(mat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <button
                          onClick={() => handleDeleteMaterial(mat.id)}
                          className="text-slate-300 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Delete Material"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h4 className="font-black text-slate-900 text-base group-hover:text-indigo-600 transition-colors leading-tight">
                        {mat.title}
                      </h4>
                      {mat.description && (
                        <p className="text-xs text-slate-600 font-medium mt-1.5 leading-relaxed">
                          {mat.description}
                        </p>
                      )}
                    </div>

                    {/* Download / Open Link Action Box */}
                    <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-150 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          mat.attachment_type === 'DRIVE_LINK' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                        }`}>
                          {mat.attachment_type === 'DRIVE_LINK' ? <HardDrive size={20} /> : <FileText size={20} />}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate">{mat.file_name || mat.title}</p>
                          <p className="text-[10px] font-bold text-slate-400">{mat.file_size || 'Document'} • {mat.download_count || 0} student access(es)</p>
                        </div>
                      </div>

                      {mat.attachment_type === 'DRIVE_LINK' ? (
                        <a 
                          href={mat.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          Open Drive Link <ExternalLink size={12} />
                        </a>
                      ) : (
                        <a 
                          href={mat.attachment_url} 
                          download={mat.file_name || 'Study_Material'}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          Download <Download size={12} />
                        </a>
                      )}
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 3: SYSTEM NOTIFICATIONS */}
      {activeTab === 'system' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200">
            <h3 className="font-black text-slate-900 text-base">Incoming System Alerts</h3>
            <button 
              onClick={markAllAsRead}
              className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm divide-y divide-slate-100 overflow-hidden">
            {loading ? (
              <div className="p-16 text-center font-bold text-slate-400 uppercase tracking-widest text-xs">Loading notifications...</div>
            ) : notifications.length === 0 ? (
              <div className="p-16 text-center">
                 <Bell className="mx-auto text-slate-200 mb-4" size={48} />
                 <h3 className="text-base font-black text-slate-900">No Notifications</h3>
                 <p className="text-slate-500 text-xs mt-1 font-medium">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  className={`p-6 flex items-start gap-5 hover:bg-slate-50 transition-colors ${!notif.is_read ? 'bg-blue-50/30' : ''}`}
                >
                  <div className={`p-3 rounded-2xl shrink-0 ${!notif.is_read ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                    <Bell size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-black text-slate-900 text-sm">{notif.title}</h4>
                      <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Clock size={12} />
                        {new Date(notif.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Notice Preview Modal */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-200 space-y-6 max-h-[90vh] overflow-y-auto">
            
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Eye size={20} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Student Feed Preview</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">How students see this notice</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPreviewModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Mocked Student Notice Card */}
            <div className="bg-white rounded-3xl p-6 border-2 border-indigo-200 shadow-sm relative overflow-hidden space-y-3">
              <div className="absolute top-0 left-0 bottom-0 w-[4px] bg-amber-500 rounded-l-full"></div>
              
              <div className="flex flex-wrap justify-between items-start gap-4 mb-2">
                <div className="flex items-center gap-2">
                  {getCategoryBadge(category)}
                  {getPriorityBadge(priority)}
                </div>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg">
                  <Clock size={13} className="text-slate-400" /> Today
                </span>
              </div>

              <h3 className="text-lg font-black text-slate-900 leading-tight">
                {title || "Notice Title Placeholder"}
              </h3>
              
              <div>
                <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full">
                  Target Audience: {batchName}
                </span>
              </div>

              <p className="text-sm text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap bg-slate-50/80 p-4 rounded-2xl border border-slate-100">
                {message || "Notice details will appear here..."}
              </p>

              {/* Preview Attached Document Box */}
              {attachmentMode === 'LOCAL' && localFile && (
                <div className="bg-indigo-50 border border-indigo-200 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <FileText size={20} className="text-indigo-600 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-black text-indigo-950 truncate">{localFile.name}</p>
                      <p className="text-[10px] font-bold text-indigo-600">{localFile.size}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-xl flex items-center gap-1">
                    Download <Download size={12} />
                  </span>
                </div>
              )}

              {attachmentMode === 'DRIVE_LINK' && driveUrl && (
                <div className="bg-blue-50 border border-blue-200 p-3.5 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <HardDrive size={20} className="text-blue-600 shrink-0" />
                    <div className="truncate">
                      <p className="text-xs font-black text-blue-950 truncate">{title || 'Google Drive Document'}</p>
                      <p className="text-[10px] font-bold text-blue-600">Google Drive Cloud Link</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-xl flex items-center gap-1">
                    Open Link <ExternalLink size={12} />
                  </span>
                </div>
              )}

            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
              >
                Close Preview
              </button>
              <button
                type="button"
                onClick={() => handlePostNotice()}
                disabled={submitting}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2"
              >
                <Send size={14} /> Confirm & Broadcast
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
