import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  show: boolean
  selectedCurrency: string
  onCurrencyChange: (code: string) => void
  savingCurrency: boolean
  currencySaved: boolean
}

const CurrencyCard: React.FC<Props> = ({ show, selectedCurrency, onCurrencyChange, savingCurrency, currencySaved }) => {
  const { t } = useTranslation()
  if (!show) return null
  return (
    <div id="settings-section-currency" className="card si-478be2e9">
      <div className="card-header"><h2 className="si-63c2680d">💱 {t('systemSettings.platformCurrency')}</h2></div>
      <div className="card-body">
        <div className="si-ccc9b2e4">
          <div className="si-0c982175">
            <h3 className="si-3301c332">{t('systemSettings.defaultCurrency')}</h3>
            <p className="si-faa1c026">
              {t('systemSettings.defaultCurrencyDesc')}
            </p>
          </div>
          <div className="si-ef8e09e5">
            <select
              className="form-input ss-field ss-select-wide"
              value={selectedCurrency}
              onChange={e => onCurrencyChange(e.target.value)}
              disabled={savingCurrency}
            >
              <option value="INR">🇮🇳 INR - Indian Rupee (₹)</option>
              <option value="USD">🇺🇸 USD - US Dollar ($)</option>
              <option value="EUR">🇪🇺 EUR - Euro (€)</option>
              <option value="GBP">🇬🇧 GBP - British Pound (£)</option>
              <option value="AUD">🇦🇺 AUD - Australian Dollar (A$)</option>
              <option value="CAD">🇨🇦 CAD - Canadian Dollar (C$)</option>
              <option value="JPY">🇯🇵 JPY - Japanese Yen (¥)</option>
              <option value="CNY">🇨🇳 CNY - Chinese Yuan (¥)</option>
              <option value="KES">🇰🇪 KES - Kenyan Shilling (KSh)</option>
              <option value="ZAR">🇿🇦 ZAR - South African Rand (R)</option>
              <option value="BRL">🇧🇷 BRL - Brazilian Real (R$)</option>
              <option value="SGD">🇸🇬 SGD - Singapore Dollar (S$)</option>
              <option value="AED">🇦🇪 AED - UAE Dirham (د.إ)</option>
              <option value="SAR">🇸🇦 SAR - Saudi Riyal (﷼)</option>
              <option value="MYR">🇲🇾 MYR - Malaysian Ringgit (RM)</option>
              <option value="THB">🇹🇭 THB - Thai Baht (฿)</option>
              <option value="PHP">🇵🇭 PHP - Philippine Peso (₱)</option>
              <option value="IDR">🇮🇩 IDR - Indonesian Rupiah (Rp)</option>
              <option value="NZD">🇳🇿 NZD - New Zealand Dollar (NZ$)</option>
              <option value="CHF">🇨🇭 CHF - Swiss Franc (CHF)</option>
            </select>
            {savingCurrency && <span className="si-48a0b045">{t('systemSettings.saving')}</span>}
            {currencySaved && <span className="si-ab4fa2e9">✅ Saved!</span>}
          </div>
        </div>
        <p className="si-e73c55d1">
          <strong>Current:</strong> All prices across the platform display in <strong>{selectedCurrency}</strong>.
          Changing this will update currency symbols on all pages for all users.
        </p>
      </div>
    </div>
  )
}

export default CurrencyCard
