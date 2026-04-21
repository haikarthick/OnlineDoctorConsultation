import { useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'

/**
 * useAutoRefresh — silent background data refresh for any component.
 *
 * Combines:
 *   1. Interval polling (default 30s) — always-on fallback
 *   2. Socket.io data:refresh push — instant update when server emits
 *
 * Usage:
 *   useAutoRefresh(['bookings', 'dashboard'], loadData)
 *   useAutoRefresh('animals', loadAnimals, 60000)
 */
export function useAutoRefresh(
  dataTypes: string | string[],
  onRefresh: () => void | Promise<void>,
  intervalMs = 30_000
): { refreshNow: () => void } {
  const { socket } = useSocket()
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh // always latest ref

  const types = Array.isArray(dataTypes) ? dataTypes : [dataTypes]
  const typesRef = useRef(types)
  typesRef.current = types

  // Interval polling
  useEffect(() => {
    const id = setInterval(() => {
      onRefreshRef.current()
    }, intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  // Socket push
  useEffect(() => {
    if (!socket) return
    const handler = (data: { type: string }) => {
      if (typesRef.current.includes(data.type)) {
        onRefreshRef.current()
      }
    }
    socket.on('data:refresh', handler)
    return () => { socket.off('data:refresh', handler) }
  }, [socket])

  const refreshNow = useCallback(() => { onRefreshRef.current() }, [])
  return { refreshNow }
}
