import React from 'react';
import './FeaturesSection.css';

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
    title: "AI Revenue Intelligence",
    description: "Predict deal completion probabilities and pinpoint margin leakage before contract execution."
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: "Automated Approval Chains",
    description: "Dynamic multi-tiered discount threshold rules that route approvals instantly to key decision makers."
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    title: "Seamless Provisioning Sync",
    description: "Automatically synchronize closed-won deals with your ERP, CRM, and SaaS provisioning systems."
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: "Unified Billing Engine",
    description: "Eliminate invoice discrepancies with automated usage rating, recurring subscriptions, and custom terms."
  }
];

const METRICS = [
  { value: "4.2x", label: "Faster Approval Velocity" },
  { value: "99.8%", label: "Billing Accuracy Rate" },
  { value: "35%", label: "Margin Leakage Prevention" },
  { value: "< 24h", label: "Average Time-to-Fulfill" }
];

export default function FeaturesSection() {
  return (
    <section id="platform" className="features-section">
      <div className="features-container">
        
        {/* Section Header */}
        <div className="section-header">
          <span className="section-eyebrow">Enterprise Capabilities</span>
          <h2 className="section-title">Built for Modern Deal Orchestration</h2>
          <p className="section-description">
            DealFlow360 connects your entire deal desk lifecycle into one frictionless, intelligent workflow.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="features-grid">
          {FEATURES.map((feature, idx) => (
            <div key={idx} className="feature-card">
              <div className="feature-icon-wrapper">
                {feature.icon}
              </div>
              <h3 className="feature-title">{feature.title}</h3>
              <p className="feature-description">{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Stats Strip */}
        <div className="metrics-card">
          <div className="metrics-grid">
            {METRICS.map((m, idx) => (
              <div key={idx} className="metric-item">
                <div className="metric-value">{m.value}</div>
                <div className="metric-label">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
