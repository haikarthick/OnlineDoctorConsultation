import { useState, useEffect, useRef, useCallback } from 'react'
import './Home.css'

interface HomeProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
  onLogin?: () => void
}

const SECTIONS = [
  { id: 'hero', label: 'Home' },
  { id: 'enterprises', label: 'Enterprises' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'testimonials', label: 'Testimonials' },
] as const

export default function Home({ onGetStarted, onViewForDoctors, onLogin }: HomeProps) {
  const [activeTab, setActiveTab] = useState<'owner' | 'enterprise' | 'vet'>('owner')
  const [activeSection, setActiveSection] = useState('hero')
  const [scrollProgress, setScrollProgress] = useState(0)
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [navScrolled, setNavScrolled] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scroll progress + back-to-top + nav shadow
  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY
    const docHeight = document.documentElement.scrollHeight - window.innerHeight
    setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0)
    setShowBackToTop(scrollTop > 500)
    setNavScrolled(scrollTop > 20)
  }, [])

  // IntersectionObserver for active section
  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter(e => e.isIntersecting)
        if (visible.length > 0) {
          // Pick the one with the highest intersection ratio
          const best = visible.reduce((a, b) => a.intersectionRatio > b.intersectionRatio ? a : b)
          setActiveSection(best.target.id)
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.25, 0.5] }
    )

    // Observe all sections with IDs
    setTimeout(() => {
      SECTIONS.forEach(({ id }) => {
        const el = document.getElementById(id)
        if (el) observerRef.current?.observe(el)
      })
    }, 100)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      observerRef.current?.disconnect()
    }
  }, [handleScroll])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const ownerBenefits = [
    { icon: '⏰', title: 'Available 24/7', description: 'Get expert advice for your pets anytime, day or night' },
    { icon: '🩺', title: 'Licensed Vets', description: 'Connect with board-certified veterinary professionals' },
    { icon: '💬', title: 'Live Video & Chat', description: 'Real-time consultations with screen-sharing support' },
    { icon: '📋', title: 'Digital Records', description: 'Complete medical history, prescriptions & lab results' },
    { icon: '💰', title: '40% More Affordable', description: 'Save compared to in-clinic visits with same quality' },
    { icon: '⚡', title: 'Under 5 Min Wait', description: 'Average response time to connect with a vet' }
  ]

  const enterpriseBenefits = [
    { icon: '🏢', title: 'Multi-Site Management', description: 'Manage farms, ranches, zoos & facilities from one dashboard' },
    { icon: '🐄', title: 'Herd & Flock Tracking', description: 'Groups, lineage, movements & production data at scale' },
    { icon: '💉', title: 'Treatment Campaigns', description: 'Batch vaccinations, deworming & health testing programs' },
    { icon: '📊', title: 'Analytics & Reporting', description: 'Real-time dashboards, mortality rates & productivity KPIs' },
    { icon: '🔔', title: 'Smart Alerts', description: 'Automated health alerts, breeding reminders & compliance' },
    { icon: '🌐', title: 'Multi-Enterprise', description: 'Dairy, poultry, equestrian, aquaculture, sanctuaries & more' }
  ]

  const vetBenefits = [
    { icon: '👥', title: 'Expand Practice', description: 'Serve individual pets and enterprise-scale operations' },
    { icon: '📊', title: 'Case Management', description: 'Organized patient queue with priority triage system' },
    { icon: '💵', title: 'Enterprise Contracts', description: 'Steady income from farm & facility retainer agreements' },
    { icon: '🛡️', title: 'Regulatory Compliant', description: 'Built-in compliance for veterinary standards & audits' },
    { icon: '📱', title: 'Mobile Ready', description: 'Field-ready mobile interface for on-site visits' },
    { icon: '🌍', title: 'Global Network', description: 'Connect with animal businesses worldwide' }
  ]

  const enterpriseTypes = [
    { icon: '🐄', label: 'Dairy Farms' },
    { icon: '🐔', label: 'Poultry' },
    { icon: '🐎', label: 'Equestrian' },
    { icon: '🐟', label: 'Aquaculture' },
    { icon: '🦁', label: 'Zoos & Wildlife' },
    { icon: '🐕', label: 'Kennels' },
    { icon: '🐈', label: 'Catteries' },
    { icon: '🏇', label: 'Breeding' },
    { icon: '🦜', label: 'Aviaries' },
    { icon: '🐑', label: 'Ranches' },
    { icon: '🏥', label: 'Vet Clinics' },
    { icon: '🌿', label: 'Sanctuaries' }
  ]

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Pet Owner',
      image: '👩',
      text: 'VetCare saved my cat\'s life! Quick diagnosis at 2 AM when every clinic was closed. The video consultation was seamless.',
      rating: 5
    },
    {
      name: 'Robert Hargrove',
      role: 'Dairy Farm Owner — 2,400 head',
      image: '👨‍🌾',
      text: 'Managing treatment campaigns across 3 farms used to take a week of paperwork. Now it\'s done in minutes with full traceability.',
      rating: 5
    },
    {
      name: 'Dr. James Wilson',
      role: 'Veterinarian',
      image: '👨‍⚕️',
      text: 'I serve 12 enterprise clients and dozens of pet owners through VetCare. The platform handles scheduling, records, and billing beautifully.',
      rating: 5
    },
    {
      name: 'Maria Chen',
      role: 'Zoo Operations Director',
      image: '👩‍💼',
      text: 'Location tracking, species grouping and campaign management for our 800+ animals across 40 enclosures — all in one place.',
      rating: 5
    }
  ]

  const stats = [
    { number: '50K+', label: 'Pet Owners' },
    { number: '3K+', label: 'Enterprises' },
    { number: '2K+', label: 'Verified Vets' },
    { number: '2M+', label: 'Animals Managed' },
    { number: '1M+', label: 'Consultations' },
    { number: '4.9★', label: 'Average Rating' }
  ]

  const advancedFeatures = [
    { icon: '📊', title: 'Health Analytics', description: 'AI-powered dashboards with mortality trends, growth curves, and predictive health scoring across your entire operation' },
    { icon: '🧬', title: 'Breeding & Genetics', description: 'Lineage trees, inbreeding coefficients, breeding cycle tracking, and genetic trait analysis for optimal pairing' },
    { icon: '⚖️', title: 'Feed & Inventory', description: 'Feed consumption tracking, cost-per-animal analytics, automated reorder alerts and supplier management' },
    { icon: '📡', title: 'IoT & Sensor Ready', description: 'Integration-ready for temperature sensors, GPS trackers, weight scales, and automated feeding systems' },
    { icon: '📜', title: 'Regulatory & Compliance', description: 'Export certificates, movement permits, vaccination records and audit trails for government inspections' },
    { icon: '💹', title: 'Financial Management', description: 'Revenue per animal, treatment cost analytics, insurance claims tracking, and enterprise billing' }
  ]

  const innovationFeatures = [
    { icon: '🧠', title: 'AI Disease Prediction', description: 'Predict disease outbreaks before they happen using risk scoring, geographic outbreak mapping, and automated preventive action plans' },
    { icon: '🧬', title: 'Genomic Lineage Tracker', description: 'Deep ancestry trees with recursive lineage tracing, inbreeding coefficient analysis, and AI-powered breeding pair recommendations' },
    { icon: '📡', title: 'IoT Sensor Dashboard', description: 'Real-time environmental monitoring with automated anomaly detection, low-battery alerts, and telemetry analytics across all facilities' },
    { icon: '🔗', title: 'Farm-to-Fork Traceability', description: 'Blockchain-style supply chain audit trail with SHA-256 verification, QR code generation, and complete batch traceability' },
    { icon: '👷', title: 'Workforce Ops Center', description: 'Task boards with priority scheduling, shift management with check-in/out, and worker performance analytics' },
    { icon: '📊', title: 'Report Builder', description: 'Generate 7 types of cross-module reports on demand — from animal census to sensor analytics — with export capabilities' }
  ]

  const intelligenceFeatures = [
    { icon: '🤖', title: 'AI Vet Copilot', description: 'Intelligent veterinary AI assistant with drug interaction checking, symptom analysis, and chat-based clinical decision support' },
    { icon: '🔮', title: 'Digital Twin & Simulator', description: 'Create digital replicas of your operations and run simulations for disease spread, resource optimization, and financial forecasting' },
    { icon: '🏪', title: 'Marketplace & Auctions', description: 'Buy, sell, and auction livestock, equipment, and supplies with real-time bidding, order management, and seller dashboards' },
    { icon: '🌱', title: 'Sustainability & Carbon', description: 'Track ESG metrics, set sustainability goals, and estimate carbon footprints using IPCC emission factors per species' },
    { icon: '💚', title: 'Wellness Portal', description: 'Comprehensive pet health scorecards with nutrition, activity, vaccination & dental tracking plus smart recurring reminders' },
    { icon: '🗺️', title: 'Geospatial Analytics', description: 'Geofencing zones, real-time location tracking, heatmap clustering, movement trails, and automatic zone breach detection' }
  ]

  return (
    <div className="home-page">
      {/* Scroll Progress Bar */}
      <div className="scroll-progress" style={{ width: `${scrollProgress}%` }} />

      {/* Top Navigation Bar */}
      <nav className={`home-nav${navScrolled ? ' home-nav--scrolled' : ''}`}>
        <div className="home-nav-inner">
          <div className="home-nav-brand" onClick={scrollToTop} style={{ cursor: 'pointer' }}>
            <span className="home-nav-logo">🏥</span>
            <span className="home-nav-title">VetCare</span>
            <span className="home-nav-badge">ENTERPRISE</span>
          </div>
          <div className="home-nav-center">
            {SECTIONS.filter(s => s.id !== 'hero').map(s => (
              <button
                key={s.id}
                className={`home-nav-link${activeSection === s.id ? ' home-nav-link--active' : ''}`}
                onClick={() => scrollToSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="home-nav-actions">
            <button className="home-nav-signin" onClick={onLogin || (() => {})}>
              Sign In
            </button>
            <button className="home-nav-cta" onClick={onGetStarted}>
              Get Started Free
            </button>
          </div>
          <button className="home-nav-mobile-toggle" onClick={onLogin || (() => {})}>
            <span className="nav-hamburger" />
          </button>
        </div>
      </nav>

      {/* Section Quick-Nav Dots */}
      <div className={`section-dots${showBackToTop ? ' section-dots--visible' : ''}`}>
        {SECTIONS.map(s => (
          <button
            key={s.id}
            className={`section-dot${activeSection === s.id ? ' section-dot--active' : ''}`}
            onClick={() => scrollToSection(s.id)}
            title={s.label}
          >
            <span className="section-dot-tooltip">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Back to Top */}
      <button
        className={`back-to-top${showBackToTop ? ' back-to-top--visible' : ''}`}
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
      >
        ↑
      </button>

      {/* Hero Section */}
      <section className="hero-section" id="hero">
        <div className="hero-content">
          <div className="hero-text">
            <div className="hero-tag">Trusted by 3,000+ animal enterprises worldwide</div>
            <h1 className="hero-title">
              The Complete Platform for<br />
              <span className="hero-gradient-text">Animal Health & Enterprise Management</span>
            </h1>
            <p className="hero-subtitle">
              From a single pet to herds of thousands — connect with licensed veterinarians, 
              manage treatment campaigns, track animal movements, and run your entire operation 
              from one intelligent platform.
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary btn-large" onClick={onGetStarted}>
                Start Free — Pet Owner
              </button>
              <button className="btn btn-enterprise btn-large" onClick={onGetStarted}>
                🏢 Enterprise Sign Up
              </button>
              <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
                Join as Veterinarian
              </button>
            </div>
            <p className="hero-subtext">
              ✓ Free for pet owners • ✓ 30-day enterprise trial • ✓ No credit card required
            </p>
            <p className="hero-login-link">
              Already have an account? <button className="link-button" onClick={onLogin || (() => {})}>Sign in here →</button>
            </p>
          </div>
          <div className="hero-visual">
            <div className="hero-card hero-card-1">
              <span className="hero-card-icon">🐄</span>
              <div className="hero-card-text">
                <strong>2,400 cattle</strong>
                <small>3 locations tracked</small>
              </div>
            </div>
            <div className="hero-card hero-card-2">
              <span className="hero-card-icon">💉</span>
              <div className="hero-card-text">
                <strong>Campaign: 94% done</strong>
                <small>FMD Vaccination drive</small>
              </div>
            </div>
            <div className="hero-card hero-card-3">
              <span className="hero-card-icon">📹</span>
              <div className="hero-card-text">
                <strong>Live Consult</strong>
                <small>Dr. Wilson — now</small>
              </div>
            </div>
            <div className="hero-icon-large">🏥</div>
            <div className="hero-badge">Enterprise Animal Care</div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          {stats.map((stat, idx) => (
            <div key={idx} className="stat-item">
              <div className="stat-number">{stat.number}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Enterprise Types */}
      <section className="enterprise-types-section" id="enterprises">
        <h2 className="section-title">Built for Every Animal Enterprise</h2>
        <p className="section-subtitle">One platform. Every species. Every scale.</p>
        <div className="enterprise-types-grid">
          {enterpriseTypes.map((etype, idx) => (
            <div key={idx} className="enterprise-type-card">
              <span className="enterprise-type-icon">{etype.icon}</span>
              <span className="enterprise-type-label">{etype.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features Tabs Section */}
      <section className="features-section" id="features">
        <h2 className="section-title">Why Choose VetCare?</h2>
        
        <div className="tabs-container">
          <button className={`tab-button ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>
            🐕 Pet Owners
          </button>
          <button className={`tab-button ${activeTab === 'enterprise' ? 'active' : ''}`} onClick={() => setActiveTab('enterprise')}>
            🏢 Enterprises
          </button>
          <button className={`tab-button ${activeTab === 'vet' ? 'active' : ''}`} onClick={() => setActiveTab('vet')}>
            👨‍⚕️ Veterinarians
          </button>
        </div>

        <div className="benefits-grid">
          {(activeTab === 'owner' ? ownerBenefits : activeTab === 'enterprise' ? enterpriseBenefits : vetBenefits).map((benefit, idx) => (
            <div key={idx} className="benefit-card">
              <div className="benefit-icon">{benefit.icon}</div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Advanced Enterprise Capabilities */}
      <section className="advanced-features-section">
        <h2 className="section-title">Advanced Enterprise Capabilities</h2>
        <p className="section-subtitle">Built for operations that demand more</p>
        <div className="advanced-grid">
          {advancedFeatures.map((feat, idx) => (
            <div key={idx} className="advanced-card">
              <div className="advanced-icon">{feat.icon}</div>
              <h3>{feat.title}</h3>
              <p>{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Next-Generation Innovation */}
      <section className="advanced-features-section" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <h2 className="section-title" style={{ color: '#f8fafc' }}>🚀 Next-Generation Innovation</h2>
        <p className="section-subtitle" style={{ color: '#94a3b8' }}>Cutting-edge AI, IoT, and blockchain-style features that redefine animal management</p>
        <div className="advanced-grid">
          {innovationFeatures.map((feat, idx) => (
            <div key={idx} className="advanced-card" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0' }}>
              <div className="advanced-icon">{feat.icon}</div>
              <h3 style={{ color: '#f8fafc' }}>{feat.title}</h3>
              <p style={{ color: '#94a3b8' }}>{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Futuristic Intelligence */}
      <section className="advanced-features-section" style={{ background: 'linear-gradient(135deg, #4a1d96 0%, #7c3aed 50%, #2563eb 100%)' }}>
        <h2 className="section-title" style={{ color: '#f8fafc' }}>🔮 Futuristic Intelligence</h2>
        <p className="section-subtitle" style={{ color: '#c4b5fd' }}>AI copilots, digital twins, marketplace ecosystems, and geospatial intelligence</p>
        <div className="advanced-grid">
          {intelligenceFeatures.map((feat, idx) => (
            <div key={idx} className="advanced-card" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#e2e8f0' }}>
              <div className="advanced-icon">{feat.icon}</div>
              <h3 style={{ color: '#f8fafc' }}>{feat.title}</h3>
              <p style={{ color: '#c4b5fd' }}>{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <h2 className="section-title">How It Works</h2>
        
        <div className="tabs-container" style={{ marginBottom: '2rem' }}>
          <button className={`tab-button ${activeTab === 'owner' ? 'active' : ''}`} onClick={() => setActiveTab('owner')}>
            🐕 Pet Owners
          </button>
          <button className={`tab-button ${activeTab === 'enterprise' ? 'active' : ''}`} onClick={() => setActiveTab('enterprise')}>
            🏢 Enterprises
          </button>
          <button className={`tab-button ${activeTab === 'vet' ? 'active' : ''}`} onClick={() => setActiveTab('vet')}>
            👨‍⚕️ Veterinarians
          </button>
        </div>

        {activeTab === 'owner' ? (
          <div className="steps-container">
            <div className="step-card"><div className="step-number">1</div><h3>Sign Up Free</h3><p>Create your account in seconds</p><div className="step-icon">📝</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">2</div><h3>Add Your Pet</h3><p>Register species, breed & history</p><div className="step-icon">🐾</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">3</div><h3>Book a Vet</h3><p>Chat, video or schedule a visit</p><div className="step-icon">📹</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">4</div><h3>Get Treatment</h3><p>Prescriptions & records saved</p><div className="step-icon">💊</div></div>
          </div>
        ) : activeTab === 'enterprise' ? (
          <div className="steps-container">
            <div className="step-card"><div className="step-number">1</div><h3>Register Enterprise</h3><p>Farm, ranch, zoo, clinic or more</p><div className="step-icon">🏢</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">2</div><h3>Set Up Operations</h3><p>Locations, groups & team members</p><div className="step-icon">📍</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">3</div><h3>Onboard Animals</h3><p>Import herds, assign to locations</p><div className="step-icon">🐄</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">4</div><h3>Run & Scale</h3><p>Campaigns, analytics & vet care</p><div className="step-icon">📊</div></div>
          </div>
        ) : (
          <div className="steps-container">
            <div className="step-card"><div className="step-number">1</div><h3>Register & Verify</h3><p>Submit your veterinary credentials</p><div className="step-icon">📋</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">2</div><h3>Set Availability</h3><p>Choose your consultation hours</p><div className="step-icon">🕐</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">3</div><h3>Serve Clients</h3><p>Pet owners & enterprise operations</p><div className="step-icon">🩺</div></div>
            <div className="step-arrow">→</div>
            <div className="step-card"><div className="step-number">4</div><h3>Grow Practice</h3><p>Reviews, analytics & retainer deals</p><div className="step-icon">💹</div></div>
          </div>
        )}
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section" id="testimonials">
        <h2 className="section-title">Trusted by Professionals</h2>
        <div className="testimonials-grid">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar">{testimonial.image}</div>
                <div className="testimonial-info">
                  <h4 className="testimonial-name">{testimonial.name}</h4>
                  <p className="testimonial-role">{testimonial.role}</p>
                </div>
              </div>
              <div className="testimonial-rating">{'⭐'.repeat(testimonial.rating)}</div>
              <p className="testimonial-text">"{testimonial.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Transform Your Animal Care?</h2>
          <p>Join thousands of pet owners, enterprises, and veterinarians on VetCare</p>
          <div className="cta-buttons">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              Start Free — Pet Owner
            </button>
            <button className="btn btn-enterprise btn-large" onClick={onGetStarted}>
              🏢 Enterprise Trial
            </button>
            <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
              Join as Veterinarian
            </button>
          </div>
          <p className="cta-login">
            Already a member? <button className="link-button" onClick={onLogin || (() => {})}>Sign in →</button>
          </p>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="home-footer" id="footer">
        <div className="footer-content">
          <div className="footer-brand">
            <span>🏥</span> <strong>VetCare Enterprise</strong>
          </div>
          <p>© 2026 VetCare. All rights reserved.</p>
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <span className="divider">•</span>
            <a href="#terms">Terms of Service</a>
            <span className="divider">•</span>
            <a href="#contact">Contact Us</a>
            <span className="divider">•</span>
            <button className="link-button" onClick={onLogin || (() => {})}>Sign In</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
