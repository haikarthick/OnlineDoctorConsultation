import React from 'react'
import './ModulePage.css'

const MedicalRecords: React.FC = () => {
  const records = [
    { id: 1, pet: 'Buddy', date: '2026-01-15', type: 'Vaccination Record', doctor: 'Dr. Smith', status: 'Completed' },
    { id: 2, pet: 'Whiskers', date: '2026-01-10', type: 'Blood Test', doctor: 'Dr. Johnson', status: 'Completed' },
    { id: 3, pet: 'Buddy', date: '2026-01-01', type: 'Annual Checkup', doctor: 'Dr. Williams', status: 'Completed' }
  ]

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>📋 Medical Records</h1>
        <button className="btn-primary">Request Medical Record</button>
      </div>

      <div className="module-content">
        <div className="records-list">
          {records.map((record) => (
            <div key={record.id} className="record-item">
              <div className="record-icon">📄</div>
              <div className="record-details">
                <h4>{record.pet}</h4>
                <p><strong>{record.type}</strong></p>
                <p className="text-muted">By {record.doctor} • {record.date}</p>
              </div>
              <div className="record-actions">
                <span className="badge badge-completed">{record.status}</span>
                <button className="btn-small">View</button>
                <button className="btn-small">Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default MedicalRecords
