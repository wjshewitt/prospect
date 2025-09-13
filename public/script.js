// LandVision Homepage JavaScript - Enhanced with Dynamic Features

document.addEventListener("DOMContentLoaded", function () {
  // ========== ENHANCED DYNAMIC FEATURES ==========

  // 1. TYPING ANIMATION FOR HERO HEADLINE
  function initTypeWriter() {
    const heroHeadline = document.querySelector(".hero-headline");
    if (!heroHeadline) return;

    const originalText = heroHeadline.innerHTML;
    const textParts = originalText.split('<span class="gradient-text">');
    const beforeGradient = textParts[0].replace(
      "Transform Land Development with ",
      ""
    );
    const gradientText = textParts[1].replace("</span>", "").trim();

    const fullText = "Transform Land Development with " + gradientText;
    heroHeadline.innerHTML = "";

    let charIndex = 0;
    const typingSpeed = 60;

    function typeChar() {
      if (charIndex < fullText.length) {
        const currentChar = fullText.charAt(charIndex);
        if (charIndex >= 32) {
          // Start of "AI-Powered Analysis"
          const beforePart = fullText.substring(0, 32);
          const gradientPart = fullText.substring(32, charIndex + 1);
          heroHeadline.innerHTML =
            beforePart +
            '<span class="gradient-text">' +
            gradientPart +
            '<span class="typing-cursor">|</span></span>';
        } else {
          heroHeadline.innerHTML =
            fullText.substring(0, charIndex + 1) +
            '<span class="typing-cursor">|</span>';
        }
        charIndex++;
        setTimeout(typeChar, typingSpeed);
      } else {
        // Remove cursor after typing is complete
        setTimeout(() => {
          heroHeadline.innerHTML = originalText;
        }, 1000);
      }
    }

    setTimeout(typeChar, 2000); // Delay start of typing animation
  }

  // 2. INTERACTIVE DASHBOARD MOCKUP WITH LIVE DATA
  function initInteractiveDashboard() {
    const mockupContent = document.querySelector(".mockup-content");
    const analysisPanel = document.querySelector(".analysis-panel");
    const dataPoints = document.querySelectorAll(".data-point");

    if (!mockupContent || !analysisPanel) return;

    const dataScenarios = [
      {
        score: "8.7/10",
        risk: "Low",
        riskClass: "low",
        activity: "Analyzing soil composition...",
      },
      {
        score: "9.2/10",
        risk: "Very Low",
        riskClass: "very-low",
        activity: "Processing satellite data...",
      },
      {
        score: "7.4/10",
        risk: "Medium",
        riskClass: "medium",
        activity: "Evaluating zoning regulations...",
      },
      {
        score: "8.9/10",
        risk: "Low",
        riskClass: "low",
        activity: "Assessing environmental factors...",
      },
    ];

    let currentScenario = 0;

    function updateDashboardData() {
      const scenario = dataScenarios[currentScenario];
      const scoreElement = analysisPanel.querySelector(".metric-value");
      const riskElement = analysisPanel.querySelectorAll(".metric-value")[1];

      if (scoreElement) {
        scoreElement.textContent = scenario.score;
        scoreElement.style.opacity = "0";
        setTimeout(() => {
          scoreElement.style.opacity = "1";
        }, 200);
      }

      if (riskElement) {
        riskElement.textContent = scenario.risk;
        riskElement.className = "metric-value " + scenario.riskClass;
        riskElement.style.opacity = "0";
        setTimeout(() => {
          riskElement.style.opacity = "1";
        }, 300);
      }

      // Animate data points
      dataPoints.forEach((point, index) => {
        point.classList.remove("active", "processing");
        setTimeout(() => {
          if (index === currentScenario % dataPoints.length) {
            point.classList.add("active");
          } else if (index === (currentScenario + 1) % dataPoints.length) {
            point.classList.add("processing");
          }
        }, 100 * index);
      });

      currentScenario = (currentScenario + 1) % dataScenarios.length;
    }

    // Update dashboard every 3 seconds
    setInterval(updateDashboardData, 3000);
    updateDashboardData(); // Initial call
  }

  // 3. TESTIMONIAL CAROUSEL
  function initTestimonialCarousel() {
    const testimonials = document.querySelectorAll(".testimonial");
    if (testimonials.length <= 1) return;

    let currentTestimonial = 0;

    // Create carousel indicators
    const indicatorsContainer = document.createElement("div");
    indicatorsContainer.className = "testimonial-indicators";

    testimonials.forEach((_, index) => {
      const indicator = document.createElement("button");
      indicator.className = "testimonial-indicator";
      if (index === 0) indicator.classList.add("active");
      indicator.addEventListener("click", () => goToTestimonial(index));
      indicatorsContainer.appendChild(indicator);
    });

    const testimonialsContainer = document.querySelector(".testimonials");
    if (testimonialsContainer) {
      testimonialsContainer.appendChild(indicatorsContainer);

      // Hide all testimonials except first
      testimonials.forEach((testimonial, index) => {
        if (index > 0) testimonial.style.display = "none";
      });
    }

    function goToTestimonial(index) {
      const current = testimonials[currentTestimonial];
      const next = testimonials[index];
      const indicators = document.querySelectorAll(".testimonial-indicator");

      // Fade out current
      current.style.opacity = "0";
      indicators[currentTestimonial].classList.remove("active");

      setTimeout(() => {
        current.style.display = "none";
        next.style.display = "block";
        next.style.opacity = "0";

        setTimeout(() => {
          next.style.opacity = "1";
          indicators[index].classList.add("active");
        }, 50);
      }, 300);

      currentTestimonial = index;
    }

    function nextTestimonial() {
      const nextIndex = (currentTestimonial + 1) % testimonials.length;
      goToTestimonial(nextIndex);
    }

    // Auto-rotate testimonials every 5 seconds
    setInterval(nextTestimonial, 5000);
  }

  // 4. INTERACTIVE TOOLTIPS FOR FEATURES
  function initInteractiveTooltips() {
    const featureCards = document.querySelectorAll(".feature-card");

    const tooltipContent = {
      "AI-Powered Analysis":
        "Our advanced algorithms process over 50 data points including soil composition, geological surveys, weather patterns, and historical development data to provide comprehensive land insights.",
      "Interactive Visualization":
        "Experience land data like never before with 3D terrain models, real-time heatmaps, drone imagery integration, and augmented reality overlays that make complex data instantly understandable.",
      "Real-Time Intelligence":
        "Stay ahead with instant notifications about zoning changes, market fluctuations, permit updates, and new development opportunities in your areas of interest.",
      "Risk Assessment":
        "Identify potential issues before they become expensive problems with our predictive models that analyze environmental hazards, regulatory risks, market volatility, and infrastructure challenges.",
    };

    featureCards.forEach((card) => {
      const title = card.querySelector(".feature-title").textContent;
      const tooltip = document.createElement("div");
      tooltip.className = "feature-tooltip";
      tooltip.innerHTML = `
                <div class="tooltip-content">
                    <h4>${title} - Advanced Details</h4>
                    <p>${
                      tooltipContent[title] ||
                      "Enhanced capabilities for modern land development."
                    }</p>
                    <div class="tooltip-arrow"></div>
                </div>
            `;

      card.appendChild(tooltip);

      card.addEventListener("mouseenter", () => {
        tooltip.classList.add("show");
      });

      card.addEventListener("mouseleave", () => {
        tooltip.classList.remove("show");
      });
    });
  }

  // 5. PARTICLE BACKGROUND ANIMATION
  function initParticleBackground() {
    const hero = document.querySelector(".hero");
    if (!hero) return;

    const canvas = document.createElement("canvas");
    canvas.className = "particle-canvas";
    canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
        `;

    hero.style.position = "relative";
    hero.appendChild(canvas);

    const ctx = canvas.getContext("2d");
    const particles = [];
    const particleCount = 50;

    function resizeCanvas() {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
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
      requestAnimationFrame(animate);
    }

    resizeCanvas();
    initParticles();
    animate();

    window.addEventListener("resize", resizeCanvas);
  }

  // 6. DEMO MODAL SYSTEM
  function initDemoModal() {
    const demoModal = document.createElement("div");
    demoModal.className = "demo-modal";
    demoModal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <div class="modal-header">
                    <h2>Request Your Free Demo</h2>
                    <p>See how LandVision can transform your land development process</p>
                </div>
                <div class="modal-body">
                    <form class="demo-form">
                        <div class="form-group">
                            <label>Full Name</label>
                            <input type="text" required placeholder="Enter your full name">
                        </div>
                        <div class="form-group">
                            <label>Company Email</label>
                            <input type="email" required placeholder="your.email@company.com">
                        </div>
                        <div class="form-group">
                            <label>Company Name</label>
                            <input type="text" required placeholder="Your Company">
                        </div>
                        <div class="form-group">
                            <label>Industry</label>
                            <select required>
                                <option value="">Select your industry</option>
                                <option value="real-estate">Real Estate Development</option>
                                <option value="urban-planning">Urban Planning</option>
                                <option value="construction">Construction</option>
                                <option value="investment">Land Investment</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Project Size</label>
                            <select required>
                                <option value="">Typical project size</option>
                                <option value="small">Under 10 acres</option>
                                <option value="medium">10-100 acres</option>
                                <option value="large">100-1000 acres</option>
                                <option value="enterprise">1000+ acres</option>
                            </select>
                        </div>
                        <button type="submit" class="btn-primary-large demo-submit">
                            Schedule My Demo
                        </button>
                    </form>
                </div>
            </div>
        `;

    document.body.appendChild(demoModal);

    // Event listeners
    const modalOverlay = demoModal.querySelector(".modal-overlay");
    const modalClose = demoModal.querySelector(".modal-close");
    const demoForm = demoModal.querySelector(".demo-form");

    function closeModal() {
      demoModal.classList.remove("show");
      document.body.style.overflow = "";
    }

    function openModal() {
      demoModal.classList.add("show");
      document.body.style.overflow = "hidden";
    }

    modalOverlay.addEventListener("click", closeModal);
    modalClose.addEventListener("click", closeModal);

    // Handle form submission
    demoForm.addEventListener("submit", function (e) {
      e.preventDefault();
      const submitBtn = demoForm.querySelector(".demo-submit");
      const originalText = submitBtn.textContent;

      submitBtn.textContent = "Processing...";
      submitBtn.disabled = true;

      // Simulate form processing
      setTimeout(() => {
        submitBtn.textContent = "Demo Scheduled!";
        submitBtn.style.background = "#22c55e";

        setTimeout(() => {
          closeModal();
          showNotification(
            "Demo scheduled! Check your email for confirmation.",
            "success"
          );

          // Reset form
          demoForm.reset();
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
          submitBtn.style.background = "";
        }, 2000);
      }, 2000);
    });

    // Attach to demo buttons
    document
      .querySelectorAll(".btn-primary, .btn-primary-large")
      .forEach((button) => {
        if (
          button.textContent.includes("Demo") ||
          button.textContent.includes("demo")
        ) {
          button.addEventListener("click", function (e) {
            e.preventDefault();
            openModal();
          });
        }
      });
  }

  // 7. NOTIFICATION SYSTEM
  function initNotificationSystem() {
    const notificationContainer = document.createElement("div");
    notificationContainer.className = "notification-container";
    document.body.appendChild(notificationContainer);

    window.showNotification = function (
      message,
      type = "info",
      duration = 5000
    ) {
      const notification = document.createElement("div");
      notification.className = `notification ${type}`;
      notification.innerHTML = `
                <div class="notification-content">
                    <div class="notification-icon">
                        ${
                          type === "success"
                            ? "✓"
                            : type === "error"
                            ? "✗"
                            : "ℹ"
                        }
                    </div>
                    <div class="notification-message">${message}</div>
                    <button class="notification-close">&times;</button>
                </div>
            `;

      notificationContainer.appendChild(notification);

      // Show notification
      setTimeout(() => notification.classList.add("show"), 100);

      // Auto-remove
      const autoRemove = setTimeout(() => {
        notification.classList.remove("show");
        setTimeout(() => notification.remove(), 300);
      }, duration);

      // Manual close
      notification
        .querySelector(".notification-close")
        .addEventListener("click", () => {
          clearTimeout(autoRemove);
          notification.classList.remove("show");
          setTimeout(() => notification.remove(), 300);
        });
    };

    // Show welcome notification after page load
    setTimeout(() => {
      showNotification(
        "Welcome to LandVision! Explore our AI-powered land analysis platform.",
        "info"
      );
    }, 3000);
  }

  // 8. LIVE CHAT SIMULATION
  function initLiveChatSimulation() {
    const chatWidget = document.createElement("div");
    chatWidget.className = "chat-widget";
    chatWidget.innerHTML = `
            <div class="chat-toggle">
                <div class="chat-icon">💬</div>
                <div class="chat-badge">1</div>
            </div>
            <div class="chat-window">
                <div class="chat-header">
                    <div class="chat-agent">
                        <div class="agent-avatar">AI</div>
                        <div class="agent-info">
                            <div class="agent-name">LandVision Assistant</div>
                            <div class="agent-status">Online</div>
                        </div>
                    </div>
                    <button class="chat-minimize">−</button>
                </div>
                <div class="chat-messages">
                    <div class="message agent-message">
                        <div class="message-content">
                            Hi! I'm your AI assistant. I can help you learn about LandVision's features and answer questions about land analysis. How can I help you today?
                        </div>
                        <div class="message-time">just now</div>
                    </div>
                </div>
                <div class="chat-input-area">
                    <input type="text" class="chat-input" placeholder="Type your message...">
                    <button class="chat-send">Send</button>
                </div>
            </div>
        `;

    document.body.appendChild(chatWidget);

    const chatToggle = chatWidget.querySelector(".chat-toggle");
    const chatWindow = chatWidget.querySelector(".chat-window");
    const chatMinimize = chatWidget.querySelector(".chat-minimize");
    const chatInput = chatWidget.querySelector(".chat-input");
    const chatSend = chatWidget.querySelector(".chat-send");
    const chatMessages = chatWidget.querySelector(".chat-messages");
    const chatBadge = chatWidget.querySelector(".chat-badge");

    let isOpen = false;

    function toggleChat() {
      isOpen = !isOpen;
      chatWidget.classList.toggle("open", isOpen);
      if (isOpen) {
        chatBadge.style.display = "none";
        chatInput.focus();
      }
    }

    chatToggle.addEventListener("click", toggleChat);
    chatMinimize.addEventListener("click", toggleChat);

    const responses = [
      "LandVision analyzes over 50 data points to give you comprehensive land insights. Would you like to know about our AI analysis features?",
      "Our platform helps reduce development risks by up to 40% through predictive analytics. What type of projects are you working on?",
      "We integrate with satellite imagery, GIS data, and government databases for real-time insights. Would you like to see a demo?",
      "LandVision supports projects from 1 acre to 10,000+ acres. What size developments do you typically work with?",
      "Our risk assessment feature has helped clients avoid costly mistakes worth millions. Would you like to learn more about risk analysis?",
    ];

    function addMessage(content, isUser = false) {
      const message = document.createElement("div");
      message.className = `message ${
        isUser ? "user-message" : "agent-message"
      }`;
      message.innerHTML = `
                <div class="message-content">${content}</div>
                <div class="message-time">${new Date().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</div>
            `;

      chatMessages.appendChild(message);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
      const message = chatInput.value.trim();
      if (!message) return;

      addMessage(message, true);
      chatInput.value = "";

      // Simulate typing
      const typingIndicator = document.createElement("div");
      typingIndicator.className = "typing-indicator";
      typingIndicator.innerHTML =
        '<div class="typing-dots"><span></span><span></span><span></span></div>';
      chatMessages.appendChild(typingIndicator);
      chatMessages.scrollTop = chatMessages.scrollHeight;

      setTimeout(() => {
        typingIndicator.remove();
        const response =
          responses[Math.floor(Math.random() * responses.length)];
        addMessage(response);
      }, 1000 + Math.random() * 2000);
    }

    chatSend.addEventListener("click", sendMessage);
    chatInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") sendMessage();
    });
  }

  // 9. PARALLAX SCROLLING EFFECTS
  function initParallaxEffects() {
    const parallaxElements = [
      { selector: ".hero-visual", speed: 0.15 },
      { selector: ".dashboard-mockup", speed: 0.08 },
      { selector: ".particle-canvas", speed: 0.05 },
    ];

    function updateParallax() {
      const scrolled = window.pageYOffset;
      const rate = scrolled * -0.5;

      parallaxElements.forEach(({ selector, speed }) => {
        const element = document.querySelector(selector);
        if (element) {
          const yPos = -(scrolled * speed);
          element.style.transform = `translateY(${yPos}px)`;
        }
      });
    }

    let ticking = false;
    function requestTick() {
      if (!ticking) {
        requestAnimationFrame(updateParallax);
        ticking = true;
      }
    }

    window.addEventListener("scroll", () => {
      requestTick();
      ticking = false;
    });
  }

  // 10. INTERACTIVE STEP TIMELINE
  function initInteractiveTimeline() {
    const steps = document.querySelectorAll(".step");
    steps.forEach((step, index) => {
      step.addEventListener("click", () => {
        // Remove active class from all steps
        steps.forEach((s) => s.classList.remove("step-active"));

        // Add active class to clicked step
        step.classList.add("step-active");

        // Add completion effect
        const stepNumber = step.querySelector(".step-number");
        stepNumber.style.transform = "scale(1.2)";
        setTimeout(() => {
          stepNumber.style.transform = "scale(1)";
        }, 200);

        // Show detailed info
        const existingDetail = step.querySelector(".step-detail");
        if (!existingDetail) {
          const detail = document.createElement("div");
          detail.className = "step-detail";
          detail.innerHTML = getStepDetail(index);
          step.appendChild(detail);

          setTimeout(() => {
            detail.classList.add("show");
          }, 100);
        }
      });
    });

    function getStepDetail(stepIndex) {
      const details = [
        "<strong>Supported formats:</strong> GIS shapefiles, KML, GPX, CSV, Excel, PDF surveys, drone imagery, satellite data, and more.",
        "<strong>AI capabilities:</strong> Machine learning models trained on millions of land parcels, geological data, climate patterns, and development outcomes.",
        "<strong>Report types:</strong> Development feasibility, environmental impact, market analysis, zoning compliance, infrastructure requirements, and ROI projections.",
      ];
      return (
        details[stepIndex] ||
        "Enhanced functionality for streamlined land development."
      );
    }
  }

  // Initialize all dynamic features
  setTimeout(() => {
    initTypeWriter();
    initInteractiveDashboard();
    initTestimonialCarousel();
    initInteractiveTooltips();
    initParticleBackground();
    initDemoModal();
    initNotificationSystem();
    initLiveChatSimulation();
    initParallaxEffects();
    initInteractiveTimeline();
  }, 500);

  // ========== ORIGINAL FUNCTIONALITY ==========
  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");
  const navLinks = document.querySelector(".nav-links");

  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener("click", function () {
      navLinks.classList.toggle("mobile-menu-open");
      this.classList.toggle("active");
    });
  }

  // Smooth scrolling for navigation links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        const offsetTop = target.offsetTop - 80; // Account for fixed navbar
        window.scrollTo({
          top: offsetTop,
          behavior: "smooth",
        });

        // Close mobile menu if open
        if (navLinks.classList.contains("mobile-menu-open")) {
          navLinks.classList.remove("mobile-menu-open");
          mobileMenuToggle.classList.remove("active");
        }
      }
    });
  });

  // Navbar scroll effect
  const navbar = document.querySelector(".navbar");
  let lastScrollTop = 0;

  window.addEventListener("scroll", function () {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Add/remove background blur based on scroll position
    if (scrollTop > 50) {
      navbar.classList.add("scrolled");
    } else {
      navbar.classList.remove("scrolled");
    }

    lastScrollTop = scrollTop;
  });

  // Intersection Observer for animations
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate-in");
      }
    });
  }, observerOptions);

  // Observe elements for animation
  document
    .querySelectorAll(".feature-card, .step, .testimonial, .stat-card")
    .forEach((el) => {
      observer.observe(el);
    });

  // Hero dashboard mockup interaction
  const dashboardMockup = document.querySelector(".dashboard-mockup");
  if (dashboardMockup) {
    dashboardMockup.addEventListener("mouseenter", function () {
      this.style.transform = "rotateY(-5deg) rotateX(2deg) scale(1.02)";
    });

    dashboardMockup.addEventListener("mouseleave", function () {
      this.style.transform = "rotateY(-10deg) rotateX(5deg) scale(1)";
    });
  }

  // Button click effects
  document
    .querySelectorAll(
      ".btn-primary, .btn-primary-large, .btn-secondary, .btn-secondary-large"
    )
    .forEach((button) => {
      button.addEventListener("click", function (e) {
        // Create ripple effect
        const ripple = document.createElement("span");
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;

        ripple.style.cssText = `
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.3);
                transform: scale(0);
                animation: ripple 0.6s linear;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                pointer-events: none;
            `;

        this.style.position = "relative";
        this.style.overflow = "hidden";
        this.appendChild(ripple);

        setTimeout(() => {
          ripple.remove();
        }, 600);
      });
    });

  // Form handling for demo requests (placeholder)
  document
    .querySelectorAll(".btn-primary, .btn-primary-large")
    .forEach((button) => {
      if (
        button.textContent.includes("Demo") ||
        button.textContent.includes("demo")
      ) {
        button.addEventListener("click", function (e) {
          e.preventDefault();
          // In a real implementation, this would open a modal or redirect to a form
          alert(
            "Demo request functionality would be implemented here. This would typically open a form or redirect to a demo signup page."
          );
        });
      }
    });

  // Counter animation for statistics
  function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }

      // Format number based on content
      if (element.textContent.includes("K")) {
        element.textContent = Math.floor(current / 1000) + "K+";
      } else if (element.textContent.includes("%")) {
        element.textContent = Math.floor(current) + "%";
      } else if (element.textContent.includes("x")) {
        element.textContent = (current / 10).toFixed(1) + "x";
      } else if (element.textContent.includes("$")) {
        element.textContent = "$" + (current / 1000000).toFixed(1) + "M";
      } else {
        element.textContent = Math.floor(current);
      }
    }, 16);
  }

  // Animate counters when they come into view
  const counterObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach((entry) => {
        if (
          entry.isIntersecting &&
          !entry.target.classList.contains("animated")
        ) {
          entry.target.classList.add("animated");
          const text = entry.target.textContent;

          let target;
          if (text.includes("500K+")) target = 500000;
          else if (text.includes("95%")) target = 95;
          else if (text.includes("2.5x"))
            target = 25; // 2.5 * 10 for calculation
          else if (text.includes("$2.3M")) target = 2300000;
          else target = parseInt(text) || 0;

          if (target > 0) {
            animateCounter(entry.target, target);
          }
        }
      });
    },
    { threshold: 0.5 }
  );

  // Observe stat numbers for counter animation
  document
    .querySelectorAll(".stat-number, .stat-number-large")
    .forEach((el) => {
      counterObserver.observe(el);
    });

  // Add loading states and error handling
  window.addEventListener("load", function () {
    document.body.classList.add("loaded");

    // Hide any loading spinners or show content
    const loadingElements = document.querySelectorAll(".loading");
    loadingElements.forEach((el) => (el.style.display = "none"));
  });

  // Handle form submissions (placeholder for future implementation)
  document.addEventListener("submit", function (e) {
    if (e.target.matches("form")) {
      e.preventDefault();
      console.log("Form submission intercepted for demo purposes");
      // Real implementation would handle form data
    }
  });

  // Keyboard navigation support
  document.addEventListener("keydown", function (e) {
    // ESC key closes mobile menu
    if (e.key === "Escape" && navLinks.classList.contains("mobile-menu-open")) {
      navLinks.classList.remove("mobile-menu-open");
      mobileMenuToggle.classList.remove("active");
    }
  });

  // Performance monitoring (optional)
  if ("performance" in window) {
    window.addEventListener("load", function () {
      setTimeout(function () {
        const perf = performance.getEntriesByType("navigation")[0];
        if (perf && perf.loadEventEnd - perf.loadEventStart > 3000) {
          console.log(
            "Page load took longer than expected:",
            perf.loadEventEnd - perf.loadEventStart,
            "ms"
          );
        }
      }, 0);
    });
  }
});

