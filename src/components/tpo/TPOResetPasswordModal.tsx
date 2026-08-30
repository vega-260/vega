import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Lock, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Send, 
  X, 
  Check,
  Clock,
  AlertTriangle
} from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface TPOResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'otp' | 'direct';
  onSuccess?: () => void;
}

export function TPOResetPasswordModal({
  isOpen,
  onClose,
  initialMode = 'otp',
  onSuccess,
}: TPOResetPasswordModalProps) {
  const { user } = useAuth();

  const [activeMode, setActiveMode] = useState<'otp' | 'direct'>(initialMode);
  
  // OTP Reset States
  const [otpSent, setOtpSent] = useState(false);
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResetting, setOtpResetting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devOtpHint, setDevOtpHint] = useState<string | null>(null);

  // OTP Passwords
  const [otpNewPassword, setOtpNewPassword] = useState('');
  const [otpConfirmPassword, setOtpConfirmPassword] = useState('');
  const [showOtpNewPassword, setShowOtpNewPassword] = useState(false);
  const [showOtpConfirmPassword, setShowOtpConfirmPassword] = useState(false);

  // Direct Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [directNewPassword, setDirectNewPassword] = useState('');
  const [directConfirmPassword, setDirectConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showDirectNewPassword, setShowDirectNewPassword] = useState(false);
  const [showDirectConfirmPassword, setShowDirectConfirmPassword] = useState(false);
  const [directChanging, setDirectChanging] = useState(false);

  // Inline error message state for guaranteed in-modal visibility
  const [formError, setFormError] = useState<string | null>(null);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setOtpSent(false);
      setOtpValues(['', '', '', '', '', '']);
      setOtpNewPassword('');
      setOtpConfirmPassword('');
      setCurrentPassword('');
      setDirectNewPassword('');
      setDirectConfirmPassword('');
      setDevOtpHint(null);
      setFormError(null);
    }
  }, [isOpen, initialMode]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Password criteria check helper
  const checkCriteria = (pass: string) => {
    return {
      minLength: pass.length >= 8,
      maxLength: pass.length <= 64,
      hasUpper: /[A-Z]/.test(pass),
      hasLower: /[a-z]/.test(pass),
      hasNumber: /\d/.test(pass),
      hasSpecial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(pass),
    };
  };

  const calculateStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'Not Entered', color: 'bg-slate-200', text: 'text-slate-400' };
    const c = checkCriteria(pass);
    let count = 0;
    if (c.minLength) count++;
    if (c.hasUpper) count++;
    if (c.hasLower) count++;
    if (c.hasNumber) count++;
    if (c.hasSpecial) count++;

    if (count <= 2) return { score: 25, label: 'Weak', color: 'bg-rose-500', text: 'text-rose-500' };
    if (count === 3) return { score: 50, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500' };
    if (count === 4) return { score: 75, label: 'Good', color: 'bg-blue-500', text: 'text-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
  };

  // Dispatch OTP
  const handleSendOtp = async () => {
    if (resendCooldown > 0 || otpSending) return;
    setFormError(null);
    try {
      setOtpSending(true);
      const res = await api.post('/tpo/password/send-otp');
      if (res.data?.success) {
        toast.success(res.data.message || 'Verification code dispatched to your registered email!');
        setOtpSent(true);
        setResendCooldown(45);
        if (res.data.debugOtp) {
          setDevOtpHint(res.data.debugOtp);
        }
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 150);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to dispatch verification code';
      toast.error(msg);
      setFormError(msg);
    } finally {
      setOtpSending(false);
    }
  };

  // OTP Box inputs
  const handleOtpChange = (index: number, val: string) => {
    setFormError(null);
    const cleanVal = val.replace(/[^0-9]/g, '');
    const newValues = [...otpValues];
    newValues[index] = cleanVal.slice(-1);
    setOtpValues(newValues);

    if (cleanVal && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    setFormError(null);
    const pasted = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newValues = [...otpValues];
      for (let i = 0; i < 6; i++) {
        newValues[i] = pasted[i] || '';
      }
      setOtpValues(newValues);
      const targetIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[targetIndex]?.focus();
    }
  };

  const getMissingCriteriaLabels = (c: ReturnType<typeof checkCriteria>) => {
    const missing: string[] = [];
    if (!c.minLength) missing.push('8+ characters');
    if (!c.hasUpper) missing.push('uppercase letter (A-Z)');
    if (!c.hasLower) missing.push('lowercase letter (a-z)');
    if (!c.hasNumber) missing.push('number (0-9)');
    if (!c.hasSpecial) missing.push('special symbol (!@#$%...)');
    return missing;
  };

  // Method 1: Submit Reset with OTP
  const handleSubmitOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      const err = 'Please enter the complete 6-digit verification code.';
      setFormError(err);
      toast.error(err);
      return;
    }

    const c = checkCriteria(otpNewPassword);
    if (!c.minLength || !c.hasUpper || !c.hasLower || !c.hasNumber || !c.hasSpecial) {
      const missing = getMissingCriteriaLabels(c);
      const err = `Please meet all password requirements. Missing: ${missing.join(', ')}.`;
      setFormError(err);
      toast.error('Please meet all password security requirements.');
      return;
    }

    if (otpNewPassword !== otpConfirmPassword) {
      const err = 'New passwords do not match. Please verify confirmation.';
      setFormError(err);
      toast.error(err);
      return;
    }

    try {
      setOtpResetting(true);
      const res = await api.post('/tpo/password/reset-with-otp', {
        otp: fullOtp,
        newPassword: otpNewPassword,
        confirmPassword: otpConfirmPassword,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Password successfully updated!');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to reset password. Please check your verification code.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setOtpResetting(false);
    }
  };

  // Method 2: Submit Direct Change
  const handleSubmitDirectChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!currentPassword) {
      const err = 'Please enter your current active password.';
      setFormError(err);
      toast.error(err);
      return;
    }

    const c = checkCriteria(directNewPassword);
    if (!c.minLength || !c.hasUpper || !c.hasLower || !c.hasNumber || !c.hasSpecial) {
      const missing = getMissingCriteriaLabels(c);
      const err = `Please meet all password requirements. Missing: ${missing.join(', ')}.`;
      setFormError(err);
      toast.error('Please meet all password security requirements.');
      return;
    }

    if (directNewPassword !== directConfirmPassword) {
      const err = 'New passwords do not match. Please verify confirmation.';
      setFormError(err);
      toast.error(err);
      return;
    }

    if (currentPassword === directNewPassword) {
      const err = 'New password cannot be identical to your current password.';
      setFormError(err);
      toast.error(err);
      return;
    }

    try {
      setDirectChanging(true);
      const res = await api.post('/tpo/password/change-direct', {
        currentPassword,
        newPassword: directNewPassword,
        confirmPassword: directConfirmPassword,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Password successfully updated!');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to update password. Verify your current password.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setDirectChanging(false);
    }
  };

  const otpStrength = calculateStrength(otpNewPassword);
  const directStrength = calculateStrength(directNewPassword);
  const otpCrit = checkCriteria(otpNewPassword);
  const directCrit = checkCriteria(directNewPassword);

  const modalContent = (
    <div 
      id="tpo-reset-password-modal-backdrop"
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div 
        id="tpo-reset-password-modal-card"
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh] my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white relative flex-shrink-0">
          <button
            id="close-reset-password-modal"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close modal"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
              <KeyRound size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  TPO Password Security
                </h3>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={11} /> Verified Account
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                Update and secure your training & placement officer credentials.
              </p>
            </div>
          </div>

          {/* Segmented Mode Selector */}
          <div className="grid grid-cols-2 gap-1 mt-3.5 p-1 bg-slate-800/80 rounded-xl border border-slate-700/80 text-xs font-bold">
            <button
              type="button"
              id="mode-tab-otp"
              onClick={() => {
                setActiveMode('otp');
                setFormError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'otp'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Mail size={13} />
              <span>Reset via Email OTP</span>
            </button>

            <button
              type="button"
              id="mode-tab-direct"
              onClick={() => {
                setActiveMode('direct');
                setFormError(null);
              }}
              className={`py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'direct'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Lock size={13} />
              <span>Use Old Password</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5">
          {/* =========================================================================
              METHOD 1: RESET VIA EMAIL OTP
             ========================================================================= */}
          {activeMode === 'otp' && (
            <form id="tpo-otp-reset-form" onSubmit={handleSubmitOtpReset} className="space-y-3.5">
              {/* Account Confirmation & Send OTP Bar */}
              <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Registered Target Email
                  </span>
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {user?.email || 'Placement Officer'}
                  </p>
                </div>

                <button
                  type="button"
                  id="send-otp-btn"
                  onClick={handleSendOtp}
                  disabled={otpSending || resendCooldown > 0}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                >
                  {otpSending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Sending OTP...</span>
                    </>
                  ) : resendCooldown > 0 ? (
                    <>
                      <Clock size={13} />
                      <span>Resend in {resendCooldown}s</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>{otpSent ? 'Resend OTP' : 'Send Verification Code'}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Dev OTP Helper */}
              {devOtpHint && (
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-amber-600" />
                    Dev Preview Code:
                  </span>
                  <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-amber-300 tracking-widest text-amber-700">
                    {devOtpHint}
                  </span>
                </div>
              )}

              {/* 6-Digit OTP Box Grid */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    6-Digit Verification Code <span className="text-rose-500">*</span>
                  </label>
                  {otpSent && (
                    <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Code Sent (10m valid)
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  {otpValues.map((val, idx) => (
                    <input
                      key={idx}
                      id={`otp-box-${idx}`}
                      ref={(el) => { otpInputRefs.current[idx] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      onPaste={handleOtpPaste}
                      placeholder="•"
                      className="w-10 h-10 sm:w-11 sm:h-11 text-center text-base sm:text-lg font-black font-mono bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white rounded-xl outline-none transition-all focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-300"
                    />
                  ))}
                </div>
                {!otpSent && (
                  <p className="text-[11px] text-slate-500">
                    Click <strong>"Send Verification Code"</strong> above to receive your code via email.
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold ${otpStrength.text}`}>
                    {otpStrength.label}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="otp-new-password-input"
                    type={showOtpNewPassword ? 'text' : 'password'}
                    value={otpNewPassword}
                    onChange={(e) => {
                      setOtpNewPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Create a strong password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOtpNewPassword(!showOtpNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showOtpNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${otpStrength.color} transition-all duration-300`}
                    style={{ width: `${otpStrength.score}%` }}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="otp-confirm-password-input"
                    type={showOtpConfirmPassword ? 'text' : 'password'}
                    value={otpConfirmPassword}
                    onChange={(e) => {
                      setOtpConfirmPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Re-enter password to verify"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOtpConfirmPassword(!showOtpConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showOtpConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {otpConfirmPassword && (
                  <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
                    otpNewPassword === otpConfirmPassword ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {otpNewPassword === otpConfirmPassword ? (
                      <>
                        <CheckCircle2 size={12} />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} />
                        Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Security Requirements Checklist with Live Reactive Highlights */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Password Requirements
                  </p>
                  {otpNewPassword && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {Object.values(otpCrit).filter(Boolean).length}/6 Met
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    otpCrit.minLength 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : otpNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={otpCrit.minLength ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>8+ Chars</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    otpCrit.hasUpper 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : otpNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={otpCrit.hasUpper ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    otpCrit.hasLower 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : otpNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={otpCrit.hasLower ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    otpCrit.hasNumber 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : otpNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={otpCrit.hasNumber ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    otpCrit.hasSpecial 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : otpNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={otpCrit.hasSpecial ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Special symbol</span>
                  </div>
                </div>
              </div>

              {/* In-Modal Prominent Error Banner */}
              {formError && (
                <div 
                  id="modal-form-error-banner"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2 animate-in fade-in slide-in-from-top-1"
                >
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    {formError}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  id="cancel-otp-reset-btn"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-otp-reset-btn"
                  disabled={otpResetting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {otpResetting ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Verifying Code & Resetting...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Confirm & Reset Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* =========================================================================
              METHOD 2: CHANGE WITH OLD PASSWORD
             ========================================================================= */}
          {activeMode === 'direct' && (
            <form id="tpo-direct-change-form" onSubmit={handleSubmitDirectChange} className="space-y-3.5">
              {/* Current Password Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Current Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="direct-current-password-input"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Enter your current active password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    New Password <span className="text-rose-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold ${directStrength.text}`}>
                    {directStrength.label}
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="direct-new-password-input"
                    type={showDirectNewPassword ? 'text' : 'password'}
                    value={directNewPassword}
                    onChange={(e) => {
                      setDirectNewPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Create new secure password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectNewPassword(!showDirectNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showDirectNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {/* Strength Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${directStrength.color} transition-all duration-300`}
                    style={{ width: `${directStrength.score}%` }}
                  />
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="direct-confirm-password-input"
                    type={showDirectConfirmPassword ? 'text' : 'password'}
                    value={directConfirmPassword}
                    onChange={(e) => {
                      setDirectConfirmPassword(e.target.value);
                      setFormError(null);
                    }}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectConfirmPassword(!showDirectConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showDirectConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {directConfirmPassword && (
                  <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
                    directNewPassword === directConfirmPassword ? 'text-emerald-600' : 'text-rose-500'
                  }`}>
                    {directNewPassword === directConfirmPassword ? (
                      <>
                        <CheckCircle2 size={12} />
                        Passwords match
                      </>
                    ) : (
                      <>
                        <AlertCircle size={12} />
                        Passwords do not match
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* Criteria Checklist with Live Reactive Highlights */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Password Requirements
                  </p>
                  {directNewPassword && (
                    <span className="text-[10px] font-semibold text-slate-400">
                      {Object.values(directCrit).filter(Boolean).length}/6 Met
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    directCrit.minLength 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : directNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={directCrit.minLength ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>8+ Chars</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    directCrit.hasUpper 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : directNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={directCrit.hasUpper ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    directCrit.hasLower 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : directNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={directCrit.hasLower ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    directCrit.hasNumber 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : directNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={directCrit.hasNumber ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 p-1 rounded-md transition-colors ${
                    directCrit.hasSpecial 
                      ? 'text-emerald-700 font-bold bg-emerald-50' 
                      : directNewPassword 
                        ? 'text-rose-600 bg-rose-50/60' 
                        : 'text-slate-500'
                  }`}>
                    <Check size={13} className={directCrit.hasSpecial ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Special symbol</span>
                  </div>
                </div>
              </div>

              {/* In-Modal Prominent Error Banner */}
              {formError && (
                <div 
                  id="direct-modal-form-error-banner"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-start gap-2 animate-in fade-in slide-in-from-top-1"
                >
                  <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 leading-relaxed">
                    {formError}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  id="cancel-direct-change-btn"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="submit-direct-change-btn"
                  disabled={directChanging}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {directChanging ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Updating Password...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={14} />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
