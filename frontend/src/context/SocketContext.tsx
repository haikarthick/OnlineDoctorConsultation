/**
 * SocketContext — provides a singleton socket.io-client instance to the React tree.
 *
 * Usage:
 *   const { socket, connected } = useSocket()
 *   socket?.emit('chat:send', { consultationId, message })
 *   socket?.on('chat:message', handler)
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'

interface SocketContextValue {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false })

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('authToken')
    if (!token) return

    const s = io(window.location.origin, {
      path: '/ws',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
    })

    s.on('connect', () => {
      setConnected(true)
      // Authenticate right after connect
      s.emit('authenticate', token)
    })

    s.on('disconnect', () => setConnected(false))

    s.on('auth_error', () => {
      // Token may have been refreshed; re-try with current token
      const freshToken = localStorage.getItem('authToken')
      if (freshToken && freshToken !== token) {
        s.emit('authenticate', freshToken)
      }
    })

    socketRef.current = s

    return () => {
      s.disconnect()
      socketRef.current = null
      setConnected(false)
    }
  }, [])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext)
}

export default SocketContext
