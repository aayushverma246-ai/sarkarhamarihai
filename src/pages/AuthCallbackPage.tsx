import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { api, setCachedUser } from '../api';
import GovLoader from '../components/GovLoader';

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const [error, setError] = useState('');
    const [isMobileRedirect, setIsMobileRedirect] = useState(false);
    const [appUrl, setAppUrl] = useState('');

    useEffect(() => {
        let mounted = true;

        async function handleAuthCallback() {
            const hash = window.location.hash;
            const search = window.location.search;

            const hasTokens = (hash && hash.includes('access_token')) || (search && search.includes('access_token'));
            const isMobilePlatform = window.location.href.includes('platform=mobile');

            if (isMobilePlatform && hasTokens) {
                const tokenPart = hash || search;
                const deepLinkUrl = 'com.sarkarhamarihai.app://auth/callback' + tokenPart;

                if (mounted) {
                    setIsMobileRedirect(true);
                    setAppUrl(deepLinkUrl);
                    setError('Redirecting to the SarkarHamariHai App...');
                }

                // 1. Direct location change
                window.location.href = deepLinkUrl;

                // 2. Fallback: replace location after a small tick
                setTimeout(() => {
                    window.location.replace(deepLinkUrl);
                }, 50);

                // 3. Fallback: hidden iframe injection (classic robust scheme launch)
                try {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = deepLinkUrl;
                    document.body.appendChild(iframe);
                    setTimeout(() => {
                        if (document.body.contains(iframe)) {
                            document.body.removeChild(iframe);
                        }
                    }, 1000);
                } catch (e) {
                    console.error('Redirection iframe error:', e);
                }

                return;
            }

            try {
                // Supabase automatically parses the URL fragment and sets the session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) throw sessionError;
                if (!session) throw new Error('No session found. Please try logging in again.');

                const isRecovery = (hash && hash.includes('type=recovery')) || (search && search.includes('type=recovery'));
                if (isRecovery) {
                    if (mounted) {
                        navigate('/reset-password', { replace: true });
                    }
                    return;
                }

                // Check if there's pending profile data from signup
                let pendingProfile = null;
                try {
                    const raw = localStorage.getItem('sarkar_pending_profile');
                    if (raw) pendingProfile = JSON.parse(raw);
                } catch { /* ignore */ }

                let user;
                if (pendingProfile && pendingProfile.full_name) {
                    // Use the saved profile data from signup form
                    const result = await api.setupProfile(pendingProfile);
                    user = result.user;
                    localStorage.removeItem('sarkar_pending_profile');
                } else {
                    // No pending profile — just ensure a profile row exists
                    const result = await api.ensureProfile();
                    user = result.user;
                }
                
                if (mounted) {
                    setCachedUser(user);
                    if (user && user.age === 0 && !user.email?.startsWith('guest@')) {
                        navigate('/profile-setup', { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                }
            } catch (err: any) {
                console.error('Auth callback error:', err);
                if (mounted) {
                    setError(err.message || 'Authentication failed. Redirecting to login...');
                    setTimeout(() => navigate('/login', { replace: true }), 3000);
                }
            }
        }

        handleAuthCallback();

        return () => { mounted = false; };
    }, [navigate]);

    if (isMobileRedirect) {
        return (
            <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
                <div className="bg-[#0c0c0c] border border-white/10 p-8 rounded-3xl max-w-sm w-full text-center shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-red-500 to-transparent" />
                    <div className="w-16 h-16 bg-red-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8 text-red-500 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2">Back to SarkarHamariHai</h2>
                    <p className="text-gray-400 text-xs mb-6 leading-relaxed">
                        We are opening the native mobile application to complete your secure sign-in.
                    </p>
                    <a
                        href={appUrl}
                        className="block w-full py-3.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg active:scale-95 uppercase tracking-wider"
                    >
                        Launch App Manually
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
            {error ? (
                <div className="p-4 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm max-w-sm text-center">
                    {error}
                </div>
            ) : (
                <GovLoader message="Completing Authentication..." />
            )}
        </div>
    );
}
