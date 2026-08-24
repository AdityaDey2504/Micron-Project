import React from 'react';
import { Navigate, Outlet } from 'react-router';
import { useApp } from '../context/AppContext';

export const AdminGuard: React.FC = () => {
  const { user, token } = useApp();

  // Redirect to login if unauthenticated or if user is not an admin
  if (!token || !user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};