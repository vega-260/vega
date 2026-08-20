import React from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuth } from '../../context/AuthContext';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
    return <Navigate to="/login" replace />;
  }

  // Path authorization check for non-SUPER_ADMIN staff/admin officers
  if (user.role !== 'SUPER_ADMIN' && user.sidebarPermissions && Array.isArray(user.sidebarPermissions)) {
    const currentPath = location.pathname;
    // The base dashboard "/admin" is always authorized
    if (currentPath !== '/admin' && currentPath !== '/admin/') {
      const isAllowed = user.sidebarPermissions.some((allowedPath: string) => 
        currentPath.startsWith(allowedPath)
      );
      if (!isAllowed) {
        return <Navigate to="/admin" replace />;
      }
    }
  }

  return (
    <div className="flex bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <AdminSidebar />
      <main className="flex-1 ml-64 min-w-0 max-w-[calc(100vw-16rem)] p-6 md:p-8 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
