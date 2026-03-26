import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import Logo from '../assets/logo';

// Optimized Animation variants using transform-gpu
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#080808] text-gray-900 dark:text-gray-100 font-sans selection:bg-red-500/30 selection:text-red-900 dark:selection:text-red-200 overflow-hidden">
            
            {/* ── HEADER ── */}
            <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-[#0c0c0c]/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-[#1a1a1a]/50 supports-[backdrop-filter]:bg-white/60">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <Logo className="w-8 h-8 text-red-600 dark:text-red-500 group-hover:rotate-12 transition-transform duration-300" />
                        <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                            SarkarHamariHai
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/login')}
                            className="text-sm font-bold text-gray-700 dark:text-gray-200 bg-gray-100 hover:bg-gray-200 dark:bg-[#1a1a1a] dark:hover:bg-[#252525] px-5 py-2 rounded-full transition-all border border-transparent dark:border-[#333]"
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-full text-sm font-bold transition-all hover:shadow-lg hover:shadow-red-600/20 active:scale-95"
                        >
                            Get Started
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1">
                {/* ── HERO SECTION ── */}
                <section className="relative px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden flex flex-col items-center justify-center text-center isolate">
                    {/* Background Ambient Glows */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-gradient-to-b from-red-500/10 via-orange-500/5 to-transparent dark:from-red-600/15 dark:via-red-900/5 blur-[100px] rounded-full -z-10" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-red-400/5 dark:bg-amber-500/5 blur-[120px] rounded-full -z-10" />

                    <motion.div 
                        className="relative z-10 max-w-5xl mx-auto space-y-8 gpu-accelerated"
                        initial="hidden" animate="visible" variants={staggerContainer}
                    >


                        <motion.h1 
                            variants={fadeUp}
                            className="text-5xl sm:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight text-gray-900 dark:text-white leading-[1.05]"
                        >
                            Find all eligible <br className="hidden sm:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-amber-500 dark:from-red-500 dark:to-orange-400">
                                government exams
                            </span> <br className="hidden sm:block" />
                            in one place.
                        </motion.h1>

                        <motion.p 
                            variants={fadeUp}
                            className="text-lg sm:text-2xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed font-medium"
                        >
                            Stop manually checking notifications. Let AI map your profile to exactly the exams you're qualified for, with automated trackers and syllabus-overlap recommendations.
                        </motion.p>

                        <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6">
                            <button
                                onClick={() => navigate('/signup')}
                                className="w-full sm:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-bold text-lg transition-all hover:shadow-2xl hover:shadow-red-500/10 dark:hover:shadow-white/10 hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-2"
                            >
                                Start Preparing Free
                                <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto px-8 py-4 bg-white dark:bg-[#111] border border-gray-200 dark:border-[#222] hover:border-gray-300 dark:hover:border-[#333] text-gray-800 dark:text-gray-300 rounded-2xl font-bold text-lg transition-all hover:shadow-md hover:-translate-y-1"
                            >
                                Log In to Dashboard
                            </button>
                        </motion.div>
                    </motion.div>

                    {/* App Preview Mockup Element */}
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.8, duration: 1, ease: 'easeOut' }}
                        className="mt-20 relative max-w-5xl mx-auto w-full group"
                    >
                        <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-400 rounded-[2.5rem] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                        <div className="relative bg-white dark:bg-[#0c0c0c] border border-gray-200/50 dark:border-[#1a1a1a] rounded-[2rem] shadow-2xl p-2 sm:p-4 aspect-video overflow-hidden">
                            <div className="w-full h-full bg-gray-50 dark:bg-[#0a0a0a] rounded-xl border border-gray-100 dark:border-[#141414] overflow-hidden flex flex-col relative">
                                {/* Fake App Top Bar */}
                                <div className="h-12 border-b border-gray-200/50 dark:border-[#1a1a1a] flex items-center px-4 gap-2 bg-white/50 dark:bg-[#0d0d0d]/50">
                                    <div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-400/80"></div><div className="w-3 h-3 rounded-full bg-amber-400/80"></div><div className="w-3 h-3 rounded-full bg-green-400/80"></div></div>
                                </div>
                                <div className="p-6 grid grid-cols-12 gap-6 h-full relative">
                                    {/* App UI Simulation */}
                                    <div className="col-span-3 space-y-3 hidden md:block opacity-90">
                                        <div className="h-16 rounded-xl bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] p-4 flex items-center shadow-sm">
                                            <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0 mr-3"></div>
                                            <div className="space-y-1.5 flex-1">
                                                <div className="h-2.5 w-full bg-gray-200 dark:bg-[#222] rounded"></div>
                                                <div className="h-2 w-2/3 bg-gray-100 dark:bg-[#1a1a1a] rounded"></div>
                                            </div>
                                        </div>
                                        <div className="h-40 rounded-xl bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] p-4 space-y-3 shadow-sm">
                                            <div className="h-2.5 w-1/2 bg-gray-200 dark:bg-[#222] rounded mb-4"></div>
                                            <div className="h-2 w-full bg-gray-100 dark:bg-[#1a1a1a] rounded"></div>
                                            <div className="h-2 w-5/6 bg-gray-100 dark:bg-[#1a1a1a] rounded"></div>
                                            <div className="h-2 w-4/6 bg-gray-100 dark:bg-[#1a1a1a] rounded"></div>
                                        </div>
                                    </div>
                                    <div className="col-span-12 md:col-span-9 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-32 rounded-lg bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] shadow-sm"></div>
                                            <div className="h-8 w-24 rounded-lg bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] shadow-sm"></div>
                                            <div className="h-8 w-24 rounded-lg bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] shadow-sm hidden sm:block"></div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {[
                                                { title: 'SSC CGL 2024', org: 'Staff Selection Commission', tag: 'LIVE', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                                                { title: 'RRB NTPC', org: 'Railway Recruitment Board', tag: 'UPCOMING', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                                                { title: 'UPSC CSE', org: 'Union Public Service Comm', tag: 'LIVE', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
                                            ].map((job, i) => (
                                                <div key={i} className="h-32 rounded-xl bg-white dark:bg-[#111] border border-gray-100 dark:border-[#1a1a1a] p-4 flex flex-col justify-between shadow-sm">
                                                    <div>
                                                        <div className="flex justify-between items-start mb-2.5">
                                                            <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-[#151515] border border-gray-100 dark:border-[#222] flex items-center justify-center text-[10px] font-bold text-gray-500">
                                                                {job.title[0]}
                                                            </div>
                                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${job.color}`}>{job.tag}</span>
                                                        </div>
                                                        <div className="text-sm font-bold text-gray-900 dark:text-white truncate">{job.title}</div>
                                                        <div className="text-[10px] text-gray-500 truncate mt-0.5">{job.org}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Overlay Gradient */}
                                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-gray-50 dark:from-[#0a0a0a] to-transparent"></div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </section>

                {/* ── SOCIAL PROOF ── */}
                <section className="py-10 border-y border-gray-100 dark:border-[#141414] bg-white dark:bg-[#0c0c0c] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 flex flex-col items-center opacity-60">
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-6">Trusted by aspirants for exams across</p>
                        <div className="flex flex-wrap justify-center gap-8 sm:gap-16 text-lg sm:text-2xl font-bold text-gray-400 grayscale">
                            <span>SSC</span>
                            <span>UPSC</span>
                            <span>IBPS</span>
                            <span>RRB</span>
                            <span>STATE PSC</span>
                        </div>
                    </div>
                </section>

                {/* ── THE PROBLEM ── */}
                <section id="problem" className="py-24 lg:py-32 bg-[#fafafa] dark:bg-[#080808]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}
                            className="grid lg:grid-cols-2 gap-16 items-center"
                        >
                            <div className="space-y-8">
                                <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                                    The government exam landscape is <span className="text-red-500">chaotic</span>.
                                </motion.h2>
                                <motion.p variants={fadeUp} className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                                    Aspirants miss out on 60% of jobs they are eligible for because tracking 1,000+ notifications across scattered state and central websites is humanly impossible.
                                </motion.p>
                                <motion.ul variants={fadeUp} className="space-y-4">
                                    {[
                                        "Missed application deadlines due to bad sorting.",
                                        "Wasted preparation targeting exams with low syllabus synergy.",
                                        "Confusion regarding exact age and qualification eligibility.",
                                    ].map((item, i) => (
                                        <li key={i} className="flex items-start gap-3">
                                            <div className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                                <svg className="w-3 h-3 text-red-600 dark:text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                            </div>
                                            <span className="text-gray-700 dark:text-gray-300 font-medium">{item}</span>
                                        </li>
                                    ))}
                                </motion.ul>
                            </div>
                            <motion.div variants={fadeUp} className="relative">
                                {/* Abstract Visual representation of chaos */}
                                <div className="relative aspect-square max-w-md mx-auto">
                                    <div className="absolute inset-0 border-2 border-dashed border-gray-300 dark:border-[#222] rounded-full animate-[spin_60s_linear_infinite]"></div>
                                    <div className="absolute inset-4 border border-dashed border-red-300 dark:border-red-900/40 rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-32 h-32 bg-white dark:bg-[#111] rounded-2xl shadow-2xl flex items-center justify-center rotate-12 z-10 border border-gray-100 dark:border-[#222]">
                                            <span className="text-4xl">🤯</span>
                                        </div>
                                        <div className="w-24 h-24 bg-white dark:bg-[#111] rounded-2xl shadow-xl flex items-center justify-center -rotate-12 absolute -left-4 top-10 border border-gray-100 dark:border-[#222]">
                                            <span className="text-xs font-bold text-gray-400">PDF Notif</span>
                                        </div>
                                        <div className="w-28 h-20 bg-white dark:bg-[#111] rounded-xl shadow-xl flex items-center justify-center rotate-6 absolute -right-6 bottom-16 border border-gray-100 dark:border-[#222]">
                                            <span className="text-xs font-bold text-red-500">Deadline Passed</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* ── THE SOLUTION ── */}
                <section className="py-24 lg:py-32 bg-white dark:bg-[#0c0c0c] border-y border-gray-100 dark:border-[#141414] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.2 }} variants={staggerContainer}
                            className="text-center max-w-3xl mx-auto mb-20 space-y-6"
                        >
                            <motion.div variants={fadeUp} className="inline-block px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm font-bold tracking-wide uppercase">The Solution</motion.div>
                            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white">
                                Personalized. Automated. Intelligent.
                            </motion.h2>
                            <motion.p variants={fadeUp} className="text-lg text-gray-600 dark:text-gray-400">
                                Enter your profile details once. Our engine crunches data across nationwide notifications to curate your perfect dashboard.
                            </motion.p>
                        </motion.div>

                        <div className="grid md:grid-cols-3 gap-8 relative">
                            {/* Connecting Line */}
                            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gradient-to-r from-red-500/0 via-red-500/20 to-red-500/0 hidden md:block -z-10 -translate-y-1/2"></div>
                            
                            {[
                                { step: '1', title: 'Smart Profile', desc: 'Input your age, state, and qualifications. We do the heavy lifting to find matches.' },
                                { step: '2', title: 'Live Tracker', desc: 'A unified dashboard showing what is Live, Upcoming, or Recently Closed.' },
                                { step: '3', title: 'AI Synergy', desc: 'Prepare for one exam, and let our AI suggest others with a 70%+ syllabus overlap.' }
                            ].map((item, i) => (
                                <motion.div 
                                    key={i}
                                    initial={{ opacity: 0, y: 50 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ delay: i * 0.2, duration: 0.6 }}
                                    className="bg-gray-50 dark:bg-[#111] border border-gray-200/60 dark:border-[#1a1a1a] rounded-[2rem] p-8 relative hover:shadow-2xl hover:shadow-red-500/5 transition-all duration-500 hover:-translate-y-1 hover:border-gray-300 dark:hover:border-[#252525]"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-orange-400 text-white flex items-center justify-center text-2xl font-black mb-6 shadow-lg shadow-red-500/30">
                                        {item.step}
                                    </div>
                                    <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{item.title}</h3>
                                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FEATURES GRID ── */}
                <section className="py-24 lg:py-32 bg-[#fafafa] dark:bg-[#080808]">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="mb-16">
                            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">Core Features</h2>
                            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">A complete ecosystem designed to keep you focused on studying, not searching.</p>
                        </div>
                        
                        <div className="grid lg:grid-cols-2 gap-6">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                                className="col-span-1 lg:col-span-2 bg-gradient-to-br from-[#111] to-[#1a1a1a] dark:from-[#111] dark:to-[#0a0a0a] rounded-3xl p-8 sm:p-12 border border-gray-200 dark:border-[#222] overflow-hidden relative group"
                            >
                                <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-gradient-to-tl from-red-500/20 to-transparent blur-3xl rounded-full z-0 group-hover:scale-110 transition-transform duration-700"></div>
                                <div className="relative z-10 sm:max-w-xl">
                                    <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center text-white mb-6 border border-white/10 backdrop-blur-md">
                                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                    </div>
                                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">AI Syllabus Recommendations</h3>
                                    <p className="text-gray-400 text-lg leading-relaxed mb-6">
                                        Our vector-powered engine analyzes the syllabus of the exam you are preparing for and instantly maps a percentage overlap with hundreds of other exams. Apply to more jobs with zero extra preparation.
                                    </p>
                                    <button className="text-red-400 font-bold hover:text-red-300 flex items-center gap-2 transition-colors">
                                        Explore Feature <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </motion.div>

                            <motion.div 
                                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                                className="bg-white dark:bg-[#0c0c0c] border border-gray-200/80 dark:border-[#1a1a1a] rounded-3xl p-8 sm:p-10 hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
                            >
                                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 rounded-xl flex items-center justify-center mb-6">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Smart Deadline Alerts</h3>
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">Never miss an application. Get notified instantly when targeted exams open, when deadlines approach, or when they finally close.</p>
                            </motion.div>

                            <motion.div 
                                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                                className="bg-white dark:bg-[#0c0c0c] border border-gray-200/80 dark:border-[#1a1a1a] rounded-3xl p-8 sm:p-10 hover:shadow-xl hover:-translate-y-1 transition-all duration-500"
                            >
                                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 rounded-xl flex items-center justify-center mb-6">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Preparation Tracker</h3>
                                <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">Log your daily study hours, maintain streaks, and watch your Readiness Score climb alongside a personalized AI accountability coach.</p>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section className="relative py-32 overflow-hidden bg-white dark:bg-[#080808] border-t border-gray-100 dark:border-[#141414]">
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
                    <div className="max-w-4xl mx-auto px-4 text-center relative z-10">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-6"
                        >
                            Ready to secure your future?
                        </motion.h2>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                            className="text-xl text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto"
                        >
                            Join thousands of aspirants crushing their preparation using a platform that dynamically works for you.
                        </motion.p>
                        <motion.button 
                            initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                            onClick={() => navigate('/signup')}
                            className="px-10 py-5 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-orange-500 text-white rounded-2xl font-black text-xl hover:shadow-[0_0_40px_rgba(239,68,68,0.4)] transition-all active:scale-95 hover:scale-105 hover:-translate-y-0.5"
                        >
                            Create Free Account Now
                        </motion.button>
                        <p className="mt-6 text-sm text-gray-500 dark:text-gray-500 font-medium">No credit card required. Fast sign-up.</p>
                    </div>
                </section>
            </main>
            
            <footer className="py-12 border-t border-gray-200 dark:border-[#141414] bg-white dark:bg-[#0c0c0c] text-center text-sm text-gray-500 font-medium">
                <div className="flex items-center justify-center gap-2 mb-4">
                    <Logo className="w-6 h-6 text-gray-400" />
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-base">SarkarHamariHai</span>
                </div>
                <div className="flex justify-center gap-6 mb-6">
                    <a href="#" className="hover:text-red-500 transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-red-500 transition-colors">Terms of Service</a>
                    <a href="#" className="hover:text-red-500 transition-colors">Contact</a>
                </div>
                <p>&copy; {new Date().getFullYear()} SarkarHamariHai Inc. All rights reserved.</p>
            </footer>
        </div>
    );
}
