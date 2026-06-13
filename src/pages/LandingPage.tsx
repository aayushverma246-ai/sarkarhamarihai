import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import Logo from '../assets/logo';
import { Spotlight } from '../components/ui/spotlight';
import { SpotlightHover } from '../components/ui/spotlight-hover';
import { SplineScene } from '../components/ui/splite';

const stableParticles = [
    { x: 260, y: 310, targetY: 90,  targetX: 200, scale: 1.1, duration: 1.4, delay: 0.0 },
    { x: 310, y: 290, targetY: 110, targetX: 280, scale: 0.9, duration: 1.6, delay: 0.15 },
    { x: 280, y: 330, targetY: 80,  targetX: 150, scale: 1.15, duration: 1.2, delay: 0.3 },
    { x: 330, y: 300, targetY: 130, targetX: 310, scale: 0.8, duration: 1.8, delay: 0.45 },
    { x: 250, y: 320, targetY: 100, targetX: 180, scale: 1.0, duration: 1.5, delay: 0.6 },
    { x: 300, y: 280, targetY: 120, targetX: 240, scale: 1.2, duration: 1.3, delay: 0.75 },
    { x: 290, y: 340, targetY: 95,  targetX: 220, scale: 0.75, duration: 1.5, delay: 0.9 },
    { x: 320, y: 315, targetY: 85,  targetX: 260, scale: 1.1, duration: 1.7, delay: 1.05 }
];

