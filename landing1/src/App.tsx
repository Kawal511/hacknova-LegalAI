"use client";

import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import ClientsPage from "./ClientsPage";
import LegalResearcherPage from "./LegalResearcherPage";
import AdminDashboard from "./AdminDashboard";
import { LanguageProvider, useLanguage } from "./LanguageContext";
import { LanguageSelector } from "./LanguageSelector";
import { getUserCases, type CaseDetails } from "./api/legalResearcher";
import { useTheme, getThemeColors } from "./ThemeContext";
import { UserButton } from "@clerk/clerk-react";

const HAS_CLERK_KEY = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

interface Block {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  delay: number;
}

function generateRandomBlocks(count: number = 15): Block[] {
  const blocks: Block[] = [];
  const gridSize = 40;

  for (let i = 0; i < count; i++) {
    blocks.push({
      id: i,
      x: Math.floor(Math.random() * 100),
      y: Math.floor(Math.random() * 100),
      width: [gridSize * 2, gridSize * 3, gridSize * 4][Math.floor(Math.random() * 3)],
      height: [gridSize * 2, gridSize * 3, gridSize * 4][Math.floor(Math.random() * 3)],
      rotation: [0, 90, 180, 270][Math.floor(Math.random() * 4)],
      delay: Math.random() * 0.5,
    });
  }

  return blocks;
}

// 26 Company logos using actual icon images
const companies = [
  { name: "Apache", logo: "/icons/apache.png" },
  { name: "Apache JMeter", logo: "/icons/apachejmeter.png" },
  { name: "Apple", logo: "/icons/apple.png" },
  { name: "Apple Pay", logo: "/icons/applepay.png" },
  { name: "Apple TV", logo: "/icons/appletv.png" },
  { name: "BookMyShow", logo: "/icons/bookmyshow.png" },
  { name: "Deliveroo", logo: "/icons/deliveroo.png" },
  { name: "Evernote", logo: "/icons/evernote.png" },
  { name: "Every.org", logo: "/icons/everydotorg.png" },
  { name: "Fortran", logo: "/icons/fortran.png" },
  { name: "Git", logo: "/icons/git.png" },
  { name: "GitHub", logo: "/icons/github.png" },
  { name: "GitLab", logo: "/icons/gitlab.png" },
  { name: "Google Colab", logo: "/icons/googlecolab.png" },
  { name: "Google Gemini", logo: "/icons/googlegemini.png" },
  { name: "Google Lens", logo: "/icons/googlelens.png" },
  { name: "Google Pay", logo: "/icons/googlepay.png" },
  { name: "Google Photos", logo: "/icons/googlephotos.png" },
  { name: "Google Street View", logo: "/icons/googlestreetview.png" },
  { name: "Kingston", logo: "/icons/kingstontechnology.png" },
  { name: "Mazda", logo: "/icons/mazda.png" },
  { name: "MediaMarkt", logo: "/icons/mediamarkt.png" },
  { name: "Ollama", logo: "/icons/ollama.png" },
  { name: "Snowflake", logo: "/icons/snowflake.png" },
  { name: "TestRail", logo: "/icons/testrail.png" },
  { name: "Vercel", logo: "/icons/vercel.png" },
];

// Featured testimonial (SAP) - main colored box
const featuredTestimonial = {
  company: "SAP",
  logo: "/icons/apache.png",
  quote: "SAP continues to expand its partnership with Sample AI to broaden customer choice.",
  category: "Technology and Software",
};

// All company cards data for bento grid
const companyCards = [
  { name: "Apache", logo: "/icons/apache.png", description: "Apache leverages Sample AI to support due diligence and deal analysis workflows.", category: "Technology and Software" },
  { name: "Apache JMeter", logo: "/icons/apachejmeter.png", description: "Apache JMeter revolutionizes the future of performance testing with AI.", category: "Technology and Software" },
  { name: "Apple", logo: "/icons/apple.png", description: "Apple enhances customer experience with multilingual AI-powered solutions.", category: "Technology and Software" },
  { name: "Apple Pay", logo: "/icons/applepay.png", description: "Apple Pay unlocks advanced AI-driven insights for payment processing.", category: "Financial services" },
  { name: "Apple TV", logo: "/icons/appletv.png", description: "Apple TV leverages Sample AI for personalized content recommendations.", category: "Entertainment" },
  { name: "BookMyShow", logo: "/icons/bookmyshow.png", description: "BookMyShow accelerates ticket booking with AI-powered recommendations.", category: "Entertainment" },
  { name: "Deliveroo", logo: "/icons/deliveroo.png", description: "Deliveroo optimizes delivery routes with Sample AI integration.", category: "Food & Delivery" },
  { name: "Evernote", logo: "/icons/evernote.png", description: "Evernote enhances note-taking with AI-powered organization.", category: "Technology and Software" },
  { name: "Every.org", logo: "/icons/everydotorg.png", description: "Every.org streamlines charitable giving with intelligent matching.", category: "Non-profit" },
  { name: "Fortran", logo: "/icons/fortran.png", description: "Fortran modernizes legacy systems with AI-assisted code optimization.", category: "Technology and Software" },
  { name: "Git", logo: "/icons/git.png", description: "Git integrates Sample AI for smarter version control workflows.", category: "Technology and Software" },
  { name: "GitHub", logo: "/icons/github.png", description: "GitHub leverages Sample AI to enhance developer productivity.", category: "Technology and Software" },
  { name: "GitLab", logo: "/icons/gitlab.png", description: "GitLab accelerates CI/CD pipelines with AI-powered automation.", category: "Technology and Software" },
  { name: "Google Colab", logo: "/icons/googlecolab.png", description: "Google Colab enhances notebook experiences with Sample AI.", category: "Technology and Software" },
  { name: "Google Gemini", logo: "/icons/googlegemini.png", description: "Google Gemini partners with Sample for advanced AI research.", category: "Technology and Software" },
  { name: "Google Lens", logo: "/icons/googlelens.png", description: "Google Lens improves visual search with Sample AI technology.", category: "Technology and Software" },
  { name: "Google Pay", logo: "/icons/googlepay.png", description: "Google Pay secures transactions with AI-powered fraud detection.", category: "Financial services" },
  { name: "Google Photos", logo: "/icons/googlephotos.png", description: "Google Photos enhances image organization with intelligent tagging.", category: "Technology and Software" },
  { name: "Google Street View", logo: "/icons/googlestreetview.png", description: "Google Street View improves mapping accuracy with AI analysis.", category: "Technology and Software" },
  { name: "Kingston", logo: "/icons/kingstontechnology.png", description: "Kingston Technology optimizes storage solutions with AI insights.", category: "Hardware" },
  { name: "Mazda", logo: "/icons/mazda.png", description: "Mazda leverages Sample AI for enhanced driving experiences.", category: "Automotive" },
  { name: "MediaMarkt", logo: "/icons/mediamarkt.png", description: "MediaMarkt personalizes shopping with AI-powered recommendations.", category: "Retail" },
  { name: "Ollama", logo: "/icons/ollama.png", description: "Ollama simplifies local AI deployment with Sample integration.", category: "Technology and Software" },
  { name: "Snowflake", logo: "/icons/snowflake.png", description: "Snowflake unlocks data insights with Sample AI analytics.", category: "Technology and Software" },
  { name: "TestRail", logo: "/icons/testrail.png", description: "TestRail enhances test management with AI-powered insights.", category: "Technology and Software" },
  { name: "Vercel", logo: "/icons/vercel.png", description: "Vercel accelerates web development with Sample AI integration.", category: "Technology and Software" },
];

