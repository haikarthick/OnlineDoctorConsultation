export const NAV_KEY_MAP: Record<string, string> = {
  hero: 'home', enterprises: 'enterprises', hospitals: 'hospitals', features: 'features',
  workflow: 'workflow', compliance: 'compliance', 'how-it-works': 'howItWorks', testimonials: 'testimonials',
  grooming: 'grooming'
}

export const benefitIcons = {
  owner: ['⏰', '🩺', '💬', '📋', '💰', '⚡'],
  enterprise: ['🏢', '🐄', '💉', '📊', '🔔', '🌐'],
  vet: ['👥', '📊', '💵', '🛡️', '📱', '🌍'],
  hospital: ['🏥', '👨‍⚕️', '🗂️', '📅', '🚨', '⭐'],
}

export const benefitKeyMap: Record<string, string> = {
  owner: 'ownerBenefits', enterprise: 'enterpriseBenefits', vet: 'vetBenefits', hospital: 'hospitalBenefits'
}

export const enterpriseTypes = [
  { icon: '🐄', key: 'dairyFarms' }, { icon: '🐔', key: 'poultry' }, { icon: '🐎', key: 'equestrian' },
  { icon: '🐟', key: 'aquaculture' }, { icon: '🦁', key: 'zoosWildlife' }, { icon: '🐕', key: 'kennels' },
  { icon: '🐈', key: 'catteries' }, { icon: '🏇', key: 'breeding' }, { icon: '🦜', key: 'aviaries' },
  { icon: '🐑', key: 'ranches' }, { icon: '🏥', key: 'vetClinics' }, { icon: '🌿', key: 'sanctuaries' }
]

export const statsData = [
  { number: '50K+', key: 'petOwners' }, { number: '3K+', key: 'enterprises' },
  { number: '500+', key: 'hospitals' }, { number: '2K+', key: 'verifiedVets' },
  { number: '2M+', key: 'animalsManaged' }, { number: '4.9★', key: 'avgRating' }
]

export const featureIcons = {
  advanced: ['📊', '🧬', '⚖️', '📡', '📜', '💹'],
  innovation: ['🧠', '🧬', '📡', '🔗', '👷', '📊'],
  intelligence: ['🤖', '🔮', '🏪', '🌱', '💚', '🗺️'],
  workflow: ['📋', '🔄', '🔀', '🛏️', '👥', '📊'],
  compliance: ['🛡️', '📜', '🔐', '🔒', '👁️', '📊']
}

export const stepIcons = {
  owner: ['📝', '🐾', '📹', '💊'],
  enterprise: ['🏢', '📍', '🐄', '📊'],
  hospital: ['👨‍⚕️', '🏥', '👥', '📅'],
  vet: ['📋', '🕐', '🩺', '💹']
}

export type HomeTab = 'owner' | 'enterprise' | 'vet' | 'hospital'
