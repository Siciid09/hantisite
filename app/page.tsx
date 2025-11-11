"use client";

import React, { useState, useEffect, useRef } from 'react';
// NEW: Import icons from lucide-react
import {
  LayoutGrid, Sparkles, MessageCircle, DollarSign, Download, LogIn, X, Apple,
  Store, MessageSquare, Twitter, Facebook, Linkedin, CheckCircle2, FileText,
  Package, ShoppingBag, Building, Users, PieChart, BarChart, CreditCard, UserPlus,
  LucideProps, MoreVertical, Check, XCircle,
  Loader2 // <-- (GEMINI) Added Loader icon
} from 'lucide-react'; // Added Check and XCircle

// --- 0. Global Styles Component ---

/**
 * Injects custom CSS.
 * NOTE: Ideally, move this into your 'globals.css' file.
 */
const GlobalStyles = () => (
  <style>{`
    html { scroll-behavior: smooth; }
    /* This component's styles will override your layout's body styles on this page */
    body {
        font-family: 'Inter', sans-serif;
        background-color: #030409;
        color: #e0e0e0;
        overflow-x: hidden;
        /* A subtle gradient grid background for a "tech" feel */
        background-image: 
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
        background-size: 30px 30px;
        /* NEW: Animated background */
        animation: animated-bg 20s linear infinite alternate;
    }

    @keyframes animated-bg {
        0% { background-color: #030409; }
        50% { background-color: #050c1f; } /* Deep blue */
        100% { background-color: #0a051f; } /* Deep purple/blue */
    }

    /* 1. 3D Hero Dashboard */
    .hero-perspective {
        perspective: 1500px;
    }
    #hero-dashboard {
        background: rgba(10, 10, 15, 0.5);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform-style: preserve-3d;
        will-change: transform;
        transition: transform 0.1s linear;
    }
    .hero-dashboard-inner {
        transform: translateZ(40px); /* Gives the content depth */
        transform-style: preserve-3d;
    }
    .live-data-ticker {
        text-shadow: 0 0 8px #00ddff;
        color: #00ddff;
    }

    /* 2. Self-Drawing Data Flow (Canvas) */
    #module-flow-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
        pointer-events: none;
    }
    .module-icon div {
        transition: all 0.3s ease;
    }
    .module-icon div:hover {
        transform: scale(1.15);
        box-shadow: 0 0 30px #00ddff80;
    }
    .module-icon svg, .module-icon p {
        transition: all 0.3s ease;
    }
    .step-trigger h3 {
        transition: transform 0.3s ease, color 0.3s ease;
    }
    .step-trigger:hover h3 {
        transform: scale(1.1) rotate(-3deg);
        color: #00ddff;
    }

    /* 3. 3D Magnetic Module Cards */
    .module-grid-perspective {
        perspective: 2000px;
    }
    .module-card {
        background: rgba(15, 16, 22, 0.6);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        transform-style: preserve-3d;
        transition: transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
        position: relative;
        overflow: hidden;
        will-change: transform;
    }
    .module-card-inner {
        transform: translateZ(30px); /* Gives content depth */
    }
    .module-card::before {
        content: '';
        position: absolute;
        top: var(--mouse-y, 50%);
        left: var(--mouse-x, 50%);
        width: 0;
        height: 0;
        background: radial-gradient(circle at center, rgba(0, 221, 255, 0.15) 0%, transparent 70%);
        transform: translate(-50%, -50%);
        transition: width 0.4s ease-out, height 0.4s ease-out;
        opacity: 0;
    }
    .module-card:hover::before {
        width: 500px;
        height: 500px;
        opacity: 1;
    }

    /* 4. Animated Analytics Dashboard */
    .chart {
        display: flex;
        justify-content: space-around;
        align-items: flex-end;
        height: 200px;
        border-bottom: 2px solid #222;
        padding: 0 10px;
    }
    .chart-bar {
        width: 30px;
        background: linear-gradient(to top, #0070f3, #00ddff);
        transform: scaleY(0);
        transform-origin: bottom;
        border-radius: 5px 5px 0 0;
        transition: transform 1.5s cubic-bezier(0.19, 1, 0.22, 1);
    }
    .chart-bar.live-update {
         transition: transform 0.5s ease-out;
    }
    .chart-bar.visible {
        transform: scaleY(var(--bar-height, 0));
    }
    #pie-chart-canvas, #pie-chart-canvas-2,
    #inventory-pie-chart, #inventory-bar-chart,
    #customer-line-chart {
        transition: transform 1s cubic-bezier(0.19, 1, 0.22, 1), opacity 1s ease;
        transform: scale(0);
        opacity: 0;
    }
    #pie-chart-canvas.visible, #pie-chart-canvas-2.visible,
    #inventory-pie-chart.visible, #inventory-bar-chart.visible,
    #customer-line-chart.visible {
        transform: scale(1);
        opacity: 1;
    }
    #line-chart-canvas {
        opacity: 0;
        transition: opacity 1.5s ease 0.5s;
    }
    #line-chart-canvas.visible {
        opacity: 1;
    }
    .dashboard-tab {
        transition: all 0.3s ease;
    }
    .dashboard-tab.active {
        background: #0070f3;
        color: white;
    }
    
    /* FIX: Tab content styles */
    .tab-content {
        display: none; /* Hide by default */
    }
    .tab-content.active {
        display: block; /* Default active display */
    }
    /* Grid layouts for specific tabs */
    #sales-content.active,
    #inventory-content.active,
    #customers-content.active {
        display: grid;
    }
    
    /* Preserve sales grid layout */
    #sales-content.active {
        grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 1.5rem;
    }
    @media (min-width: 1024px) { /* lg */
        #sales-content.active {
            grid-template-columns: repeat(4, minmax(0, 1fr));
        }
    }
    /* Preserve inventory/customer grid layout */
    #inventory-content.active,
    #customers-content.active {
         grid-template-columns: repeat(1, minmax(0, 1fr));
        gap: 1.5rem;
    }
     @media (min-width: 1024px) { /* lg */
        #inventory-content.active,
        #customers-content.active {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    /* 5. Spotlight Button */
    .spotlight-button {
        position: relative;
        overflow: hidden;
        background: #0070f3;
        transition: background 0.3s;
    }
    .spotlight-button::before {
        content: '';
        position: absolute;
        left: var(--mouse-x, 50%);
        top: var(--mouse-y, 50%);
        width: 0;
        height: 0;
        background: radial-gradient(circle at center, rgba(255, 255, 255, 0.3) 0%, transparent 80%);
        transform: translate(-50%, -50%);
        transition: width 0.4s ease-out, height 0.4s ease-out;
        opacity: 0;
    }
    .spotlight-button:hover::before {
        width: 300px;
        height: 300px;
        opacity: 1;
    }
    /* (GEMINI) Added disabled styles */
    .spotlight-button:disabled {
        opacity: 0.6;
        background: #004a9e;
        cursor: not-allowed;
    }
    .spotlight-button:disabled::before {
      width: 0;
      height: 0;
      opacity: 0;
    }


    /* 6. Scroll Animation Base State */
    .scroll-reveal {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.8s cubic-bezier(0.165, 0.84, 0.44, 1), transform 0.8s cubic-bezier(0.165, 0.84, 0.44, 1);
    }
    .scroll-reveal.visible {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* 7. Hamburger Menu */
    .nav-links {
        transition: opacity 0.5s ease, clip-path 0.5s ease;
        clip-path: inset(0 0 100% 0);
        opacity: 0;
        pointer-events: none;
    }
    .nav-links.open {
        transform: translateY(0);
        opacity: 1;
        clip-path: inset(0 0 0 0);
        pointer-events: all;
    }
    .hamburger-lines {
        width: 28px;
        height: 20px;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }
    .line {
        display: block;
        height: 3px;
        width: 100%;
        border-radius: 10px;
        background: #e0e0e0;
        transition: transform 0.4s ease-in-out, opacity 0.4s ease-in-out;
    }
    .line1 { transform-origin: top left; }
    .line3 { transform-origin: bottom left; }
    
    .hamburger-lines.open .line1 {
        transform: rotate(45deg) translate(2px, -3px);
    }
    .hamburger-lines.open .line2 {
        opacity: 0;
        transform: translateX(-20px);
    }
    .hamburger-lines.open .line3 {
        transform: rotate(-45deg) translate(3px, 4px);
    }

    /* Mobile nav link staggered animation */
    .mobile-nav-link {
        opacity: 0;
        transform: translateY(10px);
        transition: opacity 0.3s ease, transform 0.3s ease;
    }
    .mobile-nav-link.visible {
        opacity: 1;
        transform: translateY(0);
    }

    /* 8. Modal Form */
    #modal-backdrop {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        z-index: 90;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
    }
    #modal-form {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        z-index: 100;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
    }
    body.modal-open #modal-backdrop,
    body.modal-open #modal-form {
        opacity: 1;
        pointer-events: all;
    }
    body.modal-open #modal-form {
        transform: translate(-50%, -50%) scale(1);
    }
    .form-input {
        background-color: #1a1a1a;
        border: 1px solid #333;
        transition: border-color 0.3s, box-shadow 0.3s;
    }
    .form-input:focus {
        outline: none;
        border-color: #00ddff;
        box-shadow: 0 0 15px rgba(0, 221, 255, 0.3);
    }
    /* (GEMINI) Added disabled styles for form */
    .form-input:disabled {
        background-color: #2a2a2a;
        opacity: 0.7;
        cursor: not-allowed;
    }

    /* 9. "Old Book" 3D Tilt & Glow */
    #old-book-wrapper {
        perspective: 1000px;
        padding: 10px;
    }
    #old-book-image {
        transition: transform 0.1s linear;
        position: relative;
        overflow: hidden;
        border: 8px solid transparent; 
        background-clip: padding-box;
        z-index: 1;
        box-shadow: 0 0 25px rgba(255, 0, 0, 0.3), 0 0 40px rgba(255, 0, 0, 0.2);
    }
    #old-book-image::after {
        content: '';
        position: absolute;
        top: -8px; left: -8px; right: -8px; bottom: -8px;
        background: linear-gradient(60deg, #ff0000, #ff4500, #e0007c, #ff0000);
        background-size: 300% 300%;
        animation: animated-gradient-border 4s linear infinite;
        z-index: -2;
        border-radius: 10px;
    }
    #old-book-image::before {
        content: '';
        position: absolute;
        top: -10px; left: -10px; right: -10px; bottom: -10px;
        background: linear-gradient(60deg, #ff0000, #ff4500, #e0007c, #ff0000);
        background-size: 300% 300%;
        animation: animated-gradient-border 4s linear infinite;
        z-index: -1;
        border-radius: 12px;
        filter: blur(12px);
        opacity: 0.8;
    }
    @keyframes animated-gradient-border {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
    }

    /* Header link hover "torch" */
    .header-link {
        position: relative;
        padding: 6px 12px;
        border-radius: 9999px;
        transition: background-color 0.3s, color 0.3s;
    }
    .header-link::before {
        content: none;
    }
    .header-link:hover {
        color: #00ddff;
        background-color: rgba(0, 221, 255, 0.1);
    }
    .header-link:hover::before {
        content: none;
    }

    /* 10. Testimonial Slideshow */
    #testimonial-slider {
        position: relative;
        overflow: hidden;
    }
    #testimonial-track {
        display: flex;
        transition: transform 0.5s cubic-bezier(0.23, 1, 0.32, 1);
    }
    .testimonial-slide {
        flex: 0 0 100%;
        width: 100%;
    }
    #testimonial-dots {
        position: absolute;
        bottom: -20px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
    }
    .testimonial-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: #444;
        cursor: pointer;
        transition: background 0.3s, transform 0.3s;
        margin-left: 0.25rem;
        margin-right: 0.25rem;
    }
    .testimonial-dot:first-child { margin-left: 0; }
    .testimonial-dot:last-child { margin-right: 0; }
    .testimonial-dot.active {
        background: #00ddff;
        transform: scale(1.2);
    }

    /* 11. Floating Chat Button */
    .floating-chat-fab {
        background-color: #0070f3; /* Changed from green */
        color: white;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .floating-chat-fab:hover {
        transform: scale(1.1);
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
    }
    .floating-chat-fab svg {
        width: 32px;
        height: 32px;
    }

    /* NEW: Floating message animation */
    @keyframes fadeInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* 12. Live Ticker Animations */
    .ticker-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: rgba(0, 221, 255, 0.05);
        border: 1px solid rgba(0, 221, 255, 0.1);
        padding: 10px 14px;
        border-radius: 8px;
        opacity: 0;
        animation: slideInUp 0.5s ease forwards;
    }
    .ticker-item.stock-item {
        display: block; /* Override flex for stock items */
    }
    .ticker-item.ticker-item-exit {
        animation: slideOutUp 0.5s ease forwards;
    }
    @keyframes slideInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slideOutUp {
        from { opacity: 1; transform: translateY(0); }
        to { opacity: 0; transform: translateY(-30px); }
    }
  `}</style>
);

