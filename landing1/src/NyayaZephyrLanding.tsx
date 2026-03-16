import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Github, Scale, Gavel, History, FileText, Database, Cpu, Search, Upload, Zap, Shield, Globe, Send, CheckCircle2, X } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

// Tetris Background Component
const TetrisBackground = () => {
  const blocks = useMemo(() => {
    return Array.from({ length: 25 }, (_, i) => ({
      id: i,
      top: `${Math.random() * 100}%`,
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 10}s`,
      duration: `${20 + Math.random() * 20}s`,
      size: 20 + Math.random() * 40,
      opacity: 0.03 + Math.random() * 0.05,
      rotation: Math.random() * 360
    }));
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute animate-float"
          style={{
            top: block.top,
            left: block.left,
            animationDelay: block.delay,
            animationDuration: block.duration,
          }}
        >
          <div
            className="bg-[#f97316]"
            style={{
              width: block.size,
              height: block.size,
              opacity: block.opacity,
              transform: `rotate(${block.rotation}deg)`,
            }}
          />
        </div>
      ))}
    </div>
  );
};

// Navbar Component
const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navClass = scrolled
    ? "fixed top-0 left-0 right-0 z-50 bg-[#f5f1e8]/95 backdrop-blur-md border-b border-[#d4b896]/50 py-3 shadow-lg transition-all duration-300"
    : "fixed top-0 left-0 right-0 z-50 bg-[#f5f1e8]/90 backdrop-blur-md border-b border-[#d4b896]/30 py-4 shadow-sm transition-all duration-300";

  return (
    <nav className={navClass}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer group">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1a1a1a] to-[#8b7355] rounded-sm flex items-center justify-center text-[#f97316] font-serif font-black text-2xl shadow-lg group-hover:shadow-xl transition-shadow">
            N
          </div>
          <span className="text-2xl font-serif font-black tracking-tight text-[#1a1a1a] uppercase">
            NYAYAZEPHYR
          </span>
        </div>

        <div className="hidden md:flex items-center gap-10">
          <a href="#" className="text-xs uppercase tracking-[0.2em] font-bold text-[#8b7355] hover:text-[#1a1a1a] transition-colors">Solutions</a>
          <a href="#architecture-section" className="text-xs uppercase tracking-[0.2em] font-bold text-[#8b7355] hover:text-[#1a1a1a] transition-colors">Architecture</a>
          <a href="#infrastructure-section" className="text-xs uppercase tracking-[0.2em] font-bold text-[#8b7355] hover:text-[#1a1a1a] transition-colors">Infrastructure</a>
          <a href="https://github.com/eventzeroday/Zephyr" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] font-bold text-[#8b7355] hover:text-[#1a1a1a] transition-colors">
            <Github size={14} />
            Github
          </a>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="px-6 py-2.5 text-xs font-black uppercase tracking-[0.15em] bg-[#1a1a1a] text-[#f97316] hover:bg-[#2a2a2a] transition-all shadow-lg border border-[#f97316]/20">
          Get Started
        </button>
      </div>
    </nav>
  );
};

// Hero Section Component
const Hero = () => {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-24 min-h-screen flex items-center" style={{
      backgroundImage: 'linear-gradient(rgba(139, 115, 85, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 115, 85, 0.05) 1px, transparent 1px)',
      backgroundSize: '40px 40px'
    }}>
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="text-left">
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-white/50 backdrop-blur-md border border-[#d4b896] mb-12 shadow-sm animate-bounce-slow">
              <span className="flex h-2 w-2 rounded-full bg-[#1a1a1a]"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b7355]">
                The New Standard in Nyaya
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl font-serif font-black text-[#1a1a1a] mb-10 leading-[0.85] tracking-tighter uppercase">
              Breeze Through <br />
              <span className="text-[#f97316] italic">Research.</span>
            </h1>

            <p className="text-xl text-[#8b7355] mb-14 max-w-lg leading-relaxed font-medium">
              Find precedents and analyze complex legal documents in seconds.
              Simplified legal intelligence for the modern professional.
            </p>

            <div className="inline-flex p-1.5 border border-[#d4b896]/60 bg-white/10 backdrop-blur-sm shadow-sm">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-6">
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-12 py-6 bg-[#f97316] text-white font-black uppercase tracking-[0.3em] text-sm hover:bg-[#ea580c] transition-all shadow-2xl active:scale-95 group border border-[#f97316]/20"
                >
                  Start Research
                  <ArrowRight className="inline ml-3 group-hover:translate-x-1 transition-transform" />
                </button>
                <a
                  href="https://github.com/eventzeroday/Zephyr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-12 py-6 bg-transparent border-2 border-[#1a1a1a] text-[#1a1a1a] font-black uppercase tracking-[0.3em] text-sm hover:bg-[#1a1a1a] hover:text-[#f97316] transition-all shadow-2xl active:scale-95 flex items-center justify-center gap-3"
                >
                  <Github size={18} />
                  View Source
                </a>
              </div>
            </div>

            <div className="mt-20 flex flex-wrap items-center gap-12 opacity-40 text-black">
              <div className="flex items-center gap-2 font-serif font-bold text-xl italic">
                <Scale size={26} /> Justice
              </div>
              <div className="flex items-center gap-2 font-serif font-bold text-xl italic">
                <Gavel size={26} /> Precedent
              </div>
              <div className="flex items-center gap-2 font-serif font-bold text-xl italic">
                <History size={26} /> Heritage
              </div>
            </div>
          </div>

          <div className="relative lg:block hidden animate-float-image">
            <div className="absolute -top-12 -right-12 w-full h-full bg-[#f97316]/10 rounded-xl transform rotate-3"></div>
            <div className="absolute -bottom-12 -left-12 w-full h-full bg-[#1a1a1a]/5 rounded-xl transform -rotate-2"></div>
            <div className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white">
              <img
                src="https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&q=80&w=1200"
                alt="NyayaZephyr Core"
                className="w-full h-[650px] object-cover grayscale hover:grayscale-0 transition-all duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
              <div className="absolute bottom-10 left-10 text-white">
                <div className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">
                  NyayaZephyr Core Engine
                </div>
                <div className="text-3xl font-serif font-black italic">
                  Modern Jurisprudence Powered by AI.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Architecture Grid Component - Orchestrated Intelligence with Auto-Animation
const ArchitectureGrid = () => {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [latency, setLatency] = useState(38);
  const [isAnimating, setIsAnimating] = useState(true);

  // Architecture flow: the order in which boxes highlight
  const flowSequence = [1, 2, 3, 4, 5, 6]; // PYMUPDF → CHUNKING → MPNET → PINECONE → GROQ → SQLITE

  // Connections between boxes (from → to)
  const connections = [
    { from: 1, to: 2, direction: 'right' },
    { from: 2, to: 3, direction: 'right' },
    { from: 3, to: 4, direction: 'down' },
    { from: 4, to: 5, direction: 'right' },
    { from: 5, to: 6, direction: 'right' },
  ];

  // Auto-cycle through the architecture flow
  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % flowSequence.length);
    }, 1500);

    return () => clearInterval(interval);
  }, [isAnimating]);

  // Simulate latency updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(Math.floor(35 + Math.random() * 15));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const boxes = [
    { id: 1, icon: Upload, label: 'PYMUPDF ENGINE', description: 'Complex PDF Layout Parsing', row: 1, col: 1 },
    { id: 2, icon: FileText, label: 'ADAPTIVE CHUNKING', description: 'Context-Aware Fragmentation', row: 1, col: 2 },
    { id: 3, icon: Search, label: 'HF-MPNET-V2', description: '768-dim Vector Embeddings', row: 1, col: 3 },
    { id: 4, icon: Database, label: 'PINECONE STORE', description: 'MMR Similarity Search (k=10)', row: 2, col: 1 },
    { id: 5, icon: Cpu, label: 'GROQLLAMA 3.3', description: '70B Variable Generation', row: 2, col: 2 },
    { id: 6, icon: Shield, label: 'SQLITE PERSISTENCE', description: 'Metadata & Session Memory', row: 2, col: 3 },
  ];

  const currentActiveId = flowSequence[activeStep];
  const nextActiveId = flowSequence[(activeStep + 1) % flowSequence.length];

  // Find the active connection (arrow to show)
  const activeConnection = connections.find(c => c.from === currentActiveId && c.to === nextActiveId);

  // Render a single architecture box
  const renderBox = (box: typeof boxes[0], _index: number, showArrow: boolean) => {
    const Icon = box.icon;
    const isActive = currentActiveId === box.id;
    const isPast = flowSequence.indexOf(box.id) < activeStep;

    return (
      <div key={box.id} className="relative">
        <div
          className={`relative p-5 rounded-xl transition-all duration-500 ${isActive
            ? 'bg-[#f5f1e8] border-2 border-[#f97316] shadow-lg scale-[1.03] ring-2 ring-[#f97316]/20'
            : isPast
              ? 'bg-[#f5f1e8] border border-[#f97316]/50'
              : 'bg-[#e8e4db] border border-[#d4b896]/40'
            }`}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-all duration-300 ${isActive ? 'bg-[#f97316]/30' : isPast ? 'bg-[#f97316]/15' : 'bg-[#d4b896]/30'
            }`}>
            <Icon size={20} className={isActive || isPast ? 'text-[#f97316]' : 'text-[#6b5c45]'} />
          </div>
          <h4 className={`text-[11px] font-black uppercase tracking-[0.1em] mb-1.5 transition-colors duration-300 ${isActive ? 'text-[#1a1a1a]' : isPast ? 'text-[#2d2d2d]' : 'text-[#3a3a3a]'
            }`}>
            {box.label}
          </h4>
          <p className={`text-[10px] leading-relaxed font-medium ${isActive ? 'text-[#4a4a4a]' : 'text-[#5a5a5a]'
            }`}>
            {box.description}
          </p>

          {/* Active indicator pulse */}
          {isActive && (
            <div className="absolute -top-1 -right-1 w-3 h-3">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#f97316] opacity-75 animate-ping"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#f97316]"></span>
            </div>
          )}
        </div>

        {/* Horizontal Arrow to next box */}
        {showArrow && (
          <div className={`absolute top-1/2 -right-3 transform -translate-y-1/2 z-10 transition-all duration-300 ${activeConnection?.from === box.id && activeConnection?.direction === 'right'
            ? 'opacity-100 scale-110'
            : 'opacity-30 scale-100'
            }`}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12H19M19 12L13 6M19 12L13 18"
                stroke={activeConnection?.from === box.id ? '#f97316' : '#8b7355'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={activeConnection?.from === box.id ? 'animate-pulse' : ''}
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="bg-[#f5f1e8] rounded-2xl p-6 border border-[#d4b896]/30 shadow-xl"
      onMouseEnter={() => setIsAnimating(false)}
      onMouseLeave={() => setIsAnimating(true)}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-2 h-2 rounded-full bg-[#f97316] animate-pulse"></div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5a5040]">
          System Architecture
        </span>
      </div>

      {/* Grid of boxes with arrows */}
      <div className="relative">
        {/* Row 1 */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {boxes.filter(b => b.row === 1).map((box, index) => renderBox(box, index, index < 2))}
        </div>

        {/* Vertical Arrow from row 1 to row 2 (box 3 to box 4) */}
        <div className={`flex justify-start pl-[16.67%] mb-3 transition-all duration-300 ${activeConnection?.from === 3 && activeConnection?.to === 4
          ? 'opacity-100'
          : 'opacity-30'
          }`}>
          <div className="flex flex-col items-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className={activeConnection?.from === 3 ? 'animate-bounce' : ''}>
              <path
                d="M12 5V19M12 19L6 13M12 19L18 13"
                stroke={activeConnection?.from === 3 ? '#f97316' : '#8b7355'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {boxes.filter(b => b.row === 2).map((box, index) => renderBox(box, index, index < 2))}
        </div>
      </div>

      {/* Live Status Bar */}
      <div className="bg-[#e8e4db] rounded-xl p-4 border border-[#d4b896]/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#4a4a4a]">
              Live Architecture Status
            </span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-[11px] text-[#5a5a5a] font-medium">Embedding Latency</span>
            <span className="text-[12px] font-black text-[#1a1a1a]">{latency}ms (CUDA Optimized)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Feature Item Component
interface FeatureItemProps {
  icon: React.ElementType;
  title: string;
  titleHighlight?: string;
  description: React.ReactNode;
}

const FeatureItem = ({ icon: Icon, title, titleHighlight, description }: FeatureItemProps) => (
  <div className="flex items-start gap-5 group">
    <div className="w-12 h-12 rounded-lg bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 group-hover:bg-[#f97316]/20 transition-colors">
      <Icon size={20} className="text-[#f97316]" />
    </div>
    <div>
      <h4 className="text-lg font-serif font-bold text-[#f97316] mb-2">
        {title}
        {titleHighlight && <span className="text-white"> {titleHighlight}</span>}
      </h4>
      <p className="text-sm text-white/50 leading-relaxed">
        {description}
      </p>
    </div>
  </div>
);

// Sandbox Preview Component
const SandboxPreview = () => {
  const [messages] = useState([
    { role: 'user', content: 'What are the key precedents for breach of contract in India?' },
    { role: 'assistant', content: 'Based on the Indian Contract Act, 1872, key precedents include:\n\n1. **Hadley v Baxendale** - Established remoteness of damages\n2. **Mohori Bibee v Dharmodas Ghose** - Minor\'s agreement void ab initio\n3. **Carlill v Carbolic Smoke Ball Co** - Unilateral contracts and acceptance by performance' }
  ]);
  const [inputValue, setInputValue] = useState('');

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl border border-[#f97316]/20">
        <div className="bg-[#2a2a2a] px-6 py-4 flex items-center justify-between border-b border-[#f97316]/10">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-[#f97316]/50">
            NyayaZephyr Terminal
          </span>
          <div className="w-16"></div>
        </div>

        <div className="p-6 h-[350px] overflow-y-auto custom-scrollbar">
          {messages.map((msg, i) => (
            <div key={i} className={`mb-6 ${msg.role === 'user' ? 'text-right' : ''}`}>
              <div className={`inline-block max-w-[85%] px-5 py-4 rounded-xl ${msg.role === 'user' ? 'bg-[#f97316]/20 text-[#f97316]' : 'bg-[#2a2a2a] text-white/80'}`}>
                <div className="text-[10px] font-bold uppercase tracking-wider mb-2 opacity-50">
                  {msg.role === 'user' ? 'You' : 'NyayaZephyr'}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-[#f97316]/10">
          <div className="flex items-center gap-3 bg-[#2a2a2a] rounded-lg px-4 py-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about Indian legal precedents..."
              className="flex-1 bg-transparent text-white/80 text-sm placeholder-white/30 outline-none"
            />
            <button className="p-2 bg-[#f97316] rounded-lg hover:bg-[#f97316]/80 transition-colors">
              <Send size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Infrastructure Section Component
const InfrastructureSection = () => {
  const features = [
    { icon: Zap, title: 'Real-time Processing', description: 'Instant document analysis with streaming responses' },
    { icon: Shield, title: 'Enterprise Security', description: 'End-to-end encryption and secure data handling' },
    { icon: Globe, title: 'Multi-jurisdiction', description: 'Support for Indian and international legal systems' },
    { icon: Database, title: 'Vector Database', description: 'Pinecone-powered semantic search capabilities' },
  ];

  return (
    <section id="infrastructure-section" className="py-32 bg-[#1a1a1a] relative overflow-hidden">
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(249, 115, 22, 0.1) 1px, transparent 0)',
        backgroundSize: '40px 40px'
      }} />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="text-center mb-20">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#f97316]/60 mb-4 block">
            Enterprise Infrastructure
          </span>
          <h2 className="text-5xl md:text-6xl font-serif font-black text-white mb-6 uppercase tracking-tight">
            Built for <span className="text-[#f97316] italic">Scale</span>
          </h2>
          <p className="text-lg text-white/50 max-w-2xl mx-auto">
            Production-ready architecture designed to handle the demands of modern legal practice
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div key={i} className="group p-8 bg-[#2a2a2a]/50 border border-[#f97316]/10 hover:border-[#f97316]/30 transition-all duration-300 hover:-translate-y-1">
                <div className="w-14 h-14 bg-[#f97316]/10 rounded-lg flex items-center justify-center mb-6 group-hover:bg-[#f97316]/20 transition-colors">
                  <Icon size={28} className="text-[#f97316]" />
                </div>
                <h3 className="text-lg font-bold text-white mb-3 uppercase tracking-wide">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// Sandbox Section Component
const SandboxSection = () => {
  return (
    <section id="sandbox-section" className="py-32 bg-[#f5f1e8] relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b7355] mb-4 block">
            Interactive Demo
          </span>
          <h2 className="text-5xl md:text-6xl font-serif font-black text-[#1a1a1a] mb-6 uppercase tracking-tight">
            Try the <span className="text-[#f97316] italic">Sandbox</span>
          </h2>
          <p className="text-lg text-[#8b7355] max-w-2xl mx-auto">
            Experience NyayaZephyr's capabilities with our interactive preview
          </p>
        </div>

        <SandboxPreview />
      </div>
    </section>
  );
};

// Newsletter Section Component
const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    // Trigger celebration
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f97316', '#1a1a1a', '#8b7355', '#ffffff']
    });

    setShowPopup(true);
    setEmail('');
  };

  return (
    <section className="py-24 bg-gradient-to-br from-[#f97316]/10 to-[#d4b896]/20 relative">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#8b7355] mb-4 block">
          Stay Updated
        </span>
        <h2 className="text-4xl md:text-5xl font-serif font-black text-[#1a1a1a] mb-6 uppercase tracking-tight">
          Join the <span className="text-[#f97316] italic">Revolution</span>
        </h2>
        <p className="text-lg text-[#8b7355] mb-10 max-w-xl mx-auto">
          Get early access to new features, legal AI insights, and exclusive updates
        </p>

        <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full px-6 py-4 bg-white border-2 border-[#d4b896] text-[#1a1a1a] placeholder-[#8b7355]/50 focus:outline-none focus:border-[#f97316] transition-colors"
            required
          />
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-4 bg-[#f97316] text-white font-black uppercase tracking-[0.2em] text-sm hover:bg-[#ea580c] transition-all whitespace-nowrap"
          >
            Subscribe
          </button>
        </form>
      </div>

      {/* Success Popup */}
      <AnimatePresence>
        {showPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#1a1a1a]/40 backdrop-blur-sm pointer-events-auto"
              onClick={() => setShowPopup(false)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-[#f5f1e8] border-2 border-[#f97316] p-8 shadow-[0_20px_50px_rgba(249,115,22,0.3)] pointer-events-auto"
            >
              <button
                onClick={() => setShowPopup(false)}
                className="absolute top-4 right-4 text-[#8b7355] hover:text-[#f97316] transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#f97316]/10 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 size={32} className="text-[#f97316]" />
                </div>

                <h3 className="text-2xl font-serif font-black text-[#1a1a1a] uppercase mb-4 tracking-tight">
                  You're <span className="text-[#f97316] italic">In!</span>
                </h3>

                <p className="text-[#8b7355] font-medium leading-relaxed mb-8">
                  Thank you for subscribing! <br />
                  Keep an eye on <span className="text-[#1a1a1a] font-bold">your mailbox</span> for the latest in AI Law.
                </p>

                <button
                  onClick={() => setShowPopup(false)}
                  className="w-full py-4 bg-[#1a1a1a] text-white font-black uppercase tracking-[0.2em] text-sm hover:bg-[#2a2a2a] transition-all shadow-lg"
                >
                  Close
                </button>
              </div>

              {/* Decorative side bar */}
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#f97316]"></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

// Footer Component
const Footer = () => {
  return (
    <footer className="bg-[#1a1a1a] text-white py-16 relative">
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-white rounded-md flex items-center justify-center text-[#1a1a1a] font-serif font-black text-3xl">
                N
              </div>
              <span className="text-2xl font-serif font-black text-white uppercase">
                NYAYAZEPHYR
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm">
              Revolutionizing legal research with AI-powered intelligence. Built for the modern legal professional.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-[#f97316] mb-6">
              Product
            </h4>
            <ul className="space-y-3">
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">API</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-[#f97316] mb-6">
              Connect
            </h4>
            <ul className="space-y-3">
              <li><a href="https://github.com/eventzeroday/Zephyr" target="_blank" rel="noopener noreferrer" className="text-sm text-white/50 hover:text-white transition-colors flex items-center gap-2"><Github size={14} /> GitHub</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Twitter</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">LinkedIn</a></li>
              <li><a href="#" className="text-sm text-white/50 hover:text-white transition-colors">Contact</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-[11px] font-black uppercase tracking-[0.4em] text-white/30">
            © 2025 NyayaZephyr Intelligence Systems
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="text-[10px] uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors">Privacy</a>
            <a href="#" className="text-[10px] uppercase tracking-wider text-white/30 hover:text-white/60 transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

// Main Landing Page Component
export default function NyayaZephyrLanding() {
  return (
    <div className="min-h-screen bg-[#f5f1e8] relative" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <TetrisBackground />
      <Navbar />
      <Hero />

      {/* Architecture Section - Orchestrated Intelligence */}
      <section id="architecture-section" className="py-32 bg-[#1a1a1a] relative overflow-hidden">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(249, 115, 22, 0.05) 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Side - Text Content */}
            <div>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-[#f97316]/60 mb-6 block">
                Internal Architecture
              </span>
              <h2 className="text-5xl md:text-6xl font-serif font-black text-white mb-4 uppercase tracking-tight leading-[0.9]">
                ORCHESTRATED<br />
                <span className="text-[#f97316] italic">INTELLIGENCE.</span>
              </h2>
              <p className="text-base text-white/50 mb-12 max-w-lg leading-relaxed">
                Our backend leverages a high-performance stack running{' '}
                <a href="#" className="text-[#f97316] underline hover:text-[#f97316]/80 transition-colors">FastAPI</a>
                {' '}for sub-second retrieval.
              </p>

              <div className="space-y-8">
                <FeatureItem
                  icon={FileText}
                  title="PyMuPDF"
                  titleHighlight="Contextual Engine"
                  description={
                    <>
                      Adaptive chunking strategies ensure legal formatting and citation hierarchies remain intact.
                    </>
                  }
                />

                <FeatureItem
                  icon={Database}
                  title="Pinecone"
                  titleHighlight="Vector Storage"
                  description={
                    <>
                      Similarity search provides diverse context assembly, reducing LLM hallucinations through precision grounding.
                    </>
                  }
                />

                <FeatureItem
                  icon={Zap}
                  title="Llama 3.3"
                  titleHighlight="LPU Acceleration"
                  description={
                    <>
                      Groq API delivers 70B parameter reasoning at{' '}
                      <span className="text-[#f97316]">real-time</span> speeds for sub-second synthesis.
                    </>
                  }
                />
              </div>
            </div>

            {/* Right Side - Architecture Grid */}
            <div>
              <ArchitectureGrid />
            </div>
          </div>
        </div>
      </section>

      <InfrastructureSection />
      <SandboxSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
