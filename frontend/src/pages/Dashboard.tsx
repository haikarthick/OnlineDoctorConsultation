import React from 'react'
import { useAuth } from '../context/AuthContext'
import './Dashboard.css'

const Dashboard: React.FC = () => {
  const { user } = useAuth()

  const stats = [
    { label: 'Consultations', value: '12', icon: '🏥', color: '#667eea' },
    { label: 'Appointments', value: '5', icon: '📅', color: '#764ba2' },
    { label: 'Medical Records', value: '8', icon: '📋', color: '#f093fb' },
    { label: 'Messages', value: '3', icon: '💬', color: '#4facfe' }
  ]

  const recentActivity = [
    { type: 'Consultation', description: 'With Dr. Smith for Buddy', time: '2 hours ago', status: 'completed' },
    { type: 'Appointment', description: 'Scheduled for tomorrow at 2 PM', time: '1 day ago', status: 'scheduled' },
    { type: 'Medical Record', description: 'Updated vaccination records', time: '3 days ago', status: 'updated' }
  ]

  const isVeterinarian = user?.role === 'veterinarian'
  const isPetOwner = user?.role === 'pet_owner'
  const isFarmer = user?.role === 'farmer'

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title-section">
          <h1 className="dashboard-title">Welcome, {user?.firstName}!</h1>
          <p className="dashboard-subtitle">
            {isVeterinarian && 'Manage your consultations and patients'}
            {isPetOwner && 'Manage your pets and consultations'}
            {isFarmer && 'Manage your farm animals and consultations'}
          </p>
        </div>
        <div className="dashboard-date">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-stats-grid">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ background: `${stat.color}20` }}>
              <span>{stat.icon}</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-label">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-main-grid">
        {/* Quick Actions */}
        <section className="dashboard-section quick-actions">
          <div className="section-header">
            <h2 className="section-title">Quick Actions</h2>
          </div>
          <div className="quick-actions-grid">
            {isVeterinarian && (
              <>
                <button className="action-btn">
                  <span className="action-icon">➕</span>
                  <span className="action-label">New Consultation</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">👥</span>
                  <span className="action-label">View Patients</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">📊</span>
                  <span className="action-label">Generate Report</span>
                </button>
              </>
            )}
            {isPetOwner && (
              <>
                <button className="action-btn">
                  <span className="action-icon">📞</span>
                  <span className="action-label">Book Consultation</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">📋</span>
                  <span className="action-label">View Records</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">🐾</span>
                  <span className="action-label">Add Pet</span>
                </button>
              </>
            )}
            {isFarmer && (
              <>
                <button className="action-btn">
                  <span className="action-icon">🚜</span>
                  <span className="action-label">Herd Management</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">💉</span>
                  <span className="action-label">Vaccination Schedule</span>
                </button>
                <button className="action-btn">
                  <span className="action-icon">📞</span>
                  <span className="action-label">Consult Vet</span>
                </button>
              </>
            )}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="dashboard-section recent-activity">
          <div className="section-header">
            <h2 className="section-title">Recent Activity</h2>
            <a href="#" className="view-all-link">View All</a>
          </div>
          <div className="activity-list">
            {recentActivity.map((activity, index) => (
              <div key={index} className="activity-item">
                <div className="activity-icon">
                  {activity.type === 'Consultation' && '🏥'}
                  {activity.type === 'Appointment' && '📅'}
                  {activity.type === 'Medical Record' && '📋'}
                </div>
                <div className="activity-content">
                  <div className="activity-title">{activity.type}</div>
                  <div className="activity-description">{activity.description}</div>
                </div>
                <div className="activity-meta">
                  <span className={`activity-status status-${activity.status}`}>
                    {activity.status}
                  </span>
                  <span className="activity-time">{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Featured Section */}
      <section className="dashboard-section featured-section">
        <div className="section-header">
          <h2 className="section-title">Pro Tips & Resources</h2>
        </div>
        <div className="featured-grid">
          <div className="featured-card">
            <div className="featured-icon">💡</div>
            <h3>Appointment Best Practices</h3>
            <p>Schedule consultations in advance for better availability</p>
            <a href="#" className="featured-link">Learn More →</a>
          </div>
          <div className="featured-card">
            <div className="featured-icon">📚</div>
            <h3>Health Resources</h3>
            <p>Access our comprehensive health articles and guides</p>
            <a href="#" className="featured-link">Explore →</a>
          </div>
          <div className="featured-card">
            <div className="featured-icon">🎯</div>
            <h3>Community Forum</h3>
            <p>Connect with other users and share experiences</p>
            <a href="#" className="featured-link">Join →</a>
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard
