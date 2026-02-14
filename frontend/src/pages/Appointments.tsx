import React from 'react'
import './ModulePage.css'

const Appointments: React.FC = () => {
  const appointments = [
    { id: 1, doctor: 'Dr. Smith', date: '2026-01-25', time: '10:00 AM', type: 'Regular Checkup', confirmed: true },
    { id: 2, doctor: 'Dr. Johnson', date: '2026-01-27', time: '2:00 PM', type: 'Vaccination', confirmed: false },
    { id: 3, doctor: 'Dr. Williams', date: '2026-02-01', time: '11:30 AM', type: 'Follow-up', confirmed: true }
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📅 Appointments</h1>
        <button className="btn-primary">Schedule New</button>
      </div>

      <div className="module-content">
        <div className="appointment-grid">
          {appointments.map((appointment) => (
            <div key={appointment.id} className="appointment-card">
              <div className="appointment-icon">📅</div>
              <div className="appointment-info">
                <h3>{appointment.doctor}</h3>
                <p className="date">{appointment.date}</p>
                <p className="time">⏰ {appointment.time}</p>
                <p className="type">{appointment.type}</p>
                <div className="appointment-footer">
                  <span className={`status ${appointment.confirmed ? 'confirmed' : 'pending'}`}>
                    {appointment.confirmed ? '✓ Confirmed' : '⏳ Pending'}
                  </span>
                  <button className="btn-small">Reschedule</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Appointments
