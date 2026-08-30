import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { TPOSidebar } from './TPOSidebar';
import { PortalHeader } from '../PortalHeader';
import { useAuth } from '../../context/AuthContext';
import { useTPOUI, TPOUIProvider } from '../../context/TPOUIContext';

function TPOLayoutContent() {
  const { isSidebarCollapsed } = useTPOUI();

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans selection:bg-blue-100 selection:text-blue-600">
      {/* Sidebar - Fixed */}
      <TPOSidebar />

      {/* Main Content Area */}
      <div className={`flex-1 ${isSidebarCollapsed ? 'pl-20' : 'pl-64'} transition-all duration-300 flex flex-col min-h-screen`}>
        <PortalHeader portalType="TPO" searchPlaceholder="Search students, assessments, drives..." />
        {/* Content */}
        <main className="flex-1 p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function TPOLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user || user.role !== 'TPO') {
    return <Navigate to="/login" replace />;
  }

  return (
    <TPOUIProvider>
      <TPOLayoutContent />
    </TPOUIProvider>
  );
}
