import React, { Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { getCachedUser } from './api';
import { supabase } from './utils/supabase';
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

// ── Global auth listener: detects email confirmation redirects ──
// When Supabase email confirmation link redirects here with tokens in
// the URL hash, this listener picks up the SIGNED_IN event and
// navigates to /auth/callback to complete profile setup.
function AuthListener() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Only handle auth events on non-callback pages
      // (AuthCallbackPage handles its own flow)
      if (location.pathname === '/auth/callback') return;

      if (event === 'SIGNED_IN' && session) {
        // Check if this is from an email confirmation (URL has auth tokens)
        const hash = window.location.hash;
        if (hash && (hash.includes('access_token') || hash.includes('type=signup') || hash.includes('type=recovery'))) {
          // Email confirmation redirect — navigate to callback to complete setup
          navigate('/auth/callback', { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  return null;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthListener />
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
