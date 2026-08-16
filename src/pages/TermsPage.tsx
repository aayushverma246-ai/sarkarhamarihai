import { useNavigate } from 'react-router-dom';

export default function TermsPage() {
    const navigate = useNavigate();

    const handleBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };
    return (
        <div className="min-h-screen bg-[#080808] text-gray-200 p-8 md:p-16">
            <div className="max-w-3xl mx-auto bg-[#0e0e0e] border border-[#1a1a1a] rounded-xl p-8">
                <h1 className="text-3xl font-bold text-white mb-6">Terms of Service</h1>
                <p className="text-sm text-gray-500 mb-8">Last updated: {new Date().toLocaleDateString()}</p>
                
                <div className="space-y-6 text-gray-400">
                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">1. Agreement to Terms</h2>
                        <p>By accessing or using SarkarHamariHai, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">2. Service Description</h2>
                        <p>SarkarHamariHai provides a platform for discovering, tracking, and analyzing Indian government job vacancies, calculating eligibility, and generating study plans. The information provided is for educational and indicative purposes only.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">3. User Responsibilities</h2>
                        <p>You agree to verify all exam details, application deadlines, and eligibility criteria on the official government website of the respective recruiting authority before applying or making financial commitments. SarkarHamariHai is not responsible for any issues resulting from incorrect, changed, or missed exam details.</p>
                    </section>

                    <section>
                        <h2 className="text-xl font-semibold text-gray-200 mb-3">4. Intellectual Property</h2>
                        <p>All brand marks, design systems, layouts, and AI-generated outputs displayed on the platform are the property of SarkarHamariHai and protected by applicable copyright and trademark laws.</p>
                    </section>
                </div>

                <div className="mt-12 pt-6 border-t border-[#1a1a1a]">
                    <button 
                        type="button" 
                        onClick={handleBack} 
                        className="text-red-500 hover:text-red-400 font-medium bg-transparent border-none p-0 cursor-pointer outline-none"
                    >
                        ← Back
                    </button>
                </div>
            </div>
        </div>
    );
}