// Navigation component shared between pages
function Navigation({ onBack }: { onBack?: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="flex items-center justify-between px-4 sm:px-8 md:px-12 py-4 md:py-5"
    >
      {/* Logo */}
      <div className="flex items-center cursor-pointer" onClick={onBack}>
        <div className="w-8 h-8 bg-[#f97316] rounded flex items-center justify-center">
          <span className="text-white font-bold text-lg">M</span>
        </div>
      </div>

      {/* Nav Links - centered (hidden on mobile) */}
      <div className="hidden lg:flex items-center gap-8">
        {["Products", "Solutions", "Research", "Resources", "Pricing", "Company"].map((item) => (
          <a
            key={item}
            href="#"
            className="text-[#1a1a1a] hover:text-[#333] text-[15px] font-normal transition-colors"
          >
            {item}
          </a>
        ))}
      </div>

      {/* CTA Buttons (hidden on mobile) */}
      <div className="hidden md:flex items-center gap-3">
        <button className="px-5 py-2 text-[14px] font-medium text-[#f97316] hover:text-[#ea580c] transition-colors flex items-center gap-2">
          Try AI Studio
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button className="px-5 py-2 text-[14px] font-medium text-[#f97316] hover:text-[#ea580c] transition-colors flex items-center gap-2">
          Talk to sales
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Mobile Menu Button */}
      <button
        className="md:hidden p-2 text-[#1a1a1a]"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileMenuOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 bg-[#f5f1e8] border-b border-[#e5e0d5] py-4 px-4 md:hidden z-50"
        >
          <div className="flex flex-col gap-3">
            {["Products", "Solutions", "Research", "Resources", "Pricing", "Company"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[#1a1a1a] hover:text-[#333] text-[15px] font-normal transition-colors py-2"
              >
                {item}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-2 border-t border-[#e5e0d5]">
              <button className="px-4 py-2 text-[14px] font-medium text-[#f97316] hover:text-[#ea580c] transition-colors flex items-center gap-2">
                Try AI Studio
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button className="px-4 py-2 text-[14px] font-medium text-[#f97316] hover:text-[#ea580c] transition-colors flex items-center gap-2">
                Talk to sales
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
}

// Customers Page Component
function CustomersPage() {
  const [blocks] = useState<Block[]>(() => generateRandomBlocks(20));

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f5f1e8]">
      {/* Grid Pattern */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(139, 115, 85, 0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(139, 115, 85, 0.15) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Subtle Gradient Overlay */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(245, 222, 179, 0.3) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(222, 184, 135, 0.2) 0%, transparent 50%)
          `,
        }}
      />

      {/* Animated Tetris-like Blocks */}
      <div className="absolute inset-0 z-[2]">
        {blocks.map((block) => (
          <motion.div
            key={block.id}
            initial={{
              opacity: 0,
              scale: 0.8,
              rotate: block.rotation - 15,
            }}
            animate={{
              opacity: [0.7, 0.85, 0.7],
              scale: 1,
              rotate: block.rotation,
              y: [0, -10, 0],
            }}
            transition={{
              duration: 3,
              delay: block.delay,
              ease: "easeInOut",
              opacity: {
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                duration: 6,
                repeat: Infinity,
                repeatType: "reverse",
              },
            }}
            className="absolute"
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.width}px`,
              height: `${block.height}px`,
            }}
          >
            <div
              className={cn(
                "w-full h-full rounded-sm",
                "bg-gradient-to-br from-[#f4e4c1]/90 to-[#e8d4a8]/85",
                "border-2 border-[#d4b896]/60",
                "shadow-[0_4px_16px_rgba(139,115,85,0.25)]",
                "backdrop-blur-[2px]"
              )}
            />
          </motion.div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <Navigation onBack={() => { }} />

        {/* Hero Section */}
        <div className="text-center pt-8 sm:pt-12 md:pt-16 pb-8 md:pb-12 px-4">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-[32px] sm:text-[40px] md:text-[56px] lg:text-[72px] font-normal mb-4 md:mb-6 tracking-[-0.02em] leading-[1.15]"
            style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
          >
            <span className="text-[#1a1a1a]">
              Bringing customers
              <br />
              to the frontier.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="text-[14px] sm:text-[16px] md:text-[18px] text-[#666] max-w-2xl mx-auto font-normal leading-relaxed px-2"
          >
            From startups to institutions, across tech, finance, healthcare, and more, our customers set
            <br className="hidden md:block" />
            the benchmark for AI-powered business outcomes.
          </motion.p>
        </div>

        {/* Featured SAP Card */}
        <div className="px-4 sm:px-8 md:px-12 pb-6 md:pb-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="max-w-5xl mx-auto bg-[#d4c4a8] backdrop-blur-sm rounded-xl p-6 sm:p-8 md:p-10 shadow-lg"
          >
            <p
              className="text-[18px] sm:text-[22px] md:text-[26px] text-[#1a1a1a] mb-6 md:mb-8 leading-snug font-normal"
              style={{ fontFamily: "'Times New Roman', Georgia, serif" }}
            >
              {featuredTestimonial.quote}
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <button className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#1a1a1a] rounded-md flex items-center gap-2 hover:bg-[#333] transition-colors">
                Learn more
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <span className="text-[24px] sm:text-[28px] md:text-[32px] font-bold text-[#1a1a1a]">
                {featuredTestimonial.company}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Bento Grid of Company Cards */}
        <div className="px-4 sm:px-8 md:px-12 pb-12 md:pb-20">
          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {companyCards.map((company, index) => (
              <motion.div
                key={company.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 + index * 0.05 }}
                className="group bg-[#d9cbb3]/80 backdrop-blur-sm hover:bg-[#c9b99f] border border-[#c4b69e]/50 rounded-xl p-5 sm:p-6 transition-all duration-300 cursor-pointer shadow-md hover:shadow-lg"
              >
                {/* Company Logo */}
                <div className="flex items-center justify-center h-10 sm:h-12 mb-3 sm:mb-4">
                  <img
                    src={company.logo}
                    alt={company.name}
                    className="h-8 sm:h-10 w-auto object-contain"
                  />
                </div>

                {/* Description */}
                <p className="text-[13px] sm:text-[14px] text-[#4a4a4a] mb-4 sm:mb-6 text-center leading-relaxed min-h-[50px] sm:min-h-[60px]">
                  {company.description}
                </p>

                {/* Footer with category and read more */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] sm:text-[12px] text-[#555] border border-[#b8a890] rounded-full px-2 sm:px-3 py-1 bg-[#f5f1e8]/50">
                    {company.category}
                  </span>
                  <a
                    href="#"
                    className="text-[12px] sm:text-[13px] text-[#f97316] font-medium flex items-center gap-1 hover:text-[#ea580c] transition-colors"
                  >
                    Read more
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Top Navbar Component (replaces Sidebar)
function TopNavbar({ activePage, onNavigate }: { activePage: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher"; onNavigate: (page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => void }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Try to use language context, but provide fallback
  let t = (key: string) => key;
  try {
    const langContext = useLanguage();
    t = langContext.t;
  } catch (e) {
    // Not wrapped in LanguageProvider, use fallback
  }

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    {
      id: "dashboard" as const, label: t('dashboard'), icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      )
    },
    {
      id: "clients" as const, label: t('clients'), icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    },
    {
      id: "documents" as const, label: t('documents'), icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: "legal-researcher" as const, label: t('legal_researcher'), icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      )
    },
    {
      id: "settings" as const, label: t('settings'), icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      )
    },
  ];

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-[#f3eed2]/95 backdrop-blur-md shadow-lg py-2"
        : "bg-[#f3eed2] py-3"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#f97316] rounded flex items-center justify-center">
              <span className="text-white font-bold text-lg">N</span>
            </div>
            <span className="text-[18px] font-bold text-[#1a1a1a] hidden sm:block" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>NYAYAZEPHYR</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  "px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium",
                  activePage === item.id
                    ? "bg-[#f97316] text-white shadow-md"
                    : "text-[#666] hover:bg-[#e5ddd0] hover:text-[#1a1a1a]"
                )}
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.label}</span>
              </button>
            ))}
          </div>

          {/* Right side - Language selector and user */}
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="hidden sm:block">
              <LanguageSelector />
            </div>

            {/* User Profile */}
            {HAS_CLERK_KEY && (
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-[#d4cdb8]">
                <UserButton afterSignOutUrl="/" />
              </div>
            )}

              {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-[#e5ddd0] transition-colors"
            >
              <svg className="w-6 h-6 text-[#1a1a1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden mt-3 pb-3 border-t border-[#d4cdb8] pt-3">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={cn(
                    "px-4 py-3 rounded-lg flex items-center gap-3 transition-all text-sm font-medium w-full text-left",
                    activePage === item.id
                      ? "bg-[#f97316] text-white"
                      : "text-[#666] hover:bg-[#e5ddd0]"
                  )}
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[#d4cdb8] flex items-center justify-between">
              <LanguageSelector />
              {HAS_CLERK_KEY && (
                <div className="flex items-center gap-2">
                  <UserButton afterSignOutUrl="/" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}


// Documents Page Component
function DocumentsPage({ onNavigate }: { onNavigate: (page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => void }) {
  const [blocks] = useState<Block[]>(() => generateRandomBlocks(12));
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string; citations?: string[] }[]>([
    { role: "ai", content: "Hello! Upload a legal document to get started. I can analyze judgments, contracts, and legal notices." }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [dbDocuments, setDbDocuments] = useState<any[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [showFullSummary, setShowFullSummary] = useState(false);

  // Manual re-analyze function
  const handleReanalyze = async () => {
    if (!sessionId) return;
    setProcessing(true);
    try {
      const response = await fetch(`http://localhost:8000/legal/documents/reanalyze/${sessionId}`, { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setMetadata(data.metadata);
        setMessages(prev => [...prev, { role: "ai", content: "[OK] Document re-analyzed successfully! Summary and metadata updated." }]);
      } else {
        setMessages(prev => [...prev, { role: "ai", content: "[X] Re-analysis failed. Please try again." }]);
      }
    } catch (error) {
      console.error("Re-analyze failed:", error);
    } finally {
      setProcessing(false);
    }
  };

  // Fetch documents (cases) from database on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await fetch("http://localhost:8000/legal/cases?user_id=1");
        if (response.ok) {
          const data = await response.json();
          // Transform cases to document format for display
          const docs = (data.cases || []).map((c: any) => ({
            file_hash: c.case_id,
            filename: c.client_name || "Case Document",
            case_title: c.client_name + (c.structured_data?.opposing_party ? ` vs ${c.structured_data?.opposing_party}` : ""),
            upload_date: c.created_at
          }));
          setDbDocuments(docs);
        }
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setLoadingDocs(false);
      }
    };
    fetchDocuments();
  }, []);

  // Handle clicking on a previous document to load its data
  const handleLoadDocument = async (doc: any) => {
    setProcessing(true);
    try {
      // doc.file_hash is actually case_id from our transformation
      const caseId = doc.file_hash;

      // Fetch case details from the cases endpoint
      const caseResponse = await fetch(`http://localhost:8000/legal/cases/${caseId}?user_id=1`);
      if (caseResponse.ok) {
        const caseData = await caseResponse.json();
        console.log("Loaded case data:", caseData);

        setSessionId(String(caseId));
        // Map case fields to the metadata format expected by the Document Analysis panel
        const sd = caseData.structured_data || {};
        setMetadata({
          case_title: caseData.client_name + (sd.opposing_party ? ` vs ${sd.opposing_party}` : ""),
          case_number: `CASE-${caseId}`,
          doc_type: sd.case_type || caseData.case_type || "Legal Case",
          court: sd.court || "General Court",
          judge: sd.judge || "Not specified",
          appellant: caseData.client_name || sd.appellant || "Not specified",
          respondent: sd.opposing_party || sd.respondent || "Not specified",
          detailed_summary: sd.detailed_summary || sd.legal_issue_summary || caseData.legal_issue_summary || "Case loaded. You can now ask questions about this case.",
          verdict: caseData.stage || sd.verdict || "In Progress",
          victim: sd.victim || null,
          facts: sd.facts || null,
          reasoning: sd.reasoning || null,
        });
        setFileUrl(null); // No file preview for case-based documents

        // Fetch chat history
        const historyResponse = await fetch(`http://localhost:8000/legal/chat/history/${caseId}?user_id=1`);
        if (historyResponse.ok) {
          const historyData = await historyResponse.json();
          const chatMessages = (historyData.messages || []).map((msg: any) => ({
            role: msg.role === "assistant" ? "ai" : msg.role,
            content: msg.content
          }));

          // Set initial message if no chat history
          if (chatMessages.length === 0) {
            setMessages([
              { role: "ai", content: `📁 **Loaded: ${doc.filename}**\n\nYou can now ask questions about this case.` }
            ]);
          } else {
            setMessages(chatMessages);
          }
        } else {
          setMessages([
            { role: "ai", content: `📁 **Loaded: ${doc.filename}**\n\nYou can now ask questions about this case.` }
          ]);
        }
      } else {
        throw new Error("Failed to load case");
      }
    } catch (error) {
      console.error("Failed to load document:", error);
      setMessages([{ role: "ai", content: "Failed to load document. Please try again." }]);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }

    setUploading(true);
    setProcessing(true);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/legal/cases/pdf-upload?user_id=1", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Upload failed");
      }

      const data = await response.json();
      // Backend returns CaseResponse with case_id, client_name, structured_data
      setSessionId(data.case_id.toString());
      // Set metadata with field names that match the UI display
      setMetadata({
        case_title: data.client_name || file.name,
        case_number: `CASE-${data.case_id}`,
        doc_type: data.structured_data?.case_type || "Legal Document",
        court: data.structured_data?.court || "General Court",
        judge: data.structured_data?.judge || "Not specified",
        appellant: data.client_name || "Not specified",
        respondent: data.structured_data?.opposing_party || "Not specified",
        detailed_summary: data.structured_data?.detailed_summary || data.structured_data?.legal_issue_summary || "Document analyzed successfully. You can now ask questions about this case.",
        verdict: data.stage || "In Progress",
        victim: data.structured_data?.victim || null
      });

      // Add initial analysis message
      setMessages(prev => [...prev, {
        role: "ai",
        content: `[DOC] **Document Analyzed: ${file.name}**\n\n**Client:** ${data.client_name || "Unknown"}\n**Case Type:** ${data.structured_data?.case_type || "General"}\n\n[CHAT] You can now ask questions about this document. Case ID: #${data.case_id}`
      }]);

    } catch (error) {
      console.error("Upload error:", error);
      alert(error instanceof Error ? error.message : "Failed to analyze document. Please ensure the backend is running and try again.");
      // Keep the file visible even simply for preview
      // setFileUrl(null); 
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    if (!sessionId) {
      alert("Please upload a document first.");
      return;
    }

    const userText = inputMessage;
    setInputMessage("");
    setMessages(prev => [...prev, { role: "user", content: userText }]);

    try {
      const response = await fetch("http://localhost:8000/legal/chat?user_id=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: parseInt(sessionId), query: userText, language: "en" })
      });

      if (!response.ok) throw new Error("Chat failed");

      const data = await response.json();
      setMessages(prev => [...prev, { role: "ai", content: data.response }]);

    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: "ai", content: "Sorry, I encountered an error responding to your question." }]);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#f5f1e8] flex">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(to right, rgba(139, 115, 85, 0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(139, 115, 85, 0.15) 1px, transparent 1px)`,
          backgroundSize: "40px 40px"
        }} />
        <div className="absolute inset-0 z-[1]" style={{
          background: `radial-gradient(circle at 20% 30%, rgba(245, 222, 179, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(222, 184, 135, 0.2) 0%, transparent 50%)`
        }} />
        {/* Animated Blocks */}
        <div className="absolute inset-0 z-[2]">
          {blocks.map((block) => (
            <motion.div
              key={block.id}
              initial={{ opacity: 0, scale: 0.8, rotate: block.rotation - 15 }}
              animate={{ opacity: [0.5, 0.7, 0.5], scale: 1, rotate: block.rotation, y: [0, -8, 0] }}
              transition={{ duration: 3, delay: block.delay, ease: "easeInOut", opacity: { duration: 4, repeat: Infinity, repeatType: "reverse" }, y: { duration: 6, repeat: Infinity, repeatType: "reverse" } }}
              className="absolute"
              style={{ left: `${block.x}%`, top: `${block.y}%`, width: `${block.width}px`, height: `${block.height}px` }}
            >
              <div className="w-full h-full rounded-sm bg-gradient-to-br from-[#f4e4c1]/90 to-[#e8d4a8]/85 border-2 border-[#d4b896]/60 shadow-[0_4px_16px_rgba(139,115,85,0.25)] backdrop-blur-[2px]" />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <TopNavbar activePage="documents" onNavigate={onNavigate} />

      {/* Main Content */}
      <div className="flex-1 relative z-10 pt-20 p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-[32px] font-normal text-[#1a1a1a] italic mb-2" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>Documents & Analysis</h1>
            <p className="text-[#666] font-normal" style={{ fontFamily: "Montserrat, sans-serif" }}>Upload, analyze, and chat with your legal documents.</p>
          </div>

          {/* Top Row: Upload & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[500px]">
            {/* Upload/Preview Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#d4c4a8] backdrop-blur-sm rounded-xl overflow-hidden shadow-lg border-2 border-dashed border-[#b8a88a] relative group"
            >
              {fileUrl ? (
                <iframe key={fileUrl} src={fileUrl} className="w-full h-full" title="PDF Preview" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 hover:bg-[#cbb898]/50 transition-colors">
                  <div className="w-20 h-20 bg-[#f5f1e8] rounded-full flex items-center justify-center mb-6 shadow-inner">
                    <svg className="w-10 h-10 text-[#f97316]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h3 className="text-[20px] font-semibold text-[#1a1a1a] mb-2" style={{ fontFamily: "Montserrat, sans-serif" }}>Upload Legal Documents</h3>
                  <p className="text-[#666] text-center mb-6" style={{ fontFamily: "Montserrat, sans-serif" }}>Drag & drop PDF files here<br />or click to browse</p>

                  <label className="px-6 py-2 bg-[#f97316] text-white rounded-md font-medium hover:bg-[#ea580c] transition-colors cursor-pointer">
                    Browse Files
                    <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} />
                  </label>
                </div>
              )}
            </motion.div>

            {/* Summary Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 flex flex-col relative overflow-hidden"
            >
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>Document Analysis</h3>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar bg-[#f5f1e8] rounded-lg p-4 relative">
                {processing ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#f5f1e8] z-20">
                    {/* Custom Legal Loading Animation: Scales */}
                    <div className="relative w-24 h-24 mb-4">
                      <motion.svg
                        className="w-full h-full text-[#AC9362]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </motion.svg>
                      <motion.div
                        className="absolute -top-1 -right-1 w-4 h-4 bg-[#f97316] rounded-full"
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    </div>
                    <h4 className="text-[#1a1a1a] font-serif italic text-lg mb-1 animate-pulse">Analyzing Case Law...</h4>
                    <p className="text-xs text-[#666] font-medium">Extracting metadata & citations</p>
                  </div>
                ) : metadata ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-[#e5ddd0]/50 rounded border border-[#d4cdb8]">
                      <p className="text-[11px] uppercase tracking-wider text-[#8b7355] font-bold mb-1">CASE</p>
                      <p className="text-[#1a1a1a] font-medium font-serif italic text-lg">{metadata.case_title}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-white/50 rounded border border-[#d4cdb8]">
                        <p className="text-[10px] uppercase text-[#8b7355] font-bold">CASE NO.</p>
                        <p className="text-[#1a1a1a] text-sm">{metadata.case_number}</p>
                      </div>
                      <div className="p-2 bg-white/50 rounded border border-[#d4cdb8]">
                        <p className="text-[10px] uppercase text-[#8b7355] font-bold">TYPE</p>
                        <p className="text-[#1a1a1a] text-sm">{metadata.doc_type}</p>
                      </div>
                    </div>

                    <div className="p-2 bg-white/50 rounded border border-[#d4cdb8]">
                      <p className="text-[10px] uppercase text-[#8b7355] font-bold">JUDGE / BENCH</p>
                      <p className="text-[#1a1a1a] text-sm">{metadata.judge}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="p-2 bg-white/50 rounded border border-[#d4cdb8]">
                        <p className="text-[10px] uppercase text-[#8b7355] font-bold">APPELLANT</p>
                        <p className="text-[#1a1a1a] text-sm">{metadata.appellant || "Not specified"}</p>
                      </div>
                      <div className="p-2 bg-white/50 rounded border border-[#d4cdb8]">
                        <p className="text-[10px] uppercase text-[#8b7355] font-bold">RESPONDENT</p>
                        <p className="text-[#1a1a1a] text-sm">{metadata.respondent || "Not specified"}</p>
                      </div>
                    </div>

                    {metadata.victim && metadata.victim !== "Not specified" && metadata.victim !== "Not applicable" && (
                      <div className="p-2 bg-red-50/50 rounded border border-red-200 mt-3">
                        <p className="text-[10px] uppercase text-red-700 font-bold">VICTIM</p>
                        <p className="text-red-800 text-sm font-medium">{metadata.victim}</p>
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#8b7355] font-bold mb-2">SUMMARY</p>
                      <p className="text-[14px] text-[#333] leading-relaxed text-justify" style={{ fontFamily: "Georgia, serif" }}>
                        {metadata.detailed_summary}
                      </p>
                    </div>

                    <div className="mt-4">
                      <p className="text-[11px] uppercase tracking-wider text-[#8b7355] font-bold mb-2">VERDICT</p>
                      <p className="text-[14px] font-bold text-[#f97316] leading-relaxed">
                        {metadata.verdict}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleReanalyze}
                        disabled={processing}
                        className="px-3 py-1.5 bg-[#f97316] text-white rounded text-xs font-medium hover:bg-[#ea580c] transition-colors disabled:opacity-50"
                      >
                        {processing ? "Analyzing..." : " Re-Analyze"}
                      </button>
                      {metadata.detailed_summary && metadata.detailed_summary.length > 100 && (
                        <button
                          onClick={() => setShowFullSummary(true)}
                          className="px-3 py-1.5 bg-[#6b5744] text-white rounded text-xs font-medium hover:bg-[#5a4838] transition-colors"
                        >
                          Full Summary
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
                    <p className="text-[#666] leading-relaxed text-[15px]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                      Upload a document to view the AI-generated legal analysis, including case details, summary, and verdict.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Full Summary Modal */}
          {showFullSummary && metadata && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowFullSummary(false)}>
              <div className="bg-[#f5f1e8] rounded-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-serif italic text-[#1a1a1a]">Detailed Case Summary</h2>
                  <button onClick={() => setShowFullSummary(false)} className="text-[#666] hover:text-[#1a1a1a]">x</button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs uppercase text-[#8b7355] font-bold mb-1">Case</p>
                    <p className="text-lg font-serif italic">{metadata.parties || metadata.case_title}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-[#8b7355] font-bold mb-1">Summary</p>
                    <p className="text-[#333] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>{metadata.detailed_summary}</p>
                  </div>
                  {metadata.facts && metadata.facts !== "See summary" && (
                    <div>
                      <p className="text-xs uppercase text-[#8b7355] font-bold mb-1">Key Facts</p>
                      <p className="text-[#333] leading-relaxed">{metadata.facts}</p>
                    </div>
                  )}
                  {metadata.reasoning && metadata.reasoning !== "See summary" && (
                    <div>
                      <p className="text-xs uppercase text-[#8b7355] font-bold mb-1">Legal Reasoning</p>
                      <p className="text-[#333] leading-relaxed">{metadata.reasoning}</p>
                    </div>
                  )}
                  <div className="bg-[#f97316]/10 p-3 rounded">
                    <p className="text-xs uppercase text-[#f97316] font-bold mb-1">Verdict</p>
                    <p className="text-[#f97316] font-bold">{metadata.verdict}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Chatbot Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 bg-white rounded-xl shadow-lg border border-[#e5e0d5] flex flex-col h-[400px]"
          >
            {/* Chat Header */}
            <div className="p-4 border-b border-[#f0f0f0] bg-[#fafafa] flex justify-between items-center rounded-t-xl">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <h3 className="font-semibold text-[#1a1a1a]">Legal Assistant</h3>
              </div>
              <button
                onClick={() => setMessages([{ role: "ai", content: "Hello! Upload a legal document to get started." }])}
                className="text-xs text-[#666] hover:text-[#f97316] transition-colors"
              >
                Clear Chat
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#fcfcfc]">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user" ? "bg-[#f97316] text-white" : "bg-[#f5f1e8] text-[#1a1a1a] border border-[#e5e0d5]"}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    {msg.citations && (
                      <div className="mt-2 pt-2 border-t border-black/10 text-xs opacity-80">
                        <strong>Sources:</strong>
                        <ul className="list-disc pl-4 mt-1">
                          {msg.citations.map((cit, cIdx) => <li key={cIdx}>{cit}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {processing && !uploading && (
                <div className="flex justify-start">
                  <div className="bg-[#f5f1e8] text-[#666] rounded-lg p-3 border border-[#e5e0d5] text-sm italic">
                    Thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-[#f0f0f0] bg-white rounded-b-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  placeholder={sessionId ? "Ask a question about the case..." : "Upload a document first..."}
                  disabled={!sessionId || processing}
                  className="flex-1 px-4 py-2 bg-[#f8f9fa] border border-[#e2e8f0] rounded-lg focus:outline-none focus:border-[#f97316] disabled:opacity-50"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!sessionId || processing}
                  className="px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#333] transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </motion.div>

          {/* Previous Documents List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>Previous Documents</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {loadingDocs ? (
                <div className="col-span-3 text-center py-8 text-[#666]">Loading documents...</div>
              ) : dbDocuments.length === 0 ? (
                <div className="col-span-3 text-center py-8 text-[#666]">No documents uploaded yet. Upload a PDF to get started.</div>
              ) : (
                dbDocuments.map((doc: any, idx: number) => (
                  <div
                    key={doc.file_hash || idx}
                    onClick={() => handleLoadDocument(doc)}
                    className="bg-[#f5f1e8] rounded-lg p-4 flex items-center justify-between hover:bg-[#ebe5d8] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-[#e5ddd0] rounded text-[#f97316] group-hover:text-white group-hover:bg-[#f97316] transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>{doc.filename || doc.case_title || "Untitled Document"}</p>
                        <p className="text-[12px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>PDF | {doc.case_title ? doc.case_title.substring(0, 30) + "..." : "Legal Document"}</p>
                      </div>
                    </div>
                    <span className="text-[12px] text-[#999]" style={{ fontFamily: "Montserrat, sans-serif" }}>{doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : "N/A"}</span>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Dashboard Page Component
function DashboardPage({ onNavigate }: { onNavigate: (page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher" | "admin") => void }) {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const colors = getThemeColors(isDark);
  const [blocks] = useState<Block[]>(() => generateRandomBlocks(12));
  const [dashboardStats, setDashboardStats] = useState({
    documents_analyzed: 0,
    queries_asked: 0,
    time_saved_hours: 0,
    time_saved_minutes: 0
  });
  const [_statsLoading, setStatsLoading] = useState(true);
  const [cases, setCases] = useState<CaseDetails[]>([]);
  const [_casesLoading, setCasesLoading] = useState(true);

  // eCourts India Statistics
  const [eCourtsStats, setECourtsStats] = useState<any>(null);
  const [eCourtsLoading, setECourtsLoading] = useState(true);

  // Fetch real stats from backend
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("http://localhost:8000/legal/stats/1");
        if (response.ok) {
          const data = await response.json();
          setDashboardStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch real cases from backend
  useEffect(() => {
    const fetchCases = async () => {
      try {
        const res = await getUserCases(1); // Default user_id = 1
        if (res.success && res.cases) {
          setCases(res.cases);
        }
      } catch (error) {
        console.error("Failed to fetch cases:", error);
      } finally {
        setCasesLoading(false);
      }
    };
    fetchCases();
  }, []);

  // Fetch eCourts India statistics
  useEffect(() => {
    const fetchECourts = async () => {
      try {
        const response = await fetch("http://localhost:8000/legal/ecourts/statistics");
        if (response.ok) {
          const data = await response.json();
          setECourtsStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch eCourts stats:", error);
      } finally {
        setECourtsLoading(false);
      }
    };
    fetchECourts();
  }, []);

  // Use fetched stats with fallback
  const timeSaved = { hours: dashboardStats.time_saved_hours, period: "total" };
  const stats = {
    queries: dashboardStats.queries_asked,
    documents: dashboardStats.documents_analyzed,
    accuracy: 94.2
  };
  // Generate calendar events from cases
  const calendarEventsData = cases.slice(0, 4).map((c, idx) => {
    const stages = ['Filing', 'Hearing', 'Review', 'Trial'];
    const baseDate = new Date(c.created_at || Date.now());
    baseDate.setDate(baseDate.getDate() + (idx + 1) * 3); // Stagger by 3 days each
    return {
      date: baseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      event: stages[idx % stages.length],
      caseId: `#${c.case_id}`,
      upcoming: idx === 0
    };
  });

  // Filter cases by completion status
  const ongoingCasesData = cases.filter(c => !c.is_complete).slice(0, 5).map(c => ({
    id: c.case_id.toString(),
    parties: c.client_name + (c.opposing_party ? ` vs ${c.opposing_party}` : ''),
    progress: c.progress,
    stage: c.stage || 'Pending'
  }));

  const completedCasesData = cases.filter(c => c.is_complete).slice(0, 5).map(c => ({
    id: c.case_id.toString(),
    parties: c.client_name + (c.opposing_party ? ` vs ${c.opposing_party}` : ''),
    verdict: 'COMPLETED',
    details: c.stage,
    date: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  const documentLibraryData = cases.slice(0, 3).map(c => ({
    id: c.case_id,
    name: c.client_name + (c.opposing_party ? ` vs ${c.opposing_party}` : ''),
    date: new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }));

  const getVerdictEmoji = (verdict: string) => {
    switch (verdict) {
      case "WON": return "W";
      case "LOST": return "L";
      case "SETTLED": return "S";
      default: return "-";
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex" style={{ backgroundColor: colors.bg }}>
      {/* Grid Pattern */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, ${colors.grid} 1px, transparent 1px),
            linear-gradient(to bottom, ${colors.grid} 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Subtle Gradient Overlay */}
      <div
        className="absolute inset-0 z-[1]"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, ${colors.gradient1} 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, ${colors.gradient2} 0%, transparent 50%)
          `,
        }}
      />

      {/* Animated Tetris-like Blocks */}
      <div className="absolute inset-0 z-[2]">
        {blocks.map((block) => (
          <motion.div
            key={block.id}
            initial={{
              opacity: 0,
              scale: 0.8,
              rotate: block.rotation - 15,
            }}
            animate={{
              opacity: [0.5, 0.7, 0.5],
              scale: 1,
              rotate: block.rotation,
              y: [0, -8, 0],
            }}
            transition={{
              duration: 3,
              delay: block.delay,
              ease: "easeInOut",
              opacity: {
                duration: 4,
                repeat: Infinity,
                repeatType: "reverse",
              },
              y: {
                duration: 6,
                repeat: Infinity,
                repeatType: "reverse",
              },
            }}
            className="absolute"
            style={{
              left: `${block.x}%`,
              top: `${block.y}%`,
              width: `${block.width}px`,
              height: `${block.height}px`,
            }}
          >
            <div
              className={cn(
                "w-full h-full rounded-sm",
                "bg-gradient-to-br from-[#f4e4c1]/90 to-[#e8d4a8]/85",
                "border-2 border-[#d4b896]/60",
                "shadow-[0_4px_16px_rgba(139,115,85,0.25)]",
                "backdrop-blur-[2px]"
              )}
            />
          </motion.div>
        ))}
      </div>

      {/* Sidebar */}
      <TopNavbar activePage="dashboard" onNavigate={onNavigate} />

      {/* Main Content */}
      <div className="flex-1 relative z-10 pt-20 p-8">
        {/* Dashboard Header */}
        <div className="mb-8 p-4">
          <div className="flex justify-between items-start">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="text-[28px] sm:text-[36px] md:text-[48px] font-normal mb-2 tracking-[-0.02em] leading-[1.15]"
                style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
              >
                <span className="text-[#1a1a1a]">{t('dashboard')}</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-[14px] sm:text-[16px] text-[#666] font-normal"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Manage your cases and track progress
              </motion.p>
            </div>
            {/* Language Selector */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex items-center gap-3"
            >
              <button
                onClick={() => onNavigate("admin")}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg hover:bg-[#333] transition-all shadow-md text-sm font-medium"
                title="Admin Dashboard"
              >
                <span>🛡️</span>
                <span className="hidden sm:inline">Admin</span>
              </button>
              <LanguageSelector variant="dropdown" />
            </motion.div>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="px-4 pb-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Saved Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5, boxShadow: "0 20px 40px rgba(139,115,85,0.3)" }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-[#d4c4a8] backdrop-blur-sm rounded-xl p-6 shadow-lg cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-[14px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>TIME SAVED</h3>
              </div>
              <p className="text-[42px] font-bold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>{timeSaved.hours}</p>
              <p className="text-[14px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>hours saved {timeSaved.period}</p>
            </motion.div>

            {/* Stats Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5, boxShadow: "0 20px 40px rgba(139,115,85,0.3)" }}
              transition={{ duration: 0.5, delay: 0.7 }}
              className="bg-[#d4c4a8] backdrop-blur-sm rounded-xl p-6 shadow-lg cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <h3 className="text-[14px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>STATS</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>Queries</span>
                  <span className="text-[16px] font-bold text-[#1a1a1a]">{stats.queries}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>Documents</span>
                  <span className="text-[16px] font-bold text-[#1a1a1a]">{stats.documents}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[14px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>Accuracy</span>
                  <span className="text-[16px] font-bold text-[#f97316]">{stats.accuracy}%</span>
                </div>
              </div>
            </motion.div>

            {/* Calendar with Mini Month View */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5, boxShadow: "0 20px 40px rgba(139,115,85,0.3)" }}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="bg-[#d4c4a8] backdrop-blur-sm rounded-xl p-6 shadow-lg cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="text-[14px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>CALENDAR</h3>
                </div>
                <span className="text-[12px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
              </div>

              {/* Mini Calendar Grid */}
              <div className="mb-3">
                <div className="grid grid-cols-7 gap-1 text-center mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                    <span key={i} className="text-[10px] text-[#666] font-medium">{day}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {(() => {
                    const today = new Date();
                    const currentMonth = today.getMonth();
                    const currentYear = today.getFullYear();
                    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
                    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
                    const todayDate = today.getDate();

                    // Get event dates from cases
                    const eventDates = calendarEventsData.map(e => {
                      const parts = e.date.split(' ');
                      return parseInt(parts[1]) || 0;
                    });

                    const days = [];
                    // Empty cells for days before first of month
                    for (let i = 0; i < firstDay; i++) {
                      days.push(<div key={`empty-${i}`} className="w-5 h-5"></div>);
                    }
                    // Actual days
                    for (let d = 1; d <= daysInMonth; d++) {
                      const isToday = d === todayDate;
                      const hasEvent = eventDates.includes(d);
                      days.push(
                        <div
                          key={d}
                          className={`w-5 h-5 flex items-center justify-center text-[10px] rounded-full cursor-pointer transition-all hover:bg-[#f97316] hover:text-white ${isToday ? 'bg-[#f97316] text-white font-bold' :
                            hasEvent ? 'bg-[#f5f1e8] text-[#f97316] font-bold ring-2 ring-[#f97316]/50' :
                              'text-[#1a1a1a]'
                            }`}
                          title={hasEvent ? "Has event" : ""}
                        >
                          {d}
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>

              {/* Upcoming Events List */}
              <div className="space-y-1.5 max-h-[80px] overflow-y-auto border-t border-[#c4b498] pt-2">
                {calendarEventsData.length > 0 ? (
                  calendarEventsData.map((event: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px] p-1.5 rounded-md bg-[#f5f1e8]/70 hover:bg-[#f5f1e8] transition-colors" style={{ fontFamily: "Montserrat, sans-serif" }}>
                      <span className={`w-2 h-2 rounded-full ${event.upcoming ? "bg-[#f97316]" : "bg-[#999]"}`}></span>
                      <span className="text-[#666] min-w-[50px]">{event.date}</span>
                      <span className="text-[#1a1a1a] font-medium">{event.event}</span>
                      <span className="text-[#f97316]">{event.caseId}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-[#666] text-center">No upcoming events</p>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* eCourts India Live Statistics */}
        <div className="px-4 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.85 }}
            className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
                <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>eCourts India - Live Statistics</h3>
              </div>
              <span className="text-[11px] text-[#6b5744] px-2 py-1 bg-[#e5ddd0] rounded-full">🔴 LIVE</span>
            </div>

            {eCourtsLoading ? (
              <div className="text-[#666] text-center py-4">Loading court statistics...</div>
            ) : eCourtsStats ? (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
                {/* High Court Stats */}
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">High Courts</p>
                  <p className="text-[24px] font-bold text-[#1a1a1a]">{eCourtsStats.hc_complexes}</p>
                  <p className="text-[11px] text-[#666]">Complexes</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">HC Pending</p>
                  <p className="text-[28px] font-bold text-[#f97316]">{eCourtsStats.hc_pending_cases}</p>
                  <p className="text-[11px] text-[#666]">Cases Pending</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">HC Disposed</p>
                  <p className="text-[24px] font-bold text-green-600">{eCourtsStats.hc_disposed_cases}</p>
                  <p className="text-[11px] text-[#666]">Cases Disposed</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">HC Today</p>
                  <p className="text-[24px] font-bold text-[#1a1a1a]">{eCourtsStats.hc_cases_listed_today}</p>
                  <p className="text-[11px] text-[#666]">Listed Today</p>
                </div>
                {/* District Court Stats */}
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">District Courts</p>
                  <p className="text-[24px] font-bold text-[#1a1a1a]">{eCourtsStats.dc_complexes}</p>
                  <p className="text-[11px] text-[#666]">Complexes</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">DC Pending</p>
                  <p className="text-[28px] font-bold text-[#f97316]">{eCourtsStats.dc_pending_cases}</p>
                  <p className="text-[11px] text-[#666]">Cases Pending</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">DC Disposed</p>
                  <p className="text-[24px] font-bold text-green-600">{eCourtsStats.dc_disposed_last_month}</p>
                  <p className="text-[11px] text-[#666]">Last Month</p>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-lg p-4 border border-[#d4b896]/30">
                  <p className="text-[10px] text-[#666] uppercase mb-1">DC Today</p>
                  <p className="text-[24px] font-bold text-[#1a1a1a]">{eCourtsStats.dc_cases_listed_today}</p>
                  <p className="text-[11px] text-[#666]">Listed Today</p>
                </div>
              </div>
            ) : (
              <div className="text-[#666] text-center py-4">Unable to load statistics</div>
            )}
          </motion.div>
        </div>

        {/* Multi-Source Research Options */}
        <div className="px-4 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Acts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ duration: 0.5, delay: 0.86 }}
              onClick={() => onNavigate("legal-researcher")}
              className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-5 shadow-lg border border-[#d4b896]/50 cursor-pointer"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-[#f97316] rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold text-[#1a1a1a]">Search Acts</h4>
                  <p className="text-[12px] text-[#666]">IndiaCode Legislation</p>
                </div>
              </div>
              <p className="text-[13px] text-[#666]">Search Indian acts and find applicable legislation for your cases</p>
            </motion.div>

            {/* US Case Law - Removed per user request */}
          </div>
        </div>

        {/* Ongoing Cases */}
        <div className="px-4 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 20px 40px rgba(139,115,85,0.25)" }}
            transition={{ duration: 0.5, delay: 0.9 }}
            onClick={() => onNavigate("legal-researcher")}
            className="max-w-6xl mx-auto bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>{t('ongoing_cases')}</h3>
            </div>
            <div className="space-y-3">
              {ongoingCasesData.map((caseItem: any) => (
                <div key={caseItem.id} className="bg-[#f5f1e8] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
                  <span className="text-[13px] font-mono text-[#666] min-w-[100px]">#{caseItem.id}</span>
                  <span className="text-[14px] text-[#1a1a1a] flex-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{caseItem.parties}</span>
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex-1 bg-[#e5e0d5] rounded-full h-3 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${caseItem.progress}%` }}
                        transition={{ duration: 1, delay: 1 }}
                        className="h-full bg-gradient-to-r from-[#f97316] to-[#ea580c] rounded-full"
                      />
                    </div>
                    <span className="text-[13px] font-bold text-[#1a1a1a] min-w-[40px]">{caseItem.progress}%</span>
                  </div>
                  <span className="text-[12px] px-3 py-1 bg-[#d4c4a8] rounded-full text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>{caseItem.stage}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Completed Cases */}
        <div className="px-4 pb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 20px 40px rgba(139,115,85,0.25)" }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="max-w-6xl mx-auto bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>{t('completed_cases')}</h3>
            </div>
            <div className="space-y-2">
              {completedCasesData.map((caseItem: any) => (
                <div key={caseItem.id} className="bg-[#f5f1e8] rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <span className="text-[13px] font-mono text-[#666] min-w-[100px]">#{caseItem.id}</span>
                  <span className="text-[14px] text-[#1a1a1a] flex-1" style={{ fontFamily: "Montserrat, sans-serif" }}>{caseItem.parties}</span>
                  <span className="text-[14px] min-w-[80px]">{getVerdictEmoji(caseItem.verdict)} {caseItem.verdict}</span>
                  <span className="text-[13px] text-[#666] min-w-[100px]" style={{ fontFamily: "Montserrat, sans-serif" }}>{caseItem.details}</span>
                  <span className="text-[12px] text-[#999]" style={{ fontFamily: "Montserrat, sans-serif" }}>{caseItem.date}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Document Library used to be here, but now we have Documents page for it. Remove or keep simplified? User said "replace the previous page with the current one" but that applied to Documents. Dashboard can keep docs or just rely on main nav. Keeping it for comprehensive dashboard view is fine unless redundant. */}
        {/* Document Library */}
        <div className="px-4 pb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01, boxShadow: "0 20px 40px rgba(139,115,85,0.25)" }}
            transition={{ duration: 0.5, delay: 1.1 }}
            onClick={() => onNavigate("documents")}
            className="max-w-6xl mx-auto bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 cursor-pointer"
          >
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <h3 className="text-[18px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}>{t('document_library')}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {documentLibraryData.slice(0, 3).map((doc: any, idx: number) => (
                <div key={idx} className="bg-[#f5f1e8] rounded-lg p-4 flex items-center justify-between hover:bg-[#ebe5d8] transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-[#f97316] group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-[14px] text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>{doc.name}</span>
                  </div>
                  <span className="text-[12px] text-[#999]" style={{ fontFamily: "Montserrat, sans-serif" }}>{doc.date}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function InfiniteLogoScroll({ onMeetCustomers }: { onMeetCustomers: () => void }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="w-full py-6 sm:py-8 bg-[#f8f6f1] px-4 sm:px-8 md:px-12">
      {/* Container with side margins */}
      <div
        className="relative overflow-hidden rounded-lg border border-[#e5e0d5]"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Left blur fade */}
        <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 z-10 bg-gradient-to-r from-[#f8f6f1] to-transparent pointer-events-none" />

        {/* Right blur fade */}
        <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 z-10 bg-gradient-to-l from-[#f8f6f1] to-transparent pointer-events-none" />

        {/* Meet our customers button overlay on hover */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isHovered ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none"
        >
          <button
            onClick={onMeetCustomers}
            className="px-5 py-2.5 text-[14px] font-medium text-white bg-[#1a1a1a] border border-[#333] rounded-md flex items-center gap-2 pointer-events-auto hover:bg-[#333] transition-colors shadow-lg"
          >
            Meet our customers
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </motion.div>

        {/* Scrolling container */}
        <motion.div
          className="flex py-6"
          animate={{
            filter: isHovered ? "blur(8px)" : "blur(0px)",
            opacity: isHovered ? 0.3 : 1
          }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="flex items-center gap-20 px-8"
            animate={{
              x: [0, -2720],
            }}
            transition={{
              x: {
                duration: 35,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          >
            {/* First set of logos */}
            {companies.map((company, index) => (
              <div
                key={`first-${index}`}
                className="flex items-center justify-center min-w-[100px] h-10"
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="h-8 w-auto object-contain opacity-70"
                />
              </div>
            ))}
            {/* Duplicate set for seamless loop */}
            {companies.map((company, index) => (
              <div
                key={`second-${index}`}
                className="flex items-center justify-center min-w-[100px] h-10"
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="h-8 w-auto object-contain opacity-70"
                />
              </div>
            ))}
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// Customer reviews data
const customerReviews = [
  {
    name: "Liz Centoni",
    title: "Executive Vice President and Chief Customer Experience Officer, Cisco",
    quote: "Sample AI is a critical partner for Cisco Customer Experience (CX) as we build towards an Agentic-AI-Led future. The AI Renewals Agent is just the start of what we can build together with Sample's LLMs.",
    logo: "/logos/Screenshot-2024-01-25-at-15.09.28.png",
    company: "Cisco",
  },
  {
    name: "Bertrand Rondepierre",
    title: "CEO, NASA AI Research Division",
    quote: "Sample AI accelerates our space exploration research with advanced language models that help us analyze vast amounts of astronomical data.",
    logo: "/logos/nasa-curvy-logo.png",
    company: "NASA",
  },
  {
    name: "Tim Anderson",
    title: "VP of AI Integration, Apple Inc.",
    quote: "We leverage Sample AI to enhance Siri's natural language understanding capabilities across all devices, delivering smarter experiences to billions.",
    logo: "/logos/apple-logo.png",
    company: "Apple",
  },
  {
    name: "Sarah Mitchell",
    title: "Director of AI Solutions, IBM",
    quote: "Sample's models integrate seamlessly with Watson, powering next-gen enterprise AI solutions for our global clients.",
    logo: "/logos/ibm-logo.png",
    company: "IBM",
  },
  {
    name: "Maria Garcia",
    title: "Chief Digital Officer, Coca-Cola",
    quote: "Sample AI transforms our customer engagement with personalized marketing at scale, reaching millions with tailored experiences.",
    logo: "/logos/Coca-Cola_logo.svg_.png",
    company: "Coca-Cola",
  },
  {
    name: "James Wright",
    title: "Head of Innovation, Shell",
    quote: "AI-powered analytics from Sample optimize our energy operations globally, reducing costs and improving sustainability.",
    logo: "/logos/shell-logo.png",
    company: "Shell",
  },
  {
    name: "Kenji Tanaka",
    title: "CTO, Sony Interactive Entertainment",
    quote: "Sample AI enhances PlayStation's gaming experiences with intelligent NPCs and dynamic storytelling that adapts to players.",
    logo: "/logos/sony-vaio-curvy-logo-1.png",
    company: "Sony",
  },
];

function CustomerCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % customerReviews.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + customerReviews.length) % customerReviews.length);
  };

  const currentReview = customerReviews[currentIndex];
  const nextReview = customerReviews[(currentIndex + 1) % customerReviews.length];

  return (
    <div className="relative z-10 py-16 px-8">
      {/* Section Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between mb-10">
        <h2
          className="text-[36px] md:text-[42px] text-[#1a1a1a]"
          style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
        >
          Our customers.
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevSlide}
            className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center hover:bg-[#333] transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="w-10 h-10 bg-[#1a1a1a] rounded flex items-center justify-center hover:bg-[#333] transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel Cards - Vertical Layout */}
      <div className="max-w-6xl mx-auto flex gap-6">
        {/* Main Featured Card */}
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.4 }}
          className="flex-[2] bg-[#f5e6c8] rounded-lg p-10 min-h-[350px] flex flex-col"
        >
          <div className="mb-6">
            <h3
              className="text-[22px] font-semibold text-[#1a1a1a] mb-2"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {currentReview.name}
            </h3>
            <p
              className="text-[14px] text-[#666]"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {currentReview.title}
            </p>
          </div>
          <p
            className="text-[17px] text-[#1a1a1a] leading-relaxed flex-grow"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            "{currentReview.quote}"
          </p>
          <div className="mt-8">
            <img
              src={currentReview.logo}
              alt={currentReview.company}
              className="h-14 w-auto object-contain"
            />
          </div>
        </motion.div>

        {/* Preview Card for Next Review */}
        <motion.div
          key={`preview-${currentIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="flex-1 bg-[#f5e6c8] rounded-lg p-8 min-h-[350px] flex flex-col cursor-pointer hover:bg-[#f0dfc0] transition-colors"
          onClick={nextSlide}
        >
          <div className="mb-4">
            <h3
              className="text-[18px] font-semibold text-[#1a1a1a] mb-2"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {nextReview.name}
            </h3>
            <p
              className="text-[12px] text-[#666]"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {nextReview.title}
            </p>
          </div>
          <p
            className="text-[14px] text-[#666] leading-relaxed flex-grow line-clamp-4"
            style={{ fontFamily: "Montserrat, sans-serif" }}
          >
            "{nextReview.quote}"
          </p>
          <div className="mt-6">
            <img
              src={nextReview.logo}
              alt={nextReview.company}
              className="h-10 w-auto object-contain opacity-70"
            />
          </div>
        </motion.div>
      </div>

      {/* Slide Indicators */}
      <div className="flex justify-center gap-2 mt-8">
        {customerReviews.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all ${index === currentIndex ? "bg-[#1a1a1a] w-6" : "bg-[#d4b896]"
              }`}
          />
        ))}
      </div>
    </div>
  );
}

function LandingPage({ onMeetCustomers, onDashboard }: { onMeetCustomers: () => void; onDashboard: () => void }) {
  const [blocks] = useState<Block[]>(() => generateRandomBlocks(15));
  const [chatInput, setChatInput] = useState("");

  return (
    <div className="relative w-full overflow-hidden bg-[#f5f1e8]">
      {/* Mountain Section - 68vh */}
      <div className="relative" style={{ height: "68vh" }}>
        {/* Mountain Image */}
        <img
          src="/hero-bg.jpg"
          alt="Hero background"
          className="w-full h-full object-cover object-bottom"
        />

        {/* Navigation - positioned on mountain */}
        <motion.nav
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 sm:px-8 md:px-12 py-4 md:py-5"
        >
          {/* Logo */}
          <div className="flex items-center">
            <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
              <span className="text-[#1a1a1a] font-bold text-lg">M</span>
            </div>
          </div>

          {/* Nav Links - centered */}
          <div className="hidden lg:flex items-center gap-8">
            {["Products", "Solutions", "Research", "Resources", "Pricing", "Company"].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[#1a1a1a] hover:text-[#333] text-[15px] font-normal transition-colors"
              >
                {item}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden sm:flex items-center gap-2 sm:gap-3">
            <button
              onClick={onDashboard}
              className="px-3 sm:px-5 py-2 text-[12px] sm:text-[14px] font-medium text-white bg-[#1a1a1a] rounded-md hover:bg-[#333] transition-colors flex items-center gap-1 sm:gap-2"
            >
              Dashboard
              <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button className="px-3 sm:px-5 py-2 text-[12px] sm:text-[14px] font-medium text-white bg-[#f97316] rounded-md hover:bg-[#ea580c] transition-colors flex items-center gap-1 sm:gap-2">
              Try AI Studio
              <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </motion.nav>

        {/* Hero Content - positioned on mountain */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center px-4 pt-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              delay: 0.5,
              ease: [0.25, 0.4, 0.25, 1],
            }}
            className="max-w-4xl text-center"
          >
            {/* Main Heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.6,
              }}
              className="text-[32px] sm:text-[44px] md:text-[60px] lg:text-[80px] font-normal mb-4 sm:mb-5 tracking-[-0.02em] leading-[1.1]"
              style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
            >
              <span className="text-[#1a1a1a]">
                Frontier AI. In Your Hands.
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 0.8,
              }}
              className="text-[14px] sm:text-[16px] md:text-[20px] text-[#1a1a1a] mb-6 sm:mb-8 md:mb-10 font-normal tracking-normal"
            >
              Configurable AI for all builders.
            </motion.p>

            {/* Chat Input - Rectangle with slight rounding */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 1.0,
              }}
              className="mb-8"
            >
              <div className="relative max-w-md mx-auto">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Talk to le Chat"
                  className="w-full px-4 py-3 rounded-[4px] bg-white border border-[#e5e5e5] text-[#1a1a1a] text-[15px] placeholder-[#999] focus:outline-none focus:border-[#ccc] shadow-sm"
                />
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 bg-[#f97316] rounded-[4px] flex items-center justify-center hover:bg-[#ea580c] transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            </motion.div>

            {/* Action Links */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                delay: 1.2,
              }}
              className="flex flex-col sm:flex-row items-center gap-4 sm:gap-10 justify-center"
            >
              <a href="#" className="text-[#1a1a1a] text-[14px] sm:text-[15px] font-normal flex items-center gap-2 underline underline-offset-4 decoration-[#1a1a1a] hover:text-[#333] transition-colors">
                Get a demo
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
              <a href="#" className="text-[#1a1a1a] text-[14px] sm:text-[15px] font-normal flex items-center gap-2 underline underline-offset-4 decoration-[#1a1a1a] hover:text-[#333] transition-colors">
                Start building
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Infinite Logo Scroll Section */}
      <InfiniteLogoScroll onMeetCustomers={onMeetCustomers} />

      {/* Grid Background Section - below logo scroll */}
      <div className="relative min-h-[50vh]">
        {/* Grid Pattern */}
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(139, 115, 85, 0.15) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(139, 115, 85, 0.15) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Subtle Gradient Overlay */}
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background: `
              radial-gradient(circle at 20% 30%, rgba(245, 222, 179, 0.3) 0%, transparent 50%),
              radial-gradient(circle at 80% 70%, rgba(222, 184, 135, 0.2) 0%, transparent 50%)
            `,
          }}
        />

        {/* Animated Tetris-like Blocks */}
        <div className="absolute inset-0 z-[2]">
          {blocks.map((block) => (
            <motion.div
              key={block.id}
              initial={{
                opacity: 0,
                scale: 0.8,
                rotate: block.rotation - 15,
              }}
              animate={{
                opacity: [0.7, 0.85, 0.7],
                scale: 1,
                rotate: block.rotation,
                y: [0, -10, 0],
              }}
              transition={{
                duration: 3,
                delay: block.delay,
                ease: "easeInOut",
                opacity: {
                  duration: 4,
                  repeat: Infinity,
                  repeatType: "reverse",
                },
                y: {
                  duration: 6,
                  repeat: Infinity,
                  repeatType: "reverse",
                },
              }}
              className="absolute"
              style={{
                left: `${block.x}%`,
                top: `${block.y}%`,
                width: `${block.width}px`,
                height: `${block.height}px`,
              }}
            >
              <div
                className={cn(
                  "w-full h-full rounded-sm",
                  "bg-gradient-to-br from-[#f4e4c1]/90 to-[#e8d4a8]/85",
                  "border-2 border-[#d4b896]/60",
                  "shadow-[0_4px_16px_rgba(139,115,85,0.25)]",
                  "backdrop-blur-[2px]"
                )}
              />
            </motion.div>
          ))}
        </div>

        {/* Your AI Future Section */}
        <div className="relative z-10 py-16 px-8 text-center">
          <h2
            className="text-[40px] md:text-[48px] text-[#6b5744] mb-4"
            style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
          >
            Your AI future
          </h2>
          <p className="text-[#8b7355] text-lg max-w-2xl mx-auto">
            Build extraordinary applications with the most advanced AI platform designed for developers and enterprises.
          </p>
        </div>

        {/* Feature Grid Section */}
        <div className="relative z-10 px-8 pb-16">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 border border-[#AC9362] rounded-lg overflow-hidden">
              {/* Row 1 */}
              <div className="p-8 border-b border-r border-[#AC9362] md:border-r hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Faaast</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports an entire helping developers and innovate.
                </p>
              </div>

              <div className="p-8 border-b border-r border-[#AC9362] hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Powerful</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports an entire helping developers and businesses.
                </p>
              </div>

              <div className="p-8 border-b border-[#AC9362] hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Security</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports an helping developers businesses.
                </p>
              </div>

              {/* Row 2 */}
              <div className="p-8 border-r border-[#AC9362] hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Customization</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports helping developers and businesses innovate.
                </p>
              </div>

              <div className="p-8 border-r border-[#AC9362] hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Control</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports helping developers and businesses innovate.
                </p>
              </div>

              <div className="p-8 hover:bg-[#f5e6c8] transition-colors cursor-pointer group">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-5 h-5 text-[#6b5744]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <h3 className="text-[16px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "Montserrat, sans-serif" }}>Built for AI</h3>
                </div>
                <p className="text-[14px] text-[#666] leading-relaxed" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  It supports helping developers and businesses innovate.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Our Customers Section - Carousel */}
        <CustomerCarousel />
      </div>

      {/* Gradient Transition - Color Bands */}
      <div className="relative w-full">
        <div className="w-full h-[50px]" style={{ backgroundColor: "#FFFBEF" }} />
        <div className="w-full h-[50px]" style={{ backgroundColor: "#FFF8E6" }} />
        <div className="w-full h-[50px]" style={{ backgroundColor: "#FFF5DC" }} />
        <div className="w-full h-[50px]" style={{ backgroundColor: "#FFF3D6" }} />
        <div className="w-full h-[50px]" style={{ backgroundColor: "#FBE158" }} />
        <div className="w-full h-[50px]" style={{ backgroundColor: "#EFA734" }} />
      </div>

      {/* Footer */}
      <footer className="bg-[#F3EED2] pt-4 pb-4">
        {/* Logo Section */}
        <div className="px-8 py-6">
          <div className="flex justify-center">
            <h2
              className="text-[56px] md:text-[72px] lg:text-[80px] font-normal text-[#1a1a1a] tracking-wide"
              style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
            >
              Sample
            </h2>
          </div>
        </div>

        {/* Footer Content */}
        <div className="px-12 py-6 border-t border-[#d4cdb8]">
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Left Column */}
            <div>
              <p
                className="text-[11px] text-[#1a1a1a] uppercase tracking-wider leading-relaxed mb-8"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                ACCESSIBILITY STATEMENT: IF YOU ARE USING A SCREEN READER AND HAVING PROBLEMS USING THIS WEBSITE, PLEASE E-MAIL HELLO@MISTRAL.AI FOR ASSISTANCE.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="#"
                  className="text-[14px] text-[#1a1a1a] hover:underline"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  Products
                </a>
                <a
                  href="#"
                  className="text-[14px] text-[#1a1a1a] hover:underline"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  About Us
                </a>
              </div>
            </div>

            {/* Right Column */}
            <div>
              <p
                className="text-[11px] text-[#1a1a1a] uppercase tracking-wider mb-6"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                JOIN OUR MAILING LIST AND RECEIVE THE ULTIMATE AI GUIDE FOR FREE
              </p>
              <div className="flex mb-4">
                <input
                  type="email"
                  placeholder="Your Email Address"
                  className="flex-1 px-4 py-3 bg-white border border-[#1a1a1a] text-[14px] text-[#1a1a1a] placeholder-[#666] focus:outline-none"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
                <button className="px-4 py-3 bg-white border border-[#1a1a1a] border-l-0 hover:bg-[#f5f5f5] transition-colors">
                  <svg className="w-5 h-5 text-[#1a1a1a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
              <p
                className="text-[12px] text-[#666] mb-8"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                By signing up, you agree to our <a href="#" className="underline">Privacy Policy</a>
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-6">
                <a href="#" className="text-[#1a1a1a] hover:opacity-70 transition-opacity">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                  </svg>
                </a>
                <a href="#" className="text-[#1a1a1a] hover:opacity-70 transition-opacity">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
                  </svg>
                </a>
                <span
                  className="text-[13px] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                >
                  For all inquiries: hello@mistral.ai
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="px-12 py-4 border-t border-[#b8c4cc]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-6">
              <a
                href="#"
                className="text-[12px] text-[#1a1a1a] hover:underline"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Privacy Policy
              </a>
              <a
                href="#"
                className="text-[12px] text-[#1a1a1a] hover:underline"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Terms of Use
              </a>
              <a
                href="#"
                className="text-[12px] text-[#1a1a1a] hover:underline"
                style={{ fontFamily: "Montserrat, sans-serif" }}
              >
                Cookie Policy
              </a>
            </div>
            <p
              className="text-[12px] text-[#666]"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              (c) 2025 Sample AI. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}


// Settings Page Component
function SettingsPage({ onNavigate }: { onNavigate: (page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => void }) {
  const { isDark, toggleTheme } = useTheme();
  const colors = getThemeColors(isDark);

  const [userProfile, setUserProfile] = useState({
    name: "Lawyer1",
    email: "lawyer1@legalpractice.com",
    phone: "+91 98765 43210",
    barNumber: "BAR/2024/12345",
    specialization: "Constitutional & Criminal Law",
    firm: "Legal Associates LLP"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    caseReminders: true,
    autoSave: true
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden flex" style={{ backgroundColor: colors.bg }}>
      <TopNavbar activePage="settings" onNavigate={onNavigate} />
      <div className="flex-1 relative z-10 pt-20 p-8">
        <div className="max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[32px] font-normal text-[#1a1a1a] mb-8"
            style={{ fontFamily: "'Times New Roman', Georgia, serif", fontStyle: "italic" }}
          >
            Settings
          </motion.h1>

          {/* User Profile Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 mb-6"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-[#f97316] rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-[20px] font-semibold text-[#1a1a1a]" style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
                  User Profile
                </h2>
                <p className="text-[14px] text-[#666]" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Manage your personal information
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={userProfile.name}
                  onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={userProfile.email}
                  onChange={(e) => setUserProfile({ ...userProfile, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={userProfile.phone}
                  onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Bar Council Number
                </label>
                <input
                  type="text"
                  value={userProfile.barNumber}
                  onChange={(e) => setUserProfile({ ...userProfile, barNumber: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Specialization
                </label>
                <input
                  type="text"
                  value={userProfile.specialization}
                  onChange={(e) => setUserProfile({ ...userProfile, specialization: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-[#666] mb-1" style={{ fontFamily: "Montserrat, sans-serif" }}>
                  Law Firm
                </label>
                <input
                  type="text"
                  value={userProfile.firm}
                  onChange={(e) => setUserProfile({ ...userProfile, firm: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-[#d4b896] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f97316] text-[#1a1a1a]"
                  style={{ fontFamily: "Montserrat, sans-serif" }}
                />
              </div>
            </div>
          </motion.div>

          {/* Preferences Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#f5e6c8]/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-[#d4b896]/50 mb-6"
          >
            <h2 className="text-[20px] font-semibold mb-4" style={{ fontFamily: "'Times New Roman', Georgia, serif", color: colors.text }}>
              Preferences
            </h2>
            <div className="space-y-4">
              {/* Dark Mode Toggle - Separate and wired to ThemeContext */}
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' }}>
                <div>
                  <p className="text-[14px] font-medium" style={{ fontFamily: "Montserrat, sans-serif", color: colors.text }}>Dark Mode</p>
                  <p className="text-[12px]" style={{ fontFamily: "Montserrat, sans-serif", color: colors.textSecondary }}>Toggle dark theme for the entire app</p>
                </div>
                <button
                  onClick={toggleTheme}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isDark ? 'bg-[#f97316]' : 'bg-[#d4c4a8]'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${isDark ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {/* Other preferences */}
              {[
                { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive email updates about your cases' },
                { key: 'caseReminders', label: 'Case Reminders', desc: 'Get reminders for upcoming hearings and deadlines' },
                { key: 'autoSave', label: 'Auto-save', desc: 'Automatically save work in progress' }
              ].map((pref) => (
                <div key={pref.key} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.5)' }}>
                  <div>
                    <p className="text-[14px] font-medium" style={{ fontFamily: "Montserrat, sans-serif", color: colors.text }}>{pref.label}</p>
                    <p className="text-[12px]" style={{ fontFamily: "Montserrat, sans-serif", color: colors.textSecondary }}>{pref.desc}</p>
                  </div>
                  <button
                    onClick={() => setPreferences({ ...preferences, [pref.key]: !preferences[pref.key as keyof typeof preferences] })}
                    className={`w-12 h-6 rounded-full transition-colors relative ${preferences[pref.key as keyof typeof preferences] ? 'bg-[#f97316]' : 'bg-[#d4c4a8]'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${preferences[pref.key as keyof typeof preferences] ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex justify-end gap-3"
          >
            <button
              onClick={() => onNavigate("dashboard")}
              className="px-6 py-2.5 bg-[#e5ddd0] text-[#666] rounded-lg hover:bg-[#d4c4a8] transition-colors font-medium"
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2.5 rounded-lg font-medium transition-all ${saved ? 'bg-green-500 text-white' :
                saving ? 'bg-[#f97316]/70 text-white' :
                  'bg-[#f97316] text-white hover:bg-[#ea580c]'
                }`}
              style={{ fontFamily: "Montserrat, sans-serif" }}
            >
              {saved ? '✓ Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<"landing" | "customers" | "dashboard" | "documents" | "settings" | "clients" | "legal-researcher" | "admin">("dashboard");

  // Landing page doesn't need LanguageProvider
  if (currentPage === "landing") {
    return <LandingPage onMeetCustomers={() => setCurrentPage("customers")} onDashboard={() => setCurrentPage("dashboard")} />;
  }

  // Customers page (public facing, no sidebar)
  if (currentPage === "customers") {
    return <CustomersPage />;
  }

  // All dashboard pages wrapped with LanguageProvider for multilingual support
  return (
    <LanguageProvider>
      {currentPage === "clients" && (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#f5f1e8] flex">
          <TopNavbar activePage="clients" onNavigate={(page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => setCurrentPage(page)} />
          <div className="flex-1 relative z-10 pt-20 p-8">
            <ClientsPage />
          </div>
        </div>
      )}

      {currentPage === "dashboard" && (
        <DashboardPage onNavigate={(page) => setCurrentPage(page)} />
      )}

      {currentPage === "documents" && (
        <DocumentsPage onNavigate={(page) => setCurrentPage(page)} />
      )}



      {currentPage === "settings" && (
        <SettingsPage onNavigate={(page) => setCurrentPage(page)} />
      )}

      {currentPage === "legal-researcher" && (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#f5f1e8] flex">
          <TopNavbar activePage="legal-researcher" onNavigate={(page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => setCurrentPage(page)} />
          <div className="flex-1 relative z-10 pt-20">
            <LegalResearcherPage />
          </div>
        </div>
      )}

      {currentPage === "admin" && (
        <div className="relative min-h-screen w-full overflow-hidden bg-[#f5f1e8] flex">
          <TopNavbar activePage="dashboard" onNavigate={(page: "dashboard" | "documents" | "settings" | "clients" | "legal-researcher") => setCurrentPage(page)} />
          <AdminDashboard />
        </div>
      )}
    </LanguageProvider>
  );
}






