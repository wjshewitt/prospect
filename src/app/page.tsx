"use client";

import Head from "next/head";
import Script from "next/script";
import Link from "next/link";
import { Map } from "lucide-react";
import { useEffect } from "react";

export default function HomePage() {
  useEffect(() => {
    // Typing Animation for Hero Headline
    const heroHeadline = document.querySelector(
      ".hero-headline"
    ) as HTMLElement;
    if (heroHeadline) {
      const originalText = heroHeadline.innerHTML;
      const textParts = originalText.split('<span class="gradient-text">');

      // Check if we have the expected structure
      if (textParts.length >= 2 && textParts[0] && textParts[1]) {
        // Preserve original spacing inside the gradient span (no trim)
        const gradientText = textParts[1].replace("</span>", "");
        const fullText = "Visualize Land Development in " + gradientText;

        // Compute gradient start dynamically to avoid off-by-one issues
        const gradientStart = fullText.length - gradientText.length;

        heroHeadline.innerHTML = "";

        let charIndex = 0;
        const typingSpeed = 60;
        let animationFrameId: number;

        function typeChar() {
          if (charIndex < fullText.length) {
            const currentChar = fullText.charAt(charIndex);
            if (charIndex >= gradientStart) {
              // Begin gradient exactly where the gradient phrase starts
              const beforePart = fullText.substring(0, gradientStart);
              const gradientPart = fullText.substring(
                gradientStart,
                charIndex + 1
              );
              heroHeadline.innerHTML =
                beforePart +
                '<span class="gradient-text">' +
                gradientPart +
                '</span><span class="typing-cursor">|</span>';
            } else {
              heroHeadline.innerHTML =
                fullText.substring(0, charIndex + 1) +
                '<span class="typing-cursor">|</span>';
            }
            charIndex++;
            animationFrameId = requestAnimationFrame(() =>
              setTimeout(typeChar, typingSpeed)
            );
          } else {
            // Remove cursor after typing is complete
            setTimeout(() => {
              heroHeadline.innerHTML = originalText;
            }, 1000);
          }
        }

        typeChar(); // Start typing animation immediately
      }
    }

    // Particle Background Animation
    const canvas = document.getElementById(
      "particle-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    let animationFrameId: number;

    const particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
    }> = [];

    const particleCount = 50;

    function resizeCanvas() {
      const hero = document.querySelector(".hero") as HTMLElement;
      if (hero) {
        canvas.width = hero.offsetWidth;
        canvas.height = hero.offsetHeight;
      }
    }

    function createParticle() {
      return {
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 2,
        speedY: (Math.random() - 0.5) * 2,
        opacity: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.5 ? "74, 222, 128" : "255, 140, 66", // Green or orange
      };
    }

    function initParticles() {
      for (let i = 0; i < particleCount; i++) {
        particles.push(createParticle());
      }
    }

    function updateParticles() {
      particles.forEach((particle) => {
        particle.x += particle.speedX;
        particle.y += particle.speedY;

        // Wrap around edges
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.y > canvas.height) particle.y = 0;
        if (particle.y < 0) particle.y = canvas.height;
      });
    }

    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
        ctx.fill();
      });

      // Draw connections between nearby particles
      particles.forEach((particle1, index) => {
        particles.slice(index + 1).forEach((particle2) => {
          const distance = Math.sqrt(
            Math.pow(particle1.x - particle2.x, 2) +
              Math.pow(particle1.y - particle2.y, 2)
          );

          if (distance < 100) {
            ctx.beginPath();
            ctx.moveTo(particle1.x, particle1.y);
            ctx.lineTo(particle2.x, particle2.y);
            ctx.strokeStyle = `rgba(74, 222, 128, ${
              0.1 * (1 - distance / 100)
            })`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        });
      });
    }

    function animate() {
      updateParticles();
      drawParticles();
      animationFrameId = requestAnimationFrame(animate);
    }

    resizeCanvas();
    initParticles();
    animate();

    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <Head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>LandVision - AI-Powered Land Analysis Platform</title>
        <meta
          name="description"
          content="Transform land development with AI-powered analysis, visualization, and intelligence for real estate developers, urban planners, and land analysts."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </Head>

      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="nav-brand">
            <Map className="logo-icon h-8 w-8 text-c-green" />
            <span className="brand-name">LandVision</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
            <a href="#benefits">Benefits</a>
            <Link href="/login" className="btn-secondary">
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary">
              Sign Up
            </Link>
          </div>
          <button className="mobile-menu-toggle" aria-label="Toggle menu">
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text">
              <h1 className="hero-headline">
                Visualize Land Development in
                <span className="gradient-text"> Minutes, Not Months</span>
              </h1>
              <p className="hero-description">
                LandVision empowers real estate developers, urban planners, and
                land analysts with cutting-edge AI to visualize opportunities,
                analyze risks, and make data-driven decisions that transform
                communities.
              </p>
              <div className="hero-actions">
                <Link href="/signup" className="btn-primary-large">
                  Get Started Free
                </Link>
                <Link href="/login" className="btn-secondary-large">
                  Sign In
                </Link>
              </div>
              <div className="hero-stats">
                <div className="stat">
                  <span className="stat-number">500K+</span>
                  <span className="stat-label">Acres Analyzed</span>
                </div>
                <div className="stat">
                  <span className="stat-number">95%</span>
                  <span className="stat-label">Accuracy Rate</span>
                </div>
                <div className="stat">
                  <span className="stat-number">2.5x</span>
                  <span className="stat-label">Faster Decisions</span>
                </div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="dashboard-mockup">
                <div className="mockup-header">
                  <div className="mockup-controls">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
                <div className="mockup-content">
                  <div className="map-visualization">
                    <div className="analysis-panel">
                      <div className="metric">
                        <span className="metric-label">Development Score</span>
                        <span className="metric-value">8.7/10</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Risk Level</span>
                        <span className="metric-value low">Low</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Powerful AI-Driven Capabilities</h2>
            <p className="section-description">
              Leverage advanced AI and machine learning to unlock insights from
              land data, streamline analysis, and accelerate your development
              process.
            </p>
          </div>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="feature-title">AI-Powered Analysis</h3>
              <p className="feature-description">
                Advanced machine learning algorithms analyze soil composition,
                topography, environmental factors, and zoning data to provide
                comprehensive land insights.
              </p>
              <div className="feature-tooltip">
                <div className="tooltip-content">
                  <h4>AI-Powered Analysis</h4>
                  <p>
                    Advanced AI algorithms analyze soil composition, topography,
                    environmental factors, and zoning data to provide
                    comprehensive land insights.
                  </p>
                </div>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
                  />
                </svg>
              </div>
              <h3 className="feature-title">Interactive Visualization</h3>
              <p className="feature-description">
                Transform complex data into intuitive 3D maps, heatmaps, and
                interactive dashboards that make land analysis accessible and
                actionable.
              </p>
              <div className="feature-tooltip">
                <div className="tooltip-content">
                  <h4>Interactive Visualization</h4>
                  <p>
                    Transform complex data into intuitive 3D maps, heatmaps, and
                    interactive dashboards that make land analysis accessible
                    and actionable.
                  </p>
                </div>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              </div>
              <h3 className="feature-title">Real-Time Intelligence</h3>
              <p className="feature-description">
                Get instant alerts on market changes, regulatory updates, and
                development opportunities with our real-time monitoring system.
              </p>
              <div className="feature-tooltip">
                <div className="tooltip-content">
                  <h4>Real-Time Intelligence</h4>
                  <p>
                    Get instant alerts on market changes, regulatory updates,
                    and development opportunities with our real-time monitoring
                    system.
                  </p>
                </div>
              </div>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <svg
                  width="32"
                  height="32"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h3 className="feature-title">Risk Assessment</h3>
              <p className="feature-description">
                Identify potential risks including environmental hazards,
                regulatory challenges, and market volatility before making
                investment decisions.
              </p>
              <div className="feature-tooltip">
                <div className="tooltip-content">
                  <h4>Risk Assessment</h4>
                  <p>
                    Identify potential risks including environmental hazards,
                    regulatory challenges, and market volatility before making
                    investment decisions.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Particle Background */}
        <canvas className="particle-canvas" id="particle-canvas"></canvas>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">How LandVision Works</h2>
            <p className="section-description">
              Our streamlined process transforms raw land data into actionable
              insights in just three simple steps.
            </p>
          </div>
          <div className="process-steps">
            <div className="step">
              <div className="step-number">1</div>
              <div className="step-content">
                <h3 className="step-title">Import Your Data</h3>
                <p className="step-description">
                  Upload land surveys, GIS data, satellite imagery, and property
                  records. Our AI automatically processes and standardizes all
                  formats.
                </p>
              </div>
              <div className="step-visual">
                <div className="upload-animation">
                  <div className="upload-icon">
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <div className="step-content">
                <h3 className="step-title">AI Analysis</h3>
                <p className="step-description">
                  Our advanced algorithms analyze soil conditions, environmental
                  factors, zoning regulations, and market trends to generate
                  comprehensive insights.
                </p>
              </div>
              <div className="step-visual">
                <div className="analysis-animation">
                  <div className="brain-icon">
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <div className="step-content">
                <h3 className="step-title">Actionable Insights</h3>
                <p className="step-description">
                  Receive detailed reports, risk assessments, and development
                  recommendations through interactive dashboards and automated
                  notifications.
                </p>
              </div>
              <div className="step-visual">
                <div className="insights-animation">
                  <div className="chart-icon">
                    <svg
                      width="24"
                      height="24"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="benefits">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose LandVision</h2>
            <p className="section-description">
              Discover how our AI-powered platform makes land analysis
              accessible, accurate, and actionable for everyone.
            </p>
          </div>
          <div className="benefits-content">
            <div className="benefits-list">
              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                </div>
                <div className="benefit-content">
                  <h3 className="benefit-title">Save Time & Money</h3>
                  <p className="benefit-description">
                    Reduce analysis time from weeks to minutes and avoid costly
                    mistakes with our comprehensive AI-powered assessments.
                  </p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="benefit-content">
                  <h3 className="benefit-title">Make Better Decisions</h3>
                  <p className="benefit-description">
                    Access detailed insights about environmental factors, zoning
                    regulations, and market conditions to make informed choices.
                  </p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"
                    />
                  </svg>
                </div>
                <div className="benefit-content">
                  <h3 className="benefit-title">Environmental Protection</h3>
                  <p className="benefit-description">
                    Identify environmental risks and opportunities to ensure
                    sustainable development that protects our planet.
                  </p>
                </div>
              </div>
              <div className="benefit-item">
                <div className="benefit-icon">
                  <svg
                    width="48"
                    height="48"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div className="benefit-content">
                  <h3 className="benefit-title">Community Impact</h3>
                  <p className="benefit-description">
                    Make decisions that benefit communities by understanding
                    local needs, demographics, and development impacts.
                  </p>
                </div>
              </div>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-number-large">500K+</div>
                <div className="stat-label-large">Acres Analyzed</div>
                <p className="stat-description">
                  Comprehensive analysis across diverse terrains and markets
                </p>
              </div>
              <div className="stat-card">
                <div className="stat-number-large">95%</div>
                <div className="stat-label-large">Accuracy Rate</div>
                <p className="stat-description">
                  Industry-leading precision in risk and opportunity assessment
                </p>
              </div>
              <div className="stat-card">
                <div className="stat-number-large">2.5x</div>
                <div className="stat-label-large">Faster Decisions</div>
                <p className="stat-description">
                  Accelerate your development timeline with instant insights
                </p>
              </div>
              <div className="stat-card">
                <div className="stat-number-large">$2.3M</div>
                <div className="stat-label-large">Average Savings</div>
                <p className="stat-description">
                  Risk mitigation and efficiency gains per project
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">
              Ready to Transform Your Land Development?
            </h2>
            <p className="cta-description">
              Ready to accelerate your projects and reduce risks? Get started
              today.
            </p>
            <div className="cta-actions">
              <Link href="/signup" className="btn-primary-large">
                Sign Up Now
              </Link>
              <Link href="/login" className="btn-secondary-large">
                Sign In
              </Link>
            </div>
            <p className="cta-note">
              No credit card required. Setup in under 5 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="footer-logo">
                <svg
                  className="logo-icon"
                  width="32"
                  height="32"
                  viewBox="0 0 32 32"
                  fill="none"
                >
                  <rect width="32" height="32" rx="8" fill="#4ade80" />
                  <path d="M8 12h16v8H8z" fill="white" opacity="0.9" />
                  <path d="M10 14h12v4H10z" fill="#4ade80" />
                  <circle cx="16" cy="16" r="2" fill="white" />
                </svg>
                <span className="brand-name">LandVision</span>
              </div>
              <p className="footer-description">
                AI-powered land analysis platform for real estate developers,
                urban planners, and land analysts.
              </p>
            </div>
            <div className="footer-links">
              <div className="link-group">
                <h4 className="link-group-title">Product</h4>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
                <a href="#integrations">Integrations</a>
                <a href="#api">API</a>
              </div>
              <div className="link-group">
                <h4 className="link-group-title">Company</h4>
                <a href="#about">About</a>
                <a href="#careers">Careers</a>
                <a href="#blog">Blog</a>
                <a href="#contact">Contact</a>
              </div>
              <div className="link-group">
                <h4 className="link-group-title">Resources</h4>
                <a href="#documentation">Documentation</a>
                <a href="#help">Help Center</a>
                <a href="#community">Community</a>
                <a href="#status">Status</a>
              </div>
              <div className="link-group">
                <h4 className="link-group-title">Legal</h4>
                <Link href="/privacy">Privacy Policy</Link>
                <Link href="/terms">Terms of Use</Link>
                <a href="#security">Security</a>
                <a href="#compliance">Compliance</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="copyright">© 2025 LandVision. All rights reserved.</p>
            <div className="social-links">
              <a href="#" aria-label="Twitter">
                <svg
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.073 4.073 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" aria-label="LinkedIn">
                <svg
                  width="20"
                  height="20"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.338 16.338H13.67V12.16c0-.995-.017-2.277-1.387-2.277-1.39 0-1.601 1.086-1.601 2.207v4.248H8.014v-8.59h2.559v1.174h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.711zM5.005 6.575a1.548 1.548 0 11-.003-3.096 1.548 1.548 0 01.003 3.096zm-1.337 9.763H6.34v-8.59H3.667v8.59zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <Script src="/script.js" />
    </>
  );
}
