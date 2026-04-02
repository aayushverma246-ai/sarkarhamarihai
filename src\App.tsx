import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getToken, getCachedUser } from './api';
import GovLoader from './components/GovLoader';
import { LanguageProvider } from './i18n/LanguageContext';

// ── Code-split all pages (each becomes its own JS chunk) ──
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const LandingPage = React.lazy(() => import('./pages/LandingPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const JobDetailsPage = React.lazy(() => import('./pages/JobDetailsPage'));
const TrackerPage = React.lazy(() => import('./pages/TrackerPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = getToken();
  const user = getCachedUser();
  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Minimal suspense fallback — theme-aware, prevents blank flash
function SuspenseFallback() {
  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light-mode');
  return (
    <div className={`min-h-screen flex items-center justify-center transition-colors duration-200 ${isLight ? 'bg-[#f1f5f9]' : 'bg-[#080808]'}`}>
      <GovLoader message="Loading..." />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailsPage /></ProtectedRoute>} />
          <Route path="/tracker" element={<ProtectedRoute><TrackerPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
