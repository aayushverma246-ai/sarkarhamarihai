import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { getCachedUser } from './api';
import GovLoader from './components/GovLoader';
import { LanguageProvider } from './i18n/LanguageContext';

// ── Code-split all pages (each becomes its own JS chunk) ──
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const SignupPage = React.lazy(() => import('./pages/SignupPage'));
const AuthCallbackPage = React.lazy(() => import('./pages/AuthCallbackPage'));
const PrivacyPage = React.lazy(() => import('./pages/PrivacyPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const JobDetailsPage = React.lazy(() => import('./pages/JobDetailsPage'));
const TrackerPage = React.lazy(() => import('./pages/TrackerPage'));
const VerifierDashboard = React.lazy(() => import('./pages/VerifierDashboard'));

// Keep LandingPage only for web (lazy-loaded, never imported in mobile builds if unused)
const LandingPage = React.lazy(() => import('./pages/LandingPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  // Check for cached user — set by both Supabase auth and guest login flows
  const user = getCachedUser();
  if (!user) {
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

// Smart root redirect: if logged in → dashboard, else → landing page
function RootRedirect() {
  const user = getCachedUser();
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

export default function App() {
  return (
    <LanguageProvider>
      <Suspense fallback={<SuspenseFallback />}>
        <Routes>
          {/* "/" → login (mobile app) or dashboard (if logged in) — no landing page */}
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          {/* Keep landing page accessible via direct URL for web */}
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
          <Route path="/jobs/:id" element={<ProtectedRoute><JobDetailsPage /></ProtectedRoute>} />
          <Route path="/tracker" element={<ProtectedRoute><TrackerPage /></ProtectedRoute>} />
          <Route path="/verifier" element={<VerifierDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </LanguageProvider>
  );
}
