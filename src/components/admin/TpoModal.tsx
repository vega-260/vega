import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Mail, 
  Phone, 
  User, 
  Briefcase, 
  BadgeCheck, 
  Building2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { isValidEmail, isValidPhone } from '../../utils/validators';

export interface TpoFormData {
  id?: number;
  user_id?: number;
  full_name: string;
  email: string;
  designation: string;
  employee_id: string;
  contact_number: string;
  college_ids: number[];
  status: 'ACTIVE' | 'INACTIVE';
}

interface TpoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  editingTpo?: TpoFormData | null;
  colleges: Array<{ id: number; college_name: string; college_code: string }>;
}

const DEFAULT_TPO_DATA: TpoFormData = {
  full_name: '',
  email: '',
  designation: '',
  employee_id: '',
  contact_number: '',
  college_ids: [],
  status: 'ACTIVE',
};

export const TpoModal: React.FC<TpoModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingTpo,
  colleges,
}) => {
  const [formData, setFormData] = useState<TpoFormData>(DEFAULT_TPO_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (editingTpo) {
        setFormData({
          id: editingTpo.id,
          user_id: editingTpo.user_id,
          full_name: editingTpo.full_name || '',
          email: editingTpo.email || '',
          designation: editingTpo.designation || '',
          employee_id: editingTpo.employee_id || '',
          contact_number: editingTpo.contact_number || '',
          college_ids: editingTpo.college_ids || [],
          status: editingTpo.status || 'ACTIVE',
        });
      } else {
        setFormData(DEFAULT_TPO_DATA);
      }
      setErrors({});
      setTouched({});
      setIsSubmitting(false);
    }
  }, [isOpen, editingTpo]);

  const validateField = (field: keyof TpoFormData, value: any): string => {
    switch (field) {
      case 'full_name': {
        const val = String(value || '').trim();
        if (!val) return 'Officer full name is required.';
        if (val.length < 2) return 'Full name must be at least 2 characters.';
        return '';
      }

      case 'email': {
        const val = String(value || '').trim();
        if (!val) return 'Official email address is required.';
        if (!isValidEmail(val)) {
          return 'Please enter a valid email address (e.g. tpo@college.edu).';
        }
        return '';
      }

      case 'contact_number': {
        const val = String(value || '').trim();
        if (val.length > 0 && !isValidPhone(val)) {
          return 'Please enter a valid contact phone (7 to 15 digits).';
        }
        return '';
      }

      default:
        return '';
    }
  };

  const handleChange = (field: keyof TpoFormData, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    const errorMsg = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: errorMsg }));
  };

  const handleBlur = (field: keyof TpoFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, formData[field]);
    setErrors(prev => ({ ...prev, [field]: errorMsg }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const allTouched: Record<string, boolean> = {
      full_name: true,
      email: true,
      contact_number: true,
    };

    const nameErr = validateField('full_name', formData.full_name);
    if (nameErr) newErrors.full_name = nameErr;

    const emailErr = validateField('email', formData.email);
    if (emailErr) newErrors.email = emailErr;

    const phoneErr = validateField('contact_number', formData.contact_number);
    if (phoneErr) newErrors.contact_number = phoneErr;

    setErrors(newErrors);
    setTouched(allTouched);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      if (errors.email || !isValidEmail(formData.email)) {
        toast.error('Please enter a valid official email address.');
        emailInputRef.current?.focus();
      } else {
        toast.error('Please fix the highlighted errors before saving.');
      }
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTpo && editingTpo.id) {
        const res = await api.put(`/admin/tpos/${editingTpo.id}`, formData);
        if (res.data.success) {
          toast.success(res.data.message || 'TPO Profile updated successfully');
          onSuccess(res.data.message);
          onClose();
        } else {
          toast.error(res.data.message || 'Failed to update TPO Profile');
        }
      } else {
        const res = await api.post('/admin/tpos', formData);
        if (res.data.success) {
          toast.success(res.data.message || 'TPO registered and credentials dispatched');
          onSuccess(res.data.message);
          onClose();
        } else {
          toast.error(res.data.message || 'Failed to register TPO');
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving TPO profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasEmailError = Boolean(errors.email && (touched.email || formData.email.length > 0));
  const isEmailValid = Boolean(!errors.email && formData.email.length > 0 && isValidEmail(formData.email));
  const hasNameError = Boolean(errors.full_name && touched.full_name);
  const hasPhoneError = Boolean(errors.contact_number && (touched.contact_number || formData.contact_number.length > 0));

  return (
    <div id="tpo-modal-overlay" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        id="tpo-modal-card" 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 id="tpo-modal-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                {editingTpo ? 'Update TPO Profile' : 'Register New TPO User'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {editingTpo ? 'Modify placement officer information and college assignments' : 'Grant institutional portal access to training & placement officers'}
              </p>
            </div>
          </div>
          <button 
            id="close-tpo-modal-btn"
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form 
          id="tpo-registration-form" 
          onSubmit={handleSubmit} 
          noValidate 
          className="p-5 sm:p-6 space-y-4 overflow-y-auto text-sm"
        >
          {/* Full Name & Official Email */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="tpo_full_name_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Full Name <span className="text-rose-500">*</span>
                </label>
              </div>
              <input 
                id="tpo_full_name_input"
                type="text" 
                placeholder="Officer Full Name" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasNameError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`}
                value={formData.full_name} 
                onChange={e => handleChange('full_name', e.target.value)} 
                onBlur={() => handleBlur('full_name')}
              />
              {hasNameError && (
                <p id="tpo_full_name_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.full_name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="tpo_email_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Official Email ID <span className="text-rose-500">*</span>
                </label>
                {isEmailValid && (
                  <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Valid email
                  </span>
                )}
              </div>
              <div className="relative">
                <input 
                  ref={emailInputRef}
                  id="tpo_email_input"
                  disabled={Boolean(editingTpo)}
                  type="email" 
                  placeholder="tpo@college.edu" 
                  className={`w-full p-3 pr-10 bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                    hasEmailError 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20' 
                      : isEmailValid
                        ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/10'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                  }`}
                  value={formData.email} 
                  onChange={e => handleChange('email', e.target.value)} 
                  onBlur={() => handleBlur('email')}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {hasEmailError && <AlertCircle className="w-4 h-4 text-rose-500" />}
                  {isEmailValid && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
              </div>
              {hasEmailError && (
                <p id="tpo_email_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>{errors.email}</span>
                </p>
              )}
            </div>
          </div>

          {/* Designation, Employee ID, Contact Phone */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label htmlFor="tpo_designation_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Briefcase className="w-3 h-3 text-slate-400" /> Designation
              </label>
              <input 
                id="tpo_designation_input"
                type="text" 
                placeholder="e.g. Placement Head" 
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white" 
                value={formData.designation} 
                onChange={e => handleChange('designation', e.target.value)} 
                onBlur={() => handleBlur('designation')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tpo_employee_id_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <BadgeCheck className="w-3 h-3 text-slate-400" /> Employee ID
              </label>
              <input 
                id="tpo_employee_id_input"
                type="text" 
                placeholder="e.g. WIT-TPO-01" 
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white" 
                value={formData.employee_id} 
                onChange={e => handleChange('employee_id', e.target.value)} 
                onBlur={() => handleBlur('employee_id')}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tpo_contact_phone_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" /> Contact Phone
              </label>
              <input 
                id="tpo_contact_phone_input"
                type="tel" 
                placeholder="e.g. +91 9876543210" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasPhoneError 
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`}
                value={formData.contact_number} 
                onChange={e => handleChange('contact_number', e.target.value)} 
                onBlur={() => handleBlur('contact_number')}
              />
              {hasPhoneError && (
                <p id="tpo_contact_phone_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.contact_number}
                </p>
              )}
            </div>
          </div>

          {/* Allocated Colleges */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-400" />
              Allocated Colleges / Institutes (Multiple Selection)
            </label>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-40 overflow-y-auto space-y-2">
              {colleges.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No colleges registered yet. Please register a college first.</p>
              ) : (
                colleges.map(c => (
                  <label key={c.id} className="flex items-center gap-2.5 text-slate-700 font-semibold cursor-pointer hover:text-slate-950 transition-colors">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-white" 
                      checked={formData.college_ids.includes(c.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleChange('college_ids', [...formData.college_ids, c.id]);
                        } else {
                          handleChange('college_ids', formData.college_ids.filter(id => id !== c.id));
                        }
                      }}
                    />
                    <span className="text-xs">{c.college_name} <span className="text-slate-400 font-mono text-[10px]">({c.college_code})</span></span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Account Status for Edit */}
          {editingTpo && (
            <div className="space-y-1.5">
              <label htmlFor="tpo_status_select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Account Status</label>
              <select 
                id="tpo_status_select"
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                value={formData.status}
                onChange={e => handleChange('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}

          {/* Notice Box */}
          <div className="bg-blue-50/60 p-4 border border-blue-100 rounded-2xl flex items-start gap-3 mt-4">
            <AlertCircle className="text-blue-600 shrink-0 mt-0.5 w-4 h-4" />
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Upon registration, TPO login credentials will be generated securely. A welcome notification containing their email username, temporary password, and system login portal address will be dispatched.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              id="cancel-tpo-modal-btn"
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="px-5 py-2.5 font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              id="save-tpo-modal-btn"
              type="submit" 
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{editingTpo ? 'Update TPO' : 'Save TPO'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