// --- 1. NEW Icon Component ---

/**
 * Maps icon names to lucide-react components.
 */
const Icon = ({ name, className }: { name: string; className?: string; }) => {
  const props: LucideProps = { className };
  switch (name) {
    case 'grid-outline':
      return <LayoutGrid {...props} />;
    case 'sparkles-outline':
      return <Sparkles {...props} />;
    case 'chatbubbles-outline':
      return <MessageCircle {...props} />;
    case 'cash-outline':
      return <DollarSign {...props} />;
    case 'download-outline':
      return <Download {...props} />;
    case 'log-in-outline':
      return <LogIn {...props} />;
    case 'close-outline':
      return <X {...props} />;
    case 'logo-apple':
      return <Apple {...props} />;
    case 'logo-google-playstore':
      return <Store {...props} />;
    case 'logo-whatsapp': // Kept for reference, but using chatbubbles
      return <MessageSquare {...props} />;
    case 'logo-twitter':
      return <Twitter {...props} />;
    case 'logo-facebook':
      return <Facebook {...props} />;
    case 'logo-linkedin':
      return <Linkedin {...props} />;
    case 'checkmark-circle-outline':
      return <CheckCircle2 {...props} />;
    case 'document-text-outline':
      return <FileText {...props} />;
    // Data flow icons
    case 'pos':
      return <CreditCard {...props} />;
    case 'inventory':
      return <Package {...props} />;
    case 'purchases':
      return <ShoppingBag {...props} />;
    case 'suppliers':
      return <Building {...props} />;
    case 'crm':
      return <UserPlus {...props} />;
    case 'finance':
      return <PieChart {...props} />;
    case 'hr':
      return <Users {...props} />;
    case 'analytics':
      return <BarChart {...props} />;
    case 'check':
      return <Check {...props} />;
    case 'x-circle':
      return <XCircle {...props} />;
    // (GEMINI) Added loader
    case 'loader':
      return <Loader2 {...props} />;
    default:
      return <Sparkles {...props} />;
  }
};


// --- 2. Reusable UI Components ---

// Prop Types
type SpotlightButtonProps = {
  children: React.ReactNode;
  className: string;
  onClick?: () => void;
  href?: string;
  type?: "button" | "submit" | "reset";
  style?: React.CSSProperties;
  disabled?: boolean; // (GEMINI) Added disabled prop
};

type ModuleCardProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  icon?: string; // This is an SVG path string, not a component
};

type HeaderLinkProps = {
  href: string;
  iconName: string;
  children: React.ReactNode;
};

type MobileNavLinkProps = {
  href: string;
  iconName: string;
  children: React.ReactNode;
  isVisible: boolean;
};

type ChecklistItemProps = {
  children: React.ReactNode;
};

type DownloadButtonProps = {
  platform: 'apple' | 'google';
  href: string;
};

type FooterLinkGroupProps = {
  title: string;
  links: Array<{ name: string; href: string }>;
};

// (GEMINI) Updated ModalProps
type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  plan: { type: string; price: number } | null; // Pass selected plan
};

type HeaderProps = {
  onDemoClick: (planType: string, planPrice: number) => void; // (GEMINI) Updated signature
  onMenuToggle: () => void;
  isMenuOpen: boolean;
};

type MobileMenuProps = {
  isOpen: boolean;
  onDemoClick: () => void; // This is for the main App state, but links to pricing buttons
  onLinkClick: () => void;
};

type HeroProps = {
  onDemoClick: (planType: string, planPrice: number) => void; // (GEMINI) Updated signature
};

type DataFlowProps = {
  stepRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
};

type SalesTabProps = {
  isActive: boolean;
};

type InventoryTabProps = {
  isActive: boolean;
};

type CustomersTabProps = {
  isActive: boolean;
};

type ReportsTabProps = {
  isActive: boolean;
};

type PricingProps = {
  onDemoClick: (planType: string, planPrice: number) => void; // (GEMINI) Updated signature
};

// Component Definitions

const SpotlightButton: React.FC<SpotlightButtonProps> = ({ children, className, onClick, href, type, style, disabled }) => {
  const buttonRef = useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;

    // FIX: Cast generic 'Event' to 'MouseEvent'
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (!el) return; // Safety check
      const rect = el.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      el.style.setProperty('--mouse-x', `${x}px`);
      el.style.setProperty('--mouse-y', `${y}px`);
    };

    const handleMouseLeave = () => {
      if (!el) return;
      el.style.setProperty('--mouse-x', '50%');
      el.style.setProperty('--mouse-y', '50%');
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const commonProps = {
    className: `spotlight-button ${className}`,
    onClick: onClick,
    style: style,
    disabled: disabled, // (GEMINI) Pass disabled prop
  };

  if (href) {
    return (
      <a href={href} ref={buttonRef as React.Ref<HTMLAnchorElement>} {...commonProps}>
        <span className="relative z-10">{children}</span>
      </a>
    );
  }

  return (
    <button type={type || 'button'} ref={buttonRef as React.Ref<HTMLButtonElement>} {...commonProps}>
      <span className="relative z-10">{children}</span>
    </button>
  );
};

const ModuleCard: React.FC<ModuleCardProps> = ({ children, className = '', delay = 0, icon }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    // FIX: Cast generic 'Event' to 'MouseEvent'
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (window.innerWidth < 768) return;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = (centerY - y) / centerY * 10;
      const rotateY = (x - centerX) / centerX * 10;
      const translateX = (x - centerX) / centerX * 5;
      const translateY = (y - centerY) / centerY * 5;

      el.style.setProperty('--mouse-x', `${x}px`);
      el.style.setProperty('--mouse-y', `${y}px`);

      el.style.transform = `translateX(${translateX}px) translateY(${translateY}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.1)`;
    };

    const handleMouseLeave = () => {
      if (!el) return;
      el.style.setProperty('--mouse-x', '50%');
      el.style.setProperty('--mouse-y', '50%');
      el.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    };

    el.addEventListener('mousemove', handleMouseMove);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      el.removeEventListener('mousemove', handleMouseMove);
      el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={`module-card scroll-reveal rounded-2xl p-8 ${className}`}
      style={{ transitionDelay: `${delay}s` }}
    >
      <div className="module-card-inner">
        {icon && (
          <div className="text-blue-400 mb-4">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
            </svg>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};

const HeaderLink: React.FC<HeaderLinkProps> = ({ href, iconName, children }) => (
  <a href={href} className="header-link text-gray-300 flex items-center space-x-2">
    <Icon name={iconName} className="h-5 w-5" />
    <span>{children}</span>
  </a>
);

const MobileNavLink: React.FC<MobileNavLinkProps> = ({ href, iconName, children, isVisible }) => (
  <a
    href={href}
    className={`mobile-nav-link text-gray-300 hover:text-white text-lg flex items-center space-x-3 ${
      isVisible ? 'visible' : ''
    }`}
  >
    <Icon name={iconName} className="h-6 w-6" />
    <span>{children}</span>
  </a>
);

const ChecklistItem: React.FC<ChecklistItemProps> = ({ children }) => (
  <div className="flex items-center space-x-3">
    <Icon name="checkmark-circle-outline" className="text-cyan-400 h-6 w-6" />
    <span>{children}</span>
  </div>
);

const DownloadButton: React.FC<DownloadButtonProps> = ({ platform, href }) => {
  const isApple = platform === 'apple';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-gray-800 border border-gray-700 rounded-lg px-6 py-3 text-white flex items-center hover:bg-gray-700 transition-all w-64 justify-center"
    >
      {/* Icon removed as requested */}
      <div>
        <p className="text-xs text-center">{isApple ? 'Download on the' : 'GET IT ON'}</p>
        <p className="text-xl font-semibold">{isApple ? 'App Store' : 'Google Play'}</p>
      </div>
    </a>
  );
};

