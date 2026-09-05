import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer-container">
      <div className="footer-content">
        
        {/* Brand column */}
        <div className="footer-brand">
          <div className="footer-logo">
            <div className="logo-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
                <path d="M2 17L12 22L22 17"/>
                <path d="M2 12L12 17L22 12"/>
              </svg>
            </div>
            <span>DealFlow<span className="logo-highlight">360</span></span>
          </div>
          <p className="footer-tagline">
            Intelligent sales operations and deal desk automation for revenue-driven enterprise teams.
          </p>
        </div>

        {/* Links Column 1 */}
        <div className="footer-column">
          <h4 className="footer-heading">Platform</h4>
          <a href="#features">Deal Intelligence</a>
          <a href="#approvals">Approval Chains</a>
          <a href="#fulfillment">Fulfillment Sync</a>
          <a href="#billing">Usage Billing</a>
        </div>

        {/* Links Column 2 */}
        <div className="footer-column">
          <h4 className="footer-heading">Resources</h4>
          <a href="#docs">Documentation</a>
          <a href="#api">API Reference</a>
          <a href="#case-studies">Customer Stories</a>
          <a href="#blog">Revenue Blog</a>
        </div>

        {/* Links Column 3 */}
        <div className="footer-column">
          <h4 className="footer-heading">Company</h4>
          <a href="#about">About Us</a>
          <a href="#careers">Careers</a>
          <a href="#contact">Contact Support</a>
          <a href="#security">Trust & Security</a>
        </div>

      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} DealFlow360, Inc. All rights reserved.</p>
        <div className="footer-legal">
          <a href="#privacy">Privacy Policy</a>
          <a href="#terms">Terms of Service</a>
          <a href="#security">Security</a>
        </div>
      </div>
    </footer>
  );
}
