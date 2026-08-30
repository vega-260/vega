import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bell, 
  Search, 
  ChevronDown, 
  User, 
  UserCheck, 
  Shield, 
  ShieldAlert, 
  LogOut, 
  LayoutDashboard, 
  Settings, 
  Calendar, 
  CheckCircle2, 
  X,
  FileText,
  Clock,
  Sparkles,
  KeyRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { TPOResetPasswordModal } from './tpo/TPOResetPasswordModal';

interface PortalHeaderProps {
  portalType: 'ADMIN' | 'TPO';
  searchPlaceholder?: string;
}

export function PortalHeader({ portalType, searchPlaceholder }: PortalHeaderProps) {
  const { user, profile, logout, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Fetch TPO profile if not yet loaded in context
  useEffect(() => {
    if (portalType === 'TPO' && user?.role === 'TPO' && !profile?.full_name) {
      api.get('/tpo/profile')
        .then(res => {
          if (res.data?.success && res.data?.data) {
            updateProfile(res.data.data);
          }
        })
        .catch(() => {});
    }
  }, [portalType, user, profile, updateProfile]);

  // Fetch system notifications
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      setLoadingNotifications(true);
      const res = await api.get('/notifications');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setNotifications(res.data.data);
        const unread = res.data.data.filter((n: any) => !n.is_read).length;
        setUnreadCount(unread);
      }
    } catch {
      // Fallback empty if notifications endpoint fails
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    }
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute display name and role badge
  const displayName = React.useMemo(() => {
    if (portalType === 'TPO') {
      return profile?.full_name || profile?.college_name || user?.email?.split('@')[0] || 'Placement Officer';
    }
    return user?.email?.split('@')[0] || (user?.role === 'SUPER_ADMIN' ? 'Super Admin' : 'System Admin');
  }, [portalType, profile, user]);

  const roleBadge = React.useMemo(() => {
    if (portalType === 'TPO') {
      return 'Verified TPO';
    }
    return user?.role === 'SUPER_ADMIN' ? 'Super Administrator' : 'System Administrator';
  }, [portalType, user]);

  const profilePhoto = profile?.profile_photo_url || null;
  const initialLetter = (displayName?.[0] || (portalType === 'TPO' ? 'T' : 'A')).toUpperCase();

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    if (portalType === 'TPO') {
      navigate(`/tpo/students?search=${encodeURIComponent(searchQuery)}`);
    } else {
      navigate(`/admin/students?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-40 h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-6 lg:px-8 flex items-center justify-between shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
      {/* Left Area: Context / Search */}
      <div className="flex items-center gap-6 flex-1 max-w-xl">
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={searchPlaceholder || (portalType === 'TPO' ? "Search students, assessments, drives..." : "Search platform records, students, logs...")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100/70 hover:bg-slate-100 focus:bg-white border border-transparent focus:border-slate-300 rounded-2xl pl-11 pr-4 py-2 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:ring-4 focus:ring-blue-500/10"
          />
        </form>

        <div className="hidden xl:flex items-center gap-2 px-3 py-1 bg-slate-100/80 rounded-full border border-slate-200/60">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
            {portalType === 'TPO' ? 'TPO Ecosystem' : 'Admin Control'}
          </span>
        </div>
      </div>

      {/* Right Area: Actions & Standardized User Profile */}
      <div className="flex items-center gap-4">
        {/* Quick Shortcut Buttons */}
        {portalType === 'TPO' && (
          <Link
            to="/tpo/events"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Calendar size={14} className="text-indigo-600" />
            <span>Events & Drives</span>
          </Link>
        )}

        {portalType === 'ADMIN' && (
          <Link
            to="/admin/monitoring"
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition-colors"
          >
            <Sparkles size={14} className="text-blue-600" />
            <span>Live Monitoring</span>
          </Link>
        )}

        {/* Notifications Icon Button */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-200 cursor-pointer ${
              showNotifications
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
            }`}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && !showNotifications && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50"
              >
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-blue-600" />
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                      Notifications
                    </h4>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {loadingNotifications && notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 font-medium">
                      Loading notifications...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center flex flex-col items-center justify-center">
                      <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                        <Bell size={18} />
                      </div>
                      <p className="text-xs font-bold text-slate-700">No new notifications</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">You are all caught up!</p>
                    </div>
                  ) : (
                    notifications.slice(0, 5).map((notif: any) => (
                      <div key={notif.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                        <p className="text-xs font-bold text-slate-800 line-clamp-1">{notif.title || 'System Notice'}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{notif.message || notif.content}</p>
                        <div className="flex items-center gap-1 mt-1 text-[9px] text-slate-400 font-medium">
                          <Clock size={10} />
                          <span>{notif.created_at ? new Date(notif.created_at).toLocaleDateString() : 'Just now'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {portalType === 'TPO' && (
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <Link
                      to="/tpo/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      View All Announcements &rarr;
                    </Link>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-8 w-px bg-slate-200 mx-1" />

        {/* Standardized User Profile Section (Same position + format + behavior) */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="flex items-center gap-3 pl-2 pr-3.5 py-1.5 bg-slate-50/80 hover:bg-white rounded-2xl border border-slate-200/60 hover:border-slate-300 hover:shadow-md transition-all duration-300 group cursor-pointer"
            aria-label="User profile menu"
          >
            {/* User Avatar with Image or Initial Letter */}
            <div className={`w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center font-black text-white text-sm shadow-sm transition-transform group-hover:scale-105 shrink-0 ${
              portalType === 'TPO'
                ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-blue-500/20'
                : 'bg-gradient-to-tr from-slate-900 to-indigo-900 shadow-indigo-950/20'
            }`}>
              {profilePhoto ? (
                <img
                  src={profilePhoto}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span>{initialLetter}</span>
              )}
            </div>

            {/* User Info Texts */}
            <div className="text-left hidden md:block max-w-[160px]">
              <p className="text-xs font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                {displayName}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate leading-none">
                  {roleBadge}
                </p>
              </div>
            </div>

            {/* Dropdown Chevron Indicator */}
            <ChevronDown
              size={15}
              className={`text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
                showProfileMenu ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {/* Standardized Profile Dropdown Menu */}
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 mt-3 w-64 bg-white border border-slate-100 rounded-2xl shadow-2xl p-2 z-50 space-y-1"
              >
                {/* Account Summary Header */}
                <div className="p-3 border-b border-slate-100 mb-1 bg-slate-50/60 rounded-xl">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs ${
                      portalType === 'TPO' ? 'bg-blue-600' : 'bg-slate-900'
                    }`}>
                      {initialLetter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{displayName}</p>
                      <p className="text-[10px] font-medium text-slate-500 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-slate-200/80 rounded-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black text-slate-700 uppercase tracking-wider">{roleBadge}</span>
                  </div>
                </div>

                {/* Role Specific Actions */}
                {portalType === 'TPO' && (
                  <>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/tpo/profile');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <UserCheck size={16} className="text-slate-400" />
                      TPO Profile
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setShowPasswordModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-blue-50/50 hover:bg-blue-100/70 text-blue-700 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <KeyRound size={16} className="text-blue-600" />
                      Change / Reset Password
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/tpo');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <LayoutDashboard size={16} className="text-slate-400" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/tpo/notifications');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <Bell size={16} className="text-slate-400" />
                      Announcements
                    </button>
                  </>
                )}

                {portalType === 'ADMIN' && (
                  <>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/admin/staff');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <ShieldAlert size={16} className="text-slate-400" />
                      Staff & Officers
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/admin');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <LayoutDashboard size={16} className="text-slate-400" />
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/admin/logs');
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-blue-600 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                    >
                      <FileText size={16} className="text-slate-400" />
                      Audit Logs
                    </button>
                  </>
                )}

                <div className="h-px bg-slate-100 my-1" />

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-bold text-xs uppercase tracking-wider transition-colors text-left cursor-pointer"
                >
                  <LogOut size={16} className="text-rose-400" />
                  Logout
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* TPO Password Reset & Change Modal */}
      {portalType === 'TPO' && (
        <TPOResetPasswordModal
          isOpen={showPasswordModal}
          onClose={() => setShowPasswordModal(false)}
        />
      )}
    </header>
  );
}
