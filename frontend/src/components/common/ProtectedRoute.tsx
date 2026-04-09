import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const ProtectedRoute = () => {
  const { user, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If we are not loading and there isn't a logged in user, redirect them to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // We have a user! Render out the nested routes.
  return <Outlet />;
};

export default ProtectedRoute;
