import React from 'react'

interface BookingProgressStepsProps {
  step: number
  labels: string[]
}

const BookingProgressSteps: React.FC<BookingProgressStepsProps> = ({ step, labels }) => (
  <div className="si-8b072f33">
    {labels.map((label, i) => (
      <div key={label} className="si-267eb255">
        <div className="si-4977896d">
          <div className={`bc-step-circle${step > i + 1 ? ' is-done' : step === i + 1 ? ' is-current' : ''}`}>
            {step > i + 1 ? '✓' : i + 1}
          </div>
          <span className={`bc-step-label${step === i + 1 ? ' is-current' : ''}`}>
            {label}
          </span>
        </div>
        {i < labels.length - 1 && (
          <div className={`bc-step-connector${step > i + 1 ? ' is-done' : ''}`} />
        )}
      </div>
    ))}
  </div>
)

export default BookingProgressSteps
