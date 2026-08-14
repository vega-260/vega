import React, { useEffect, useState } from 'react';
import { 
  Mail, 
  MessageSquare, 
  Search, 
  Trash2, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  RefreshCw, 
  Send,
  User,
  Calendar,
  Filter,
  Eye,
  X
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Inquiry {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | string;
  created_at: string;
}

export function ContactInquiries() {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  const fetchInquiries = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/contact-inquiries');
      if (res.data.success) {
        setInquiries(res.data.inquiries || []);
      }
    } catch (error) {
      console.error('Error fetching inquiries:', error);
      toast.error('Failed to load contact inquiries');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      const res = await api.put(`/admin/contact-inquiries/${id}/status`, { status: newStatus });
      if (res.data.success) {
        toast.success(`Inquiry marked as ${newStatus.replace('_', ' ')}`);
        setInquiries(prev => prev.map(inq => inq.id === id ? { ...inq, status: newStatus } : inq));
        if (selectedInquiry && selectedInquiry.id === id) {
          setSelectedInquiry({ ...selectedInquiry, status: newStatus });
        }
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this inquiry?')) return;
    try {
      const res = await api.delete(`/admin/contact-inquiries/${id}`);
      if (res.data.success) {
        toast.success('Inquiry deleted successfully');
        setInquiries(prev => prev.filter(inq => inq.id !== id));
        if (selectedInquiry?.id === id) {
          setSelectedInquiry(null);
        }
      }
    } catch (error) {
      console.error('Error deleting inquiry:', error);
      toast.error('Failed to delete inquiry');
    }
  };

  const filteredInquiries = inquiries.filter(inq => {
    const matchesSearch = 
      inq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inq.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inq.subject && inq.subject.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inq.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inq.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = inquiries.length;
  const pendingCount = inquiries.filter(i => i.status === 'PENDING').length;
  const inProgressCount = inquiries.filter(i => i.status === 'IN_PROGRESS').length;
  const resolvedCount = inquiries.filter(i => i.status === 'RESOLVED').length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <MessageSquare className="text-blue-600" size={28} />
            Contact & Support Inquiries
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Manage incoming messages submitted through the public Help Desk & Contact page
          </p>
        </div>

        <button
          onClick={fetchInquiries}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold rounded-xl transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Total Inquiries</span>
            <Mail className="text-indigo-500" size={18} />
          </div>
          <div className="text-3xl font-black text-slate-900">{totalCount}</div>
          <div className="text-[11px] text-slate-400 font-medium mt-1">Submitted messages</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Pending Action</span>
            <Clock className="text-amber-500" size={18} />
          </div>
          <div className="text-3xl font-black text-amber-600">{pendingCount}</div>
          <div className="text-[11px] text-amber-600/70 font-medium mt-1">Awaiting response</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <div className="flex items-center justify-between text-blue-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>In Progress</span>
            <AlertCircle className="text-blue-500" size={18} />
          </div>
          <div className="text-3xl font-black text-blue-600">{inProgressCount}</div>
          <div className="text-[11px] text-blue-600/70 font-medium mt-1">Currently being handled</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase tracking-wider mb-2">
            <span>Resolved</span>
            <CheckCircle className="text-emerald-500" size={18} />
          </div>
          <div className="text-3xl font-black text-emerald-600">{resolvedCount}</div>
          <div className="text-[11px] text-emerald-600/70 font-medium mt-1">Closed support tickets</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-96">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, email, or content..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { id: 'ALL', label: 'All Messages' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'IN_PROGRESS', label: 'In Progress' },
            { id: 'RESOLVED', label: 'Resolved' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inquiries Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3 font-semibold">
            <RefreshCw size={24} className="animate-spin text-blue-600" />
            Loading submitted inquiries...
          </div>
        ) : filteredInquiries.length === 0 ? (
          <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
            <Mail size={36} className="text-slate-300" />
            <div className="text-base font-bold text-slate-800">No contact inquiries found</div>
            <div className="text-xs">Submissions from the public Contact page will appear here instantly.</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="p-4">Sender Info</th>
                  <th className="p-4">Subject</th>
                  <th className="p-4">Message Snippet</th>
                  <th className="p-4">Submitted Date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredInquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-slate-900 text-sm">{inq.name}</div>
                      <a 
                        href={`mailto:${inq.email}`} 
                        className="text-indigo-600 hover:underline font-semibold flex items-center gap-1 mt-0.5 text-xs"
                      >
                        <Mail size={12} />
                        {inq.email}
                      </a>
                    </td>
                    <td className="p-4 font-bold text-slate-800 max-w-[200px] truncate">
                      {inq.subject || 'General Support Request'}
                    </td>
                    <td className="p-4 text-slate-600 max-w-[280px] truncate">
                      {inq.message}
                    </td>
                    <td className="p-4 text-slate-500 whitespace-nowrap">
                      {new Date(inq.created_at).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <select
                        value={inq.status || 'PENDING'}
                        onChange={(e) => handleUpdateStatus(inq.id, e.target.value)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider border cursor-pointer focus:outline-none ${
                          inq.status === 'RESOLVED' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : inq.status === 'IN_PROGRESS'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN PROGRESS</option>
                        <option value="RESOLVED">RESOLVED</option>
                      </select>
                    </td>
                    <td className="p-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedInquiry(inq)}
                        className="p-2 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                        title="View details"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>

                      <a
                        href={`mailto:${inq.email}?subject=RE: ${encodeURIComponent(inq.subject || 'Inquiry')}`}
                        className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg transition-colors inline-flex items-center gap-1 font-bold text-[11px]"
                        title="Reply via Email"
                      >
                        <Send size={14} />
                        <span>Reply</span>
                      </a>

                      <button
                        onClick={() => handleDelete(inq.id)}
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors inline-flex items-center"
                        title="Delete inquiry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inquiry View Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl border border-slate-100 relative animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedInquiry(null)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 p-2 rounded-full hover:bg-slate-100 transition-all cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <Mail size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Inquiry Details</h3>
                <p className="text-xs text-slate-400 font-medium">Received on {new Date(selectedInquiry.created_at).toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="space-y-4 text-sm bg-slate-50 p-5 rounded-2xl border border-slate-200 overflow-hidden">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-3 border-b border-slate-200/80">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Sender Name</span>
                  <span className="font-extrabold text-slate-900 flex items-center gap-1.5 break-all">
                    <User size={14} className="text-indigo-500 shrink-0" />
                    <span className="break-all">{selectedInquiry.name}</span>
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Email Address</span>
                  <a href={`mailto:${selectedInquiry.email}`} className="font-extrabold text-indigo-600 hover:underline flex items-center gap-1.5 break-all">
                    <Mail size={14} className="shrink-0" />
                    <span className="break-all">{selectedInquiry.email}</span>
                  </a>
                </div>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Subject</span>
                <span className="font-bold text-slate-900 text-base block break-words break-all [overflow-wrap:anywhere]">
                  {selectedInquiry.subject || 'General Support Request'}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Message Content</span>
                <p className="text-slate-700 font-medium leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-slate-200 max-h-60 overflow-y-auto break-words break-all [overflow-wrap:anywhere]">
                  {selectedInquiry.message}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-1">Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                    selectedInquiry.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedInquiry.status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedInquiry.status}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateStatus(selectedInquiry.id, 'RESOLVED')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Mark Resolved
                  </button>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=RE: ${encodeURIComponent(selectedInquiry.subject || 'Inquiry')}`}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send size={14} />
                    Reply via Email
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedInquiry(null)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ContactInquiries;
