import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Logo from '../assets/logo';

export default function LandingPage() {
    const navigate = useNavigate();
    const { scrollYProgress } = useScroll();
    
    // Parallax background effects
    const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
    const opacityBg = useTransform(scrollYProgress, [0, 0.5], [1, 0.2]);

    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY,
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const fadeInUp = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden selection:bg-red-600/30 selection:text-white">
            
            {/* Dynamic Cursor Glow */}
            <motion.div 
                className="fixed top-0 left-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none z-0"
                animate={{
                    x: mousePosition.x - 200,
                    y: mousePosition.y - 200,
                }}
                transition={{ type: "spring", damping: 40, stiffness: 150, mass: 0.5 }}
            />

            {/* Subtle Dot Grid Background */}
            <div className="fixed inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            {/* ── HEADER ── */}
            <header className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-2xl border-b border-white/[0.05]">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600 blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
                            <Logo className="w-8 h-8 text-red-500 relative z-10" />
                        </div>
                        <span className="text-lg font-normal tracking-wide text-white uppercase">
                            SarkarHamariHai
                        </span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/login')}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white px-6 py-2.5 text-[13px] font-semibold uppercase tracking-wide transition-all rounded-full backdrop-blur-md"
                        >
                            LOG IN
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className="bg-red-600 hover:bg-red-500 text-white px-7 py-2.5 text-[15px] font-semibold transition-all rounded-full shadow-lg hover:shadow-red-500/20"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </header>

            <main className="relative z-10">
                {/* ── HERO SECTION ── */}
                <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-4 pt-20">
                    <motion.div style={{ y: yBg, opacity: opacityBg }} className="absolute inset-0 z-0 flex items-center justify-center">
                        <div className="w-[800px] h-[800px] bg-gradient-to-b from-red-900/10 to-transparent rounded-full blur-[100px] absolute top-1/4" />
                    </motion.div>

                    <motion.div 
                        className="relative z-10 max-w-5xl mx-auto space-y-8 mt-10"
                        initial="hidden" animate="visible" variants={staggerContainer}
                    >
                        <motion.div variants={fadeInUp} className="inline-flex items-center gap-3 px-4 py-1.5 rounded-full border border-red-500/20 bg-red-500/5 text-red-400 text-[10px] font-medium tracking-wide uppercase mb-4 backdrop-blur-sm">
                            <span className="relative flex h-1.5 w-1.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                            </span>
                            Intelligent Exam Discovery
                        </motion.div>

                        <motion.h1 
                            variants={fadeInUp}
                            className="text-5xl sm:text-7xl lg:text-[5.5rem] font-normal tracking-tight text-white leading-[1.1]"
                        >
                            Stop Searching. <br />
                            <span className="font-medium text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-700">Start Preparing.</span>
                        </motion.h1>

                        <motion.p 
                            variants={fadeInUp}
                            className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed font-normal tracking-wide"
                        >
                            An AI tracker that maps your profile to thousands of government jobs, manages your deadlines, and recommends exams with overlapping syllabi.
                        </motion.p>

                        <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-12">
                            <button
                                onClick={() => navigate('/signup')}
                                className="w-full sm:w-auto px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all flex items-center justify-center gap-3 rounded-full shadow-lg hover:shadow-red-500/20"
                            >
                                Get Started Free
                                <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
                            </button>
                            <button
                                onClick={() => navigate('/login')}
                                className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold text-[13px] uppercase tracking-wide transition-all flex items-center justify-center gap-2 rounded-full backdrop-blur-md"
                            >
                                EXISTING USER
                            </button>
                        </motion.div>
                    </motion.div>

                    {/* Scroll Indicator */}
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
                        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
                    >
                        <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-gray-600">Scroll</span>
                        <div className="w-[1px] h-12 bg-gradient-to-b from-red-500/50 to-transparent" />
                    </motion.div>
                </section>

                {/* ── THE PROBLEM ── */}
                <section className="py-32 relative border-t border-white/[0.03] bg-gradient-to-b from-black to-[#050505]">
                    <div className="max-w-7xl mx-auto px-6">
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}
                            className="grid lg:grid-cols-2 gap-20 items-center"
                        >
                            <div className="space-y-12">
                                <motion.div variants={fadeInUp}>
                                    <h2 className="text-3xl sm:text-4xl font-normal tracking-wide mb-6">
                                        The System is <span className="text-gray-600 line-through">Broken</span> <br/><span className="text-red-500 font-medium">Chaotic.</span>
                                    </h2>
                                    <p className="text-lg text-gray-400 leading-relaxed font-normal">
                                        Every year, millions of aspirants miss out on perfect opportunities simply because the information is scattered, confusing, and unforgiving.
                                    </p>
                                </motion.div>

                                <motion.div variants={staggerContainer} className="space-y-4">
                                    {[
                                        { title: 'Information Overload', desc: '1,000+ notifications across 50+ archaic websites.' },
                                        { title: 'Missed Deadlines', desc: 'Finding out about an exam the day after applications close.' },
                                        { title: 'Wasted Potential', desc: 'Preparing for one exam, completely unaware of 5 others with the exact same syllabus.' },
                                    ].map((item, i) => (
                                        <motion.div key={i} variants={fadeInUp} className="flex items-start gap-5 p-6 bg-white/[0.02] rounded-3xl hover:border-red-500/20 transition-colors backdrop-blur-md">
                                            <div className="text-red-500/50 font-mono text-sm tracking-wide mt-1">0{i+1}</div>
                                            <div>
                                                <h3 className="text-sm font-medium text-white mb-2 uppercase tracking-wide">{item.title}</h3>
                                                <p className="text-gray-500 text-sm leading-relaxed font-normal">{item.desc}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </motion.div>
                            </div>
                            
                            {/* Visual Representation */}
                            <motion.div variants={fadeInUp} className="relative h-[600px] w-full hidden lg:block">
                                <div className="absolute inset-0 rounded-3xl bg-white/[0.01] backdrop-blur-2xl flex flex-col overflow-hidden">
                                    <div className="h-10 border-b border-white/[0.05] flex items-center px-4 bg-black/40">
                                        <div className="w-full max-w-sm h-6 bg-white/5 rounded-sm px-3 flex items-center">
                                            <span className="text-[10px] text-gray-600 font-mono tracking-wider">search: government jobs eligibility...</span>
                                        </div>
                                    </div>
                                    <div className="flex-1 p-8 relative overflow-hidden">
                                        <motion.div 
                                            animate={{ y: [0, -400] }} transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
                                            className="space-y-4"
                                        >
                                            {[...Array(10)].map((_, i) => (
                                                <div key={i} className="p-4 border border-white/[0.03] bg-white/[0.02] opacity-40 flex gap-4">
                                                    <div className="w-10 h-10 bg-white/5" />
                                                    <div className="space-y-2 flex-1 pt-1">
                                                        <div className="h-3 w-3/4 bg-white/10" />
                                                        <div className="h-2 w-1/2 bg-white/5" />
                                                    </div>
                                                </div>
                                            ))}
                                        </motion.div>
                                        {/* Overlays */}
                                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/10 to-black z-10" />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 w-64 p-8 bg-black/80 backdrop-blur-lg border border-red-500/50 text-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                                            <span className="text-red-500 font-medium uppercase tracking-wide text-xs block mb-3">Error 404</span>
                                            <span className="text-gray-400 text-xs font-normal">Deadline Passed</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </section>

                {/* ── THE SOLUTION ── */}
                <section className="py-32 relative border-t border-white/[0.03] bg-black">
                    <div className="max-w-7xl mx-auto px-6">
                        <motion.div 
                            initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}
                            className="text-center max-w-4xl mx-auto mb-20"
                        >
                            <motion.h2 variants={fadeInUp} className="text-3xl sm:text-4xl font-normal tracking-wide mb-6">
                                The <span className="font-medium text-white">AI</span> Advantage
                            </motion.h2>
                            <motion.p variants={fadeInUp} className="text-lg text-gray-400 font-normal leading-relaxed">
                                SarkarHamariHai flips the script. You don't look for exams; the right exams look for you.
                            </motion.p>
                        </motion.div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {[
                                { 
                                    icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4", 
                                    title: 'Profile Matching Engine', 
                                    desc: 'Input your exact age, category, physical traits, and qualifications. Our engine filters out the noise and shows only what you are 100% eligible for.' 
                                },
                                { 
                                    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9", 
                                    title: 'Live Tracking & Alerts', 
                                    desc: 'A unified dashboard that monitors upcoming notifications, tracks live applications, and alerts you before deadlines hit.' 
                                },
                                { 
                                    icon: "M13 10V3L4 14h7v7l9-11h-7z", 
                                    title: 'Syllabus Synergy', 
                                    desc: 'Preparing for UPSC? Our AI scans syllabus vectors to find state PSCs or SSC exams with 80%+ overlap, maximizing your chances.' 
                                }
                            ].map((item, i) => (
                                <motion.div 
                                    key={i}
                                    initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeInUp}
                                    className="group relative rounded-3xl bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 p-10 backdrop-blur-sm"
                                >
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/0 group-hover:via-red-500/50 to-transparent transition-all duration-700" />
                                    <svg className="w-8 h-8 text-red-500/80 mb-8 stroke-[1]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                                    <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">{item.title}</h3>
                                    <p className="text-gray-500 leading-relaxed font-normal text-sm">{item.desc}</p>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── APP PREVIEW SECTION ── */}
                <section className="py-32 relative border-t border-white/[0.03] bg-[#030303] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                         <motion.div 
                            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8 }}
                            className="relative max-w-5xl mx-auto"
                        >
                            <div className="absolute -inset-10 bg-gradient-to-r from-red-600/10 to-red-900/10 blur-[100px] opacity-50" />
                            <div className="relative border border-white/[0.08] bg-[#0a0a0a] shadow-2xl overflow-hidden">
                                <div className="h-10 border-b border-white/[0.05] bg-[#0f0f0f] flex items-center px-4 gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                </div>
                                <div className="p-8 flex flex-col lg:flex-row gap-6 relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/[0.02] to-transparent">
                                    {/* Dashboard Mockup */}
                                    <div className="w-full lg:w-1/3 space-y-4 text-left">
                                        <div className="bg-white/[0.02] rounded-3xl p-5">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-3 font-medium">Readiness Score</div>
                                            <div className="flex items-end gap-2"><span className="text-4xl font-normal text-red-500 tracking-tighter">84</span><span className="text-gray-600 text-xs mb-1">/ 100</span></div>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-3xl p-5">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-5 font-medium">Syllabus Match</div>
                                            <div className="space-y-4">
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">SSC CGL</span><span className="text-red-400">92%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-red-500 w-[92%]" /></div></div>
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">RRB NTPC</span><span className="text-red-400">78%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-red-500 w-[78%]" /></div></div>
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">IBPS PO</span><span className="text-gray-500">45%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-gray-600 w-[45%]" /></div></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4 text-left">
                                        <div className="flex gap-4 border-b border-white/[0.05] pb-2">
                                            <div className="text-xs text-white font-medium pb-2 border-b border-red-500 translate-y-[9px]">Live Exams (3)</div>
                                            <div className="text-xs text-gray-600 font-normal pb-2">Upcoming</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            {[1,2,3,4].map(i => (
                                                <div key={i} className="bg-white/[0.02] rounded-3xl p-5 hover:border-red-500/30 transition-colors">
                                                    <div className="flex justify-between items-start mb-6"><div className="w-6 h-6 bg-white/10 rounded-sm" /><span className="text-[9px] text-green-500 border border-green-500/30 bg-green-500/10 px-2 py-0.5 uppercase tracking-wide">Live</span></div>
                                                    <div><div className="h-2 w-3/4 bg-white/20 mb-2" /><div className="h-1.5 w-1/2 bg-white/10" /></div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10 pointer-events-none" />
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── FINAL CTA ── */}
                <section className="py-40 relative border-t border-white/[0.03] bg-black text-center overflow-hidden">
                    <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
                         <div className="w-[80vw] h-[80vw] lg:w-[40vw] lg:h-[40vw] border-[1px] border-red-500/20 rounded-full flex items-center justify-center">
                            <div className="w-[75%] h-[75%] border-[1px] border-red-500/20 rounded-full flex items-center justify-center">
                                <div className="w-[60%] h-[60%] border-[1px] border-red-500/20 rounded-full" />
                            </div>
                         </div>
                    </div>

                    <div className="max-w-4xl mx-auto px-6 relative z-10">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="text-4xl sm:text-6xl font-normal tracking-tight mb-6"
                        >
                            Take Control.
                        </motion.h2>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                            className="text-lg text-gray-400 mb-12 font-normal max-w-xl mx-auto"
                        >
                            Join thousands of aspirants who have automated their exam discovery and focused entirely on preparation.
                        </motion.p>
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
                            className="flex flex-col sm:flex-row justify-center gap-4"
                        >
                            <button 
                                onClick={() => navigate('/signup')}
                                className="px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all rounded-full shadow-lg hover:shadow-red-500/20 active:scale-[0.98]"
                            >
                                Start For Free
                            </button>
                             <button 
                                onClick={() => navigate('/login')}
                                className="px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold text-[13px] uppercase tracking-wide transition-all rounded-full active:scale-[0.98]"
                            >
                                LOG IN
                            </button>
                        </motion.div>
                    </div>
                </section>
            </main>
            
            <footer className="py-12 border-t border-white/[0.03] bg-[#030303] text-center">
                <div className="max-w-7xl mx-auto px-6 flex flex-col items-center">
                    <Logo className="w-6 h-6 text-gray-700 mb-6" />
                    <div className="flex gap-8 mb-6 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        <Link to="/privacy" className="hover:text-red-500 transition-colors">Privacy</Link>
                        <Link to="/privacy" className="hover:text-red-500 transition-colors">Terms</Link>
                        <a href="mailto:support@sarkarhamarihai.vercel.app" className="hover:text-red-500 transition-colors">Contact</a>
                    </div>
                    <p className="text-[10px] text-gray-600 font-mono tracking-wide">&copy; {new Date().getFullYear()} SARKARHAMARIHAI. ALL SYSTEMS OPERATIONAL.</p>
                </div>
            </footer>
        </div>
    );
}
