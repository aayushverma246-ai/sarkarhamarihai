import { Link } from 'react-router-dom';

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#080808] text-gray-200 p-8 md:p-16">
            <div className="max-w-3xl mx-auto bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-8">
                <h1 className="text-3xl font-bold text-white mb-6">Privacy Policy</h1>
                <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
                
                <div className="space-y-6 text-gray-400">
                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">1. Information We Collect</h2>
                        <p>We collect basic profile information when you register, including your email address, name, and educational details, to provide personalized exam recommendations. If you choose to log in with Google, we securely receive your email and basic profile information from Google.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">2. How We Use Your Information</h2>
                        <p>We use your information exclusively to track government exam applications, send timely notifications regarding exam deadlines, and improve the AI recommendation engine. We do not sell your personal data to third parties.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">3. Data Security</h2>
                        <p>We implement industry-standard security measures, including Supabase authentication and encrypted PostgreSQL databases, to protect your personal information against unauthorized access or disclosure.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">4. Third-Party Services</h2>
                        <p>We use third-party services like Google OAuth for secure login. These services have their own privacy policies governing the data they collect during the authentication process.</p>
                    </section>
                </div>

                <div className="mt-12 pt-6 border-t border-[#1a1a1a]">
                    <Link to="/" className="text-red-500 hover:text-red-400 font-medium">← Back to Home</Link>
                </div>
            </div>
        </div>
    );
}
