import { useState, useEffect } from 'react'
import apiService from '../services/api'

export interface PricingPlan {
  id: string
  name: string
  description?: string
  maxSeats?: number
  maxHospitals?: number
  priceMonthly?: number
  priceAnnually?: number
  currency: string
  features: Record<string, boolean>
  sortOrder: number
}

export interface PricingVisibility {
  global: boolean
  landing_page: boolean
  registration: boolean
  corp_dashboard: boolean
  upgrade_prompts: boolean
}

export interface PricingData {
  isVisible: boolean
  plans: PricingPlan[]
  ctaText: string
  ctaEmail: string
  ctaPhone: string
  visibility: PricingVisibility
  loading: boolean
  error: string | null
}

export function usePricing(): PricingData {
  const [data, setData] = useState<PricingData>({
    isVisible: false,
    plans: [],
    ctaText: 'Contact us for pricing',
    ctaEmail: '',
    ctaPhone: '',
    visibility: { global: false, landing_page: false, registration: false, corp_dashboard: false, upgrade_prompts: false },
    loading: true,
    error: null,
  })

  useEffect(() => {
    apiService.getPricingPlans()
      .then(res => {
        if (res.success && res.data) {
          setData({ ...res.data, loading: false, error: null })
        } else {
          setData(d => ({ ...d, loading: false }))
        }
      })
      .catch(err => {
        setData(d => ({ ...d, loading: false, error: err.message }))
      })
  }, [])

  return data
}