const FooterLinkGroup: React.FC<FooterLinkGroupProps> = ({ title, links }) => (
  <div>
    <h4 className="font-semibold text-white mb-4">{title}</h4>
    <ul className="space-y-3 text-sm">
      {links.map((link) => (
        <li key={link.name}>
          <a href={link.href} className="hover:text-white">
            {link.name}
          </a>
        </li>
      ))}
    </ul>
  </div>
);

const FloatingChatButton = () => {
  const [showMessage, setShowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMessage(true);
    }, 3000); // Show after 3 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex items-end space-x-3">
      {/* The message bubble */}
      {showMessage && (
        <div 
          className="bg-white text-gray-800 p-3 rounded-lg rounded-br-none shadow-lg"
          style={{ animation: 'fadeInUp 0.5s ease-out' }}
        >
          <p className="font-semibold text-sm">Hi, how can I help you?</p>
        </div>
      )}
      {/* The FAB */}
      <a 
        href="httpsax://wa.me/252653227084" // Still links to WhatsApp, but icon is generic
        target="_blank" 
        rel="noopener noreferrer" 
         className="floating-chat-fab relative flex items-center justify-center"
        aria-label="Chat with us"
      >
        <Icon name="chatbubbles-outline" />
      </a>
    </div>
  );
};

