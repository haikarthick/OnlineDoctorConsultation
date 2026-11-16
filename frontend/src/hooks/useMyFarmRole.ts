import { useEffect, useState } from 'react'
import apiService from '../services/api'
import { useAuth } from '../context/AuthContext'
import { myFarmRole, type FarmRole } from '../utils/farmRoles'

/**
 * The signed-in person's role on one farm, so a screen can leave out a button that would only be refused
 * ("Approve" for a worker). The server is still the authority - this only decides what to offer. While the
 * team list loads, or if it cannot, the role is null and the buttons that need a role are simply not shown.
 */
export function useMyFarmRole(farm: { id: string; ownerId?: string } | undefined | null): FarmRole | null {
  const { user } = useAuth()
  const [members, setMembers] = useState<Array<{ userId: string; role: string }>>([])
  const farmId = farm?.id

  useEffect(() => {
    if (!farmId) { setMembers([]); return }
    let active = true
    apiService.listEnterpriseMembers(farmId)
      .then((res: any) => { if (active) setMembers(res?.data || []) })
      .catch(() => { if (active) setMembers([]) })
    return () => { active = false }
  }, [farmId])

  return myFarmRole(farm as any, members, user?.id, user?.role === 'admin')
}