export default function LandingPage() {
    const navigate = useNavigate();
    const { scrollYProgress } = useScroll();
    
    // Active robot emotion ('neutral' | 'happy' | 'wow')
    const [robotEmotion, setRobotEmotion] = useState<'neutral' | 'happy' | 'wow'>('neutral');

    // FAQ state variable
    const [faqOpen, setFaqOpen] = useState<number | null>(null);

    // Parallax background effects
    const yBg = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
    const opacityBg = useTransform(scrollYProgress, [0, 0.5], [1, 0.2]);

    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    useEffect(() => {
        // Bypass cursor tracking mouse listener on mobile
        if (isMobile) return;

        let rafId: number;
        let lastEvent: MouseEvent | null = null;

        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY,
            });

            if (!e.isTrusted) return; // Prevent infinite event loops from synthetic events
            lastEvent = e;

            // Throttle synthetic event dispatches using requestAnimationFrame to ensure jitter-free cursor tracking aligned with monitor refresh rates
            if (!rafId) {
                rafId = requestAnimationFrame(() => {
                    const canvas = document.querySelector('canvas');
                    if (canvas && lastEvent) {
                        // Dispatch mousemove
                        canvas.dispatchEvent(new MouseEvent('mousemove', {
                            clientX: lastEvent.clientX,
                            clientY: lastEvent.clientY,
                            screenX: lastEvent.screenX,
                            screenY: lastEvent.screenY,
                            bubbles: false,
                            cancelable: true,
                        }));

                        // Dispatch pointermove
                        if (window.PointerEvent) {
                            canvas.dispatchEvent(new PointerEvent('pointermove', {
                                clientX: lastEvent.clientX,
                                clientY: lastEvent.clientY,
                                screenX: lastEvent.screenX,
                                screenY: lastEvent.screenY,
                                bubbles: false,
                                cancelable: true,
                                pointerType: 'mouse',
                                isPrimary: true
                            }));
                        }
                    }
                    rafId = 0;
                });
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [isMobile]);

    const fadeInUp = {
        hidden: { opacity: 0, y: 30 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } }
    };

    const staggerContainer = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: { staggerChildren: 0.15 }
        }
    };

    // Highly damped, premium spring transitions with ZERO wobble/overshoot
    const robotMotionVariants = {
        neutral: {
            scale: 1,
            x: 0,
            y: 0,
            rotateY: 0,
            rotateX: 0,
            rotateZ: 0,
            transition: { type: "spring" as const, stiffness: 150, damping: 35 }
        },
        happy: {
            scale: 1.15,
            x: 0,
            y: -10,
            rotateY: 0,
            rotateX: 0,
            rotateZ: 0,
            transition: { type: "spring" as const, stiffness: 150, damping: 35 }
        },
        wow: {
            scale: 1.25,
            x: 0,
            y: -12,
            rotateY: 0,
            rotateX: -10, // Leans forward in surprise/wow
            rotateZ: 4,   // Cute slight head tilt
            transition: { type: "spring" as const, stiffness: 150, damping: 30 }
        }
    };

    return (
        <div className="min-h-screen bg-black text-white font-sans overflow-hidden selection:bg-red-600/30 selection:text-white">
            
            {/* Dynamic Cursor Glow (Desktop Only) */}
            {!isMobile && (
                <motion.div 
                    className="fixed top-0 left-0 w-[400px] h-[400px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none z-0"
                    animate={{
                        x: mousePosition.x - 200,
                        y: mousePosition.y - 200,
                    }}
                    transition={{ type: "spring", damping: 40, stiffness: 150, mass: 0.5 }}
                />
            )}

            {/* Subtle Dot Grid Background */}
            <div className="fixed inset-0 z-0 opacity-20" style={{ backgroundImage: 'radial-gradient(#555 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

            {/* ── HEADER ── */}
            <header className="fixed top-0 w-full z-50 bg-black/40 backdrop-blur-2xl border-b border-white/[0.05]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-600 blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
                            <Logo size={32} className="relative z-10" />
                        </div>
                        <span className="text-base sm:text-lg font-normal tracking-wide text-white uppercase hidden sm:block">
                            SarkarHamariHai
                        </span>
                    </div>
                    <div className="flex items-center gap-3 sm:gap-6">
                        <button
                            onClick={() => navigate('/login')}
                            onMouseEnter={() => setRobotEmotion('wow')}
                            onMouseLeave={() => setRobotEmotion('neutral')}
                            className="bg-white/5 border border-white/10 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-1.5 sm:px-6 sm:py-2.5 text-[11px] sm:text-[13px] font-semibold uppercase tracking-wide transition-all rounded-full backdrop-blur-md whitespace-nowrap"
                        >
                            LOG IN
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            onMouseEnter={() => setRobotEmotion('happy')}
                            onMouseLeave={() => setRobotEmotion('neutral')}
                            className="bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 sm:px-7 sm:py-2.5 text-[12px] sm:text-[15px] font-semibold transition-all rounded-full shadow-lg hover:shadow-red-500/20 whitespace-nowrap"
                        >
                            Sign Up
                        </button>
                    </div>
                </div>
            </header>
            <main className="relative z-10">
                {/* ── HERO SECTION ── */}
                <section className="relative min-h-screen flex items-center justify-center bg-black overflow-hidden pt-20">
                    {/* Spotlight Backdrop Glow */}
                    <Spotlight className="-top-40 left-0 md:left-60 md:-top-20" fill="red" />

                    {/* Red mesh blur glow in background */}
                    <motion.div style={{ y: yBg, opacity: opacityBg }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                        <div className="w-[800px] h-[800px] bg-gradient-to-b from-red-900/10 to-transparent rounded-full blur-[100px] absolute top-1/4" />
                    </motion.div>

                    {/* 12-Column Responsive Layout Grid */}
                    <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-12 gap-12 items-center relative z-10 w-full pt-10">
                        {/* Left Column: Bold text, description, CTAs (given higher z-index so buttons remain clickable) */}
                        <motion.div 
                            className="lg:col-span-7 text-left space-y-6 relative z-20"
                            initial="hidden" animate="visible" variants={staggerContainer}
                        >
                            <motion.h1 
                                variants={fadeInUp}
                                className="text-4xl sm:text-6xl lg:text-7xl font-normal tracking-tight text-white leading-[1.1]"
                            >
                                Stop Searching. <br />
                                <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600">Start Preparing.</span>
                            </motion.h1>

                            <motion.p 
                                variants={fadeInUp}
                                className="text-base sm:text-lg text-gray-400 max-w-xl leading-relaxed font-normal"
                            >
                                An AI tracker that maps your profile to thousands of government jobs, manages your deadlines, and recommends exams with overlapping syllabi.
                            </motion.p>

                            <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row items-center justify-start gap-4 pt-6">
                                <button
                                    onClick={() => navigate('/signup')}
                                    onMouseEnter={() => setRobotEmotion('happy')}
                                    onMouseLeave={() => setRobotEmotion('neutral')}
                                    className="w-full sm:w-auto px-10 py-4 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all flex items-center justify-center gap-3 rounded-full shadow-lg hover:shadow-red-500/20 active:scale-[0.98]"
                                >
                                    Get Started Free
                                    <motion.span animate={{ x: [0, 5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>→</motion.span>
                                </button>
                                <button
                                    onClick={() => navigate('/login')}
                                    onMouseEnter={() => setRobotEmotion('wow')}
                                    onMouseLeave={() => setRobotEmotion('neutral')}
                                    className="w-full sm:w-auto px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold text-[13px] uppercase tracking-wide transition-all flex items-center justify-center gap-2 rounded-full backdrop-blur-md active:scale-[0.98]"
                                >
                                    EXISTING USER
                                </button>
                            </motion.div>
                        </motion.div>

                        {/* Spacer column to preserve spacing in the grid */}
                        <div className="lg:col-span-5 hidden lg:block pointer-events-none" />
                    </div>

                    {/* Absolute 3D Robot Container. On desktop it occupies 55% width and tracks cursor. On mobile/tablet, it is placed as an ambient background layer with touch pass-through so touch-scrolling remains buttery smooth and fast */}
                    <div className="absolute right-0 bottom-0 w-full lg:w-[55%] h-[40vh] lg:h-full select-none z-10 opacity-25 lg:opacity-100 pointer-events-none lg:pointer-events-auto pt-10 lg:pt-20">
                        {/* Excitement sparkles/particles (floating hearts) shown during happy state */}
                        {robotEmotion === 'happy' && (
                            <div className="absolute inset-0 z-20 pointer-events-none">
                                {stableParticles.map((p, i) => (
                                    <motion.div 
                                        key={i}
                                        className="absolute text-red-500/80 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] select-none pointer-events-none font-sans text-xl"
                                        initial={{ 
                                            x: p.x, 
                                            y: p.y, 
                                            opacity: 0,
                                            scale: 0.5 
                                        }}
                                        animate={{ 
                                            y: [p.y, p.y - 120],
                                            x: [p.x, p.x + (p.targetX - 250)],
                                            opacity: [0, 1, 0],
                                            scale: [0.5, p.scale, 0.5]
                                        }}
                                        transition={{ 
                                            duration: p.duration, 
                                            repeat: Infinity,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        ❤️
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Golden stars sparked during wow state */}
                        {robotEmotion === 'wow' && (
                            <div className="absolute inset-0 z-20 pointer-events-none">
                                {stableParticles.map((p, i) => (
                                    <motion.div 
                                        key={i}
                                        className="absolute text-yellow-400/90 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)] select-none pointer-events-none font-sans text-xl"
                                        initial={{ 
                                            x: p.x, 
                                            y: p.y, 
                                            opacity: 0,
                                            scale: 0.5 
                                        }}
                                        animate={{ 
                                            y: [p.y, p.y - 120],
                                            x: [p.x, p.x + (p.targetX - 250)],
                                            opacity: [0, 1, 0],
                                            scale: [0.5, p.scale, 0.5]
                                        }}
                                        transition={{ 
                                            duration: p.duration, 
                                            repeat: Infinity,
                                            delay: p.delay,
                                            ease: "easeOut"
                                        }}
                                    >
                                        ✨
                                    </motion.div>
                                ))}
                            </div>
                        )}

                        {/* Wow background shadow overlay */}
                        <motion.div 
                            className="absolute inset-0 z-10 pointer-events-none rounded-full bg-red-900/10 blur-3xl transition-opacity duration-300"
                            animate={{ opacity: robotEmotion === 'wow' ? 0.5 : 0 }}
                        />

                        <motion.div 
                            className="absolute inset-0 w-full h-full flex items-center justify-center"
                            animate={robotEmotion}
                            variants={robotMotionVariants}
                            style={{ transformStyle: "preserve-3d", perspective: 1000 }}
                        >
                            <SplineScene 
                                scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
                                className="w-full h-full"
                                emotion={robotEmotion}
                            />
                        </motion.div>
                    </div>

                    {/* Scroll Indicator */}
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 1 }}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20 pointer-events-none"
                    >
                        <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-gray-600">Scroll</span>
                        <div className="w-[1px] h-10 bg-gradient-to-b from-red-500/50 to-transparent" />
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
                                        <motion.div key={i} variants={fadeInUp} className="flex items-start gap-5 p-6 bg-white/[0.02] rounded-3xl hover:border-red-500/20 transition-colors backdrop-blur-md relative overflow-hidden group">
                                            <SpotlightHover size={200} className="from-red-500/10 via-red-500/5 to-transparent" />
                                            <div className="text-red-500/50 font-mono text-sm tracking-wide mt-1 relative z-10">0{i+1}</div>
                                            <div className="relative z-10">
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
                                    className="group relative rounded-3xl bg-white/[0.01] hover:bg-white/[0.03] transition-all duration-500 p-10 backdrop-blur-sm overflow-hidden"
                                >
                                    <SpotlightHover size={250} className="from-red-500/10 via-red-500/5 to-transparent" />
                                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/0 group-hover:via-red-500/50 to-transparent transition-all duration-700 z-10" />
                                    <svg className="w-8 h-8 text-red-500/80 mb-8 stroke-[1] relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
                                    <div className="relative z-10">
                                        <h3 className="text-sm font-medium text-white mb-4 uppercase tracking-wider">{item.title}</h3>
                                        <p className="text-gray-500 leading-relaxed font-normal text-sm">{item.desc}</p>
                                    </div>
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

                {/* ── FAQ SECTION ── */}
                <section className="py-32 relative border-t border-white/[0.03] bg-black">
                    <div className="max-w-4xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-4xl font-normal tracking-wide mb-4 text-white">Frequently Asked Questions</h2>
                            <p className="text-base text-gray-400 font-normal">Answers to everything you need to know about the SarkarHamariHai AI ecosystem.</p>
                        </div>
                        
                        <div className="space-y-4">
                            {[
                                {
                                    q: "How does the Syllabus Synergy calculator work?",
                                    a: "Our AI scans the official syllabus PDFs of central and state level exams using vector embeddings. It correlates topics, weights, and scoring distributions to calculate a synergy percentage, showing you exactly which additional exams require zero extra study."
                                },
                                {
                                    q: "What types of government exams are tracked?",
                                    a: "We track 5,000+ public sector vacancies yearly including Central (SSC, UPSC, Railways, IBPS, Defence, LIC) and State Civil Services, police recruitments, and teachers eligibility tests across all major states."
                                },
                                {
                                    q: "How does the SMS & live alerts service function?",
                                    a: "Once you lock in your profile qualifications, our background crawler checks for state-level portal modifications. If a notification is released that matches your profile, you receive a direct SMS and dashboard alert 14 days before applications close."
                                },
                                {
                                    q: "Is my personal qualification and age data secure?",
                                    a: "Yes. All data is securely stored inside Supabase under industry-grade Row-Level Security (RLS) policies. We do not sell or distribute candidate data to third-party institutions."
                                }
                            ].map((item, index) => {
                                const isOpen = faqOpen === index;
                                return (
                                    <div key={index} className="border border-white/[0.05] bg-white/[0.01] rounded-3xl overflow-hidden backdrop-blur-sm transition-all duration-300">
                                        <button 
                                            onClick={() => setFaqOpen(isOpen ? null : index)}
                                            className="w-full px-8 py-6 text-left flex justify-between items-center gap-4 text-white hover:bg-white/[0.02] transition-colors"
                                        >
                                            <span className="text-sm font-medium tracking-wide uppercase text-left">{item.q}</span>
                                            <span className="text-red-500 font-light text-2xl transition-transform duration-300" style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                                        </button>
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-8 pb-6 text-sm text-gray-500 leading-relaxed font-normal text-left">
                                                {item.a}
                                            </div>
                                        </motion.div>
                                    </div>
                                );
                            })}
                        </div>
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
