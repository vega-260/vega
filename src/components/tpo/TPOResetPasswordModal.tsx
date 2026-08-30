import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  KeyRound, 
  Mail, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Send, 
  X, 
  ArrowRight, 
  Check, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const [otpStep, setOtpStep] = useState<'request' | 'verify'>('request');
  const [otpValues, setOtpValues] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSending, setOtpSending] = useState(false);
  const [otpResetting, setOtpResetting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
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

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Sync initial mode
  useEffect(() => {
    if (isOpen) {
      setActiveMode(initialMode);
      setOtpStep('request');
      setOtpValues(['', '', '', '', '', '']);
      setOtpNewPassword('');
      setOtpConfirmPassword('');
      setCurrentPassword('');
      setDirectNewPassword('');
      setDirectConfirmPassword('');
      setDevOtpHint(null);
    }
  }, [isOpen, initialMode]);

  // Cooldown countdown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Password criteria check helper
  const checkPasswordCriteria = (pass: string) => {
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
    const criteria = checkPasswordCriteria(pass);
    let passedCount = 0;
    if (criteria.minLength) passedCount++;
    if (criteria.hasUpper) passedCount++;
    if (criteria.hasLower) passedCount++;
    if (criteria.hasNumber) passedCount++;
    if (criteria.hasSpecial) passedCount++;

    if (passedCount <= 2) return { score: 25, label: 'Weak', color: 'bg-red-500', text: 'text-red-500' };
    if (passedCount === 3) return { score: 50, label: 'Fair', color: 'bg-amber-500', text: 'text-amber-500' };
    if (passedCount === 4) return { score: 75, label: 'Good', color: 'bg-blue-500', text: 'text-blue-500' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-500' };
  };

  // Handle Send OTP
  const handleSendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      setOtpSending(true);
      const res = await api.post('/tpo/password/send-otp');
      if (res.data?.success) {
        toast.success(res.data.message || 'Verification code sent to your email!');
        setOtpStep('verify');
        setResendCooldown(45);
        if (res.data.debugOtp) {
          setDevOtpHint(res.data.debugOtp);
        }
        if (res.data.expiresInMinutes) {
          setOtpExpiresAt(new Date(Date.now() + res.data.expiresInMinutes * 60000));
        }
        // Focus first OTP box
        setTimeout(() => {
          otpInputRefs.current[0]?.focus();
        }, 100);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send verification code');
    } finally {
      setOtpSending(false);
    }
  };

  // Handle OTP digit box input
  const handleOtpChange = (index: number, value: string) => {
    // Only accept numeric
    const cleanVal = value.replace(/[^0-9]/g, '');
    if (!cleanVal && value !== '') return;

    const newValues = [...otpValues];
    newValues[index] = cleanVal.slice(-1);
    setOtpValues(newValues);

    // Auto move to next input if filled
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
    const pasted = e.clipboardData.getData('text').trim().replace(/[^0-9]/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newValues = [...otpValues];
      for (let i = 0; i < pasted.length; i++) {
        newValues[i] = pasted[i];
      }
      setOtpValues(newValues);
      const targetIndex = Math.min(pasted.length, 5);
      otpInputRefs.current[targetIndex]?.focus();
    }
  };

  // Method 1: Submit Reset with OTP
  const handleSubmitOtpReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otpValues.join('');
    if (fullOtp.length !== 6) {
      toast.error('Please enter the complete 6-digit verification code.');
      return;
    }

    const criteria = checkPasswordCriteria(otpNewPassword);
    if (!criteria.minLength || !criteria.hasUpper || !criteria.hasLower || !criteria.hasNumber || !criteria.hasSpecial) {
      toast.error('Please ensure the new password satisfies all security criteria.');
      return;
    }

    if (otpNewPassword !== otpConfirmPassword) {
      toast.error('New password and confirmation do not match.');
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
        toast.success(res.data.message || 'Password successfully reset!');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password. Please check your OTP.');
    } finally {
      setOtpResetting(false);
    }
  };

  // Method 2: Submit Direct Change
  const handleSubmitDirectChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error('Please enter your current password.');
      return;
    }

    const criteria = checkPasswordCriteria(directNewPassword);
    if (!criteria.minLength || !criteria.hasUpper || !criteria.hasLower || !criteria.hasNumber || !criteria.hasSpecial) {
      toast.error('Please satisfy all password security criteria.');
      return;
    }

    if (directNewPassword !== directConfirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === directNewPassword) {
      toast.error('New password must be different from your current password.');
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
        toast.success(res.data.message || 'Password changed successfully!');
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password. Please check current password.');
    } finally {
      setDirectChanging(false);
    }
  };

  const otpStrength = calculateStrength(otpNewPassword);
  const directStrength = calculateStrength(directNewPassword);
  const otpCriteria = checkPasswordCriteria(otpNewPassword);
  const directCriteria = checkPasswordCriteria(directNewPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fade-in">
      <div 
        className="bg-white border border-slate-200/90 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner">
              <KeyRound size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  TPO Password & Security
                </h3>
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-[10px] font-black uppercase tracking-wider rounded-md">
                  Dual-Mode
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Manage your credentials with verified Email OTP or existing password authentication.
              </p>
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-2 gap-2 mt-5 p-1 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => setActiveMode('otp')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'otp'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Mail size={14} />
              <span>1. Reset via Email OTP</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMode('direct')}
              className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeMode === 'direct'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              <Lock size={14} />
              <span>2. Change with Old Password</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* ==============================================
              METHOD 1: RESET VIA EMAIL OTP
             ============================================== */}
          {activeMode === 'otp' && (
            <div className="space-y-6">
              {/* Step 1: Request OTP State */}
              {otpStep === 'request' && (
                <div className="space-y-6 text-center py-2">
                  <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mx-auto shadow-sm">
                    <Mail size={32} />
                  </div>

                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      Send One-Time Passcode (OTP)
                    </h4>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      We will dispatch a secure 6-digit authorization code to your official registered email address.
                    </p>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl max-w-md mx-auto text-left">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Target Registered Account
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs font-black text-slate-800 truncate">
                        {user?.email}
                      </span>
                      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black rounded-md flex items-center gap-1">
                        <CheckCircle2 size={11} />
                        Verified
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending || resendCooldown > 0}
                      className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      {otpSending ? (
                        <>
                          <RefreshCw size={15} className="animate-spin" />
                          <span>Dispatching OTP...</span>
                        </>
                      ) : resendCooldown > 0 ? (
                        <span>Wait {resendCooldown}s to Resend</span>
                      ) : (
                        <>
                          <Send size={15} />
                          <span>Send Verification Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Verify OTP & Enter New Password */}
              {otpStep === 'verify' && (
                <form onSubmit={handleSubmitOtpReset} className="space-y-5">
                  {/* Email & OTP Notice */}
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail size={16} className="text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Code sent to <span className="text-blue-700">{user?.email}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">Valid for 10 minutes</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending || resendCooldown > 0}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 disabled:text-slate-400 transition-colors cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>

                  {/* Dev OTP Helper */}
                  {devOtpHint && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
                      <span className="font-semibold">Development Code Preview:</span>
                      <span className="font-mono font-black text-sm bg-white px-2 py-0.5 rounded border border-amber-300 tracking-widest text-amber-700">
                        {devOtpHint}
                      </span>
                    </div>
                  )}

                  {/* 6-Digit OTP Box Grid */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Enter 6-Digit OTP <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      {otpValues.map((val, idx) => (
                        <input
                          key={idx}
                          ref={(el) => { otpInputRefs.current[idx] = el; }}
                          type="text"
                          inputMode="numeric"
                          maxLength={1}
                          value={val}
                          onChange={(e) => handleOtpChange(idx, e.target.value)}
                          onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                          onPaste={handleOtpPaste}
                          className="w-12 h-14 text-center text-xl font-black font-mono bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-2xl outline-none transition-all shadow-inner focus:ring-4 focus:ring-blue-500/10 text-slate-900"
                        />
                      ))}
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                        New Secure Password <span className="text-red-500">*</span>
                      </label>
                      <span className={`text-[11px] font-bold ${otpStrength.text}`}>
                        {otpStrength.label}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type={showOtpNewPassword ? 'text' : 'password'}
                        value={otpNewPassword}
                        onChange={(e) => setOtpNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOtpNewPassword(!showOtpNewPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      >
                        {showOtpNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Live Strength Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                      <div
                        className={`h-full ${otpStrength.color} transition-all duration-300`}
                        style={{ width: `${otpStrength.score}%` }}
                      />
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Confirm New Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showOtpConfirmPassword ? 'text' : 'password'}
                        value={otpConfirmPassword}
                        onChange={(e) => setOtpConfirmPassword(e.target.value)}
                        placeholder="Re-enter your new password"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowOtpConfirmPassword(!showOtpConfirmPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                      >
                        {showOtpConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {otpConfirmPassword && (
                      <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
                        otpNewPassword === otpConfirmPassword ? 'text-emerald-600' : 'text-red-500'
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

                  {/* Password Checklist */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      Security Requirements
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                      <div className={`flex items-center gap-1.5 ${otpCriteria.minLength ? 'text-emerald-700 font-bold' : ''}`}>
                        <Check size={13} className={otpCriteria.minLength ? 'text-emerald-600' : 'text-slate-300'} />
                        <span>8+ Characters</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${otpCriteria.hasUpper ? 'text-emerald-700 font-bold' : ''}`}>
                        <Check size={13} className={otpCriteria.hasUpper ? 'text-emerald-600' : 'text-slate-300'} />
                        <span>Uppercase (A-Z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${otpCriteria.hasLower ? 'text-emerald-700 font-bold' : ''}`}>
                        <Check size={13} className={otpCriteria.hasLower ? 'text-emerald-600' : 'text-slate-300'} />
                        <span>Lowercase (a-z)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${otpCriteria.hasNumber ? 'text-emerald-700 font-bold' : ''}`}>
                        <Check size={13} className={otpCriteria.hasNumber ? 'text-emerald-600' : 'text-slate-300'} />
                        <span>Number (0-9)</span>
                      </div>
                      <div className={`flex items-center gap-1.5 ${otpCriteria.hasSpecial ? 'text-emerald-700 font-bold' : ''}`}>
                        <Check size={13} className={otpCriteria.hasSpecial ? 'text-emerald-600' : 'text-slate-300'} />
                        <span>Special Symbol</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setOtpStep('request')}
                      className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={otpResetting}
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      {otpResetting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>Verifying & Resetting...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} />
                          <span>Reset Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* ==============================================
              METHOD 2: CHANGE WITH OLD PASSWORD
             ============================================== */}
          {activeMode === 'direct' && (
            <form onSubmit={handleSubmitDirectChange} className="space-y-5">
              {/* Current Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* New Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    New Secure Password <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-[11px] font-bold ${directStrength.text}`}>
                    {directStrength.label}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type={showDirectNewPassword ? 'text' : 'password'}
                    value={directNewPassword}
                    onChange={(e) => setDirectNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectNewPassword(!showDirectNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showDirectNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full ${directStrength.color} transition-all duration-300`}
                    style={{ width: `${directStrength.score}%` }}
                  />
                </div>
              </div>

              {/* Confirm New Password Field */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Confirm New Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showDirectConfirmPassword ? 'text' : 'password'}
                    value={directConfirmPassword}
                    onChange={(e) => setDirectConfirmPassword(e.target.value)}
                    placeholder="Re-enter your new password"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-blue-600 outline-none transition-all pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDirectConfirmPassword(!showDirectConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
                  >
                    {showDirectConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {directConfirmPassword && (
                  <p className={`text-[11px] font-bold mt-1 flex items-center gap-1 ${
                    directNewPassword === directConfirmPassword ? 'text-emerald-600' : 'text-red-500'
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

              {/* Password Checklist */}
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  Security Requirements
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                  <div className={`flex items-center gap-1.5 ${directCriteria.minLength ? 'text-emerald-700 font-bold' : ''}`}>
                    <Check size={13} className={directCriteria.minLength ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>8+ Characters</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${directCriteria.hasUpper ? 'text-emerald-700 font-bold' : ''}`}>
                    <Check size={13} className={directCriteria.hasUpper ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Uppercase (A-Z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${directCriteria.hasLower ? 'text-emerald-700 font-bold' : ''}`}>
                    <Check size={13} className={directCriteria.hasLower ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Lowercase (a-z)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${directCriteria.hasNumber ? 'text-emerald-700 font-bold' : ''}`}>
                    <Check size={13} className={directCriteria.hasNumber ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Number (0-9)</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${directCriteria.hasSpecial ? 'text-emerald-700 font-bold' : ''}`}>
                    <Check size={13} className={directCriteria.hasSpecial ? 'text-emerald-600' : 'text-slate-300'} />
                    <span>Special Symbol</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={directChanging}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-blue-600/20 transition-all flex items-center gap-2 cursor-pointer"
                >
                  {directChanging ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
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
}
