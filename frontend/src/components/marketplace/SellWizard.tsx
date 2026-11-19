import React from 'react'
import type { TFunction } from 'i18next'
import { SellStepPhotos } from './SellStepPhotos'
import { SellStep0BasicInfo } from './SellStep0BasicInfo'
import { SellStep1AnimalDetails } from './SellStep1AnimalDetails'
import { SellStep2HealthCerts } from './SellStep2HealthCerts'
import { SellStep3Pricing } from './SellStep3Pricing'
import { SellStep4Review } from './SellStep4Review'

export const SellWizard: React.FC<{
  sellSteps: string[]; sellStep: number; onStepClick: (i: number) => void; onStartOver: () => void;
  photosProps: React.ComponentProps<typeof SellStepPhotos>;
  step0Props: React.ComponentProps<typeof SellStep0BasicInfo>;
  step1Props: React.ComponentProps<typeof SellStep1AnimalDetails>;
  step2Props: React.ComponentProps<typeof SellStep2HealthCerts>;
  step3Props: React.ComponentProps<typeof SellStep3Pricing>;
  step4Props: React.ComponentProps<typeof SellStep4Review>;
  t: TFunction;
}> = ({ sellSteps, sellStep, onStepClick, onStartOver, photosProps, step0Props, step1Props, step2Props, step3Props, step4Props, t }) => (
  <div className="mp-sell-container">
    {/* Step Indicator */}
    <div className="mp-steps">
      {sellSteps.map((label, i) => (
        <div key={i} className={`mp-step ${i === sellStep ? 'active' : i < sellStep ? 'done' : ''}`} onClick={() => i < sellStep && onStepClick(i)}>
          <div className="mp-step-num">{i < sellStep ? '✓' : i + 1}</div>
          <div className="mp-step-label">{label}</div>
        </div>
      ))}
    </div>

    <div className="mp-sell-card">
      <div className="mp-sell-topbar"><button type="button" className="module-btn small" onClick={onStartOver}>{t('marketplace.sell.startOver')}</button></div>
      {sellStep === 0 && <SellStepPhotos {...photosProps} />}
      {sellStep === 1 && <SellStep0BasicInfo {...step0Props} />}
      {sellStep === 2 && <SellStep1AnimalDetails {...step1Props} />}
      {sellStep === 3 && <SellStep2HealthCerts {...step2Props} />}
      {sellStep === 4 && <SellStep3Pricing {...step3Props} />}
      {sellStep === 5 && <SellStep4Review {...step4Props} />}
    </div>
  </div>
)
