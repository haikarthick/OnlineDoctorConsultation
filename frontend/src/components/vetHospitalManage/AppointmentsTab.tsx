import React from 'react'
import type { TFunction } from 'i18next'

interface Props {
  t: TFunction
  bookings: any[]
  bookingsLoading: boolean
  bookingsTotal: number
  bookingsPage: number
  bookingsStatusFilter: string
  formatSlotTime: (time: string) => string
  onStatusFilterChange: (status: string) => void
  onRefresh: () => void
  onPrevPage: () => void
  onNextPage: () => void
}

const AppointmentsTab: React.FC<Props> = ({ t, bookings, bookingsLoading, bookingsTotal, bookingsPage, bookingsStatusFilter, formatSlotTime, onStatusFilterChange, onRefresh, onPrevPage, onNextPage }) => (
  <div>
    <div className="si-f456fb79">
      <h3 className="si-44087c4b">{t('vetHospitalManage.appointments.title')}</h3>
      <div className="si-0d113669">
        <select className="vh-select" value={bookingsStatusFilter} onChange={e => onStatusFilterChange(e.target.value)}>
          <option value="">{t('vetHospitalManage.appointments.allStatuses')}</option>
          <option value="pending">{t('common.pending')}</option>
          <option value="confirmed">{t('common.confirmed')}</option>
          <option value="completed">{t('common.completed')}</option>
          <option value="cancelled">{t('common.cancelled')}</option>
        </select>
        <button className="btn-secondary" onClick={onRefresh}>↻ Refresh</button>
      </div>
    </div>
    {bookingsLoading ? (
      <p className="si-38b53f15">{t('vetHospitalManage.appointments.loading')}</p>
    ) : bookings.length === 0 ? (
      <div className="empty-state si-41acd90c">
        <div className="si-28db9f67">📅</div>
        <p>{t('vetHospitalManage.appointments.noAppointments')}{bookingsStatusFilter ? ` ${t('vetHospitalManage.appointments.withStatus', { status: bookingsStatusFilter })}` : ''}</p>
      </div>
    ) : (
      <>
        <table className="vh-admin-table">
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              <th>{t('vetHospitalManage.appointments.time')}</th>
              <th>{t('vetHospitalManage.appointments.patient')}</th>
              <th>{t('vetHospitalManage.appointments.doctor')}</th>
              <th>{t('common.type')}</th>
              <th>{t('common.status')}</th>
              <th>{t('vetHospitalManage.appointments.reason')}</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b: any) => (
              <tr key={b.id}>
                <td>{b.scheduledDate ? new Date(b.scheduledDate).toLocaleDateString() : '-'}</td>
                <td>{b.timeSlotStart ? formatSlotTime(b.timeSlotStart) : '-'}{b.timeSlotEnd ? ` - ${formatSlotTime(b.timeSlotEnd)}` : ''}</td>
                <td>{b.patientName || b.ownerName || '-'}</td>
                <td>{b.vetName || b.veterinarianName || '-'}</td>
                <td><span className="chip">{(b.bookingType || 'in_person').replace(/_/g, ' ')}</span></td>
                <td>
                  <span className={`vh-booking-status-badge status-${b.status}`}>{b.status}</span>
                </td>
                <td className="si-073b955b">{b.reasonForVisit || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bookingsTotal > 15 && (
          <div className="pagination si-216c99b7">
            <button disabled={bookingsPage === 0} onClick={onPrevPage}>← Prev</button>
            <span className="si-24635ff2">
              Page {bookingsPage + 1} of {Math.ceil(bookingsTotal / 15)}
            </span>
            <button disabled={(bookingsPage + 1) * 15 >= bookingsTotal} onClick={onNextPage}>Next →</button>
          </div>
        )}
      </>
    )}
  </div>
)

export default AppointmentsTab
