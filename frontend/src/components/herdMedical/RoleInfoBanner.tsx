import React from 'react'
import { useTranslation } from 'react-i18next'

interface RoleInfoBannerProps { role: string }

const RoleInfoBanner: React.FC<RoleInfoBannerProps> = ({ role }) => {
  const { t } = useTranslation()
  // Emoji, not a word. These were the strings 'Admin'/'Vet'/'Farmer'/'Owner' rendered as
  // "[icon] label", which read as "[Farmer] Farmer" for a farmer and was redundant for every
  // other role too ("[Vet] Veterinarian"). Icons match the role icons used at registration.
  const roleInfo: Record<string, { icon: string; label: string; perms: string }> = {
    admin: { icon: '🛡️', label: t('herdMedical.role.admin'), perms: t('herdMedical.role.adminPerms') },
    veterinarian: { icon: '👨‍⚕️', label: t('herdMedical.role.vet'), perms: t('herdMedical.role.vetPerms') },
    farmer: { icon: '🐄', label: t('herdMedical.role.farmer'), perms: t('herdMedical.role.farmerPerms') },
    pet_owner: { icon: '🐕', label: t('herdMedical.role.petOwner'), perms: t('herdMedical.role.petOwnerPerms') },
  }
  const info = roleInfo[role] || roleInfo['pet_owner']
  return (
    <div className="si-c59d9a8b">
      <span className="si-655cbeba" aria-hidden="true">{info?.icon}</span>
      <div><strong>{info?.label}</strong> - {info?.perms}</div>
    </div>
  )
}

export default RoleInfoBanner
