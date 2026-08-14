import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Users, 
  Target, 
  Activity, 
  MapPin, 
  Building2, 
  BookOpen, 
  Clock, 
  Megaphone, 
  ClipboardList,
  Sparkles,
  ChevronRight,
  HelpCircle,
  Bell,
  ArrowRight,
  FileText,
  Download,
  ExternalLink,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import CollegeAssessments from './CollegeAssessments';

export default function CollegeUpdates() {
  const [activeTab, setActiveTab] = useState<'updates' | 'assessments'>('updates');
  const [feedFilter, setFeedFilter] = useState<'all' | 'notices' | 'events' | 'materials'>('notices');
  const [updates, setUpdates] = useState<{events: any[], tests: any[], notices: any[], materials: any[]}>({ events: [], tests: [], notices: [], materials: [] });
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/students/college-updates');
      if (res.data.success) {
        setUpdates({
          events: res.data.data.events || [],
          tests: res.data.data.tests || [],
          notices: res.data.data.notices || [],
          materials: res.data.data.materials || []
        });
      }
    } catch (error) {
      toast.error('Failed to load college updates');
    } finally {
      setLoading(false);
    }
  };

  const trackDownload = async (materialId?: number) => {
    if (!materialId) return;
    try {
      await api.post(`/students/study-materials/${materialId}/download`);
    } catch (err) {
      // Ignore background tracking failure
    }
  };

  if (!profile?.college_id) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-12 flex flex-col items-center justify-center min-h-[75vh] text-center bg-white border border-slate-150 rounded-3xl shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6">
          <Building2 size={32} className="text-indigo-600 animate-pulse" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">College Hub Restricted</h2>
        <p className="text-slate-500 font-semibold max-w-lg mb-6 leading-relaxed">
          This exclusive hub is only available for students who have registered through their college Training & Placement Office (TPO). 
        </p>
        <div className="text-xs text-slate-400 font-medium bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 max-w-md">
          Please contact your college TPO administrator or update your profile to link with your registered institution.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      
      {/* Immersive College Portal Welcome Header */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-3xl p-6 md:p-10 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute left-1/3 bottom-0 w-48 h-48 bg-purple-500/5 blur-[80px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3 py-1 rounded-full uppercase tracking-widest flex items-center gap-1.5 w-max">
                <Sparkles size={11} className="animate-pulse" /> Active TPO Student
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">
              {profile?.college_name || 'My Campus Portal'}
            </h1>
            <p className="text-indigo-200 text-sm max-w-2xl font-medium leading-relaxed">
              Welcome to your dedicated TPO Hub. Stay connected with live Training & Placement announcements, schedule updates, dynamic workshops, and proctored assessment tests assigned by your college administrator.
            </p>
          </div>
          
          <div className="bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl p-4 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-indigo-300 tracking-wider">Registered Batch</p>
              <p className="text-sm font-extrabold text-white">{profile?.batch_name || 'Class of WIT'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('updates')}
            className={`px-6 py-3 rounded-xl font-black text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'updates' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'hover:bg-slate-100 text-slate-500 font-bold'
            }`}
          >
            <Megaphone size={14} className={activeTab === 'updates' ? 'text-indigo-400' : 'text-slate-400'} />
            TPO Updates & Notices
          </button>
          
          <button
            onClick={() => setActiveTab('assessments')}
            className={`px-6 py-3 rounded-xl font-black text-xs tracking-wider uppercase transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'assessments' 
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/10' 
                : 'hover:bg-slate-100 text-slate-500 font-bold'
            }`}
          >
            <ClipboardList size={14} className={activeTab === 'assessments' ? 'text-indigo-400' : 'text-slate-400'} />
            Assigned College Exams
          </button>
        </div>

        {activeTab === 'updates' && (
          <button 
            onClick={fetchUpdates}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-4 py-2 rounded-xl transition-colors cursor-pointer"
          >
            Refresh Feed
          </button>
        )}
      </div>

      {/* Primary Tab Contents */}
      <div className="transition-all duration-300">
        {activeTab === 'updates' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Events & Announcements Noticeboard */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Campus Notice Board</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">TPO announcements, events & placement drives</p>
                  </div>
                </div>

                {/* Feed Sub-tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 self-start sm:self-auto">
                  <button
                    onClick={() => setFeedFilter('notices')}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      feedFilter === 'notices'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Megaphone size={13} />
                    Notices
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      feedFilter === 'notices' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {updates.notices?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setFeedFilter('materials')}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      feedFilter === 'materials'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <FolderOpen size={13} />
                    Study Materials
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      feedFilter === 'materials' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {updates.materials?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setFeedFilter('events')}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      feedFilter === 'events'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Calendar size={13} />
                    Events & Drives
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      feedFilter === 'events' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {updates.events?.length || 0}
                    </span>
                  </button>

                  <button
                    onClick={() => setFeedFilter('all')}
                    className={`px-3 py-1.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer ${
                      feedFilter === 'all'
                        ? 'bg-white text-indigo-700 shadow-sm border border-slate-200/60'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    All
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${
                      feedFilter === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {(updates.notices?.length || 0) + (updates.materials?.length || 0) + (updates.events?.length || 0)}
                    </span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-100 shadow-xs">
                  <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin mb-4"></div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Syncing TPO news...</span>
                </div>
              ) : (() => {
                const noticeItems = (updates.notices || []).map(n => ({...n, _type: 'notice'}));
                const materialItems = (updates.materials || []).map(m => ({...m, _type: 'material'}));
                const eventItems = (updates.events || []).map(e => ({...e, _type: 'event'}));
                
                let displayedItems: any[] = [];
                if (feedFilter === 'notices') displayedItems = noticeItems;
                else if (feedFilter === 'materials') displayedItems = materialItems;
                else if (feedFilter === 'events') displayedItems = eventItems;
                else displayedItems = [...noticeItems, ...materialItems, ...eventItems];

                displayedItems.sort((a, b) => new Date(b.created_at || b.start_date || 0).getTime() - new Date(a.created_at || a.start_date || 0).getTime());

                if (displayedItems.length === 0) {
                  return (
                    <div className="text-center py-16 bg-white rounded-3xl border border-slate-150 shadow-xs">
                      <Bell size={40} className="mx-auto text-slate-200 mb-4" />
                      <p className="font-bold text-slate-800">
                        {feedFilter === 'notices' ? 'No Campus Notices Found' : feedFilter === 'materials' ? 'No Study Materials Available' : feedFilter === 'events' ? 'No Events & Drives Scheduled' : 'Your TPO Feed is Quiet'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        {feedFilter === 'notices' 
                          ? 'There are no notices posted by your TPO in this category.' 
                          : feedFilter === 'materials'
                          ? 'There are no study materials or documents uploaded by your TPO.'
                          : feedFilter === 'events' 
                          ? 'There are no active events or drives posted by your TPO.' 
                          : 'There are no recent announcements, study materials, or workshops scheduled.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5">
                    {displayedItems.map((item, idx) => (
                      <div key={`${item._type}-${item.id}-${idx}`} className="bg-white rounded-3xl p-6 border border-slate-150 hover:border-indigo-200 transition-all shadow-xs relative group overflow-hidden">
                        <div className={`absolute top-0 left-0 bottom-0 w-[4px] rounded-l-full ${
                          item._type === 'notice' ? 'bg-amber-500' : item._type === 'material' ? 'bg-indigo-600' : 'bg-blue-500'
                        }`}></div>
                        
                        <div className="flex flex-wrap justify-between items-start gap-4 mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                              item._type === 'notice' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                                : item._type === 'material'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {item._type === 'notice' ? (item.category || 'CAMPUS NOTICE') : item._type === 'material' ? (item.category || 'STUDY MATERIAL') : (item.event_type || 'PLACEMENT DRIVE')}
                            </span>

                            {item._type === 'notice' && item.priority === 'URGENT' && (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-1">
                                <Sparkles size={11} className="animate-pulse" /> Urgent Alert
                              </span>
                            )}
                            {item._type === 'notice' && item.priority === 'HIGH' && (
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">
                                High Priority
                              </span>
                            )}
                          </div>
                          
                          {(item.start_date || item.created_at) && (
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                              <Clock size={13} className="text-slate-400" /> 
                              {new Date(item.start_date || item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>

                        <h3 className={`text-lg font-black text-slate-900 transition-colors mb-2 leading-tight ${item._type === 'notice' ? 'group-hover:text-amber-600' : 'group-hover:text-indigo-600'}`}>
                          {item.title}
                        </h3>
                        
                        {item.batch_name && item.batch_name !== 'ALL' && (
                          <div className="mb-3">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-full">
                              Target Audience: {item.batch_name}
                            </span>
                          </div>
                        )}
                        
                        <p className={`text-sm text-slate-600 font-semibold mb-4 leading-relaxed ${item._type === 'notice' ? 'whitespace-pre-wrap' : 'line-clamp-3'}`}>
                          {item.message || item.description}
                        </p>
                        
                        {/* Event Location or Link */}
                        {item._type === 'event' && item.location_or_link && (
                          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50/50 px-3.5 py-2.5 rounded-xl border border-indigo-100/50 w-max max-w-full">
                            <MapPin size={14} className="text-indigo-500 shrink-0" />
                            <span className="truncate">{item.location_or_link}</span>
                          </div>
                        )}

                        {/* Notice Attachment (Local or Drive) */}
                        {item._type === 'notice' && item.attachment_url && (
                          <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl flex items-center justify-between gap-3 mt-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                                item.attachment_type === 'DRIVE_LINK' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                              }`}>
                                {item.attachment_type === 'DRIVE_LINK' ? <HardDrive size={18} /> : <FileText size={18} />}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-slate-900 truncate">{item.attachment_name || 'Attached Document'}</p>
                                <p className="text-[10px] font-bold text-slate-500">{item.attachment_size || 'Document Attachment'}</p>
                              </div>
                            </div>

                            {item.attachment_type === 'DRIVE_LINK' ? (
                              <a 
                                href={item.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                              >
                                Open Drive Link <ExternalLink size={12} />
                              </a>
                            ) : (
                              <a 
                                href={item.attachment_url} 
                                download={item.attachment_name || 'Campus_Notice_Document'}
                                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                              >
                                Download <Download size={12} />
                              </a>
                            )}
                          </div>
                        )}

                        {/* Standalone Study Material Document Card */}
                        {item._type === 'material' && item.attachment_url && (
                          <div className="bg-indigo-50/80 border border-indigo-200 p-4 rounded-2xl flex items-center justify-between gap-3 mt-3">
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                item.attachment_type === 'DRIVE_LINK' ? 'bg-blue-600 text-white' : 'bg-indigo-600 text-white'
                              }`}>
                                {item.attachment_type === 'DRIVE_LINK' ? <HardDrive size={20} /> : <FileText size={20} />}
                              </div>
                              <div className="truncate">
                                <p className="text-xs font-black text-indigo-950 truncate">{item.file_name || item.title}</p>
                                <p className="text-[10px] font-bold text-indigo-600">{item.file_size || 'Study Document'}</p>
                              </div>
                            </div>

                            {item.attachment_type === 'DRIVE_LINK' ? (
                              <a 
                                href={item.attachment_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                onClick={() => trackDownload(item.id)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                Open Drive Link <ExternalLink size={12} />
                              </a>
                            ) : (
                              <a 
                                href={item.attachment_url} 
                                download={item.file_name || 'Study_Material'}
                                onClick={() => trackDownload(item.id)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                Download Document <Download size={12} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Right Column: Mini Checklist or Fast Actions */}
            <div className="space-y-6">
              
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Target size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-slate-900 uppercase tracking-wider">Placement Progress</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active assignments check</p>
                </div>
              </div>

              {/* Swift Assessments Summary Card */}
              <div className="bg-gradient-to-b from-white to-slate-50 border border-slate-150 rounded-3xl p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase">Assigned Tests</span>
                  <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-full uppercase tracking-wider">
                    {updates.tests.length} Active
                  </span>
                </div>
                
                <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                  Your Training & Placement Office administers examinations, coding benchmarks, and mock interview prep cycles directly. Always check the exams tab to avoid missing vital windows.
                </p>

                <button 
                  onClick={() => setActiveTab('assessments')}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Go to Assigned Exams <ArrowRight size={14} />
                </button>
              </div>

              {/* TPO Advice Banner */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 space-y-3">
                <h4 className="text-xs font-black text-indigo-900 uppercase tracking-widest flex items-center gap-1.5">
                  <Activity size={14} className="text-indigo-600 animate-pulse" /> Student Guidelines
                </h4>
                <ul className="space-y-2 text-xs text-indigo-950 font-bold leading-relaxed list-disc list-inside">
                  <li>Verify and maintain profile accuracy to ensure accurate drive scheduling.</li>
                  <li>Arrive 10 minutes early for all dynamic tests and workshops.</li>
                  <li>Enable proctoring logs (camera/geolocation) when demanded by your examiner.</li>
                </ul>
              </div>

            </div>

          </div>
        ) : (
          /* Embed the full dynamic assessments engine components */
          <div className="bg-white border border-slate-150 rounded-3xl p-2 md:p-6 shadow-xs">
            <CollegeAssessments />
          </div>
        )}
      </div>

    </div>
  );
}