// --- (GEMINI) MODIFIED MODAL COMPONENT ---
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, plan }) => {
  const [showContent, setShowContent] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', company: '', whatsapp: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Reset form when modal opens or plan changes
  useEffect(() => {
    if (isOpen) {
      setFormData({ name: '', email: '', company: '', whatsapp: '' });
      setFormMessage(null);
      setIsSaving(false);
      
      const timer = setTimeout(() => setShowContent(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen, plan]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!plan) return; // Should not happen
    if (!formData.name || !formData.email || !formData.company || !formData.whatsapp) {
      setFormMessage({ type: 'error', text: 'Please fill out all fields.' });
      return;
    }
    
    setIsSaving(true);
    setFormMessage(null);
    
    const trialData = {
      name: formData.name,
      email: formData.email,
      companyName: formData.company,
      whatsapp: formData.whatsapp,
      planType: plan.type,
      planPrice: plan.price,
    };

    try {
      // 1. Send data to our secure API route
      const res = await fetch('/api/start-trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trialData),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit trial request.');
      }
      
      // 2. Success
      setFormMessage({ type: 'success', text: 'Success! We will contact you shortly.' });
      setIsSaving(false); // Re-enable form for a moment to show success

      // 3. Open WhatsApp link for confirmation
      const waNumber = '252653227084'; // From FloatingChatButton
      const waMessage = `New ${plan.type} Trial Request:\n\nName: ${formData.name}\nBusiness: ${formData.company}\nEmail: ${formData.email}\nWhatsApp: ${formData.whatsapp}\nPlan: ${plan.type} ($${plan.price}/mo)`;
      const waUrl = `https_ax://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;
      
      // Use target="_blank" for web WhatsApp
      window.open(waUrl, '_blank', 'noopener,noreferrer');
      
      // 4. Close modal after delay
      setTimeout(() => {
        onClose();
      }, 3000); // 3-second delay to read success message
      
    } catch (err: any) {
      setIsSaving(false);
      setFormMessage({ type: 'error', text: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div id="modal-backdrop" className="modal-close-button" onClick={onClose}></div>
      <div id="modal-form" className={`w-full max-w-lg p-4 ${showContent ? 'modal-open' : ''}`}>
        <div className="bg-gray-900 border border-cyan-500/30 rounded-2xl shadow-2xl shadow-cyan-500/20 p-8 relative">
          <button 
            className="modal-close-button absolute top-4 right-4 text-gray-500 hover:text-white disabled:opacity-50" 
            onClick={onClose}
            disabled={isSaving}
          >
            <Icon name="close-outline" className="h-8 w-8" />
          </button>
          
          <h2 className="text-3xl font-bold text-white mb-2">Start Your Free Trial</h2>
          <p className="text-lg text-cyan-400 font-medium mb-4">
            Plan: {plan?.type} (${plan?.price}/mo)
          </p>
          <p className="text-gray-400 mb-6">Enter your details and we'll set up your 14-day trial. No credit card required.</p>
          
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="name" className="text-sm font-medium text-gray-300">Full Name</label>
              <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} disabled={isSaving} className="form-input w-full p-3 rounded-lg text-white mt-1" placeholder="e.g. Ahmed Adan" />
            </div>
            <div>
              <label htmlFor="email" className="text-sm font-medium text-gray-300">Email Address</label>
              <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} disabled={isSaving} className="form-input w-full p-3 rounded-lg text-white mt-1" placeholder="you@company.com" />
            </div>
            <div>
              <label htmlFor="company" className="text-sm font-medium text-gray-300">Business Name</label>
              <input type="text" id="company" name="company" value={formData.company} onChange={handleChange} disabled={isSaving} className="form-input w-full p-3 rounded-lg text-white mt-1" placeholder="e.g. Bilan Restaurant" />
            </div>
            <div>
              <label htmlFor="whatsapp" className="text-sm font-medium text-gray-300">WhatsApp Number</label>
              <input type="tel" id="whatsapp" name="whatsapp" value={formData.whatsapp} onChange={handleChange} disabled={isSaving} className="form-input w-full p-3 rounded-lg text-white mt-1" placeholder="e.g. 2526..." />
            </div>
            
            {/* (GEMINI) Form message display */}
            {formMessage && (
              <div className={`p-3 rounded-lg text-sm ${
                formMessage.type === 'success' 
                ? 'bg-green-800/50 text-green-300' 
                : 'bg-red-800/50 text-red-300'
              }`}>
                {formMessage.text}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <SpotlightButton 
                type="submit" 
                className="w-full text-white font-semibold py-3 px-6 rounded-full flex items-center justify-center gap-2"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Icon name="loader" className="h-5 w-5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Confirm & Send Data'
                )}
              </SpotlightButton>
            </div>
            <p className="text-xs text-gray-500 text-center pt-2">
              Clicking "Confirm" will save your info and open WhatsApp to send us a confirmation message.
            </p>
          </form>
        </div>
      </div>
    </>
  );
};

// --- 3. Page Section Components ---

const Header: React.FC<HeaderProps> = ({ onDemoClick, onMenuToggle, isMenuOpen }) => (
  <header className="fixed top-0 left-0 w-full z-50 bg-black/20 backdrop-blur-xl border-b border-white/10">
    <nav className="container mx-auto px-6 py-4 flex justify-between items-center">
      <a href="#hero" className="flex-shrink-0 flex items-center space-x-2">
        <img src="/logo1.png" className="h-8 md:h-10 w-auto" alt="HantiKaab Logo" />
        <span className="text-2xl font-bold text-white tracking-wider">Hanti<span className="text-cyan-400">Kaab</span></span>
      </a>
      
      <div className="hidden md:flex space-x-2 items-center">
        <HeaderLink href="#modules" iconName="grid-outline">Modules</HeaderLink>
        <HeaderLink href="#features" iconName="sparkles-outline">Features</HeaderLink>
        <HeaderLink href="#testimonials" iconName="chatbubbles-outline">Testimonials</HeaderLink>
        <HeaderLink href="#pricing" iconName="cash-outline">Pricing</HeaderLink>
        <HeaderLink href="#download" iconName="download-outline">Download</HeaderLink>
        <HeaderLink href="/login" iconName="log-in-outline">Login</HeaderLink>
      </div>
      
      <div className="md:hidden">
        <button id="hamburger-button" className="md:hidden text-white w-8 h-8 relative focus:outline-none" onClick={onMenuToggle}>
          <span className="sr-only">Open main menu</span>
          <div className={`hamburger-lines ${isMenuOpen ? 'open' : ''}`}>
            <span className="line line1"></span>
            <span className="line line2"></span>
            <span className="line line3"></span>
          </div>
        </button>
      </div>
    </nav>
    
    <MobileMenu 
     isOpen={isMenuOpen}
      // (GEMINI) Pass a default trial click for mobile menu
      onDemoClick={() => onDemoClick('Business', 10)} 
      onLinkClick={onMenuToggle} 
    />
  </header>
);

const MobileMenu: React.FC<MobileMenuProps> = ({ isOpen, onDemoClick, onLinkClick }) => {
  const [visibleLinks, setVisibleLinks] = useState<number[]>([]);

  const navItems = [
    { href: '#modules', icon: 'grid-outline', text: 'Modules' },
    { href: '#features', icon: 'sparkles-outline', text: 'Features' },
    { href: '#testimonials', icon: 'chatbubbles-outline', text: 'Testimonials' },
    { href: '#pricing', icon: 'cash-outline', text: 'Pricing' },
    { href: '#download', icon: 'download-outline', text: 'Download' },
    { href: '/login', icon: 'log-in-outline', text: 'Login' },
  ];

  useEffect(() => {
    let timers: NodeJS.Timeout[] = [];
    if (isOpen) {
      navItems.forEach((_, index) => {
        timers.push(
          setTimeout(() => {
            setVisibleLinks((prev) => [...prev, index]);
          }, index * 70 + 100)
        );
      });
    } else {
      setVisibleLinks([]);
    }
    return () => timers.forEach(clearTimeout);
  }, [isOpen, navItems.length]);

  return (
    <div id="mobile-menu" className={`nav-links md:hidden absolute top-full left-0 w-full bg-gray-900/95 backdrop-blur-lg ${isOpen ? 'open' : ''}`}>
      <div className="flex flex-col items-center space-y-6 py-8" onClick={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target instanceof Element && (e.target.closest('a') || e.target.closest('button'))) {
          onLinkClick();
        }
      }}>
        {navItems.map((item, index) => (
          <MobileNavLink
            key={item.text}
            href={item.href}
            iconName={item.icon}
            isVisible={visibleLinks.includes(index)}
          >
            {item.text}
          </MobileNavLink>
        ))}
      </div>
    </div>
  );
};

const Hero: React.FC<HeroProps> = ({ onDemoClick }) => {
  const heroDashboardRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = heroDashboardRef.current;
    const wrapper = wrapperRef.current;
    if (!el || !wrapper) return;

    // FIX: Cast generic 'Event' to 'MouseEvent'
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (window.innerWidth < 768) return;
      if (!el) return;
      const rect = wrapper.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (centerY - y) / centerY * 8;
      const rotateY = (x - centerX) / centerX * 8;
      el.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
    };

    const handleMouseLeave = () => {
      if (!el) return;
      el.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    };

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const [liveData, setLiveData] = useState({ sales: 14729, inventory: 8104, orders: 312 });

  useEffect(() => {
    const interval = setInterval(() => {
      setLiveData(prevData => ({
        sales: prevData.sales + (Math.floor(Math.random() * 10) - 4),
        inventory: prevData.inventory + (Math.floor(Math.random() * 10) - 4),
        orders: prevData.orders + (Math.floor(Math.random() * 10) - 4),
      }));
    }, Math.random() * 2000 + 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section id="hero" ref={wrapperRef} className="h-screen w-full flex flex-col items-center justify-center relative text-center p-4 pt-48 hero-perspective"> {/* CHANGED: pt-32 to pt-48 */}
      <div className="z-10 relative max-w-4xl scroll-reveal visible">
         <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white"></h1>
         <br></br><h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white"></h1>
         <br></br><h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white"></h1>
         <br></br><h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white"></h1>
         <br></br>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-white">
          The Future of <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
            Business is Here.
          </span>
        </h1>
        <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto mt-6">
          Stop juggling apps. HantiKaab unifies your POS, Inventory, Sales, and Analytics into one intelligent, real-time platform.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          {/* (GEMINI) Updated hero button to launch modal with Business plan */}
          <SpotlightButton 
            className="text-white text-lg font-bold py-4 px-10 rounded-full" 
            onClick={() => onDemoClick('Business', 10)}
          >
            Start Your Free Trial
          </SpotlightButton>
          <a href="/login" className="text-white text-lg font-bold py-4 px-10 rounded-full bg-gray-700 hover:bg-gray-600 transition-all">
            Track Your Business
          </a>
        </div>
      </div>

      <div ref={heroDashboardRef} id="hero-dashboard" className="scroll-reveal visible w-full max-w-4xl rounded-2xl shadow-2xl shadow-cyan-500/10 p-6 mt-16" style={{ transitionDelay: '0.2s' }}>
        <div className="hero-dashboard-inner">
          <div className="flex justify-between items-center pb-4 border-b border-gray-700/50">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 bg-red-500 rounded-full"></span>
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span className="w-3 h-3 bg-green-500 rounded-full"></span>
            </div>
            <div className="text-sm font-semibold text-gray-300">Main Dashboard</div>
            <div><MoreVertical className="w-6 h-6 text-gray-500" /></div>
          </div>
          <div className="grid grid-cols-3 gap-6 pt-6">
            <div className="col-span-1 bg-gray-800/20 p-4 rounded-lg border border-gray-700/50">
              <h4 className="text-sm font-semibold text-gray-400">Total Sales</h4>
              <p className="text-3xl font-bold live-data-ticker" id="live-sales">${liveData.sales.toLocaleString()}</p>
            </div>
            <div className="col-span-1 bg-gray-800/20 p-4 rounded-lg border border-gray-700/50">
              <h4 className="text-sm font-semibold text-gray-400">Stock Value</h4>
              <p className="text-3xl font-bold live-data-ticker" id="live-inventory">${liveData.inventory.toLocaleString()}</p>
            </div>
            <div className="col-span-1 bg-gray-800/20 p-4 rounded-lg border border-gray-700/50">
              <h4 className="text-sm font-semibold text-gray-400">New Customers</h4>
              <p className="text-3xl font-bold live-data-ticker" id="live-orders">{liveData.orders.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// Type definition for a connection
type Connection = {
  from: string;
  to: string;
  color: string;
  drawn: boolean;
  targetIcon: string;
};

// Type definition for the connections ref
type ConnectionsData = {
  [key: string]: Connection[];
};

const DataFlow: React.FC<DataFlowProps> = ({ stepRefs }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const iconContainerRef = useRef<HTMLDivElement>(null);
  const connectionsRef = useRef<ConnectionsData | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false); // Prevent re-animation

  const steps = [
    { id: 'step-pos', title: '01. POS & Sales', heading: 'Sell Anywhere', text: 'Your POS, in-store and online, is the engine. Every sale is instantly captured.' },
    { id: 'step-inventory', title: '02. Inventory & Suppliers', heading: 'Sync Stock Perfectly', text: 'Sales automatically update inventory. Manage suppliers and create purchase orders with one click.' },
    { id: 'step-crm', title: '03. CRM & Finance', heading: 'Know Your Numbers', text: 'Customer data is saved to their profile, and all transactions flow directly into your accounting ledger.' },
    { id: 'step-analytics', title: '04. Analytics & HR', heading: 'See The Full Picture', text: 'All your data—sales, stock, and team performance—feeds one central analytics dashboard.' },
  ];

  const icons = [
    { id: 'icon-core', style: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }, isCore: true, iconName: '', text: '' },
    { id: 'icon-pos', style: { top: '16%', left: '50%', transform: 'translateX(-50%)' }, text: 'POS / Sales', iconName: 'pos', isCore: false },
    { id: 'icon-inventory', style: { top: '26%', left: '22%', transform: 'translateX(-50%)' }, text: 'Inventory', iconName: 'inventory', isCore: false },
    { id: 'icon-purchases', style: { top: '50%', left: '10%', transform: 'translateX(-50%)' }, text: 'Purchases', iconName: 'purchases', isCore: false },
    { id: 'icon-suppliers', style: { top: '74%', left: '22%', transform: 'translateX(-50%)' }, text: 'Suppliers', iconName: 'suppliers', isCore: false },
    { id: 'icon-crm', style: { top: '26%', left: '78%', transform: 'translateX(-50%)' }, text: 'Customers', iconName: 'crm', isCore: false },
    { id: 'icon-finance', style: { top: '50%', left: '90%', transform: 'translateX(-50%)' }, text: 'Finance', iconName: 'finance', isCore: false },
    { id: 'icon-hr', style: { top: '74%', left: '78%', transform: 'translateX(-50%)' }, text: 'HR / Team', iconName: 'hr', isCore: false },
    { id: 'icon-analytics', style: { top: '84%', left: '50%', transform: 'translateX(-50%)' }, text: 'Analytics', iconName: 'analytics', isCore: false },
  ];

  const getIconCenter = (iconId: string) => {
    const icon = document.getElementById(iconId);
    const container = iconContainerRef.current;
    if (!icon || !container) return { x: 0, y: 0 };
    const rect = icon.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return {
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2,
    };
  };

  // Effect for setting up connections and resize listener
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return; 
    const iconContainer = iconContainerRef.current;

    connectionsRef.current = {
      'step-pos': [{ from: 'icon-core', to: 'icon-pos', color: '#00ddff', drawn: false, targetIcon: '#icon-pos' }],
      'step-inventory': [
        { from: 'icon-core', to: 'icon-inventory', color: '#00ddff', drawn: false, targetIcon: '#icon-inventory' },
        { from: 'icon-core', to: 'icon-purchases', color: '#00ddff', drawn: false, targetIcon: '#icon-purchases' },
        { from: 'icon-core', to: 'icon-suppliers', color: '#00ddff', drawn: false, targetIcon: '#icon-suppliers' }
      ],
      'step-crm': [
        { from: 'icon-core', to: 'icon-crm', color: '#0070f3', drawn: false, targetIcon: '#icon-crm' },
        { from: 'icon-core', to: 'icon-finance', color: '#0070f3', drawn: false, targetIcon: '#icon-finance' }
      ],
      'step-analytics': [
        { from: 'icon-core', to: 'icon-analytics', color: '#0070f3', drawn: false, targetIcon: '#icon-analytics' },
        { from: 'icon-core', to: 'icon-hr', color: '#0070f3', drawn: false, targetIcon: '#icon-hr' }
      ]
    };

    const drawLine = (conn: Connection, progress: number) => {
      const start = getIconCenter(conn.from);
      const end = getIconCenter(conn.to);
      const x = start.x + (end.x - start.x) * progress;
      const y = start.y + (end.y - start.y) * progress;

      if (!ctx) return; 
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = conn.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
    };

    const resizeCanvas = () => {
      if (!iconContainer || !canvas || !ctx) return;
      canvas.width = iconContainer.clientWidth;
      canvas.height = iconContainer.clientHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (connectionsRef.current) {
        Object.values(connectionsRef.current).flat().forEach(conn => {
          if (conn.drawn) drawLine(conn, 1);
        });
      }
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []); // Empty dependency array is correct

  // Effect for triggering animation on scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawLine = (conn: Connection, progress: number) => {
      const start = getIconCenter(conn.from);
      const end = getIconCenter(conn.to);
      const x = start.x + (end.x - start.x) * progress;
      const y = start.y + (end.y - start.y) * progress;

      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 2;
      ctx.shadowColor = conn.color;
      ctx.shadowBlur = 10;
      ctx.stroke();
    };

    const animateLine = (conn: Connection) => {
      if (!conn || conn.drawn) return;
      conn.drawn = true;
      
      const targetIcon = document.querySelector<HTMLElement>(conn.targetIcon);
      if (targetIcon) {
        const iconDiv = targetIcon.querySelector<HTMLElement>('div');
        const iconSvg = targetIcon.querySelector<HTMLElement>('svg');
        const iconP = targetIcon.querySelector<HTMLElement>('p');
        if(iconDiv) iconDiv.style.borderColor = conn.color;
        if(iconDiv) iconDiv.style.boxShadow = `0 0 20px ${conn.color}60`;
        if(iconSvg) iconSvg.style.color = conn.color;
        if(iconP) iconP.style.color = '#ffffff';
      }

      let progress = 0;
      let animationFrameId: number;
      function animate() {
        if (progress < 1) {
          progress += 0.08; // CHANGED: Increased speed from 0.02 to 0.08
          drawLine(conn, progress);
          animationFrameId = requestAnimationFrame(animate);
        } else {
          drawLine(conn, 1);
        }
      }
      animate();
      return () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
      };
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated) {
        setHasAnimated(true); // Mark as animated
        if (connectionsRef.current) {
          // Get ALL connections
          const allConnections = Object.values(connectionsRef.current).flat();
          // Animate all of them
          allConnections.forEach(animateLine);
        }
        observer.unobserve(entry.target); // Stop observing
      }
    }, { threshold: 0.5 }); // Trigger when 50% visible

    const currentIconContainer = iconContainerRef.current;
    if (currentIconContainer) {
      observer.observe(currentIconContainer);
    }

    return () => {
      if (currentIconContainer) {
        observer.unobserve(currentIconContainer);
      }
    };
  }, [hasAnimated]); // Depend on hasAnimated

  return (
   <section id="modules" className="container mx-auto px-6 py-32">
       <h2 className=""></h2><br/>  <h2 className=""></h2><br/>
         <h2 className=""></h2><br/>
      <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mb-16">
        Finally. <span className="text-cyan-400">Everything. Synced.</span>
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-start">
        <div className="flex flex-col space-y-16 mt-8">
          {steps.map((step, index) => (
            <div
              key={step.id}
              id={step.id}
              ref={el => { stepRefs.current[index] = el; }}
              className="step-trigger scroll-reveal p-4 rounded-lg"
              // Removed inline style for opacity
            >
              <span className="text-cyan-400 font-bold text-lg">{step.title}</span>
              <h3 className="text-3xl font-bold text-white mt-2 mb-4">{step.heading}</h3>
              <p className="text-gray-400 text-lg">{step.text}</p>
            </div>
          ))}
        </div>

        <div className="sticky top-28">
          <div ref={iconContainerRef} className="relative w-full max-w-lg mx-auto h-[600px] bg-gray-900/20 border border-gray-700/50 rounded-2xl p-8">
            <canvas ref={canvasRef} id="module-flow-canvas"></canvas>
            
            {icons.map(icon => (
              <div key={icon.id} id={icon.id} className="module-icon absolute z-10 flex flex-col items-center" style={icon.style as React.CSSProperties}>
                {icon.isCore ? (
                  <>
                    <div className="p-3 bg-blue-500 rounded-full border-4 border-cyan-400 shadow-2xl shadow-cyan-500/50">
                      <img src="/logo1.png" className="w-14 h-14 bg-white rounded-full" alt="HantiKaab Core Logo" />
                    </div>
                    <p className="mt-3 font-semibold text-white text-lg">HantiKaab Core</p>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-gray-800 rounded-full border-2 border-gray-600">
                      <Icon name={icon.iconName} className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-400">{icon.text}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

const FeaturesGrid = () => {
  const features = [
    { icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6-4a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1zm10 0a1 1 0 001-1v-1a1 1 0 10-2 0v1a1 1 0 001 1z', title: 'Multi-Channel E-commerce Sync', text: 'Connect your online store (Shopify, WooCommerce, etc.) and even social media shops. All sales and inventory sync perfectly.', className: 'md:col-span-2', delay: 0.2 },
    { icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857M3 16V5a2 2 0 012-2h14a2 2 0 012 2v11', title: 'HR & Team Management', text: 'Manage schedules, track performance, and set permissions with integrated employee management tools.', className: '', delay: 0.3 },
    { icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m6-4h1m-1 4h1m-1 4h1M9 3v1m6-1v1', title: 'Supplier & Purchase Orders', text: 'Manage all your suppliers in one place. Create and send purchase orders directly from the system.', className: '', delay: 0.4 },
    { icon: 'M4 4v5h.582m15.356 2.082a10.001 10.001 0 00-16.42 6.33M5 12S5 4 12 4s7 8 7 8', title: 'Advanced Debt Management', text: 'Track customer debts (Caymis) and supplier payments with clarity. Send reminders and manage your cash flow effectively.', className: 'md:col-span-2', delay: 0.5 },
  ];
  
  return (
    <section id="features" className="container mx-auto px-6 py-24 module-grid-perspective">
      <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mb-4">One Platform. Infinite Power.</h2>
      <p className="scroll-reveal text-xl text-gray-400 text-center max-w-3xl mx-auto mb-16" style={{ transitionDelay: '0.1s' }}>
        HantiKaab is more than just a POS. It's a complete business operating system designed for growth.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {features.map(feature => (
          <ModuleCard key={feature.title} icon={feature.icon} className={feature.className} delay={feature.delay}>
            <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
            <p className="text-gray-400">{feature.text}</p>
          </ModuleCard>
        ))}
      </div>
    </section>
  );
};

const OldBookImage = () => {
  const elRef = useRef<HTMLImageElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elRef.current;
    const wrapper = wrapperRef.current;
    if (!element || !wrapper) return;

    // FIX: Cast generic 'Event' to 'MouseEvent'
    const handleMouseMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      if (window.innerWidth < 768) return;
      if (!element) return;
      const rect = wrapper.getBoundingClientRect();
      const x = mouseEvent.clientX - rect.left;
      const y = mouseEvent.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (centerY - y) / centerY * 6;
      const rotateY = (x - centerX) / centerX * 6;
      element.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.03)`;
    };

    const handleMouseLeave = () => {
      if (!element) return;
      element.style.transform = 'rotateX(0deg) rotateY(0deg) scale(1)';
    };

    wrapper.addEventListener('mousemove', handleMouseMove);
    wrapper.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      wrapper.removeEventListener('mousemove', handleMouseMove);
      wrapper.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div id="old-book-wrapper" ref={wrapperRef} className="scroll-reveal flex justify-center" style={{ transitionDelay: '0.2s' }}>
      <img
        ref={elRef}
        id="old-book-image"
        src="https://i.etsystatic.com/11461080/r/il/53f4c5/7257375309/il_fullxfull.7257375309_lptl.jpg"
        alt="Old accounting book"
        className="w-full max-w-2xl rounded-lg shadow-2xl opacity-70"
        onError={(e) => {
          (e.target as HTMLImageElement).src = 'https://placehold.co/800x600/1a1a1a/444444?text=Old+Ledger+Book';
        }}
      />
    </div>
  );
};

const AnalyticsDashboard = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setHasBeenVisible(true);
        if (dashboardRef.current) {
          observer.unobserve(dashboardRef.current);
        }
      }
    }, { threshold: 0.2 });

    const currentDashboardRef = dashboardRef.current; // Capture current ref
    if (currentDashboardRef) {
      observer.observe(currentDashboardRef);
    }
    return () => {
      if(currentDashboardRef) observer.unobserve(currentDashboardRef);
    };
  }, []);

  return (
    <div
      id="dashboard-container"
      ref={dashboardRef}
      className="scroll-reveal max-w-7xl mx-auto bg-gray-900/20 p-4 md:p-8 rounded-2xl border border-gray-700/50"
      style={{ transitionDelay: '0.3s' }}
    >
      <div className="flex flex-wrap space-x-2 md:space-x-4 mb-4">
        {['sales', 'inventory', 'customers', 'reports'].map(tab => (
          <button
            key={tab}
            className={`dashboard-tab text-sm md:text-base font-semibold py-2 px-4 rounded-full ${activeTab === tab ? 'active' : 'text-gray-400 hover:bg-gray-800'}`}
            data-tab={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} {tab === 'sales' && 'Overview'}
          </button>
        ))}
      </div>
      
      <div>
        <SalesTab isActive={activeTab === 'sales' && hasBeenVisible} />
        <InventoryTab isActive={activeTab === 'inventory' && hasBeenVisible} />
        <CustomersTab isActive={activeTab === 'customers' && hasBeenVisible} />
        <ReportsTab isActive={activeTab === 'reports' && hasBeenVisible} />
      </div>
    </div>
  );
};

