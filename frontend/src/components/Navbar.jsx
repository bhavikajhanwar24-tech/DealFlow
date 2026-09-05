import React, { useState, useEffect } from 'react';
import './Navbar.css';

export default function Navbar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Navbar remains hidden during the 300vh scroll-video hero,
      // and smoothly slides in when user scrolls past the hero section
      const heroHeight = window.innerHeight * 2.2;
      setVisible(window.scrollY > heroHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={`navbar-header ${visible ? 'visible' : ''}`}>
      <div className="navbar-container">
        {/* Brand Logo */}
        <a href="/" className="navbar-logo">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="logo-text">DealFlow<span className="logo-highlight">360</span></span>
        </a>

        {/* Center Navigation Links */}
        <nav className="navbar-nav">
          <a href="#platform" className="nav-link">Platform</a>
          <a href="#solutions" className="nav-link">Solutions</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <a href="#integrations" className="nav-link">Integrations</a>
        </nav>

        {/* Action CTAs */}
        <div className="navbar-actions">
          <a href="#login" className="btn-secondary">Sign In</a>
          <a href="#demo" className="btn-primary">Book Demo</a>
        </div>
      </div>
    </header>
  );
}
