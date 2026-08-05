import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ArrowRight, Calendar, BookOpen, AlertCircle } from 'lucide-react';
import Logo from '../assets/logo';
import Footer from '../components/Footer';

export default function LandingPage() {
    const navigate = useNavigate();

    // Page title syncing
    useEffect(() => {
        document.title = "SarkarHamariHai | AI Study & Exam Tracker";
    }, []);

    // FAQ state variable
    const [faqOpen, setFaqOpen] = useState<number | null>(null);

    // Mobile check & Navigation drawer
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Throttled Scroll State via top-anchor IntersectionObserver (No scroll listeners)
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            setIsScrolled(!entry.isIntersecting);
        }, { threshold: 0 });

        const anchor = document.getElementById('top-anchor');
        if (anchor) observer.observe(anchor);

        return () => {
            if (anchor) observer.unobserve(anchor);
        };
    }, []);

    // Scroll restoration for Landing Page
    useEffect(() => {
        const savedScroll = sessionStorage.getItem('landing_scroll');
        if (savedScroll) {
            const scrollPos = parseInt(savedScroll, 10);
            if (scrollPos > 0) {
                const timer = setTimeout(() => {
                    window.scrollTo({ top: scrollPos, behavior: 'instant' });
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: scrollPos, behavior: 'instant' });
                    });
                }, 100);
                return () => clearTimeout(timer);
            }
        }
    }, []);

    useEffect(() => {
        let debounceTimer: ReturnType<typeof setTimeout>;
        const handleScroll = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const y = Math.max(
                    window.scrollY,
                    document.documentElement.scrollTop,
                    document.body?.scrollTop || 0
                );
                sessionStorage.setItem('landing_scroll', y.toString());
            }, 100);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => {
            clearTimeout(debounceTimer);
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Dynamic Clock Time (NYC clock translated to candidate local experience / standard premium tag)
    const [currentTime, setCurrentTime] = useState('12:00 PM');
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12; // the hour '0' should be '12'
            setCurrentTime(`${hours}:${minutes} ${ampm}`);
        };
        updateTime();
        const timer = setInterval(updateTime, 60000);
        return () => clearInterval(timer);
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
        <div className="min-h-screen bg-[#050505] text-white font-sans overflow-hidden selection:bg-[#FF4500] selection:text-white relative">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500;700&display=swap');

                body, .font-sans {
                    font-family: 'Inter', sans-serif !important;
                    -webkit-font-smoothing: antialiased;
                    -moz-osx-font-smoothing: grayscale;
                    text-rendering: optimizeLegibility;
                }

                .font-serif {
                    font-family: 'Playfair Display', serif !important;
                }

                .font-mono {
                    font-family: 'JetBrains Mono', monospace !important;
                }

                /* Reveal Animation class mappings */
                .reveal-effect {
                    opacity: 0;
                    transform: translateY(25px);
                    transition: all 0.8s cubic-bezier(0.22, 1, 0.36, 1);
                }

                .reveal-effect.active {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* Floating animations for surrealist hands */
                @keyframes float-hand-left {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(-20px) rotate(2deg); }
                }

                @keyframes float-hand-right {
                    0%, 100% { transform: translateY(0) rotate(0); }
                    50% { transform: translateY(20px) rotate(-2deg); }
                }

                .animate-float-left {
                    animation: float-hand-left 12s ease-in-out infinite;
                }

                .animate-float-right {
                    animation: float-hand-right 14s ease-in-out infinite;
                }

                /* Global Noise overlay */
                .noise-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 50;
                    pointer-events: none;
                    opacity: 0.04;
                    mix-blend-mode: overlay;
                    background-image: url("https://grainy-gradients.vercel.app/noise.svg");
                }

                /* Rendering performance optimization for offscreen content elements */
                #problem, #expertise, #works, #solutions, #faq {
                    content-visibility: auto;
                    contain-intrinsic-size: 500px;
                }
            `}</style>

            {/* Top Anchor for Header scroll state */}
            <div id="top-anchor" className="absolute top-0 left-0 w-full h-1 pointer-events-none" />

            {/* Global Noise Overlay */}
            <div className="noise-overlay" />

            {/* ── NAVIGATION ── */}
            <nav 
                className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 py-8 ${
                    isScrolled 
                        ? 'py-4 bg-[#050505]/80 backdrop-blur-md border-b border-white/5 shadow-lg' 
                        : 'bg-transparent border-b border-transparent'
                }`}
            >
                <div className="container mx-auto px-6 flex items-center justify-between">
                    <a href="#" className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
                        <div className="relative">
                            <div className="absolute inset-0 bg-[#FF4500] blur-lg opacity-0 group-hover:opacity-40 transition-opacity duration-700" />
                            <Logo size={28} className="relative z-10" />
                        </div>
                        <span className="text-2xl font-light tracking-wide text-white font-serif">
                            Sarkar <span className="text-[#FF4500] italic font-semibold">Hamari</span> Hai<span className="text-[#FF4500]">.</span>
                        </span>
                    </a>
                    
                    <div className="hidden md:flex items-center space-x-10 font-sans">
                        <a href="#problem" className="text-sm text-gray-400 hover:text-white transition-colors duration-300">The Problem</a>
                        <a href="#expertise" className="text-sm text-gray-400 hover:text-white transition-colors duration-300">Categories</a>
                        <a href="#works" className="text-sm text-gray-400 hover:text-white transition-colors duration-300">Features</a>
                        <a href="#faq" className="text-sm text-gray-400 hover:text-white transition-colors duration-300">FAQs</a>
                    </div>

                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => navigate('/login')}
                            className="hidden sm:inline-block text-xs uppercase tracking-widest text-gray-400 hover:text-white px-5 py-2 transition-all font-mono"
                        >
                            Log In
                        </button>
                        <button
                            onClick={() => navigate('/signup')}
                            className="inline-flex items-center justify-center px-6 py-3 rounded-full text-xs md:text-sm font-medium bg-white text-black hover:scale-105 hover:bg-gray-100 transition-all duration-300 font-sans uppercase tracking-wider"
                        >
                            Start Free
                        </button>
                        {/* Mobile Hamburger Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden flex flex-col justify-center items-center gap-1.5 w-10 h-10 rounded-full border border-white/10 bg-white/5 z-50 relative"
                            aria-label="Toggle mobile menu"
                        >
                            <span className={`w-4 h-0.5 bg-white transition-transform duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-1' : ''}`} />
                            <span className={`w-4 h-0.5 bg-white transition-opacity duration-300 ${mobileMenuOpen ? 'opacity-0' : 'opacity-100'}`} />
                            <span className={`w-4 h-0.5 bg-white transition-transform duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-1' : ''}`} />
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-40 bg-[#050505] pt-32 px-6 flex flex-col gap-8 md:hidden"
                    >
                        <div className="flex flex-col gap-6 text-xl font-sans text-left">
                            <a href="#problem" onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white transition-colors py-2 border-b border-white/5">The Problem</a>
                            <a href="#expertise" onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white transition-colors py-2 border-b border-white/5">Categories</a>
                            <a href="#works" onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white transition-colors py-2 border-b border-white/5">Features</a>
                            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="text-gray-400 hover:text-white transition-colors py-2 border-b border-white/5">FAQs</a>
                        </div>
                        <div className="flex flex-col gap-4 mt-8">
                            <button
                                onClick={() => { setMobileMenuOpen(false); navigate('/login'); }}
                                className="w-full py-4 rounded-full border border-white/10 bg-white/5 text-sm uppercase tracking-wider font-mono text-center"
                            >
                                Log In
                            </button>
                            <button
                                onClick={() => { setMobileMenuOpen(false); navigate('/signup'); }}
                                className="w-full py-4 rounded-full bg-white text-black text-sm uppercase tracking-wider font-sans font-medium text-center"
                            >
                                Start Free
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <main className="relative z-10">
                {/* ── HERO SECTION ── */}
                <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-32 pb-20 bg-[#050505]">
                    {/* Background Atmosphere */}
                    <div className="absolute inset-0 z-0 pointer-events-none select-none">
                        <div className="absolute top-0 left-0 w-full h-full opacity-60 mix-blend-screen">
                            <img src="https://framerusercontent.com/images/9zvwRJAavKKacVyhFCwHyXW1U.png?width=1536&height=1024" alt="Atmosphere" className="w-full h-full object-cover object-center opacity-80" loading="eager" />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505] z-10" />
                    </div>

                    {/* Floating Surrealist Left Hand (Reaching) */}
                    <div className="absolute -left-[10%] top-[-10%] md:left-[-5%] md:top-[-15%] w-[50vw] md:w-[40vw] max-w-[800px] z-10 pointer-events-none mix-blend-hard-light opacity-80 animate-float-left">
                         <img src="https://framerusercontent.com/images/KNhiA5A2ykNYqNkj04Hk6BVg5A.png?width=1540&height=1320" alt="Hand Reaching" className="w-full h-auto object-contain" />
                    </div>

                    {/* Floating Surrealist Right Hand (Receiving) */}
                    <div className="absolute -right-[10%] bottom-[-10%] md:right-[-5%] md:bottom-[-5%] w-[45vw] md:w-[35vw] max-w-[700px] z-10 pointer-events-none mix-blend-hard-light opacity-80 animate-float-right">
                         <img src="https://framerusercontent.com/images/X89VFCABCEjjZ4oLGa3PjbOmsA.png?width=1542&height=1002" alt="Hand Receiving" className="w-full h-auto object-contain" />
                    </div>

                    {/* Hero Content (Centered layout mapping Superdesign layout structure) */}
                    <div className="container mx-auto px-6 relative z-20 text-center flex flex-col items-center justify-center h-full max-w-5xl">
                        <div id="hero-content-wrapper" className="max-w-4xl mx-auto">
                            <motion.div 
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <h1 className="leading-[1.1] tracking-tight mb-8 text-[#ffe0e0] mix-blend-overlay font-serif" 
                                    style={{ textShadow: '0 0 12px rgba(255,255,255,0.71)' }}>
                                    <span className="text-5xl md:text-7xl lg:text-8xl block mb-4">SarkarHamariHai.</span>
                                    <span className="italic font-light text-2xl md:text-5xl lg:text-6xl text-[#ffe0e0]/90 block">Stop searching. Start preparing.</span>
                                </h1>
                            </motion.div>
                            
                            <motion.div 
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <p className="text-base md:text-lg text-[#ffe0e0]/90 max-w-2xl mx-auto mb-16 font-light tracking-wide leading-relaxed mix-blend-overlay font-sans"
                                   style={{ textShadow: '0 0 12px rgba(255,255,255,0.71)' }}>
                                    SarkarHamariHai maps your age, category, qualifications, and state parameters directly to thousands of active government exams. We track every notification and syllabus overlap, so you never miss an eligible vacancy.
                                </p>
                            </motion.div>

                            <motion.div 
                                initial={{ opacity: 0, y: 25 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                className="flex flex-col items-center gap-6"
                            >
                                <div className="relative group cursor-pointer" onClick={() => navigate('/signup')}>
                                   <div className="absolute inset-0 bg-[#FF4500]/20 blur-xl rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-500" />
                                   <div className="relative border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-3.5 rounded-full flex items-center gap-3 text-xs md:text-sm text-white/80 uppercase tracking-widest hover:bg-white/10 hover:border-white/40 transition-all duration-300 font-sans font-medium">
                                     <span>Start Preparing</span>
                                   </div>
                                </div>
                                
                                <div className="flex items-center gap-4 text-[10px] md:text-xs text-white/40 uppercase tracking-widest mt-8 font-mono">
                                   <span>{currentTime}</span>
                                   <span className="w-px h-3 bg-white/20" />
                                   <span>IN, ASIA</span>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                </section>

                {/* ── THE PROBLEM IN INDIA ── */}
                <section id="problem" className="py-32 relative border-t border-white/[0.03] bg-gradient-to-b from-[#050505] to-black">
                    <div className="container mx-auto px-6 max-w-7xl">
                        <div className="grid lg:grid-cols-12 gap-16 items-center">
                            <div className="lg:col-span-6 space-y-12">
                                <motion.div 
                                    initial={{ opacity: 0, y: 30 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.8 }}
                                >
                                    <h2 className="text-4xl md:text-6xl text-white mb-8 font-serif leading-[1.1]">
                                        The Indian Exam <br />
                                        <span className="italic font-light text-[#FF4500]">Chaotic Landscape.</span>
                                    </h2>
                                    <p className="text-lg text-gray-400 font-light leading-relaxed font-sans">
                                        Every year, millions of Indian aspirants prepare in isolation, missing crucial notification updates and failing to leverage syllabus overlaps simply because information is scattered across archaic government portals.
                                    </p>
                                </motion.div>

                                <div className="space-y-6 font-sans">
                                    {[
                                        { index: '01', title: 'Information Fragmentation', desc: 'Over 5,000+ public sector vacancy notices published annually across 50+ central and state portals with dense legalese PDFs.' },
                                        { index: '02', title: 'Missed Timelines', desc: 'Aspirants routinely discover active recruitment notifications days after application portals have officially closed.' },
                                        { index: '03', title: 'Preparation Redundancy', desc: 'Candidates study for one exam, completely unaware of other active notifications with 80%+ syllabus overlaps.' },
                                    ].map((item, idx) => (
                                        <div 
                                            key={idx}
                                            className="flex gap-6 p-6 rounded-2xl bg-white/[0.01] border border-white/5 hover:border-white/10 transition-colors duration-300"
                                        >
                                            <div className="text-[#FF4500] font-mono text-sm tracking-wide mt-0.5">{item.index}</div>
                                            <div>
                                                <h3 className="text-sm font-semibold uppercase tracking-wider text-white mb-2">{item.title}</h3>
                                                <p className="text-gray-500 text-sm font-light leading-relaxed">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Visual representation card */}
                            <div className="lg:col-span-6 hidden lg:block relative h-[600px] w-full">
                                <div className="absolute inset-0 rounded-3xl border border-white/5 bg-white/[0.01] backdrop-blur-2xl flex flex-col overflow-hidden">
                                    <div className="h-12 border-b border-white/5 flex items-center px-6 bg-black/40">
                                        <div className="flex gap-2">
                                            <div className="w-3 h-3 rounded-full bg-white/10" />
                                            <div className="w-3 h-3 rounded-full bg-white/10" />
                                            <div className="w-3 h-3 rounded-full bg-white/10" />
                                        </div>
                                    </div>
                                    <div className="flex-1 p-8 relative overflow-hidden flex flex-col justify-between">
                                        {/* Faux chaotic logs scrolling */}
                                        <div className="space-y-4 opacity-30 select-none pointer-events-none font-mono text-[10px] text-gray-500">
                                            <div>&gt; Scanning portals: upsc.gov.in, ssc.gov.in, rrb.gov.in...</div>
                                            <div>&gt; Found 82-page notification PDF: Advt No. 4/2026</div>
                                            <div>&gt; Parsing age limits, reservations, physical traits...</div>
                                            <div>&gt; Warning: Scattered state-level notifications detected.</div>
                                            <div className="text-red-500/80 font-bold">&gt; Error: Candidate unaware of 84% syllabus overlap with active SSC post.</div>
                                        </div>
                                        <div className="p-8 bg-black/80 border border-[#FF4500]/50 rounded-2xl relative z-10 text-center shadow-[0_0_50px_rgba(255,69,0,0.15)] max-w-sm mx-auto">
                                            <span className="text-[#FF4500] font-semibold uppercase tracking-widest text-xs block mb-3 font-mono">Notification Chaos</span>
                                            <span className="text-gray-300 text-sm font-light leading-relaxed font-sans block">
                                                Aspirants miss an average of 4 target notifications every year simply due to disjointed information pipelines.
                                            </span>
                                        </div>
                                        <div className="h-10" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── MISSION SECTION ("Expertise" scrolls here) ── */}
                <section id="expertise" className="py-32 relative border-t border-white/[0.03] bg-gradient-to-b from-black to-[#050505]">
                    <div className="container mx-auto px-6">
                        <motion.div 
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                            className="max-w-4xl mx-auto text-center"
                        >
                            <h2 className="text-3xl md:text-5xl lg:text-6xl leading-tight text-white/90 mb-12 font-serif">
                                Track your exam timelines and map eligibility profiles.
                            </h2>
                            <p className="text-xl md:text-2xl text-gray-500 leading-relaxed font-light font-sans">
                                Clarity is power. We remove the search and focus you on the prep. From discovery to tracker.
                            </p>
                        </motion.div>

                        {/* Logo Grid */}
                        <div className="mt-32 grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
                            <div className="font-bold text-xl tracking-widest text-white font-serif">UPSC</div>
                            <div className="font-bold text-xl tracking-widest text-white font-serif">SSC</div>
                            <div className="font-bold text-xl tracking-widest text-white font-serif">RAILWAYS</div>
                            <div className="font-bold text-xl tracking-widest text-white font-serif">BANKING</div>
                        </div>
                    </div>
                </section>

                {/* ── CARDS SECTION ("Works" scrolls here) ── */}
                <section id="works" className="py-40 relative overflow-hidden bg-black">
                    <div className="container mx-auto px-6 relative z-10">
                        <motion.div 
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.8 }}
                            className="mb-32 text-center"
                        >
                            <h2 className="text-5xl md:text-7xl font-serif">
                                Define your <br />
                                <span className="italic">career trajectory</span>
                            </h2>
                        </motion.div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                            {/* Card 1 - Red Orange */}
                            <motion.div 
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="bg-[#FF4500] rounded-3xl p-8 md:p-12 aspect-auto min-h-[380px] md:aspect-[4/5] flex flex-col justify-between shadow-2xl hover:shadow-[0_20px_50px_rgba(255,69,0,0.3)] transition-all duration-500 group cursor-pointer"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                                        <Star className="text-black w-6 h-6" />
                                    </div>
                                    <span className="text-black font-medium text-sm border border-black/20 px-3 py-1 rounded-full font-mono">01</span>
                                </div>
                                
                                <div>
                                    <h3 className="text-4xl md:text-5xl text-black mb-4 leading-none tracking-tight font-serif">
                                        Eligibility <br />Lock
                                    </h3>
                                    <p className="text-black/80 text-lg leading-snug font-light">
                                        Save your qualifications once. Our engine screens out the noise to instantly lock down exactly which vacancies you qualify for under vertical and horizontal reservation guidelines.
                                    </p>
                                </div>
                                
                                <div className="w-full h-px bg-black/10 mt-8" />
                            </motion.div>

                            {/* Card 2 - Black Legacy */}
                            <motion.div 
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.15 }}
                                className="bg-[#111] border border-white/10 rounded-3xl p-8 md:p-12 aspect-auto min-h-[380px] md:aspect-[4/5] flex flex-col justify-between shadow-2xl group cursor-pointer hover:border-[#FF4500]/50 transition-all duration-500 md:mt-12"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                       <ArrowRight className="text-white w-6 h-6 -rotate-45" />
                                    </div>
                                    <span className="text-white/50 font-medium text-sm border border-white/10 px-3 py-1 rounded-full font-mono">02</span>
                                </div>
                                
                                <div>
                                    <h3 className="text-4xl md:text-5xl text-white mb-4 leading-none tracking-tight font-serif">
                                        Syllabus <br />Overlap Finder
                                    </h3>
                                    <p className="text-gray-400 text-lg leading-snug font-light">
                                        Discover exams sharing 80%+ of the same curriculum. Master one set of topics and double your success rates by appearing for multiple aligned examinations.
                                    </p>
                                </div>
                                
                                <div className="w-full h-px bg-white/10 mt-8" />
                            </motion.div>

                            {/* Card 3 - Black Legacy 2 */}
                            <motion.div 
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8 }}
                                className="bg-[#111] border border-white/10 rounded-3xl p-8 md:p-12 aspect-auto min-h-[380px] md:aspect-[4/5] flex flex-col justify-between shadow-2xl group cursor-pointer hover:border-[#FF4500]/50 transition-all duration-500"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                       <Calendar className="text-white w-6 h-6" />
                                    </div>
                                    <span className="text-white/50 font-medium text-sm border border-white/10 px-3 py-1 rounded-full font-mono">03</span>
                                </div>
                                
                                <div>
                                    <h3 className="text-4xl md:text-5xl text-white mb-4 leading-none tracking-tight font-serif">
                                        Missed-Deadline <br />Guard
                                    </h3>
                                    <p className="text-gray-400 text-lg leading-snug font-light">
                                        Receive direct alerts and in-app notifications 14 days before registration portals close. We verify timelines daily so you never miss an application.
                                    </p>
                                </div>
                                
                                <div className="w-full h-px bg-white/10 mt-8" />
                            </motion.div>

                            {/* Card 4 - Red Orange 2 */}
                            <motion.div 
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.15 }}
                                className="bg-[#FF4500] rounded-3xl p-8 md:p-12 aspect-auto min-h-[380px] md:aspect-[4/5] flex flex-col justify-between shadow-2xl hover:shadow-[0_20px_50px_rgba(255,69,0,0.3)] transition-all duration-500 group cursor-pointer md:mt-12"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="w-12 h-12 rounded-full bg-black/10 flex items-center justify-center group-hover:rotate-45 transition-transform duration-500">
                                        <BookOpen className="text-black w-6 h-6" />
                                    </div>
                                    <span className="text-black font-medium text-sm border border-black/20 px-3 py-1 rounded-full font-mono">04</span>
                                </div>
                                
                                <div>
                                    <h3 className="text-4xl md:text-5xl text-black mb-4 leading-none tracking-tight font-serif">
                                        Timeline <br />Roadmaps
                                    </h3>
                                    <p className="text-black/80 text-lg leading-snug font-light">
                                        Chronological roadmaps guiding you step-by-step from notification release to application deadlines, exam phases, and document verification.
                                    </p>
                                </div>
                                
                                <div className="w-full h-px bg-black/10 mt-8" />
                            </motion.div>
                        </div>
                    </div>
                    
                    {/* Background Pattern */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] opacity-10 pointer-events-none z-0"
                         style={{ backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </section>

                {/* ── APP PREVIEW SECTION ("Solutions" scrolls here) ── */}
                <section id="solutions" className="py-32 relative border-t border-white/[0.03] bg-[#030303] overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6 text-center">
                         <div className="mb-16">
                             <h2 className="text-3xl sm:text-5xl font-medium tracking-tight mb-4 text-white font-serif">Your Command Center</h2>
                             <p className="text-base text-gray-400 font-light max-w-2xl mx-auto">An illustrative preview of the candidate dashboard, showing compatibility scores calculated dynamically based on real-time syllabus similarity parameters.</p>
                         </div>
                         <motion.div 
                            initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }}
                            transition={{ duration: 0.8 }}
                            className="relative max-w-5xl mx-auto"
                        >
                            <div className="absolute -inset-10 bg-gradient-to-r from-[#FF4500]/10 to-[#ff733b]/10 blur-[100px] opacity-50" />
                            <div className="relative border border-white/[0.08] bg-[#0a0a0a] shadow-2xl overflow-hidden rounded-3xl">
                                <div className="h-10 border-b border-white/[0.05] bg-[#0f0f0f] flex items-center px-4 gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                    <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                                </div>
                                <div className="p-8 flex flex-col lg:flex-row gap-6 relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/[0.02] to-transparent">
                                    {/* Dashboard Mockup */}
                                    <div className="w-full lg:w-1/3 space-y-4 text-left">
                                        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-3 font-medium font-mono">Readiness Score</div>
                                            <div className="flex items-end gap-2"><span className="text-4xl font-normal text-[#FF4500] tracking-tighter">84</span><span className="text-gray-600 text-xs mb-1 font-mono">/ 100</span></div>
                                        </div>
                                        <div className="bg-white/[0.02] rounded-2xl p-5 border border-white/5">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-5 font-medium font-mono">Syllabus Match</div>
                                            <div className="space-y-4 font-mono">
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">SSC CGL</span><span className="text-[#FF4500]">92%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-[#FF4500] w-[92%]" /></div></div>
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">RRB NTPC</span><span className="text-[#FF4500]">78%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-[#FF4500] w-[78%]" /></div></div>
                                                <div><div className="flex justify-between text-[10px] mb-1.5"><span className="text-gray-300">IBPS PO</span><span className="text-gray-500">45%</span></div><div className="h-0.5 bg-white/10"><div className="h-full bg-gray-600 w-[45%]" /></div></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex-1 space-y-4 text-left font-mono">
                                        <div className="flex gap-4 border-b border-white/[0.05] pb-2">
                                            <div className="text-xs text-white font-medium pb-2 border-b border-[#FF4500] translate-y-[9px]">Live Exams (3)</div>
                                            <div className="text-xs text-gray-600 font-normal pb-2">Upcoming</div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            {[
                                                { title: "UPSC Civil Services", code: "UPSC-26" },
                                                { title: "SSC CGL Exam", code: "SSC-CGL" },
                                                { title: "Railway RRB NTPC", code: "RRB-NTPC" },
                                                { title: "IBPS Clerk Vacancy", code: "IBPS-26" }
                                            ].map((job, idx) => (
                                                <div key={idx} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-[#FF4500]/30 transition-colors">
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="w-6 h-6 bg-white/10 rounded-sm flex items-center justify-center text-[10px] text-gray-300">★</div>
                                                        <span className="text-[9px] text-green-500 border border-green-500/30 bg-green-500/10 px-2 py-0.5 uppercase tracking-wide">Live</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-white font-medium mb-2 truncate">{job.title}</div>
                                                        <div className="text-[10px] text-gray-600">{job.code}</div>
                                                    </div>
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

                {/* ── FAQ SECTION ("Perspectives" scrolls here) ── */}
                <section id="faq" className="py-32 relative border-t border-white/[0.03] bg-black">
                    <div className="max-w-4xl mx-auto px-6">
                        <div className="text-center mb-16">
                            <h2 className="text-3xl sm:text-5xl font-medium tracking-tight mb-4 text-white font-serif">Frequently Asked Questions</h2>
                            <p className="text-base text-gray-400 font-light">Answers to everything you need to know about the SarkarHamariHai ecosystem.</p>
                        </div>
                        
                        <div className="space-y-4">
                            {[
                                {
                                    q: "How does the Eligibility Lock feature identify which vacancies match my background?",
                                    a: "The Eligibility Lock checks your profile inputs (such as qualifications, reservation category, state, and age) against the active guidelines of each job vacancy. It automatically accounts for state and central criteria relaxations, immediately sorting the listings to show you only the exams you are eligible to sit for."
                                },
                                {
                                    q: "How does the Syllabus Overlap Finder help me target multiple exams?",
                                    a: "The overlap tool evaluates the syllabus topics of different exams side-by-side. If you are preparing for a primary exam, it calculates the subject overlap with other active jobs. High similarity means you can appear for those exams with minimal extra preparation."
                                },
                                {
                                    q: "How does the app ensure its vacancy listings stay up to date?",
                                    a: "Our vacancy system updates directly from official state and central recruitment boards daily. It checks for date extensions, syllabus changes, or post corrections, ensuring your dashboard shows live updates before application windows close."
                                },
                                {
                                    q: "How is the vacancy information verified for accuracy?",
                                    a: "Before any vacancy listing appears on your dashboard, it goes through a multi-stage validation check. We confirm crucial details like fee structures, physical requirements, active links, and dates, preventing errors before you start the application process."
                                }
                            ].map((item, index) => {
                                const isOpen = faqOpen === index;
                                return (
                                    <div key={index} className="border border-white/[0.05] bg-white/[0.01] rounded-3xl overflow-hidden backdrop-blur-sm transition-all duration-300">
                                        <button 
                                            onClick={() => setFaqOpen(isOpen ? null : index)}
                                            className="w-full px-8 py-6 text-left flex justify-between items-center gap-4 text-white hover:bg-white/[0.02] transition-colors"
                                        >
                                            <span className="text-xs uppercase tracking-widest text-left font-medium">{item.q}</span>
                                            <span className="text-[#FF4500] font-light text-2xl transition-transform duration-300" style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
                                        </button>
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: isOpen ? 'auto' : 0, opacity: isOpen ? 1 : 0 }}
                                            transition={{ duration: 0.3, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-8 pb-6 text-sm text-gray-400 leading-relaxed font-light text-left">
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
                         <div className="w-[80vw] h-[80vw] lg:w-[40vw] lg:h-[40vw] border-[1px] border-[#FF4500]/10 rounded-full flex items-center justify-center">
                            <div className="w-[75%] h-[75%] border-[1px] border-[#FF4500]/10 rounded-full flex items-center justify-center">
                                <div className="w-[60%] h-[60%] border-[1px] border-[#FF4500]/10 rounded-full" />
                            </div>
                         </div>
                    </div>

                    <div className="max-w-4xl mx-auto px-6 relative z-10">
                        <motion.h2 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                            className="text-4xl sm:text-6xl font-normal tracking-tight mb-6 font-serif"
                        >
                            Take Control.
                        </motion.h2>
                        <motion.p 
                            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
                            className="text-lg text-gray-400 mb-12 font-light max-w-xl mx-auto"
                        >
                            Join thousands of aspirants who have automated their exam discovery and focused entirely on preparation.
                        </motion.p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button 
                                onClick={() => navigate('/signup')}
                                className="px-10 py-4 bg-[#FF4500] hover:bg-[#ff5714] text-white font-semibold text-[15px] rounded-full shadow-lg hover:shadow-[0_10px_30px_rgba(255,69,0,0.4)] hover:-translate-y-0.5 active:scale-95 transition-all duration-300 ease-out uppercase tracking-wider"
                            >
                                Start Free
                            </button>
                             <button 
                                onClick={() => navigate('/login')}
                                className="px-10 py-4 bg-white/5 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white font-semibold text-[13px] uppercase tracking-wide transition-all rounded-full active:scale-95"
                            >
                                Log In
                            </button>
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </div>
    );
}
