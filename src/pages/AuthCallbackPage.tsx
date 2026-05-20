import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { api, setToken, setCachedUser } from '../api';
import GovLoader from '../components/GovLoader';

export default function AuthCallbackPage() {
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function handleAuthCallback() {
            try {
                // Supabase automatically parses the URL fragment and sets the session
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                if (sessionError) throw sessionError;
                if (!session) throw new Error('No session found. Please try logging in again.');

                // Send the Supabase access token to our backend to exchange for our native JWT
                const { token, user } = await api.loginWithGoogle(session.access_token);
                
                if (mounted) {
                    setToken(token);
                    setCachedUser(user);
                    navigate('/dashboard', { replace: true });
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

    return (
        <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
            {error ? (
                <div className="p-4 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm max-w-sm text-center">
                    {error}
                </div>
            ) : (
                <GovLoader message="Completing Google Authentication..." />
            )}
        </div>
    );
}
