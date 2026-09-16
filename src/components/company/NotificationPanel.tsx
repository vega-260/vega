import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bell, CheckCircle, Clock, AlertCircle, Loader2, Check, X } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';

interface NotificationPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

interface NotificationItem {
  id: string | number;
  title: string;
  desc: string;
  time: string;
  type: string;
  is_read: number;
}

function formatRelativeTime(dateString: string) {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    if (isNaN(diffMs) || diffMs < 0) return "JUST NOW";
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return "JUST NOW";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins} MINS AGO`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} HOUR${diffHours > 1 ? 'S' : ''} AGO`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} DAY${diffDays > 1 ? 'S' : ''} AGO`;
  } catch (e) {
    return "JUST NOW";
  }
}

// Standard notification display duration: 5000ms (5 seconds)
const STANDARD_DISPLAY_DURATION_MS = 5000;

export function NotificationPanel({ onClose, onUnreadCountChange }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    top: '80px',
    right: '24px',
    width: '380px',
    maxWidth: 'calc(100vw - 32px)',
    zIndex: 1000,
  });
  const [arrowOffset, setArrowOffset] = useState<number>(24);
  const [isPositioned, setIsPositioned] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Position calculation: directly below bell icon, clamped within viewport bounds
  const updatePosition = () => {
    const triggerBtn = document.getElementById('company-notifications-btn');
    if (!triggerBtn) return;

    const rect = triggerBtn.getBoundingClientRect();
    const dropdownWidth = Math.min(400, window.innerWidth - 32);

    // Desired horizontal position: center dropdown directly below the bell icon
    const bellCenter = rect.left + rect.width / 2;
    let left = bellCenter - dropdownWidth / 2;

    // Viewport bounds: strictly prevent overflowing left or right edge
    const minLeft = 16;
    const maxLeft = window.innerWidth - dropdownWidth - 16;

    if (left > maxLeft) {
      left = maxLeft;
    }
    if (left < minLeft) {
      left = minLeft;
    }

    // Position directly below the bell icon with an 8px offset
    const top = rect.bottom + 8;

    // Pointer arrow offset aligned with center of bell icon
    const arrowX = Math.max(16, Math.min(dropdownWidth - 28, bellCenter - left - 6));
    setArrowOffset(arrowX);

    setPanelStyle({
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${dropdownWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 1000,
    });
    setIsPositioned(true);
  };

  useEffect(() => {
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  // Close when clicking outside the panel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        const triggerBtn = document.getElementById('company-notifications-btn');
        if (triggerBtn && triggerBtn.contains(e.target as Node)) {
          return;
        }
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [onClose]);

  const notifyUnreadChange = (items: NotificationItem[]) => {
    const count = items.filter(n => !n.is_read).length;
    onUnreadCountChange?.(count);
    window.dispatchEvent(new CustomEvent('vega:company-notifications-updated', { detail: { unreadCount: count } }));
  };

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get('/company/notifications');
      if (res.data?.success && Array.isArray(res.data.data)) {
        setNotifications(res.data.data);
        notifyUnreadChange(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch company notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Standard notification auto-dismiss timer (5 seconds)
  // Automatically closes the notification popup if user performs no action
  useEffect(() => {
    if (isHovered) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      onClose();
    }, STANDARD_DISPLAY_DURATION_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isHovered, onClose]);

  // Mark single notification as read & auto-disappear
  const handleMarkSingleRead = async (id: string | number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Optimistically update
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, is_read: 1 } : n);
      notifyUnreadChange(next);
      return next;
    });

    // Disappear immediately on click of "mark as read"
    onClose();

    try {
      await api.post(`/company/notifications/read/${id}`);
      toast.success("Notification marked as read");
    } catch (err) {
      try {
        await api.post(`/company/notifications/${id}/read`);
        toast.success("Notification marked as read");
      } catch (fallbackErr) {
        console.error("Failed to mark notification as read:", fallbackErr);
      }
    }
  };

  // Mark all notifications as read & auto-disappear
  const handleMarkAllRead = async () => {
    // Optimistic update
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, is_read: 1 }));
      notifyUnreadChange(next);
      return next;
    });

    // Disappear immediately on click of "mark as read"
    onClose();

    try {
      const res = await api.post('/company/notifications/read-all');
      if (res.data?.success) {
        toast.success("All notifications marked as read");
      }
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      toast.error("Failed to update notifications");
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return CheckCircle;
      case 'warning':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <>
      {/* Backdrop overlay to dismiss on outside click */}
      <div 
        id="notifications-backdrop"
        className="fixed inset-0 z-[999]" 
        onClick={onClose} 
      />

      <motion.div 
        ref={panelRef}
        id="company-notifications-popup"
        style={panelStyle}
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: isPositioned ? 1 : 0, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="select-none"
      >
        {/* Pointer arrow pointing directly up to the bell icon */}
        <div 
          className="absolute -top-1.5 w-3 h-3 bg-slate-50 border-t border-l border-slate-200 rotate-45 z-20 pointer-events-none"
          style={{ left: `${arrowOffset}px` }}
        />

        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden">
          {/* Top Header */}
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/90">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Bell size={13} />
              </div>
              <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
              title="Close notifications"
            >
              <X size={14} />
            </button>
          </div>

          {/* Subtle top duration countdown bar */}
          <div className="h-1 w-full bg-slate-100 overflow-hidden">
            <motion.div 
              key={isHovered ? 'paused' : 'running'}
              initial={{ width: isHovered ? "100%" : "100%" }}
              animate={{ width: isHovered ? "100%" : "0%" }}
              transition={{ duration: 5, ease: "linear" }}
              className="h-full bg-blue-600/40"
            />
          </div>

          {/* Notifications list */}
          <div className="max-h-[420px] overflow-y-auto min-h-[120px] flex flex-col justify-start divide-y divide-slate-50">
            {loading && notifications.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-indigo-600" />
                <p className="text-xs font-semibold uppercase tracking-wider">Syncing notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400 text-center px-6">
                <Bell className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-xs font-black uppercase tracking-wider text-slate-600">Your Inbox is Clear</p>
                <p className="text-[10px] font-medium text-slate-400 mt-1 leading-relaxed">
                  No new alerts or candidate status updates have been registered yet.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const IconComp = getIcon(n.type);
                return (
                  <div 
                    key={n.id} 
                    onClick={() => {
                      if (!n.is_read) {
                        handleMarkSingleRead(n.id);
                      } else {
                        onClose();
                      }
                    }}
                    className={`p-5 hover:bg-slate-50/80 transition-colors group cursor-pointer relative ${
                      !n.is_read ? 'bg-blue-50/20' : ''
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                        n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                        n.type === 'warning' ? 'bg-orange-50 text-orange-600' :
                        'bg-indigo-50 text-indigo-600'
                      }`}>
                        <IconComp size={20} />
                      </div>

                      <div className="flex-1 min-w-0 pr-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="text-xs font-black text-slate-800 uppercase tracking-tight truncate">
                            {n.title}
                          </h4>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider shrink-0">
                            {formatRelativeTime(n.time)}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 font-medium mt-1 leading-relaxed">
                          {n.desc}
                        </p>

                        {!n.is_read && (
                          <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-slate-100/60">
                            <span className="text-[10px] font-semibold text-blue-600">
                              Unread Alert
                            </span>
                            <button
                              onClick={(e) => handleMarkSingleRead(n.id, e)}
                              className="text-[10px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Check size={11} /> Mark as read
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {!n.is_read && (
                      <span className="absolute top-4 right-3 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with MARK ALL AS READ button */}
          {notifications.length > 0 && (
            <div className="p-4 bg-slate-50/50 text-center border-t border-slate-50">
              <button 
                id="mark-all-notifications-read-btn"
                onClick={handleMarkAllRead}
                className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline cursor-pointer disabled:opacity-50"
              >
                MARK ALL AS READ
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
