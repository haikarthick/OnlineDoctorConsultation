import React from 'react'
import { useAuth } from '../context/AuthContext'
import { AccessProblem } from '../components/routing/RouteGuards'

/** Shown for an address the app has no page for - says so plainly instead of redirecting. */
const NotFound: React.FC = () => {
  const { isAuthenticated } = useAuth()
  return (
    <div className="module-page">
      <AccessProblem kind="notFound" homePath={isAuthenticated ? '/dashboard' : '/'} />
    </div>
  )
}

export default NotFound
