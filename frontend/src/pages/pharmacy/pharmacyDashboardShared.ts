export interface Pharmacy {
  id: string
  pharmacy_name: string
  network_id: string
  hospital_id: string
  is_primary_pharmacy: boolean
  phone?: string
  email?: string
  address?: string
}

export interface DashboardSummary {
  pending_reviews: number
  ready_to_dispense: number
  low_stock_count: number
  expiring_soon_count: number
  pending_reorders: number
  todays_dispensed: number
  todays_revenue: number
}

export interface PendingPrescription {
  id: string
  pet_name: string
  owner_name: string
  vet_name: string
  medication_names: string
  medications?: any
  animal_species?: string
  created_at: string
  review_status: string
}

export interface ReadyDispensing {
  id: string
  pet_name: string
  owner_name: string
  vet_name?: string
  medication_names: string
  medications?: any
  animal_species?: string
  target_pharmacy_id: string
  review_status: string
}

export interface Analytics {
  total_revenue: number
  dispensing_count: number
  pending_reviews: number
  top_medications: { med_name: string; total_dispensed: number; total_revenue: number }[]
  low_stock_count: number
  expiring_count: number
}

/** One row of /networks/:networkId/pharmacy-reports */
export interface NetworkPharmacyRow {
  pharmacy_id: string
  pharmacy_name: string
  revenue: number
  dispensing_count: number
}