// --- Dashboard Tab Components ---

// Helper function: Animate number counting up
const animateValue = (
  setter: (value: string) => void,
  start: number,
  end: number,
  duration: number,
  decimals = 0
) => {
  let startTimestamp: number | null = null;
  let animationFrameId: number;
  const step = (timestamp: number) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = progress * (end - start) + start;
    setter(value.toLocaleString(undefined, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: decimals
    }));
    if (progress < 1) {
      animationFrameId = requestAnimationFrame(step);
    }
  };
  animationFrameId = requestAnimationFrame(step);
  return () => cancelAnimationFrame(animationFrameId);
};

// Helper function: Animate Pie Chart (simplified canvas)
const animatePieChart = (
  canvasEl: HTMLCanvasElement | null,
  dataValues: number[],
  colorHex: string[]
) => {
  if (!canvasEl) return () => {};
  canvasEl.classList.add('visible');
  const ctx = canvasEl.getContext('2d');
  
  // This function now closes over the 'ctx' which is 'CanvasRenderingContext2D | null'
  // So we must check inside the nested functions.

  const data = dataValues.map((value, i) => ({ value, color: colorHex[i] }));
  const total = data.reduce((sum, { value }) => sum + value, 0);
  let startAngle = -0.5 * Math.PI;
  if (!canvasEl) return () => {}; // Re-check canvasEl for width/height
  const radius = Math.min(canvasEl.width, canvasEl.height) / 2 - 10;
  const center = { x: canvasEl.width / 2, y: canvasEl.height / 2 };
  let currentSlice = 0;
  let progress = 0;
  let animationFrameId: number;

  function drawSlice(p: number) {
    if (!ctx) return; // FIX 2: Add null check
    if (currentSlice >= data.length) return;
    const slice = data[currentSlice];
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle * p;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.arc(center.x, center.y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();
    if (p >= 1) {
      startAngle = endAngle;
      currentSlice++;
      progress = 0;
    }
  }

  function animate() {
    if (!ctx || !canvasEl) return; // FIX 2: Add null check
    if (currentSlice >= data.length) return;
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    let tempAngle = -0.5 * Math.PI;
    for (let i = 0; i < currentSlice; i++) {
      const sliceAngle = (data[i].value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(center.x, center.y);
      ctx.arc(center.x, center.y, radius, tempAngle, tempAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = data[i].color;
      ctx.fill();
      tempAngle += sliceAngle;
    }
    progress += 0.05;
    drawSlice(Math.min(progress, 1));
    animationFrameId = requestAnimationFrame(animate);
  }
  animate();
  return () => {
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
  };
};

// Helper function: Animate Line Chart (simplified canvas)
type LineChartDataset = {
  points: Array<{ x: number; y: number }>;
  color: string;
};

const animateLineChart = (
  canvasEl: HTMLCanvasElement | null,
  datasets: LineChartDataset[]
) => {
  if (!canvasEl) return () => {};
  canvasEl.classList.add('visible');
  const ctx = canvasEl.getContext('2d');
  
  // ctx is 'CanvasRenderingContext2D | null'
  // We must check inside nested functions.

  const w = canvasEl.width;
  const h = canvasEl.height;
  let progress = 0;
  let animationFrameId: number;

  function drawLine(p: number, dataPoints: Array<{ x: number; y: number }>, color: string) {
    if (!ctx) return; // FIX 2: Add null check
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    const points = dataPoints.map(point => ({ x: w * point.x, y: h * point.y }));
    ctx.moveTo(points[0].x, points[0].y);
    const totalDistance = points[points.length - 1].x - points[0].x;
    const currentDistance = p * totalDistance;
    for (let i = 1; i < points.length; i++) {
      const segmentStartX = points[i-1].x - points[0].x;
      const segmentEndX = points[i].x - points[0].x;
      if (currentDistance >= segmentEndX) {
        ctx.lineTo(points[i].x, points[i].y);
      } else if (currentDistance > segmentStartX) {
        const segmentProgress = (currentDistance - segmentStartX) / (segmentEndX - segmentStartX);
        const x = points[i-1].x + (points[i].x - points[i-1].x) * segmentProgress;
        const y = points[i-1].y + (points[i].y - points[i-1].y) * segmentProgress;
        ctx.lineTo(x, y);
        break;
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  
  function animate() {
    if (!ctx) return; // FIX 2: Add null check
    if (progress < 1) {
      progress += 0.015;
      ctx.clearRect(0, 0, w, h);
      datasets.forEach(dataset => drawLine(progress, dataset.points, dataset.color));
      animationFrameId = requestAnimationFrame(animate);
    } else {
      ctx.clearRect(0, 0, w, h);
      datasets.forEach(dataset => drawLine(1, dataset.points, dataset.color));
    }
  }
  const timer = setTimeout(animate, 100);
  return () => {
    clearTimeout(timer);
    if(animationFrameId) cancelAnimationFrame(animationFrameId);
  }
};

// FIX: Define types for ticker items
type EmployeeTickerItem = {
  id: number;
  name: string;
  item: string;
  sale: number;
  saleAmount: number;
  exiting?: boolean;
};

const SalesTab: React.FC<SalesTabProps> = ({ isActive }) => {
  const [revenue, setRevenue] = useState('0'); // Use string for formatted number
  const [profit, setProfit] = useState('0');
  const [customers, setCustomers] = useState('0');
  
  const [tickerItems, setTickerItems] = useState<EmployeeTickerItem[]>([]);
  const employeeIndexRef = useRef(0);

  const pieChartRef1 = useRef<HTMLCanvasElement>(null);
  const pieChartRef2 = useRef<HTMLCanvasElement>(null);
  const lineChartRef = useRef<HTMLCanvasElement>(null);
  
  // Use useMemo to stabilize the array reference
  const mockEmployees = React.useMemo(() => [
    { name: "Muse Ahmed", item: "iPhone 17 Pro Max", sale: 1200 }, { name: "Fatima Ali", item: "Samsung S25 Ultra", sale: 1100 },
    { name: "Hassan Omar", item: "MacBook Pro 14\"", sale: 1999 }, { name: "Aisha Jama", item: "AirPods Pro 3", sale: 249 },
    { name: "Ibrahim Yusuf", item: "Dell XPS 15", sale: 1650 }, { name: "Layla Hassan", item: "Sony A7 IV", sale: 2499 },
    { name: "Said Nur", item: "LG C3 OLED TV", sale: 1497 }, { name: "Zahra Mohamud", item: "iPad Air 5", sale: 599 },
  ], []); // Empty dependency array means this array is created once

  useEffect(() => {
    if (!isActive) return;

    const cleanUpRevenue = animateValue(setRevenue, 0, 47850, 1500);
    const cleanUpProfit = animateValue(setProfit, 0, 18230, 1500);
    const cleanUpCustomers = animateValue(setCustomers, 0, 62, 1500);

    const cleanUpPie1 = animatePieChart(pieChartRef1.current, [40, 25, 15, 20], ['#00ddff', '#0070f3', '#333', '#555']);
    const cleanUpPie2 = animatePieChart(pieChartRef2.current, [55, 30, 15], ['#0070f3', '#00ddff', '#555']);
    const cleanUpLine = animateLineChart(lineChartRef.current, [
      { points: [{x:0.1,y:0.7},{x:0.25,y:0.6},{x:0.4,y:0.65},{x:0.55,y:0.4},{x:0.7,y:0.5},{x:0.85,y:0.2}], color: '#00ddff' },
      { points: [{x:0.1,y:0.8},{x:0.25,y:0.7},{x:0.4,y:0.75},{x:0.55,y:0.6},{x:0.7,y:0.65},{x:0.85,y:0.45}], color: '#0070f3' }
    ]);

    const updateTicker = () => {
      const newItems: EmployeeTickerItem[] = [];
      for (let i = 0; i < 4; i++) {
        const employee = mockEmployees[employeeIndexRef.current % mockEmployees.length];
        const saleAmount = employee.sale + Math.floor(Math.random() * 50) - 25;
        employeeIndexRef.current++;
        newItems.push({ ...employee, saleAmount, id: employeeIndexRef.current });
      }
      setTickerItems((prev: EmployeeTickerItem[]) => prev.map(item => ({ ...item, exiting: true })));
      
      setTimeout(() => {
        setTickerItems(newItems.map(item => ({ ...item, exiting: false })));
      }, 500);
    };

    updateTicker();
    const tickerInterval = setInterval(updateTicker, 3000);
    
    return () => {
      clearInterval(tickerInterval);
      cleanUpRevenue();
      cleanUpProfit();
      cleanUpCustomers();
      cleanUpPie1();
      cleanUpPie2();
      cleanUpLine();
    };

  }, [isActive, mockEmployees]); // Add mockEmployees here

  return (
    <div id="sales-content" className={`tab-content ${isActive ? 'active' : ''}`}>
      <div className="lg:col-span-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50"><h4 className="text-sm font-semibold text-gray-400">Total Revenue</h4><p className="text-3xl font-bold text-white mt-2">${revenue}</p></div>
          <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50"><h4 className="text-sm font-semibold text-gray-400">Total Profit</h4><p className="text-3xl font-bold text-white mt-2">${profit}</p></div>
          <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50"><h4 className="text-sm font-semibold text-gray-400">New Customers</h4><p className="text-3xl font-bold text-white mt-2">{customers}</p></div>
        </div>
        <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue vs. Profit (6 Months)</h3>
          <canvas ref={lineChartRef} id="line-chart-canvas" height="120"></canvas>
        </div>
      </div>
      <div className="lg:col-span-1 space-y-6">
        <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center">
          <h3 className="text-lg font-semibold text-white mb-4">Top Categories</h3>
          <canvas ref={pieChartRef1} id="pie-chart-canvas" width="200" height="200"></canvas>
        </div>
        <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center">
          <h3 className="text-lg font-semibold text-white mb-4">Traffic Source</h3>
          <canvas ref={pieChartRef2} id="pie-chart-canvas-2" width="200" height="200"></canvas>
        </div>
      </div>
      <div className="lg:col-span-4 p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Sales by Employee (Live)</h3>
        <div id="employee-ticker-container" className="h-56 space-y-3 overflow-hidden">
          {tickerItems.map(item => (
            <div key={item.id} className={`ticker-item ${item.exiting ? 'ticker-item-exit' : ''}`}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-cyan-400/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
                  {item.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="text-sm text-gray-400">Sold {item.item}</p>
                </div>
              </div>
              <div className="text-lg font-bold text-cyan-400">
                +$${item.saleAmount.toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// FIX: Define types for stock items
type StockTickerItem = {
  id: number;
  name: string;
  sku: string;
  stock: number;
  max: number;
  base: number;
  exiting?: boolean;
};

const InventoryTab: React.FC<InventoryTabProps> = ({ isActive }) => {
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const [tickerItems, setTickerItems] = useState<StockTickerItem[]>([]);
  const stockIndexRef = useRef(0);

  // Use useMemo to stabilize the array reference
  const mockStock = React.useMemo(() => [
    { name: "iPhone 17 Pro Max", sku: "SKU-1001", stock: 120, max: 200, base: 120 }, { name: "Samsung S25 Ultra", sku: "SKU-1002", stock: 80, max: 150, base: 80 },
    { name: "MacBook Pro 14\"", sku: "SKU-2001", stock: 45, max: 100, base: 45 }, { name: "AirPods Pro 3", sku: "SKU-1003", stock: 300, max: 500, base: 300 },
    { name: "Dell XPS 15", sku: "SKU-2002", stock: 60, max: 100, base: 60 }, { name: "Sony A7 IV", sku: "SKU-3001", stock: 25, max: 50, base: 25 },
  ], []); // Empty dependency array means this array is created once

  useEffect(() => {
    if (!isActive) return;

    const cleanUpPie = animatePieChart(pieChartRef.current, [60, 25, 15], ['#00ddff', '#0070f3', '#555']);

    const updateTicker = () => {
      const newItems: StockTickerItem[] = [];
      for (let i = 0; i < 4; i++) {
        const item = mockStock[stockIndexRef.current % mockStock.length];
        let newStock = item.base + Math.floor(Math.random() * 10) - 5;
        if (newStock < 0) newStock = 0;
        if (newStock > item.max) newStock = item.max;
        
        stockIndexRef.current++;
        newItems.push({ ...item, stock: newStock, id: stockIndexRef.current });
      }
      setTickerItems((prev: StockTickerItem[]) => prev.map(item => ({ ...item, exiting: true })));
      
      setTimeout(() => {
        setTickerItems(newItems.map(item => ({ ...item, exiting: false })));
      }, 500);
    };

    updateTicker();
    const tickerInterval = setInterval(updateTicker, 3000);

    return () => {
      clearInterval(tickerInterval);
      cleanUpPie();
    };

  }, [isActive, mockStock]); // Add mockStock here

  return (
    <div id="inventory-content" className={`tab-content ${isActive ? 'active' : ''}`}>
      <div className="lg:col-span-2 p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Stock Levels by Item</h3>
        <div id="stock-ticker-container" className="h-56 space-y-3 overflow-hidden">
          {tickerItems.map(item => {
            const percentage = (item.stock / item.max) * 100;
            let barColor = 'bg-cyan-400';
            if (percentage < 25) barColor = 'bg-red-500';
            else if (percentage < 50) barColor = 'bg-yellow-500';
            
            return (
              <div key={item.id} className={`ticker-item stock-item space-y-2 ${item.exiting ? 'ticker-item-exit' : ''}`}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold text-white">{item.name}</span>
                  <span className="text-gray-400"><span className="font-bold text-white">{item.stock}</span> / {item.max}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div className={`${barColor} h-2 rounded-full`} style={{ width: `${percentage}%`, transition: 'width 0.5s ease' }}></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="lg:col-span-1 p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50 flex flex-col items-center justify-center">
        <h3 className="text-lg font-semibold text-white mb-4">Stock by Warehouse</h3>
        <canvas ref={pieChartRef} id="inventory-pie-chart" width="200" height="200"></canvas>
      </div>
    </div>
  );
};

const CustomersTab: React.FC<CustomersTabProps> = ({ isActive }) => {
  const [total, setTotal] = useState('0');
  const [newThisMonth, setNewThisMonth] = useState('0');
  const [avgSpend, setAvgSpend] = useState('0.00');
  const lineChartRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isActive) return;

    const cleanUpTotal = animateValue(setTotal, 0, 1240, 1500);
    const cleanUpNew = animateValue(setNewThisMonth, 0, 85, 1500);
    const cleanUpAvg = animateValue(setAvgSpend, 0, 120.50, 1500, 2);
    
    const cleanUpLine = animateLineChart(lineChartRef.current, [
      { points: [{x:0.1,y:0.8},{x:0.25,y:0.7},{x:0.4,y:0.6},{x:0.55,y:0.4},{x:0.7,y:0.3},{x:0.85,y:0.2}], color: '#00ddff' }
    ]);
    
    return () => {
        cleanUpTotal();
        cleanUpNew();
        cleanUpAvg();
        cleanUpLine();
    };

  }, [isActive]);

  return (
    <div id="customers-content" className={`tab-content ${isActive ? 'active' : ''}`}>
      <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-semibold text-gray-400">Total Customers</h4>
        <p className="text-3xl font-bold text-white mt-2">{total}</p>
      </div>
      <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-semibold text-gray-400">New This Month</h4>
        <p className="text-3xl font-bold text-white mt-2">{newThisMonth}</p>
      </div>
      <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h4 className="text-sm font-semibold text-gray-400">Avg. Spend</h4>
        <p className="text-3xl font-bold text-white mt-2">${avgSpend}</p>
      </div>
      <div className="lg:col-span-3 p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">Customer Growth (6 Months)</h3>
        <canvas ref={lineChartRef} id="customer-line-chart" height="120"></canvas>
      </div>
    </div>
  );
};

const ReportsTab: React.FC<ReportsTabProps> = ({ isActive }) => (
  <div id="reports-content" className={`tab-content ${isActive ? 'active' : ''}`}>
    <div className="p-4 md:p-6 bg-gray-800/20 rounded-lg border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white mb-4">Download Reports</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a href="#" className="flex items-center space-x-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all">
          <Icon name="document-text-outline" className="h-6 w-6 text-cyan-400" />
          <span className="text-white">Full Sales Report (Q4)</span>
        </a>
        <a href="#" className="flex items-center space-x-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all">
          <Icon name="document-text-outline" className="h-6 w-6 text-cyan-400" />
          <span className="text-white">Inventory Value Report</span>
        </a>
        <a href="#" className="flex items-center space-x-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all">
          <Icon name="document-text-outline" className="h-6 w-6 text-cyan-400" />
          <span className="text-white">Customer Debt (Caymis) Report</span>
        </a>
        <a href="#" className="flex items-center space-x-3 p-4 bg-gray-800 rounded-lg hover:bg-gray-700 transition-all">
          <Icon name="document-text-outline" className="h-6 w-6 text-cyan-400" />
          <span className="text-white">Profit & Loss Statement</span>
        </a>
      </div>
    </div>
  </div>
);

const Testimonials = () => {
  const testimonials = [
    { name: 'Ahmed Adan', title: 'Owner, Bilan Restaurant', quote: '"HantiKaab transformed my business. I went from 10 notebooks to one dashboard. I finally know my numbers. Waa cajiib!"' },
    { name: 'Fatima Yusuf', title: 'Founder, Hargeisa Modern', quote: '"The inventory sync between my shop and my website is magic. I sell an item online, and my POS knows instantly. No more double-selling."' },
    { name: 'Ali Hassan', title: 'Manager, Tawakal Electronics', quote: '"Tracking customer debts (caymis) was my biggest headache. HantiKaab made it simple. I can see who owes what in seconds."' },
  ];
  const [currentIndex, setCurrentIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  const goToSlide = (index: number) => {
    if (trackRef.current && trackRef.current.children[0]) {
      const slideWidth = trackRef.current.children[0].getBoundingClientRect().width;
      trackRef.current.style.transform = `translateX(-${slideWidth * index}px)`;
    }
    setCurrentIndex(index);
  };

  useEffect(() => {
    const nextSlide = () => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % testimonials.length);
    };
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  useEffect(() => {
    goToSlide(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    const handleResize = () => goToSlide(currentIndex);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentIndex]);
  
  return (
    <section id="testimonials" className="container mx-auto px-6 py-24">
      <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mb-4">Trusted by Somali Businesses</h2>
      <p className="scroll-reveal text-xl text-gray-400 text-center max-w-3xl mx-auto mb-16" style={{ transitionDelay: '0.1s' }}>
        See what local entrepreneurs are saying about HantiKaab.
      </p>

      <div id="testimonial-slider" className="scroll-reveal max-w-3xl mx-auto" style={{ transitionDelay: '0.2s' }}>
        <div id="testimonial-track" ref={trackRef}>
          {testimonials.map(t => (
            <div key={t.name} className="testimonial-slide px-4">
              <ModuleCard className="text-center p-8 md:p-12">
                <p className="text-xl md:text-2xl text-gray-300 italic">{t.quote}</p>
                <h3 className="text-xl font-bold text-white mt-6">{t.name}</h3>
                <p className="text-cyan-400">{t.title}</p>
              </ModuleCard>
            </div>
          ))}
        </div>
        <div id="testimonial-dots" className="flex justify-center space-x-2">
          {testimonials.map((_, index) => (
            <button
              key={index}
              className={`testimonial-dot ${currentIndex === index ? 'active' : ''}`}
              onClick={() => goToSlide(index)}
            ></button>
          ))}
        </div>
      </div>
    </section>
  );
};

// --- (GEMINI) MODIFIED PRICING COMPONENT ---
const Pricing: React.FC<PricingProps> = ({ onDemoClick }) => {
  const features = [
    { name: 'POS Registers', standard: 'Unlimited', business: 'Unlimited' },
    { name: 'Products', standard: 'Unlimited', business: 'Unlimited' },
    { name: 'Sales & Invoices', standard: 'Unlimited', business: 'Unlimited' },
    { name: 'PDF Downloads (modern + clean)', standard: 'Classic layout', business: 'Modern & customizable' },
    { name: 'Real-time Inventory', standard: true, business: true },
    { name: 'Purchase Order Management', standard: true, business: true },
    { name: 'Supplier Management', standard: true, business: true },
    { name: 'Customer CRM', standard: true, business: true },
    { name: 'Debt (Caymis) Tracking', standard: true, business: true },
    { name: 'Accounting Module', standard: 'Basic ledger', business: 'Full accounting system' },
    { name: 'Analytics Dashboard', standard: 'Standard charts', business: 'Advanced analytics & reports' },
    { name: 'HR & Payroll Management', standard: 'Up to 5 employees', business: 'Full HR + salary automation' },
    { name: 'iOS & Android Apps', standard: true, business: true },
    { name: 'Desktop & Web Access', standard: true, business: true },
    { name: 'Offline POS Mode', standard: true, business: true },
    { name: 'Expense Tracking', standard: 'Basic', business: 'Detailed + export options' },
    { name: 'Barcode Scanning & Printing', standard: true, business: true },
    { name: 'Employee Role Permissions', standard: true, business: true },
    { name: 'Support', standard: 'Chat support only', business: '24/7 Support (Chat, Call, WhatsApp)' },
    { name: 'Custom Branding / Logo on Invoices', standard: false, business: true },
    { name: 'Data Backup', standard: 'Weekly', business: 'Daily' },
  ];

  const renderFeatureValue = (value: string | boolean) => {
    if (typeof value === 'boolean') {
      return value ? <Icon name="check" className="w-6 h-6 text-cyan-400" /> : <Icon name="x-circle" className="w-6 h-6 text-gray-500" />;
    }
    return <span className="text-gray-300">{value}</span>;
  };

  return (
    <section id="pricing" className="container mx-auto px-6 py-24">
      <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mb-4">Choose Your Plan</h2>
      <p className="scroll-reveal text-xl text-gray-400 text-center max-w-3xl mx-auto mb-16" style={{ transitionDelay: '0.1s' }}>
        Simple, transparent pricing. No hidden fees. Start your 14-day free trial.
      </p>
      
      <div className="scroll-reveal max-w-6xl mx-auto overflow-x-auto">
        <div className="min-w-[800px] md:min-w-full">
          {/* Header Row */}
          <div className="grid grid-cols-3 gap-4 p-4 rounded-t-lg bg-gray-900/50 border-b border-gray-700">
            {/* (GEMINI) Replaced emoji with Icon */}
            <div className="font-bold text-white text-xl sticky left-0 bg-gray-900/50 flex items-center space-x-2">
              <Icon name="sparkles-outline" className="h-6 w-6 text-cyan-400" /> 
              <span>Features</span>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-white text-xl">Standard</h3>
              <p className="text-3xl font-extrabold text-cyan-400">$5<span className="text-lg font-normal text-gray-400">/mo</span></p>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-white text-xl">Business</h3>
              <p className="text-3xl font-extrabold text-cyan-400">$10<span className="text-lg font-normal text-gray-400">/mo</span></p>
            </div>
          </div>
          
          {/* Feature Rows */}
          <div className="bg-gray-800/30 rounded-b-lg">
            {features.map((feature, index) => (
              <div key={feature.name} className={`grid grid-cols-3 gap-4 p-4 ${index % 2 === 0 ? 'bg-gray-900/30' : ''} border-b border-gray-700/50 last:border-b-0`}>
                <div className="font-semibold text-white sticky left-0 bg-inherit">{feature.name}</div>
                <div className="text-center flex justify-center items-center">{renderFeatureValue(feature.standard)}</div>
                <div className="text-center flex justify-center items-center">{renderFeatureValue(feature.business)}</div>
              </div>
            ))}
          </div>

          {/* (GEMINI) Button Row updated to pass plan info */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-gray-900/50 rounded-b-lg mt-1 border-t border-gray-700">
            <div></div>
            <div className="text-center">
              <SpotlightButton 
                className="w-full text-white font-semibold py-3 px-6 rounded-full" 
                onClick={() => onDemoClick('Standard', 5)}
              >
                Start Free Trial
              </SpotlightButton>
            </div>
            <div className="text-center">
              <SpotlightButton 
                className="w-full text-white font-semibold py-3 px-6 rounded-full" 
                onClick={() => onDemoClick('Business', 10)}
              >
                Start Free Trial
              </SpotlightButton>
            </div>
          </div>
        </div>
      </div>

      <div id="download" className="text-center mt-24 scroll-reveal">
        <h3 className="text-2xl font-bold text-white mb-6">Download The App Now</h3>
        <div className="flex flex-col md:flex-row justify-center items-center space-y-4 md:space-y-0 md:space-x-4">
          <DownloadButton platform="apple" href="https://www.garaadbiixi.com/p/hantikaab11.html" />
          <DownloadButton platform="google" href="https://www.garaadbiixi.com/p/hantikaab11.html" />
        </div>
      </div>
    </section>
  );
};

const Footer = () => {
  const footerLinks = {
    modules: [
      { name: 'POS & Sales', href: '#modules' }, { name: 'Inventory', href: '#modules' },
      { name: 'Purchases', href: '#modules' }, { name: 'Customers (CRM)', href: '#modules' },
      { name: 'Finance', href: '#modules' }, { name: 'Analytics', href: '#modules' },
      { name: 'HR Management', href: '#modules' },
    ],
    company: [
      { name: 'About Us', href: '#' }, { name: 'Careers', href: '#' },
      { name: 'Blog', href: '#' }, { name: 'Contact Us', href: '#' },
    ],
    legal: [
      { name: 'Privacy Policy', href: '#' }, { name: 'Terms of Service', href: '#' },
    ]
  };

  return (
    <footer className="border-t border-gray-800/50 mt-16 bg-gray-900/30">
      <div className="container mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-5 gap-12 text-gray-400">
        <div className="col-span-2 md:col-span-1">
          <a href="#hero" className="flex-shrink-0 mb-4 flex items-center space-x-2">
            <img src="/logo1.png" className="h-8 md:h-10 w-auto" alt="HantiKaab Logo" />
            <span className="text-xl font-bold text-white tracking-wider">Hanti<span className="text-cyan-400">Kaab</span></span>
          </a>
          <p className="text-sm text-gray-500 mb-4">&copy; 2025. All systems go.</p>
          <div className="flex space-x-4">
            <a href="#" className="text-2xl text-gray-500 hover:text-white transition-all"><Icon name="logo-twitter" className="h-6 w-6" /></a>
            <a href="#" className="text-2xl text-gray-500 hover:text-white transition-all"><Icon name="logo-facebook" className="h-6 w-6" /></a>
            <a href="#" className="text-2xl text-gray-500 hover:text-white transition-all"><Icon name="logo-linkedin" className="h-6 w-6" /></a>
          </div>
        </div>
        
        <FooterLinkGroup title="Modules" links={footerLinks.modules} />
        <FooterLinkGroup title="Company" links={footerLinks.company} />
        <FooterLinkGroup title="Legal" links={footerLinks.legal} />
        
        <div>
          <h4 className="font-semibold text-white mb-4">Get The App</h4>
          <div className="flex flex-col space-y-3">
            <a href="https://www.garaadbiixi.com/p/hantikaab11.html" target="_blank" rel="noopener noreferrer" className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white flex items-center space-x-2 hover:bg-gray-700 transition-all">
              {/* <Icon name="logo-apple" className="h-7 w-7" /> */} {/* Icon removed as requested */}
              <div>
                <p className="text-xs">Download on the</p>
                <p className="text-lg font-semibold">App Store</p>
              </div>
            </a>
            <a href="https://www.garaadbiixi.com/p/hantikaab11.html" target="_blank" rel="noopener noreferrer" className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white flex items-center space-x-2 hover:bg-gray-700 transition-all">
              {/* <Icon name="logo-google-playstore" className="h-7 w-7" /> */} {/* Icon removed as requested */}
              <div>
                <p className="text-xs">GET IT ON</p>
                <p className="text-lg font-semibold">Google Play</p>
              </div>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};


// --- 4. Main App Component (GEMINI MODIFIED) ---

export default function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // (GEMINI) State to hold which plan was clicked
  const [selectedPlan, setSelectedPlan] = useState<{ type: string, price: number } | null>(null);
  
  const dataFlowStepRefs = useRef<(HTMLDivElement | null)[]>([]);

  // (GEMINI) Updated openModal to accept plan details
  const openModal = (type: string, price: number) => {
    setSelectedPlan({ type, price });
    setIsModalOpen(true);
  };
  
  // (GEMINI) Updated closeModal to clear plan details
  const closeModal = () => {
    setIsModalOpen(false);
    // Delay clearing plan to prevent modal content from flashing
    setTimeout(() => setSelectedPlan(null), 300); 
  };
  
  const toggleMobileMenu = () => setIsMobileMenuOpen(prev => !prev);

  useEffect(() => {
    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // We no longer unobserve step-triggers to allow them to re-animate if needed
          // but the data flow animation is handled separately
          if (!entry.target.classList.contains('step-trigger') && entry.target.id !== 'dashboard-container' && entry.target.id !== 'module-flow-container') {
            scrollObserver.unobserve(entry.target);
          }
        }
      });
    }, { threshold: 0.2 });

    document.querySelectorAll('.scroll-reveal').forEach(el => {
      scrollObserver.observe(el);
    });

    return () => {
      scrollObserver.disconnect();
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (isModalOpen || isMobileMenuOpen) {
      document.body.classList.add('modal-open', 'overflow-hidden');
    } else {
      document.body.classList.remove('modal-open', 'overflow-hidden');
    }
    return () => {
      document.body.classList.remove('modal-open', 'overflow-hidden');
    };
  }, [isModalOpen, isMobileMenuOpen]);

  return (
    <>
      <GlobalStyles />
      <Header
        onDemoClick={openModal}
        onMenuToggle={toggleMobileMenu}
        isMenuOpen={isMobileMenuOpen}
      />
      <main>
        <Hero onDemoClick={openModal} />
        <DataFlow stepRefs={dataFlowStepRefs} />
        <FeaturesGrid />
        
        <section id="analytics-section" className="container mx-auto px-6 py-24 overflow-hidden">
          <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mb-4">Go From This...</h2>
          <p className="scroll-reveal text-xl text-gray-400 text-center max-w-3xl mx-auto mb-12" style={{ transitionDelay: '0.1s' }}>
            Stop drowning in confusing ledgers and notebooks. The old way is slow, inaccurate, and stressful. You can't grow a business on guesswork.
          </p>
          <OldBookImage />
          <h2 className="scroll-reveal text-4xl md:text-5xl font-bold text-center mt-24 mb-4">...To This. Instantly.</h2>
          <p className="scroll-reveal text-xl text-cyan-400 text-center max-w-3xl mx-auto mb-16" style={{ transitionDelay: '0.1s' }}>
            The HantiKaab way. All your data, beautifully visualized in real-time. Make decisions with confidence.
          </p>
          <AnalyticsDashboard />
        </section>

        <Testimonials />
        <Pricing onDemoClick={openModal} />
      </main>
      <Footer />
      {/* (GEMINI) Pass selected plan to Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={closeModal} 
        plan={selectedPlan} 
      />
      <FloatingChatButton />
    </>
  );
}