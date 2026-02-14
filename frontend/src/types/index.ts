export type UserRole = 'veterinarian' | 'pet_owner' | 'farmer' | 'admin'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  role: UserRole
  avatar?: string
  createdAt?: string
}

export interface AuthContextType {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
}

export interface RegisterData {
  firstName: string
  lastName: string
  email: string
  phone: string
  password: string
  confirmPassword: string
  role: UserRole
}

export interface Module {
  id: string
  name: string
  title: string
  description: string
  icon: string
  path: string
  component: React.ComponentType<any>
  roles: UserRole[]
  order: number
}

export interface MenuItem {
  id: string
  label: string
  icon: string
  path: string
  roles: UserRole[]
  subItems?: MenuItem[]
  badge?: string
}
