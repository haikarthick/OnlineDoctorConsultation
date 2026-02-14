import { useState } from 'react'
import './Home.css'

interface HomeProps {
  onGetStarted: () => void
  onViewForDoctors: () => void
}

export default function Home({ onGetStarted, onViewForDoctors }: HomeProps) {
  const [activeTab, setActiveTab] = useState<'pet-owner' | 'vet'>('pet-owner')

  const petOwnerBenefits = [
    { icon: '⏰', title: 'Available 24/7', description: 'Get expert advice anytime, anywhere' },
    { icon: '🩺', title: 'Licensed Vets', description: 'Connect with certified veterinarians' },
    { icon: '💬', title: 'Direct Chat', description: 'Real-time communication with doctors' },
    { icon: '📋', title: 'Digital Records', description: 'Keep all medical history in one place' },
    { icon: '💰', title: 'Affordable', description: '40% cheaper than in-clinic visits' },
    { icon: '⚡', title: 'Fast Response', description: 'Average response time under 5 minutes' }
  ]

  const vetBenefits = [
    { icon: '👥', title: 'Expand Practice', description: 'Reach more patients beyond your location' },
    { icon: '📊', title: 'Manage Cases', description: 'Organized patient management dashboard' },
    { icon: '💵', title: 'Increase Income', description: 'Earn more with flexible consultations' },
    { icon: '🛡️', title: 'Secure Platform', description: 'HIPAA-compliant data protection' },
    { icon: '📱', title: 'Easy Setup', description: 'Get verified and start earning in days' },
    { icon: '🌍', title: 'Global Reach', description: 'Connect with pet owners worldwide' }
  ]

  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Pet Owner',
      image: '👩',
      text: 'VetCare saved my cat\'s life! Quick diagnosis and treatment advice at 2 AM when clinics were closed.',
      rating: 5
    },
    {
      name: 'Dr. James Wilson',
      role: 'Veterinarian',
      image: '👨‍⚕️',
      text: 'Excellent platform! I\'ve helped over 500 pets and the income supplement has been amazing for my practice.',
      rating: 5
    },
    {
      name: 'Emma Rodriguez',
      role: 'Pet Owner',
      image: '👩‍🦱',
      text: 'Professional, quick, and affordable. The doctors really care about my pets as much as I do.',
      rating: 5
    }
  ]

  const stats = [
    { number: '50K+', label: 'Happy Pet Owners' },
    { number: '2K+', label: 'Verified Vets' },
    { number: '1M+', label: 'Consultations Completed' },
    { number: '4.9★', label: 'Average Rating' }
  ]

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Your Pet's Health, 24/7 Expert Care</h1>
            <p className="hero-subtitle">
              Connect with licensed veterinarians instantly. Get professional advice for your beloved pets anytime, anywhere.
            </p>
            <div className="hero-buttons">
              <button className="btn btn-primary btn-large" onClick={onGetStarted}>
                Get Started as Pet Owner
              </button>
              <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
                Join as Veterinarian
              </button>
            </div>
            <p className="hero-subtext">✓ Free sign-up • ✓ No credit card required • ✓ Get verified in 24 hours</p>
          </div>
          <div className="hero-visual">
            <div className="hero-icon-large">🐾</div>
            <div className="hero-badge">Online Vet Care</div>
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

      {/* Features Tabs Section */}
      <section className="features-section">
        <h2 className="section-title">Why Choose VetCare?</h2>
        
        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === 'pet-owner' ? 'active' : ''}`}
            onClick={() => setActiveTab('pet-owner')}
          >
            🐕 For Pet Owners
          </button>
          <button
            className={`tab-button ${activeTab === 'vet' ? 'active' : ''}`}
            onClick={() => setActiveTab('vet')}
          >
            👨‍⚕️ For Veterinarians
          </button>
        </div>

        <div className="benefits-grid">
          {(activeTab === 'pet-owner' ? petOwnerBenefits : vetBenefits).map((benefit, idx) => (
            <div key={idx} className="benefit-card">
              <div className="benefit-icon">{benefit.icon}</div>
              <h3 className="benefit-title">{benefit.title}</h3>
              <p className="benefit-description">{benefit.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h2 className="section-title">How It Works</h2>
        
        {activeTab === 'pet-owner' ? (
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Sign Up</h3>
              <p>Create your account in seconds</p>
              <div className="step-icon">📝</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Describe Issue</h3>
              <p>Tell us about your pet's symptoms</p>
              <div className="step-icon">🩺</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Connect with Vet</h3>
              <p>Chat with a qualified veterinarian</p>
              <div className="step-icon">💬</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Get Advice</h3>
              <p>Receive professional guidance</p>
              <div className="step-icon">✨</div>
            </div>
          </div>
        ) : (
          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Register</h3>
              <p>Sign up with your credentials</p>
              <div className="step-icon">📋</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Verify License</h3>
              <p>Submit your veterinary credentials</p>
              <div className="step-icon">✓</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Set Schedule</h3>
              <p>Choose your consultation hours</p>
              <div className="step-icon">🕐</div>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">4</div>
              <h3>Start Earning</h3>
              <p>Earn money with each consultation</p>
              <div className="step-icon">💰</div>
            </div>
          </div>
        )}
      </section>

      {/* Testimonials Section */}
      <section className="testimonials-section">
        <h2 className="section-title">What People Say</h2>
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
              <div className="testimonial-rating">
                {'⭐'.repeat(testimonial.rating)}
              </div>
              <p className="testimonial-text">"{testimonial.text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of pet owners and veterinarians using VetCare</p>
          <div className="cta-buttons">
            <button className="btn btn-primary btn-large" onClick={onGetStarted}>
              Start as Pet Owner
            </button>
            <button className="btn btn-secondary-outline btn-large" onClick={onViewForDoctors}>
              Start as Veterinarian
            </button>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="home-footer">
        <div className="footer-content">
          <p>© 2026 VetCare. All rights reserved.</p>
          <div className="footer-links">
            <a href="#privacy">Privacy Policy</a>
            <span className="divider">•</span>
            <a href="#terms">Terms of Service</a>
            <span className="divider">•</span>
            <a href="#contact">Contact Us</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
