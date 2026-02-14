import React from 'react'
import './ModulePage.css'

const Consultations: React.FC = () => {
  const consultations = [
    { id: 1, doctor: 'Dr. Smith', date: '2026-01-20', time: '2:00 PM', status: 'scheduled', reason: 'Pet Checkup' },
    { id: 2, doctor: 'Dr. Johnson', date: '2026-01-22', time: '3:30 PM', status: 'pending', reason: 'Vaccination' },
    { id: 3, doctor: 'Dr. Williams', date: '2026-01-18', time: '10:00 AM', status: 'completed', reason: 'Annual Exam' }
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>🏥 Consultations</h1>
        <button className="btn-primary">Book Consultation</button>
      </div>

      <div className="module-content">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Doctor</th>
                <th>Date & Time</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {consultations.map((consultation) => (
                <tr key={consultation.id}>
                  <td><strong>{consultation.doctor}</strong></td>
                  <td>{consultation.date} at {consultation.time}</td>
                  <td>{consultation.reason}</td>
                  <td>
                    <span className={`badge badge-${consultation.status}`}>
                      {consultation.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn-small">Details</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Consultations
