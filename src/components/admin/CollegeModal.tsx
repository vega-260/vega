import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  X, 
  Mail, 
  Phone, 
  Globe, 
  MapPin, 
  User, 
  GraduationCap, 
  Sparkles, 
  ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { isValidEmail, isValidPhone, isValidUrl, isValidCollegeCode, isValidText, isValidName, isValidLocation } from '../../utils/validators';

export interface CollegeFormData {
  id?: number;
  college_name: string;
  college_code: string;
  university: string;
  address: string;
  district: string;
  state: string;
  country: string;
  website: string;
  contact_number: string;
  official_email: string;
  principal_name: string;
  placement_head: string;
  college_logo?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface CollegeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message?: string) => void;
  editingCollege?: CollegeFormData | null;
}

const DEFAULT_FORM_DATA: CollegeFormData = {
  college_name: '',
  college_code: '',
  university: '',
  address: '',
  district: '',
  state: '',
  country: 'India',
  website: '',
  contact_number: '',
  official_email: '',
  principal_name: '',
  placement_head: '',
  college_logo: '',
  status: 'ACTIVE',
};

export const CollegeModal: React.FC<CollegeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingCollege,
}) => {
  const [formData, setFormData] = useState<CollegeFormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const emailInputRef = useRef<HTMLInputElement>(null);

  // Initialize or reset form when modal opens or editingCollege changes
  useEffect(() => {
    if (isOpen) {
      if (editingCollege) {
        setFormData({
          id: editingCollege.id,
          college_name: editingCollege.college_name || '',
          college_code: editingCollege.college_code || '',
          university: editingCollege.university || '',
          address: editingCollege.address || '',
          district: editingCollege.district || '',
          state: editingCollege.state || '',
          country: editingCollege.country || 'India',
          website: editingCollege.website || '',
          contact_number: editingCollege.contact_number || '',
          official_email: editingCollege.official_email || '',
          principal_name: editingCollege.principal_name || '',
          placement_head: editingCollege.placement_head || '',
          college_logo: editingCollege.college_logo || '',
          status: editingCollege.status || 'ACTIVE',
        });
      } else {
        setFormData(DEFAULT_FORM_DATA);
      }
      setErrors({});
      setTouched({});
      setShowSuggestions(false);
      setIsSubmitting(false);
    }
  }, [isOpen, editingCollege]);

  // Real-time Field Validator
  const validateField = (field: keyof CollegeFormData, value: string): string => {
    const val = (value || '').trim();

    switch (field) {
      case 'college_name':
        if (!val) return 'College or Institute name is required.';
        if (val.length < 2) return 'College name must be at least 2 characters.';
        if (!isValidText(val)) {
          return 'College name contains invalid special characters.';
        }
        return '';

      case 'college_code':
        if (!val) return 'Unique college code is required.';
        if (!isValidCollegeCode(val)) {
          return 'Code must be alphanumeric with dashes or underscores (e.g. WIT-SOLAPUR).';
        }
        return '';

      case 'university':
        if (val.length > 0 && !isValidText(val)) {
          return 'Affiliated University contains invalid special characters.';
        }
        return '';

      case 'district':
        if (val.length > 0 && !isValidLocation(val)) {
          return 'District contains invalid special characters.';
        }
        return '';

      case 'state':
        if (val.length > 0 && !isValidLocation(val)) {
          return 'State contains invalid special characters.';
        }
        return '';

      case 'country':
        if (val.length > 0 && !isValidLocation(val)) {
          return 'Country contains invalid special characters.';
        }
        return '';

      case 'principal_name':
        if (val.length > 0 && !isValidName(val)) {
          return 'Principal/Director name contains invalid special characters.';
        }
        return '';

      case 'placement_head':
        if (val.length > 0 && !isValidName(val)) {
          return 'TPO Head name contains invalid special characters.';
        }
        return '';

      case 'official_email':
        // If empty, it is allowed (optional field); if filled, it MUST be a valid email
        if (val.length > 0) {
          if (!isValidEmail(val)) {
            return 'Please enter a valid email address (e.g. info@college.edu).';
          }
        }
        return '';

      case 'contact_number':
        // If empty, allowed; if filled, must be 7-15 digits
        if (val.length > 0) {
          if (!isValidPhone(val)) {
            return 'Please enter a valid contact phone (7 to 15 digits).';
          }
        }
        return '';

      case 'website':
        // If empty, allowed; if filled, must be valid URL format
        if (val.length > 0) {
          if (!isValidUrl(val)) {
            return 'Please enter a valid website URL (e.g. https://college.edu).';
          }
        }
        return '';

      default:
        return '';
    }
  };

  // Handle Field Changes with immediate inline validation
  const handleChange = (field: keyof CollegeFormData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);

    // If field was already touched or user is editing, validate immediately
    const errorMsg = validateField(field, value);
    setErrors(prev => ({
      ...prev,
      [field]: errorMsg,
    }));
  };

  // Handle Field Blur (mark as touched and validate)
  const handleBlur = (field: keyof CollegeFormData) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, String(formData[field] ?? ''));
    setErrors(prev => ({
      ...prev,
      [field]: errorMsg,
    }));
  };

  // Autocomplete suggestions handler
  const handleCollegeNameChange = (val: string) => {
    handleChange('college_name', val);

    if (!val || val.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const suggestedNames: string[] = [];
    const lower = val.toLowerCase();
    if (lower.includes('wit') || lower.includes('walchand')) {
      suggestedNames.push('WIT (Walchand Institute of Technology), Solapur');
    }
    if (lower.includes('orchid')) {
      suggestedNames.push('Orchid College of Engineering & Technology, Solapur');
    }
    if (lower.includes('bmit')) {
      suggestedNames.push('BMIT (Brahmdevdada Mane Institute of Technology), Solapur');
    }
    if (lower.includes('coep')) {
      suggestedNames.push('COEP Technological University, Pune');
    }
    if (lower.includes('vit') || lower.includes('vellore')) {
      suggestedNames.push('VIT University, Vellore');
    }
    if (lower.includes('iit') || lower.includes('bombay')) {
      suggestedNames.push('IIT Bombay (Indian Institute of Technology)');
    }

    setSuggestions(suggestedNames);
    setShowSuggestions(suggestedNames.length > 0);
  };

  const selectCollegeSuggestion = (name: string) => {
    const upper = name.toUpperCase();
    let district = 'Mumbai';
    let state = 'Maharashtra';
    let university = 'University of Mumbai';
    let code = 'COL';

    if (upper.includes('WIT') || upper.includes('WALCHAND')) {
      district = 'Solapur';
      state = 'Maharashtra';
      university = 'Punyashlok Ahilyadevi Holkar Solapur University';
      code = 'WIT-SOLAPUR';
    } else if (upper.includes('ORCHID')) {
      district = 'Solapur';
      state = 'Maharashtra';
      university = 'Punyashlok Ahilyadevi Holkar Solapur University';
      code = 'ORCHID-SOL';
    } else if (upper.includes('BMIT')) {
      district = 'Solapur';
      state = 'Maharashtra';
      university = 'Punyashlok Ahilyadevi Holkar Solapur University';
      code = 'BMIT-SOL';
    } else if (upper.includes('COEP')) {
      district = 'Pune';
      state = 'Maharashtra';
      university = 'Savitribai Phule Pune University';
      code = 'COEP-PUNE';
    } else if (upper.includes('VIT') || upper.includes('VELLORE')) {
      district = 'Vellore';
      state = 'Tamil Nadu';
      university = 'VIT University';
      code = 'VIT-VELLORE';
    } else if (upper.includes('BOMBAY')) {
      district = 'Mumbai';
      state = 'Maharashtra';
      university = 'Autonomous / IIT Council';
      code = 'IIT-BOMBAY';
    }

    const updated = {
      ...formData,
      college_name: name,
      college_code: code,
      university,
      district,
      state,
      country: 'India',
    };

    setFormData(updated);
    setSuggestions([]);
    setShowSuggestions(false);

    // Clear any name or code errors
    setErrors(prev => ({
      ...prev,
      college_name: '',
      college_code: '',
    }));
  };

  // Validate entire form before submission
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    const fieldsToValidate: (keyof CollegeFormData)[] = [
      'college_name',
      'college_code',
      'university',
      'district',
      'state',
      'country',
      'principal_name',
      'placement_head',
      'official_email',
      'contact_number',
      'website',
    ];

    const allTouched: Record<string, boolean> = {};
    fieldsToValidate.forEach((field) => {
      allTouched[field] = true;
      const err = validateField(field, String(formData[field] || ''));
      if (err) newErrors[field] = err;
    });

    setErrors(newErrors);
    setTouched(allTouched);

    return Object.keys(newErrors).length === 0;
  };

  const isSubmittingRef = useRef(false);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || isSubmittingRef.current) return;

    if (!validateForm()) {
      if (errors.official_email || !isValidEmail(formData.official_email) && formData.official_email) {
        toast.error('Please fix the invalid email address before saving.');
        emailInputRef.current?.focus();
      } else {
        toast.error('Please review the form and correct the highlighted errors.');
      }
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);
    try {
      if (editingCollege && editingCollege.id) {
        const res = await api.put(`/admin/colleges/${editingCollege.id}`, formData);
        if (res.data.success) {
          onSuccess(res.data.message || 'College updated successfully');
          onClose();
        } else {
          toast.error(res.data.message || 'Failed to update college');
        }
      } else {
        const res = await api.post('/admin/colleges', formData);
        if (res.data.success) {
          onSuccess(res.data.message || 'College registered successfully');
          onClose();
        } else {
          toast.error(res.data.message || 'Failed to register college');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Error saving college details';
      toast.error(msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const hasEmailError = Boolean(errors.official_email && (touched.official_email || formData.official_email.length > 0));
  const isEmailValid = Boolean(!errors.official_email && formData.official_email.length > 0 && isValidEmail(formData.official_email));

  const hasPhoneError = Boolean(errors.contact_number && (touched.contact_number || formData.contact_number.length > 0));
  const hasWebError = Boolean(errors.website && (touched.website || formData.website.length > 0));
  const hasNameError = Boolean(errors.college_name && (touched.college_name || formData.college_name.length > 0));
  const hasCodeError = Boolean(errors.college_code && (touched.college_code || formData.college_code.length > 0));
  const hasUniversityError = Boolean(errors.university && (touched.university || formData.university.length > 0));
  const hasDistrictError = Boolean(errors.district && (touched.district || formData.district.length > 0));
  const hasStateError = Boolean(errors.state && (touched.state || formData.state.length > 0));
  const hasCountryError = Boolean(errors.country && (touched.country || formData.country.length > 0));
  const hasPrincipalError = Boolean(errors.principal_name && (touched.principal_name || formData.principal_name.length > 0));
  const hasPlacementHeadError = Boolean(errors.placement_head && (touched.placement_head || formData.placement_head.length > 0));

  return (
    <div id="college-modal-overlay" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        id="college-modal-card" 
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id="college-modal-title" className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                {editingCollege ? 'Update College Node' : 'Register New College'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {editingCollege ? 'Modify existing institution metadata' : 'Add an institutional partner to the campus network'}
              </p>
            </div>
          </div>
          <button 
            id="close-college-modal-btn"
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form 
          id="college-registration-form" 
          onSubmit={handleSubmit} 
          noValidate 
          className="p-5 sm:p-6 space-y-4 overflow-y-auto text-sm"
        >
          {/* College Name with Autocomplete */}
          <div className="space-y-1.5 relative">
            <div className="flex justify-between items-center">
              <label htmlFor="college_name_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                College / Institute Name <span className="text-rose-500">*</span>
              </label>
              {formData.college_name && !hasNameError && (
                <span className="text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Valid
                </span>
              )}
            </div>
            <input 
              id="college_name_input"
              type="text" 
              placeholder="e.g. Walchand Institute of Technology, Solapur" 
              className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                hasNameError 
                  ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                  : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
              }`}
              value={formData.college_name} 
              onChange={e => handleCollegeNameChange(e.target.value)} 
              onBlur={() => handleBlur('college_name')}
              autoComplete="off"
            />
            {hasNameError && (
              <p id="college_name_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {errors.college_name}
              </p>
            )}
            
            {/* Autocomplete parser suggestions */}
            {showSuggestions && suggestions.length > 0 && (
              <div id="college_suggestions_dropdown" className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden z-20 shadow-2xl max-h-48 overflow-y-auto">
                <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-blue-500" /> Quick Match Suggestions
                </div>
                {suggestions.map((name, i) => (
                  <div 
                    key={i} 
                    onClick={() => selectCollegeSuggestion(name)}
                    className="p-3 hover:bg-blue-50 cursor-pointer text-xs font-semibold text-slate-700 hover:text-blue-900 transition-colors border-b border-slate-100 last:border-0 flex items-center justify-between"
                  >
                    <span>{name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md">Auto-fill</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unique College Code & Affiliated University */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="college_code_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Unique College Code <span className="text-rose-500">*</span>
                </label>
              </div>
              <input 
                id="college_code_input"
                type="text" 
                placeholder="e.g. WIT-SOLAPUR" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 uppercase placeholder:text-slate-400 placeholder:normal-case transition-all focus:outline-none focus:ring-2 ${
                  hasCodeError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`}
                value={formData.college_code} 
                onChange={e => handleChange('college_code', e.target.value.toUpperCase())} 
                onBlur={() => handleBlur('college_code')}
              />
              {hasCodeError && (
                <p id="college_code_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.college_code}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="university_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                Affiliated University
              </label>
              <input 
                id="university_input"
                type="text" 
                placeholder="e.g. Solapur University" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasUniversityError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.university} 
                onChange={e => handleChange('university', e.target.value)} 
                onBlur={() => handleBlur('university')}
              />
              {hasUniversityError && (
                <p id="university_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.university}
                </p>
              )}
            </div>
          </div>

          {/* Regional Information: District, State, Country */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            <div className="space-y-1.5">
              <label htmlFor="district_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400" /> District
              </label>
              <input 
                id="district_input"
                type="text" 
                placeholder="e.g. Solapur" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasDistrictError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.district} 
                onChange={e => handleChange('district', e.target.value)} 
                onBlur={() => handleBlur('district')}
              />
              {hasDistrictError && (
                <p id="district_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.district}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="state_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">State</label>
              <input 
                id="state_input"
                type="text" 
                placeholder="e.g. Maharashtra" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasStateError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.state} 
                onChange={e => handleChange('state', e.target.value)} 
                onBlur={() => handleBlur('state')}
              />
              {hasStateError && (
                <p id="state_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.state}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="country_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Country</label>
              <input 
                id="country_input"
                type="text" 
                placeholder="e.g. India" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasCountryError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.country} 
                onChange={e => handleChange('country', e.target.value)} 
                onBlur={() => handleBlur('country')}
              />
              {hasCountryError && (
                <p id="country_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.country}
                </p>
              )}
            </div>
          </div>

          {/* Key Leadership: Principal & Placement Head */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="principal_name_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Principal / Director Name
              </label>
              <input 
                id="principal_name_input"
                type="text" 
                placeholder="Dr. Principal's Full Name" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasPrincipalError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.principal_name} 
                onChange={e => handleChange('principal_name', e.target.value)} 
                onBlur={() => handleBlur('principal_name')}
              />
              {hasPrincipalError && (
                <p id="principal_name_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.principal_name}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="placement_head_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400" />
                TPO Head Name
              </label>
              <input 
                id="placement_head_input"
                type="text" 
                placeholder="Training & Placement Head" 
                className={`w-full p-3 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                  hasPlacementHeadError 
                    ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20' 
                    : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                }`} 
                value={formData.placement_head} 
                onChange={e => handleChange('placement_head', e.target.value)} 
                onBlur={() => handleBlur('placement_head')}
              />
              {hasPlacementHeadError && (
                <p id="placement_head_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {errors.placement_head}
                </p>
              )}
            </div>
          </div>

          {/* Official Email Contact (BUG ID-003 FOCUS) & Primary Telephone */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* OFFICIAL EMAIL CONTACT WITH INSTANT INLINE VALIDATION */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="official_email_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Official Email Contact
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
                  id="official_email_input"
                  type="email" 
                  placeholder="e.g. info@college.edu" 
                  className={`w-full p-3 pr-10 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                    hasEmailError 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20' 
                      : isEmailValid
                        ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/10'
                        : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                  }`}
                  value={formData.official_email} 
                  onChange={e => handleChange('official_email', e.target.value)} 
                  onBlur={() => handleBlur('official_email')}
                  autoComplete="email"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {hasEmailError && <AlertCircle className="w-4 h-4 text-rose-500" />}
                  {isEmailValid && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
              </div>
              {hasEmailError && (
                <p id="official_email_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>{errors.official_email}</span>
                </p>
              )}
            </div>

            {/* PRIMARY TELEPHONE WITH INLINE VALIDATION */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="contact_number_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Primary Telephone
                </label>
              </div>
              <div className="relative">
                <input 
                  id="contact_number_input"
                  type="tel" 
                  placeholder="e.g. +91 9876543210" 
                  className={`w-full p-3 pr-10 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                    hasPhoneError 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20' 
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                  }`}
                  value={formData.contact_number} 
                  onChange={e => handleChange('contact_number', e.target.value)} 
                  onBlur={() => handleBlur('contact_number')}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {hasPhoneError && <AlertCircle className="w-4 h-4 text-rose-500" />}
                </div>
              </div>
              {hasPhoneError && (
                <p id="contact_number_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>{errors.contact_number}</span>
                </p>
              )}
            </div>
          </div>

          {/* Web Portal & Status Node */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="website_input" className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  Official Web Portal
                </label>
              </div>
              <div className="relative">
                <input 
                  id="website_input"
                  type="text" 
                  placeholder="e.g. https://witsolapur.org" 
                  className={`w-full p-3 pr-10 bg-slate-50 rounded-xl border text-slate-900 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 ${
                    hasWebError 
                      ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/20' 
                      : 'border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 focus:bg-white'
                  }`}
                  value={formData.website} 
                  onChange={e => handleChange('website', e.target.value)} 
                  onBlur={() => handleBlur('website')}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {hasWebError && <AlertCircle className="w-4 h-4 text-rose-500" />}
                </div>
              </div>
              {hasWebError && (
                <p id="website_error" role="alert" aria-live="polite" className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 mt-1.5 animate-in fade-in duration-100">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                  <span>{errors.website}</span>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label htmlFor="status_select" className="text-xs font-bold text-slate-700 uppercase tracking-wider">Status Node</label>
              <select 
                id="status_select"
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:bg-white"
                value={formData.status}
                onChange={e => handleChange('status', e.target.value as 'ACTIVE' | 'INACTIVE')}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button 
              id="cancel-college-modal-btn"
              type="button" 
              onClick={onClose} 
              disabled={isSubmitting}
              className="px-5 py-2.5 font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button 
              id="save-college-modal-btn"
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
                <span>{editingCollege ? 'Update College' : 'Save College'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
