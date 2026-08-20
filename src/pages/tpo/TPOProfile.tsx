import React, { useEffect, useState } from 'react';
import { 
  User, 
  UserCheck, 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Briefcase, 
  GraduationCap, 
  Linkedin, 
  Globe, 
  Lock, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  RotateCcw, 
  Copy, 
  ExternalLink, 
  Camera, 
  Info, 
  Sparkles, 
  Calendar, 
  Users, 
  Award,
  Layers,
  FileText
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

interface TPOProfileData {
  id?: number;
  user_id?: number;
  full_name: string;
  contact_number: string;
  alternate_contact: string;
  designation: string;
  department: string;
  office_location: string;
  office_hours: string;
  bio: string;
  linkedin_url: string;
  profile_photo_url: string;
  secondary_email: string;
  experience_years: string;
  qualification: string;
  employee_id: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

interface UserAccountData {
  id: number;
  email: string;
  role: string;
  status: string;
  is_verified: number;
  created_at: string;
}

interface CollegeData {
  id: number;
  college_name: string;
  college_code: string;
  university: string;
  address: string;
  district: string;
  state: string;
  country: string;
  website: string;
  official_email: string;
  contact_number: string;
  principal_name: string;
  placement_head: string;
  status: string;
}

interface StatsData {
  totalStudents: number;
  placedStudents: number;
  activeDrives: number;
  assignedBatches: number;
  createdTests: number;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&auto=format&fit=crop&q=80',
];

export default function TPOProfile() {
  const { user: authUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'office' | 'college' | 'stats'>('personal');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Initial & Form states
  const [initialData, setInitialData] = useState<TPOProfileData | null>(null);
  const [formData, setFormData] = useState<TPOProfileData>({
    full_name: '',
    contact_number: '',
    alternate_contact: '',
    designation: 'Training & Placement Officer',
    department: 'Training & Placement Cell',
    office_location: '',
    office_hours: 'Monday - Friday, 9:00 AM - 5:30 PM',
    bio: '',
    linkedin_url: '',
    profile_photo_url: '',
    secondary_email: '',
    experience_years: '',
    qualification: '',
    employee_id: '',
    status: 'ACTIVE',
  });

  const [userAccount, setUserAccount] = useState<UserAccountData | null>(null);
  const [colleges, setColleges] = useState<CollegeData[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalStudents: 0,
    placedStudents: 0,
    activeDrives: 0,
    assignedBatches: 0,
    createdTests: 0,
  });

  useEffect(() => {
    fetchTPOProfile();
  }, []);

  const fetchTPOProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/tpo/profile');
      if (res.data?.success && res.data?.data) {
        const { user, profile, colleges: colList, stats: statsData } = res.data.data;
        
        setUserAccount(user);
        setColleges(colList || []);
        if (statsData) setStats(statsData);

        const loadedProfile: TPOProfileData = {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name || '',
          contact_number: profile.contact_number || '',
          alternate_contact: profile.alternate_contact || '',
          designation: profile.designation || 'Training & Placement Officer',
          department: profile.department || 'Training & Placement Cell',
          office_location: profile.office_location || '',
          office_hours: profile.office_hours || 'Monday - Friday, 9:00 AM - 5:30 PM',
          bio: profile.bio || '',
          linkedin_url: profile.linkedin_url || '',
          profile_photo_url: profile.profile_photo_url || '',
          secondary_email: profile.secondary_email || '',
          experience_years: profile.experience_years || '',
          qualification: profile.qualification || '',
          employee_id: profile.employee_id || `TPO-${new Date().getFullYear()}-${profile.id || '101'}`,
          status: profile.status || 'ACTIVE',
          created_at: profile.created_at,
          updated_at: profile.updated_at,
        };

        setInitialData(loadedProfile);
        setFormData(loadedProfile);
        setCustomAvatarUrl(loadedProfile.profile_photo_url);
        setHasUnsavedChanges(false);
      }
    } catch (err: any) {
      console.error('Error loading TPO profile:', err);
      toast.error('Failed to load TPO profile details');
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof TPOProfileData, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (initialData) {
        const isChanged = JSON.stringify(updated) !== JSON.stringify(initialData);
        setHasUnsavedChanges(isChanged);
      }
      return updated;
    });
  };

  const handleReset = () => {
    if (initialData) {
      setFormData(initialData);
      setCustomAvatarUrl(initialData.profile_photo_url);
      setHasUnsavedChanges(false);
      toast.success('Form changes reset to saved state');
    }
  };

  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!formData.full_name.trim()) {
      toast.error('Full Name is required');
      setActiveTab('personal');
      return;
    }

    if (formData.secondary_email && formData.secondary_email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.secondary_email.trim())) {
        toast.error('Please enter a valid secondary email address');
        setActiveTab('personal');
        return;
      }
    }

    setSaving(true);
    try {
      const res = await api.put('/tpo/profile', {
        full_name: formData.full_name,
        contact_number: formData.contact_number,
        alternate_contact: formData.alternate_contact,
        designation: formData.designation,
        department: formData.department,
        office_location: formData.office_location,
        office_hours: formData.office_hours,
        bio: formData.bio,
        linkedin_url: formData.linkedin_url,
        profile_photo_url: formData.profile_photo_url,
        secondary_email: formData.secondary_email,
        experience_years: formData.experience_years,
        qualification: formData.qualification,
      });

      if (res.data?.success) {
        toast.success(res.data.message || 'Profile updated successfully');
        const updated = {
          ...formData,
          ...res.data.data,
        };
        setInitialData(updated);
        setFormData(updated);
        setHasUnsavedChanges(false);
      } else {
        toast.error(res.data?.message || 'Failed to update profile');
      }
    } catch (err: any) {
      console.error('Save error:', err);
      toast.error(err.response?.data?.message || 'Error updating TPO profile');
    } finally {
      setSaving(false);
    }
  };

  const primaryCollege = colleges[0] || null;

  if (loading) {
    return (
      <div id="tpo-profile-loading" className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm font-semibold text-slate-600">Loading TPO Profile details...</p>
      </div>
    );
  }

  return (
    <div id="tpo-profile-page" className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header Card */}
      <div 
        id="tpo-profile-header-card" 
        className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
      >
        {/* Banner Top Accent */}
        <div className="h-32 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 relative">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1.5 backdrop-blur-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Verified Institutional Officer
            </span>
          </div>
        </div>

        {/* Profile Avatar & Primary Info */}
        <div className="px-8 pb-6 pt-0 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 -mt-16 mb-6">
            <div className="flex items-end gap-5">
              {/* Avatar Box with Change trigger */}
              <div className="relative group">
                <div className="w-28 h-28 rounded-2xl bg-white p-1 shadow-md border border-slate-200 overflow-hidden">
                  {formData.profile_photo_url ? (
                    <img 
                      src={formData.profile_photo_url} 
                      alt={formData.full_name}
                      className="w-full h-full object-cover rounded-xl"
                      referrerPolicy="no-referrer"
                      onError={() => handleFieldChange('profile_photo_url', '')}
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold text-3xl">
                      {formData.full_name ? formData.full_name.charAt(0).toUpperCase() : 'T'}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setShowAvatarModal(true)}
                  className="absolute bottom-1 right-1 p-2 bg-slate-900 text-white rounded-xl shadow-md hover:bg-blue-600 transition-colors"
                  title="Update Profile Photo"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Title & Organization Info */}
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                    {formData.full_name || 'Placement Officer'}
                  </h1>
                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-semibold">
                    {formData.designation || 'TPO'}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-600 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                  {primaryCollege ? primaryCollege.college_name : 'Training & Placement Ecosystem'}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-2">
                  <span>ID: <strong className="font-mono text-slate-700">{formData.employee_id}</strong></span>
                  <span>•</span>
                  <span>Role: <strong className="text-slate-700">{userAccount?.role || 'TPO'}</strong></span>
                </p>
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <button
                  type="button"
                  id="reset-profile-btn"
                  onClick={handleReset}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>
              )}
              <button
                type="button"
                id="save-profile-btn"
                onClick={() => handleSave()}
                disabled={saving || !hasUnsavedChanges}
                className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                  hasUnsavedChanges
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">Monitored Students</p>
              <p className="text-xl font-bold text-slate-900 mt-0.5">{stats.totalStudents}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">Placed Candidates</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{stats.placedStudents}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">Active Campus Drives</p>
              <p className="text-xl font-bold text-blue-600 mt-0.5">{stats.activeDrives}</p>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <p className="text-xs font-semibold text-slate-500">Created Assessments</p>
              <p className="text-xl font-bold text-purple-600 mt-0.5">{stats.createdTests}</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-8 flex border-t border-slate-200 bg-slate-50/50 gap-2 overflow-x-auto">
          <button
            type="button"
            id="tab-personal-info"
            onClick={() => setActiveTab('personal')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'personal'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <User className="w-4 h-4" />
            Personal & Official Info
          </button>
          <button
            type="button"
            id="tab-office-availability"
            onClick={() => setActiveTab('office')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'office'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            Office & Availability
          </button>
          <button
            type="button"
            id="tab-institutional-record"
            onClick={() => setActiveTab('college')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'college'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-4 h-4" />
            Institutional Master Record
          </button>
          <button
            type="button"
            id="tab-placement-stats"
            onClick={() => setActiveTab('stats')}
            className={`py-3.5 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'stats'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Award className="w-4 h-4" />
            Placement Authority & Security
          </button>
        </div>
      </div>

      {/* Unsaved Changes Banner */}
      {hasUnsavedChanges && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-900 shadow-sm animate-fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm font-medium">
              You have unsaved changes in your profile. Be sure to save before navigating away.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 rounded-lg transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors shadow-sm"
            >
              {saving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT 1: PERSONAL & OFFICIAL INFO */}
      {activeTab === 'personal' && (
        <div className="space-y-6">
          {/* Section 1: Editable Fields */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  Editable Officer Details
                </h2>
                <p className="text-xs text-slate-500">
                  Update your contact details, designation, and professional placement information.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-md flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Editable
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="tpo-full-name-input"
                    value={formData.full_name}
                    onChange={(e) => handleFieldChange('full_name', e.target.value)}
                    placeholder="e.g. Dr. Rajesh Sharma"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Official Designation */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Official Designation / Title
                </label>
                <input
                  type="text"
                  id="tpo-designation-input"
                  value={formData.designation}
                  onChange={(e) => handleFieldChange('designation', e.target.value)}
                  placeholder="e.g. Head - Training & Placement"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* Primary Contact Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Primary Phone / Mobile
                </label>
                <input
                  type="tel"
                  id="tpo-contact-input"
                  value={formData.contact_number}
                  onChange={(e) => handleFieldChange('contact_number', e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* Alternate Contact Number */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  Alternate Phone / Office Ext.
                </label>
                <input
                  type="tel"
                  id="tpo-alt-contact-input"
                  value={formData.alternate_contact}
                  onChange={(e) => handleFieldChange('alternate_contact', e.target.value)}
                  placeholder="e.g. +91 98765 43211 / Ext 402"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* Secondary Email */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Secondary / Direct Placement Email
                </label>
                <input
                  type="email"
                  id="tpo-sec-email-input"
                  value={formData.secondary_email}
                  onChange={(e) => handleFieldChange('secondary_email', e.target.value)}
                  placeholder="e.g. placement.cell@college.edu"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400">Optional direct communication email for recruiters.</p>
              </div>

              {/* Highest Qualification */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                  Highest Academic Qualification
                </label>
                <input
                  type="text"
                  id="tpo-qualification-input"
                  value={formData.qualification}
                  onChange={(e) => handleFieldChange('qualification', e.target.value)}
                  placeholder="e.g. Ph.D (CSE), MBA (HR Management)"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* Placement Experience */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  Years of Placement Experience
                </label>
                <input
                  type="text"
                  id="tpo-experience-input"
                  value={formData.experience_years}
                  onChange={(e) => handleFieldChange('experience_years', e.target.value)}
                  placeholder="e.g. 8+ Years"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                />
              </div>

              {/* LinkedIn URL */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Linkedin className="w-3.5 h-3.5 text-slate-400" />
                  LinkedIn Profile URL
                </label>
                <div className="flex">
                  <input
                    type="url"
                    id="tpo-linkedin-input"
                    value={formData.linkedin_url}
                    onChange={(e) => handleFieldChange('linkedin_url', e.target.value)}
                    placeholder="https://linkedin.com/in/username"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-l-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
                  />
                  {formData.linkedin_url && (
                    <a
                      href={formData.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 border border-l-0 border-slate-200 rounded-r-xl flex items-center text-slate-600 transition-colors"
                      title="Open Link"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Executive Bio / Placement Message */}
            <div className="space-y-1.5 pt-2">
              <label className="block text-xs font-semibold text-slate-700">
                Placement Cell Executive Bio & Message to Recruiters
              </label>
              <textarea
                id="tpo-bio-input"
                rows={4}
                value={formData.bio}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                placeholder="Share a brief introduction about your role, industry partnerships, campus placement achievements, and vision for student career growth..."
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all resize-y"
              />
            </div>
          </div>

          {/* Section 2: Non-Editable / Locked Fields */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-slate-400" />
                  System & Authentication Details (Non-Editable)
                </h2>
                <p className="text-xs text-slate-500">
                  These security fields are locked by institutional access controls and role-based permissions.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Read-Only
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Login Email */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Primary Login Email (Auth Identity)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyText(userAccount?.email || '', 'Login Email')}
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 cursor-not-allowed">
                  <span className="text-sm font-mono font-medium flex-1 truncate">
                    {userAccount?.email || 'N/A'}
                  </span>
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  Official login credentials can only be changed via Admin management.
                </p>
              </div>

              {/* System Security Role */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  Security Role & Access Tier
                </label>
                <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 cursor-not-allowed">
                  <span className="text-sm font-medium flex-1">
                    {userAccount?.role || 'TPO'} (Institutional Placement Head)
                  </span>
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Info className="w-3 h-3 text-slate-400" />
                  Controlled by TalentBridge Role-Based Access Control (RBAC).
                </p>
              </div>

              {/* System Officer ID */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-600">
                    System Officer ID (UID)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopyText(formData.employee_id, 'Officer ID')}
                    className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
                <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 cursor-not-allowed">
                  <span className="text-sm font-mono font-medium flex-1">
                    {formData.employee_id}
                  </span>
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Account Induction Date */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  Account Registration Timestamp
                </label>
                <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-600 cursor-not-allowed">
                  <span className="text-sm font-medium flex-1">
                    {userAccount?.created_at ? new Date(userAccount.created_at).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'System Genesis'}
                  </span>
                  <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: OFFICE & CAMPUS AVAILABILITY */}
      {activeTab === 'office' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                Campus Placement Office & Availability
              </h2>
              <p className="text-xs text-slate-500">
                Specify your physical cabin location and student consultation hours on campus.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-md flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Editable
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Department */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Department / Cell Name
              </label>
              <input
                type="text"
                id="tpo-department-input"
                value={formData.department}
                onChange={(e) => handleFieldChange('department', e.target.value)}
                placeholder="e.g. Training & Placement Cell, Career Guidance Bureau"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              />
            </div>

            {/* Office / Cabin Location */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Campus Cabin / Office Location
              </label>
              <input
                type="text"
                id="tpo-office-loc-input"
                value={formData.office_location}
                onChange={(e) => handleFieldChange('office_location', e.target.value)}
                placeholder="e.g. Academic Block A, 2nd Floor, Room 204"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              />
            </div>

            {/* Office Hours */}
            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Student Consultation & Office Working Hours
              </label>
              <input
                type="text"
                id="tpo-office-hours-input"
                value={formData.office_hours}
                onChange={(e) => handleFieldChange('office_hours', e.target.value)}
                placeholder="e.g. Monday - Friday, 9:00 AM - 5:30 PM (Walk-in Consultations 3 PM - 5 PM)"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              />
              <p className="text-[11px] text-slate-400">
                These hours are displayed on the student placement noticeboard and event guidelines.
              </p>
            </div>
          </div>

          {/* Quick Notice to Campus Visitors */}
          <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-blue-900">
              <p className="font-semibold">Recruiter & Student Engagement Protocol</p>
              <p className="text-blue-800/90 leading-relaxed">
                Visiting company executives and HR panels report directly to the Placement Cell conference lounge located at your specified cabin address. Keep this location and working hours accurate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: INSTITUTIONAL MASTER RECORD */}
      {activeTab === 'college' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Institutional Affiliation Record (Non-Editable)
              </h2>
              <p className="text-xs text-slate-500">
                Official institutional master details assigned to your officer account by University Administration.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold rounded-md flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Institutional Master Record
            </span>
          </div>

          {primaryCollege ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* College Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    College / Institute Name
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-semibold flex-1 truncate">
                      {primaryCollege.college_name}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* College Code */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-600">
                      College Code / AISHE Code
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCopyText(primaryCollege.college_code, 'College Code')}
                      className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" />
                      Copy
                    </button>
                  </div>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-mono font-medium flex-1">
                      {primaryCollege.college_code}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* Affiliated University */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Affiliated University / Board
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-medium flex-1">
                      {primaryCollege.university || 'State Technical University'}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* Campus Principal */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    Principal / Institutional Director
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-medium flex-1">
                      {primaryCollege.principal_name || 'Dr. Academic Director'}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* Campus Address & Geography */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Campus Address & City
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-medium flex-1 truncate">
                      {primaryCollege.address ? `${primaryCollege.address}, ${primaryCollege.district || ''}` : 'Main Campus Location'}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* State & Country */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600">
                    State & Country
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-medium flex-1">
                      {primaryCollege.state ? `${primaryCollege.state}, ${primaryCollege.country || 'India'}` : 'Maharashtra, India'}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>

                {/* Official College Website */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-slate-400" />
                    Official College Website
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-medium flex-1 truncate">
                      {primaryCollege.website || 'https://institution.edu.in'}
                    </span>
                    {primaryCollege.website && (
                      <a
                        href={primaryCollege.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="Visit Website"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Official Campus Email */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    Official Institutional Email
                  </label>
                  <div className="flex items-center bg-slate-100/80 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-700 cursor-not-allowed">
                    <span className="text-sm font-mono font-medium flex-1 truncate">
                      {primaryCollege.official_email || 'info@institution.edu.in'}
                    </span>
                    <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* System Note */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-start gap-3">
                <Info className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Institutional changes (such as college affiliation codes, university accreditation, or campus address) are synchronized from the state higher education registry. If any college details are outdated, please raise an inquiry with the System Administrator.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 text-sm">
              <Building2 className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              No specific college master record linked directly to this account yet. System default parameters are in effect.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 4: PLACEMENT AUTHORITY & SECURITY */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          {/* Security & Access Overview */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Placement Authority & Security Clearance
                </h2>
                <p className="text-xs text-slate-500">
                  Cryptographic verification status and institutional placement permissions.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                ACTIVE & COMPLIANT
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Officer Verification</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-base font-bold text-slate-900">Verified Placement Head</p>
                <p className="text-[11px] text-slate-500">Compliant with State TPO guidelines</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Assessment Engine</span>
                  <Award className="w-4 h-4 text-purple-600" />
                </div>
                <p className="text-base font-bold text-slate-900">Full Proctoring Rights</p>
                <p className="text-[11px] text-slate-500">Authorized to create & conduct tests</p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Campus Drives</span>
                  <Calendar className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-base font-bold text-slate-900">Corporate Drive Host</p>
                <p className="text-[11px] text-slate-500">Authorized to invite recruitment partners</p>
              </div>
            </div>

            {/* Scope Summary Box */}
            <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/70 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-700" />
                Assigned Jurisdiction & Student Scope
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div>
                  <p className="text-xs text-slate-500">Total Enrolled</p>
                  <p className="text-lg font-bold text-slate-800">{stats.totalStudents} Candidates</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Placed</p>
                  <p className="text-lg font-bold text-emerald-600">{stats.placedStudents} Offers</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assigned Batches</p>
                  <p className="text-lg font-bold text-slate-800">{stats.assignedBatches} Active</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Drives Conducted</p>
                  <p className="text-lg font-bold text-blue-600">{stats.activeDrives} Drives</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Avatar Picker Modal */}
      {showAvatarModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Camera className="w-4 h-4 text-blue-600" />
                Select Profile Avatar
              </h3>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {/* Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">Choose from Academic Presets</label>
              <div className="grid grid-cols-3 gap-3">
                {PRESET_AVATARS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleFieldChange('profile_photo_url', url);
                      setCustomAvatarUrl(url);
                      setShowAvatarModal(false);
                      toast.success('Avatar selected. Click Save to persist.');
                    }}
                    className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all group ${
                      formData.profile_photo_url === url ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200 hover:border-blue-400'
                    }`}
                  >
                    <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>

            {/* Custom URL */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-slate-700">Or Paste Image URL</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customAvatarUrl) {
                      handleFieldChange('profile_photo_url', customAvatarUrl);
                      setShowAvatarModal(false);
                      toast.success('Custom avatar URL applied. Click Save to persist.');
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Close */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
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
