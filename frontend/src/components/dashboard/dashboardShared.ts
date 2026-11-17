export interface DashStats { bookings: number; consultations: number; animals: number; pending: number; enterprises?: number }
export interface ActivityItem { type: string; description: string; time: string; status: string }
export interface QuickAction { icon: string; label: string; path: string; color: string; description?: string }
export interface EnterpriseOverviewStats { totalAnimals: number; activeGroups: number; pendingMovements: number; activeCampaigns: number }
export interface StatCard { label: string; value: number; icon: string; color: string; path: string }
export interface FeatureCardDef { icon: string; iconClass: string; titleKey: string; descKey: string; path: string }
