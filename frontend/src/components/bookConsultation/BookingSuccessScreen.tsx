import React from 'react'
import { useTranslation } from 'react-i18next'

interface BookingSuccessScreenProps {
  onNavigate: (path: string) => void
}

const BookingSuccessScreen: React.FC<BookingSuccessScreenProps> = ({ onNavigate }) => {
  const { t } = useTranslation()
  return (
    <div className="module-page">
      <div className="si-bd60beb2">
        <div className="si-7615cf7c">✅</div>
        <h1 className="si-dab75309">{t('bookConsultation.successTitle')}</h1>
        <p className="si-6bc9c38d">
          {t('bookConsultation.successMessage')}
        </p>
        <div className="si-7b7a3b80">
          <button className="btn btn-primary" onClick={() => onNavigate('/my-bookings')}>
            {t('bookConsultation.viewMyBookings')}
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('/dashboard')}>
            {t('bookConsultation.goToDashboard')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default BookingSuccessScreen
