"use client";
import React, { useEffect } from "react";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { Map } from "lucide-react";
import Link from "next/link";

const SignInPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Subtle Particle Animation (reduced from 30 to 6 particles)
    function initParticles() {
      const canvas = document.getElementById(
        "signin-particles"
      ) as HTMLCanvasElement;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const particles: any[] = [];
      const particleCount = 6; // Much reduced

      function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      function createParticle() {
        return {
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + 1, // Smaller particles
          speedX: (Math.random() - 0.5) * 0.8, // Slower movement
          speedY: (Math.random() - 0.5) * 0.8,
          opacity: Math.random() * 0.3 + 0.05, // More subtle
          color: Math.random() > 0.5 ? "74, 222, 128" : "255, 140, 66",
        };
      }

      function initParticlesArray() {
        for (let i = 0; i < particleCount; i++) {
          particles.push(createParticle());
        }
      }

      function updateParticles() {
        particles.forEach((particle) => {
          particle.x += particle.speedX;
          particle.y += particle.speedY;

          if (particle.x > canvas.width) particle.x = 0;
          if (particle.x < 0) particle.x = canvas.width;
          if (particle.y > canvas.height) particle.y = 0;
          if (particle.y < 0) particle.y = canvas.height;
        });
      }

      function drawParticles() {
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle) => {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${particle.color}, ${particle.opacity})`;
          ctx.fill();
        });
      }

      function animate() {
        updateParticles();
        drawParticles();
        requestAnimationFrame(animate);
      }

      resizeCanvas();
      initParticlesArray();
      animate();

      window.addEventListener("resize", resizeCanvas);
    }

    // Form Handling with Enhanced UX
    function initFormHandling() {
      const form = document.getElementById("signin-form") as HTMLFormElement;
      const submitBtn = document.getElementById(
        "submit-btn"
      ) as HTMLButtonElement;
      const googleBtn = document.getElementById(
        "google-btn"
      ) as HTMLButtonElement;
      const emailInput = document.getElementById("email") as HTMLInputElement;
      const passwordInput = document.getElementById(
        "password"
      ) as HTMLInputElement;

      if (!form) return;

      // Form validation
      function validateEmail(email: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      }

      function validatePassword(password: string) {
        return password.length >= 6;
      }

      function showInputError(input: HTMLInputElement, message: string) {
        input.style.borderColor = "#ef4444";
        input.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
      }

      function clearInputError(input: HTMLInputElement) {
        input.style.borderColor = "";
        input.style.boxShadow = "";
      }

      // Real-time validation
      emailInput.addEventListener("blur", function () {
        if (this.value && !validateEmail(this.value)) {
          showInputError(this, "Please enter a valid email address");
        } else {
          clearInputError(this);
        }
      });

      passwordInput.addEventListener("blur", function () {
        if (this.value && !validatePassword(this.value)) {
          showInputError(this, "Password must be at least 6 characters");
        } else {
          clearInputError(this);
        }
      });

      // Form submission
      form.addEventListener("submit", async function (e) {
        e.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Validate
        let hasError = false;

        if (!email || !validateEmail(email)) {
          showInputError(emailInput, "Please enter a valid email address");
          hasError = true;
        } else {
          clearInputError(emailInput);
        }

        if (!password || !validatePassword(password)) {
          showInputError(
            passwordInput,
            "Password must be at least 6 characters"
          );
          hasError = true;
        } else {
          clearInputError(passwordInput);
        }

        if (hasError) return;

        // Show loading state
        submitBtn.innerHTML = '<span class="spinner"></span>Signing In...';
        submitBtn.disabled = true;
        submitBtn.classList.add("loading");

        try {
          // Firebase sign in
          await signInWithEmailAndPassword(auth, email, password);

          submitBtn.innerHTML = "✓ Signed In!";
          submitBtn.style.background =
            "linear-gradient(135deg, #22c55e, #16a34a)";

          setTimeout(() => {
            showNotification(
              "Welcome back to LandVision! You have been signed in successfully.",
              "success"
            );

            // Redirect to welcome page
            setTimeout(() => {
              router.push("/welcome");
            }, 1000);
          }, 1000);
        } catch (error: any) {
          console.error("Sign in error:", error);

          let errorMessage =
            "An error occurred during sign in. Please try again.";

          if (error.code === "auth/user-not-found") {
            errorMessage = "No account found with this email address.";
          } else if (error.code === "auth/wrong-password") {
            errorMessage = "Incorrect password. Please try again.";
          } else if (error.code === "auth/invalid-email") {
            errorMessage = "Please enter a valid email address.";
          } else if (error.code === "auth/user-disabled") {
            errorMessage = "This account has been disabled.";
          } else if (error.code === "auth/too-many-requests") {
            errorMessage = "Too many failed attempts. Please try again later.";
          }

          showNotification(errorMessage, "error");

          // Reset form
          submitBtn.innerHTML = "Sign In";
          submitBtn.disabled = false;
          submitBtn.classList.remove("loading");
          submitBtn.style.background = "";
        }
      });

      // Google sign-in
      googleBtn.addEventListener("click", async function () {
        googleBtn.innerHTML =
          '<span class="spinner"></span>Connecting with Google...';
        googleBtn.disabled = true;
        googleBtn.classList.add("loading");

        try {
          // Firebase Google sign in
          await signInWithPopup(auth, googleProvider);

          googleBtn.innerHTML = "✓ Connected!";
          showNotification(
            "Google sign-in successful! Welcome back to LandVision.",
            "success"
          );

          setTimeout(() => {
            router.push("/welcome");
          }, 1000);
        } catch (error: any) {
          console.error("Google sign in error:", error);

          let errorMessage =
            "An error occurred during Google sign in. Please try again.";

          if (error.code === "auth/popup-closed-by-user") {
            errorMessage = "Sign in was cancelled.";
          } else if (error.code === "auth/popup-blocked") {
            errorMessage =
              "Pop-up was blocked by your browser. Please allow pop-ups and try again.";
          } else if (
            error.code === "auth/account-exists-with-different-credential"
          ) {
            errorMessage = "An account already exists with this email address.";
          }

          showNotification(errorMessage, "error");

          // Reset button
          googleBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Continue with Google</span>
          `;
          googleBtn.disabled = false;
          googleBtn.classList.remove("loading");
        }
      });
    }

    // Notification System
    function showNotification(message: string, type = "info") {
      const notification = document.createElement("div");
      notification.style.cssText = `
                position: fixed;
                top: 2rem;
                right: 2rem;
                background: white;
                border-radius: 0.75rem;
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                border-left: 4px solid ${
                  type === "success" ? "#22c55e" : "#4ade80"
                };
                padding: 1rem 1.25rem;
                max-width: 400px;
                z-index: 10000;
                transform: translateX(120%);
                transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            `;

      notification.innerHTML = `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="
                        width: 24px; height: 24px;
                        background: ${
                          type === "success" ? "#22c55e" : "#4ade80"
                        };
                        border-radius: 50%;
                        display: flex; align-items: center; justify-content: center;
                        color: white; font-size: 0.875rem; font-weight: 600;
                    ">
                        ${type === "success" ? "✓" : "ℹ"}
                    </div>
                    <div style="flex: 1; color: #374151; font-weight: 500; line-height: 1.4;">${message}</div>
                    <button onclick="this.parentElement.parentElement.remove()" style="
                        background: none; border: none; color: #9ca3af;
                        cursor: pointer; font-size: 1.125rem; padding: 0.25rem;
                        border-radius: 0.25rem; transition: color 0.2s ease;
                    " onmouseover="this.style.color='#6b7280'" onmouseout="this.style.color='#9ca3af'">&times;</button>
                </div>
            `;

      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.transform = "translateX(0)";
      }, 100);

      setTimeout(() => {
        notification.style.transform = "translateX(120%)";
        setTimeout(() => notification.remove(), 400);
      }, 5000);
    }

    initParticles();
    initFormHandling();

    // Focus email input on load
    setTimeout(() => {
      const emailInput = document.getElementById("email") as HTMLInputElement;
      if (emailInput) emailInput.focus();
    }, 800);
  }, []);

  return (
    <>
      <style jsx global>{`
        :root {
          --primary-green: #4ade80;
          --primary-green-hover: #22c55e;
          --accent-orange: #ff8c42;
          --background: #f8f9fa;
          --text-primary: #0f0f0f;
          --text-secondary: #64748b;
          --text-muted: #94a3b8;
          --white: #ffffff;
          --gray-50: #f8fafc;
          --gray-100: #f1f5f9;
          --gray-200: #e2e8f0;
          --gray-300: #cbd5e1;

          --font-heading: "Space Grotesk", system-ui, -apple-system, sans-serif;
          --font-body: "Inter", system-ui, -apple-system, sans-serif;

          --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
          --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1),
            0 2px 4px -2px rgb(0 0 0 / 0.1);
          --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1),
            0 4px 6px -4px rgb(0 0 0 / 0.1);
          --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1),
            0 8px 10px -6px rgb(0 0 0 / 0.1);
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: var(--font-body);
          color: var(--text-primary);
          min-height: 100vh;
          background: linear-gradient(
            135deg,
            var(--background) 0%,
            var(--background) 80%,
            rgba(74, 222, 128, 0.03) 100%
          );
          opacity: 0;
          animation: fadeIn 0.6s ease forwards;
        }

        @keyframes fadeIn {
          to {
            opacity: 1;
          }
        }

        /* Subtle Particle Background */
        #signin-particles {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
          opacity: 0.4;
        }

        /* Navigation */
        .nav {
          position: relative;
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 2rem;
          backdrop-filter: blur(8px);
        }

        .nav-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          transition: all 0.2s ease;
        }

        .nav-brand:hover {
          transform: translateY(-1px);
        }

        .logo-icon {
          width: 2rem;
          height: 2rem;
          background: linear-gradient(
            135deg,
            var(--primary-green) 0%,
            var(--primary-green-hover) 100%
          );
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .nav-brand:hover .logo-icon {
          transform: scale(1.05);
          box-shadow: var(--shadow-md);
        }

        .brand-name {
          font-family: var(--font-heading);
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .nav-link {
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          transition: color 0.2s ease;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
        }

        .nav-link:hover {
          color: var(--primary-green);
          background: rgba(74, 222, 128, 0.05);
        }

        /* Main Content */
        .main-content {
          position: relative;
          z-index: 10;
          display: flex;
          min-height: calc(100vh - 120px);
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
        }

        .signin-container {
          width: 100%;
          max-width: 420px;
          text-align: center;
        }

        /* Header */
        .signin-header {
          margin-bottom: 2rem;
          opacity: 0;
          transform: translateY(1rem);
          animation: slideUp 0.8s ease forwards 0.2s;
        }

        .signin-title {
          font-family: var(--font-heading);
          font-size: 2.25rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 0.75rem;
          line-height: 1.2;
        }

        .signin-subtitle {
          font-size: 1.125rem;
          color: var(--text-secondary);
          font-weight: 400;
          line-height: 1.5;
        }

        .gradient-text {
          background: linear-gradient(
            135deg,
            var(--primary-green) 0%,
            var(--accent-orange) 100%
          );
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Signin Card */
        .signin-card {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border-radius: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: var(--shadow-xl);
          padding: 2rem;
          opacity: 0;
          transform: translateY(1rem);
          animation: slideUp 0.8s ease forwards 0.4s;
          transition: all 0.3s ease;
        }

        .signin-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
        }

        /* Form Styles */
        .signin-form {
          margin-bottom: 1.5rem;
        }

        .form-group {
          margin-bottom: 1.25rem;
          text-align: left;
        }

        .form-label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .form-input {
          width: 100%;
          height: 3rem;
          padding: 0 1rem;
          border: 1.5px solid var(--gray-200);
          border-radius: 0.75rem;
          font-size: 1rem;
          font-family: var(--font-body);
          transition: all 0.2s ease;
          background: var(--white);
        }

        .form-input:focus {
          outline: none;
          border-color: var(--primary-green);
          box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
          transform: translateY(-1px);
        }

        .form-input::placeholder {
          color: var(--text-muted);
        }

        .primary-button {
          width: 100%;
          height: 3.25rem;
          background: linear-gradient(
            135deg,
            var(--primary-green) 0%,
            var(--primary-green-hover) 100%
          );
          color: white;
          border: none;
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .primary-button:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-lg);
        }

        .primary-button:active {
          transform: translateY(0);
        }

        .primary-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        /* Separator */
        .separator {
          position: relative;
          text-align: center;
          margin: 1.5rem 0;
        }

        .separator::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--gray-200);
        }

        .separator-text {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          padding: 0 1rem;
          color: var(--text-muted);
          font-size: 0.875rem;
          font-weight: 500;
        }

        .secondary-button {
          width: 100%;
          height: 3.25rem;
          background: var(--white);
          border: 1.5px solid var(--gray-200);
          border-radius: 0.75rem;
          font-size: 1rem;
          font-weight: 500;
          font-family: var(--font-body);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          transition: all 0.2s ease;
          color: var(--text-primary);
        }

        .secondary-button:hover {
          border-color: var(--primary-green);
          background: rgba(74, 222, 128, 0.02);
          transform: translateY(-1px);
          box-shadow: var(--shadow-sm);
        }

        .secondary-button:active {
          transform: translateY(0);
        }

        .secondary-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        /* Footer */
        .signin-footer {
          margin-top: 1.5rem;
          opacity: 0;
          transform: translateY(1rem);
          animation: slideUp 0.8s ease forwards 0.6s;
        }

        .terms-text {
          font-size: 0.875rem;
          color: var(--text-muted);
          line-height: 1.5;
          margin-bottom: 1rem;
        }

        .terms-link {
          color: var(--primary-green);
          text-decoration: none;
          font-weight: 500;
          transition: opacity 0.2s ease;
        }

        .terms-link:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: var(--text-secondary);
          text-decoration: none;
          font-weight: 500;
          transition: all 0.2s ease;
          padding: 0.5rem;
          border-radius: 0.5rem;
        }

        .back-link:hover {
          color: var(--primary-green);
          background: rgba(74, 222, 128, 0.05);
          transform: translateX(-2px);
        }

        /* Loading States */
        .loading {
          opacity: 0.8;
        }

        .spinner {
          width: 1rem;
          height: 1rem;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(1rem);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Mobile Responsiveness */
        @media (max-width: 640px) {
          .nav {
            padding: 1rem;
          }

          .main-content {
            padding: 1rem;
          }

          .signin-container {
            max-width: 100%;
          }

          .signin-title {
            font-size: 1.875rem;
          }

          .signin-subtitle {
            font-size: 1rem;
          }

          .signin-card {
            padding: 1.5rem;
          }

          .form-input,
          .primary-button,
          .secondary-button {
            height: 2.75rem;
          }
        }

        /* High contrast support */
        @media (prefers-contrast: high) {
          .signin-card {
            border: 2px solid var(--gray-300);
          }

          .form-input {
            border-width: 2px;
          }
        }

        /* Reduced motion support */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }

          body {
            animation: none;
            opacity: 1;
          }

          .signin-header,
          .signin-card,
          .signin-footer {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
      {/* Subtle Particle Background */}
      <canvas id="signin-particles"></canvas>

      {/* Navigation */}
      <nav className="nav">
        <a href="/" className="nav-brand">
          <Map className="logo-icon h-5 w-5 text-primary-green" />
          <span className="brand-name">LandVision</span>
        </a>
        <a href="/signup" className="nav-link">
          Don't have an account? <strong>Sign up</strong>
        </a>
      </nav>

      {/* Main Content */}
      <div className="main-content">
        <div className="signin-container">
          {/* Header */}
          <div className="signin-header">
            <h1 className="signin-title">Sign back into LandVision</h1>
            <p className="signin-subtitle">
              Welcome back! Continue developing with{" "}
              <span className="gradient-text">AI-powered land analysis</span>
            </p>
          </div>

          {/* Signin Card */}
          <div className="signin-card">
            <form id="signin-form" className="signin-form">
              <div className="form-group">
                <label className="form-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  className="form-input"
                  type="email"
                  id="email"
                  name="email"
                  placeholder="your.email@company.com"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Password
                </label>
                <input
                  className="form-input"
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Enter your password"
                  minLength={6}
                  required
                />
              </div>
              <button type="submit" className="primary-button" id="submit-btn">
                Sign In
              </button>
            </form>

            <div className="separator">
              <span className="separator-text">OR</span>
            </div>

            <button className="secondary-button" id="google-btn">
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Footer */}
          <div className="signin-footer">
            <div className="terms-text">
              By signing in, you agree to our
              <a href="/terms" className="terms-link">
                Terms of Service
              </a>
              and
              <a href="/privacy" className="terms-link">
                Privacy Policy
              </a>
            </div>
            <a href="/" className="back-link">
              <svg
                width="16"
                height="16"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                  clipRule="evenodd"
                />
              </svg>
              Back to homepage
            </a>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignInPage;