// Add comprehensive CSS for all dynamic features
const style = document.createElement("style");
style.textContent = `
    /* Original Animations */
    @keyframes ripple {
        to {
            transform: scale(2);
            opacity: 0;
        }
    }
    
    @keyframes animate-in {
        from {
            opacity: 0;
            transform: translateY(30px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .animate-in {
        animation: animate-in 0.6s ease-out forwards;
    }
    
    /* Enhanced Dynamic Features Styling */
    
    /* 1. Typing Animation */
    .typing-cursor {
        animation: blink 1s infinite;
        color: #4ade80;
    }
    
    @keyframes blink {
        0%, 50% { opacity: 1; }
        51%, 100% { opacity: 0; }
    }
    
    /* 2. Interactive Dashboard */
    .data-point.processing {
        background: #ff8c42;
        animation: pulse 1.5s infinite;
        box-shadow: 0 0 0 0 rgba(255, 140, 66, 0.4);
    }
    
    .metric-value.very-low {
        background: #22c55e !important;
        color: white !important;
    }
    
    .metric-value.medium {
        background: #f59e0b !important;
        color: white !important;
    }
    
    .metric-value.high {
        background: #ef4444 !important;
        color: white !important;
    }
    
    /* 3. Testimonial Carousel */
    .testimonial-indicators {
        display: flex;
        justify-content: center;
        gap: 0.5rem;
        margin-top: 2rem;
    }
    
    .testimonial-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: none;
        background: #cbd5e1;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .testimonial-indicator.active {
        background: #4ade80;
        transform: scale(1.2);
    }
    
    .testimonial {
        transition: opacity 0.3s ease;
    }
    
    /* 4. Interactive Tooltips */
    .feature-tooltip {
        position: absolute;
        top: -10px;
        left: 50%;
        transform: translateX(-50%) translateY(-100%);
        background: white;
        border-radius: 12px;
        padding: 1.5rem;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        border: 1px solid #e2e8f0;
        width: 300px;
        z-index: 1000;
        opacity: 0;
        pointer-events: none;
        transition: all 0.3s ease;
    }
    
    .feature-tooltip.show {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(-110%);
    }
    
    .tooltip-content h4 {
        color: #4ade80;
        margin-bottom: 0.5rem;
        font-size: 1rem;
    }
    
    .tooltip-content p {
        color: #64748b;
        font-size: 0.875rem;
        line-height: 1.5;
    }
    
    .tooltip-arrow {
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 12px;
        height: 12px;
        background: white;
        border-right: 1px solid #e2e8f0;
        border-bottom: 1px solid #e2e8f0;
        transform: translateX(-50%) rotate(45deg);
    }
    
    /* 5. Demo Modal */
    .demo-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
    }
    
    .demo-modal.show {
        opacity: 1;
        visibility: visible;
    }
    
    .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(5px);
    }
    
    .modal-content {
        position: relative;
        background: white;
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        margin: 5vh auto;
        transform: scale(0.9) translateY(20px);
        transition: all 0.3s ease;
    }
    
    .demo-modal.show .modal-content {
        transform: scale(1) translateY(0);
    }
    
    .modal-close {
        position: absolute;
        top: 1rem;
        right: 1rem;
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #64748b;
        z-index: 1;
    }
    
    .modal-header {
        padding: 2rem 2rem 1rem;
        text-align: center;
        border-bottom: 1px solid #f1f5f9;
    }
    
    .modal-header h2 {
        color: #0f0f0f;
        margin-bottom: 0.5rem;
    }
    
    .modal-header p {
        color: #64748b;
    }
    
    .modal-body {
        padding: 1rem 2rem 2rem;
    }
    
    .demo-form .form-group {
        margin-bottom: 1rem;
    }
    
    .demo-form label {
        display: block;
        margin-bottom: 0.5rem;
        font-weight: 500;
        color: #374151;
    }
    
    .demo-form input,
    .demo-form select {
        width: 100%;
        padding: 0.75rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 1rem;
        transition: border-color 0.2s ease;
    }
    
    .demo-form input:focus,
    .demo-form select:focus {
        outline: none;
        border-color: #4ade80;
        box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.1);
    }
    
    /* 6. Notification System */
    .notification-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
    
    .notification {
        background: white;
        border-radius: 8px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        border-left: 4px solid #4ade80;
        padding: 1rem;
        max-width: 400px;
        transform: translateX(120%);
        transition: all 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.error {
        border-left-color: #ef4444;
    }
    
    .notification.success {
        border-left-color: #22c55e;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .notification-icon {
        flex-shrink: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #4ade80;
        color: white;
        border-radius: 50%;
        font-size: 0.75rem;
    }
    
    .notification.error .notification-icon {
        background: #ef4444;
    }
    
    .notification.success .notification-icon {
        background: #22c55e;
    }
    
    .notification-message {
        flex: 1;
        color: #374151;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: #9ca3af;
        cursor: pointer;
        font-size: 1.25rem;
    }
    
    /* 7. Chat Widget */
    .chat-widget {
        position: fixed;
        bottom: 1rem;
        right: 1rem;
        z-index: 10002;
    }
    
    .chat-toggle {
        width: 60px;
        height: 60px;
        background: linear-gradient(135deg, #4ade80, #22c55e);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
        transition: all 0.3s ease;
        position: relative;
    }
    
    .chat-toggle:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 20px rgba(74, 222, 128, 0.4);
    }
    
    .chat-icon {
        font-size: 1.5rem;
    }
    
    .chat-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        border-radius: 50%;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.75rem;
        font-weight: bold;
    }
    
    .chat-window {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 350px;
        height: 500px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
        display: none;
        flex-direction: column;
        transform: scale(0.95) translateY(20px);
        transition: all 0.3s ease;
    }
    
    .chat-widget.open .chat-window {
        display: flex;
        transform: scale(1) translateY(0);
    }
    
    .chat-header {
        padding: 1rem;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #4ade80;
        color: white;
        border-radius: 16px 16px 0 0;
    }
    
    .chat-agent {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .agent-avatar {
        width: 40px;
        height: 40px;
        background: white;
        color: #4ade80;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }
    
    .agent-name {
        font-weight: 600;
    }
    
    .agent-status {
        font-size: 0.75rem;
        opacity: 0.9;
    }
    
    .chat-minimize {
        background: none;
        border: none;
        color: white;
        font-size: 1.25rem;
        cursor: pointer;
    }
    
    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 1rem;
        display: flex;
        flex-direction: column;
        gap: 1rem;
    }
    
    .message {
        display: flex;
        flex-direction: column;
        max-width: 80%;
    }
    
    .agent-message {
        align-self: flex-start;
    }
    
    .user-message {
        align-self: flex-end;
    }
    
    .message-content {
        padding: 0.75rem 1rem;
        border-radius: 12px;
        line-height: 1.4;
    }
    
    .agent-message .message-content {
        background: #f1f5f9;
        color: #374151;
    }
    
    .user-message .message-content {
        background: #4ade80;
        color: white;
    }
    
    .message-time {
        font-size: 0.75rem;
        color: #9ca3af;
        margin-top: 0.25rem;
        text-align: right;
    }
    
    .agent-message .message-time {
        text-align: left;
    }
    
    .typing-indicator {
        align-self: flex-start;
    }
    
    .typing-dots {
        background: #f1f5f9;
        border-radius: 12px;
        padding: 0.75rem 1rem;
        display: flex;
        gap: 0.25rem;
    }
    
    .typing-dots span {
        width: 6px;
        height: 6px;
        background: #9ca3af;
        border-radius: 50%;
        animation: typing 1.5s infinite;
    }
    
    .typing-dots span:nth-child(2) {
        animation-delay: 0.2s;
    }
    
    .typing-dots span:nth-child(3) {
        animation-delay: 0.4s;
    }
    
    @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
    }
    
    .chat-input-area {
        padding: 1rem;
        border-top: 1px solid #f1f5f9;
        display: flex;
        gap: 0.5rem;
    }
    
    .chat-input {
        flex: 1;
        padding: 0.5rem;
        border: 1px solid #d1d5db;
        border-radius: 8px;
        font-size: 0.875rem;
    }
    
    .chat-send {
        background: #4ade80;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-size: 0.875rem;
    }
    
    /* 8. Interactive Timeline Steps */
    .step {
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .step:hover {
        transform: translateY(-2px);
    }
    
    .step-active {
        background: rgba(74, 222, 128, 0.05);
        border-radius: 12px;
        padding: 1rem;
        margin: -1rem;
    }
    
    .step-detail {
        margin-top: 1rem;
        padding: 1rem;
        background: rgba(74, 222, 128, 0.05);
        border-radius: 8px;
        border-left: 4px solid #4ade80;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
    }
    
    .step-detail.show {
        opacity: 1;
        transform: translateY(0);
    }
    
    /* Mobile Navigation */
    .mobile-menu-open {
        display: flex !important;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(248, 249, 250, 0.95);
        backdrop-filter: blur(12px);
        padding: 1rem;
        border-top: 1px solid var(--gray-200);
        gap: 1rem;
    }
    
    .mobile-menu-toggle.active span:nth-child(1) {
        transform: rotate(-45deg) translate(-5px, 6px);
    }
    
    .mobile-menu-toggle.active span:nth-child(2) {
        opacity: 0;
    }
    
    .mobile-menu-toggle.active span:nth-child(3) {
        transform: rotate(45deg) translate(-5px, -6px);
    }
    
    .navbar.scrolled {
        background: rgba(248, 249, 250, 0.95);
        backdrop-filter: blur(16px);
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
    }
    
    body.loaded {
        opacity: 1;
    }
    
    /* Smooth transitions for all interactive elements */
    * {
        transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    
    /* Focus styles for accessibility */
    button:focus-visible,
    a:focus-visible {
        outline: 2px solid var(--primary-green);
        outline-offset: 2px;
    }
    
    /* Responsive Adjustments */
    @media (max-width: 768px) {
        .feature-tooltip {
            width: 280px;
        }
        
        .chat-window {
            width: 300px;
            height: 400px;
        }
        
        .notification {
            max-width: 300px;
        }
        
        .modal-content {
            width: 95%;
            margin: 2vh auto;
        }
    }
`;
document.head.appendChild(style);
