import { useRef, useCallback, useEffect, useState } from 'react'
import apiService from '../services/api'

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const SIGNAL_POLL_MS = 1500

export type ConnectionState = 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed'

/**
 * Hook that manages a WebRTC peer connection with API-based signaling.
 *
 * @param sessionId  - The video session ID (used for signaling API)
 * @param localStream - The local MediaStream (camera/mic)
 * @param isHost     - true = create offer (doctor); false = wait for offer (patient)
 * @param active     - true when the session is active and WebRTC should run
 */
export function useWebRTC(
  sessionId: string | null,
  localStream: MediaStream | null,
  isHost: boolean,
  active: boolean,
) {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const iceCandidateQueue = useRef<RTCIceCandidateInit[]>([])
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('new')
  const mountedRef = useRef(true)
  const startedRef = useRef(false)

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (pcRef.current) {
      pcRef.current.ontrack = null
      pcRef.current.onicecandidate = null
      pcRef.current.onconnectionstatechange = null
      pcRef.current.close()
      pcRef.current = null
    }
    startedRef.current = false
    iceCandidateQueue.current = []
  }, [])

  // Create peer connection and add local tracks
  const createPC = useCallback(() => {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    // Add local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream)
      })
    }

    // Handle remote tracks
    pc.ontrack = (event) => {
      if (!mountedRef.current) return
      const stream = event.streams[0] || new MediaStream([event.track])
      setRemoteStream(stream)
      setConnectionState('connected')
    }

    // Send ICE candidates to the other peer via signaling API
    pc.onicecandidate = (event) => {
      if (event.candidate && sessionId) {
        apiService.sendSignal(sessionId, 'ice-candidate', JSON.stringify(event.candidate)).catch(() => {})
      }
    }

    // Track connection state
    pc.onconnectionstatechange = () => {
      if (!mountedRef.current) return
      const state = pc.connectionState
      if (state === 'connected') setConnectionState('connected')
      else if (state === 'connecting') setConnectionState('connecting')
      else if (state === 'disconnected') setConnectionState('disconnected')
      else if (state === 'failed') setConnectionState('failed')
    }

    return pc
  }, [localStream, sessionId])

  // Process queued ICE candidates
  const drainIceQueue = useCallback(async (pc: RTCPeerConnection) => {
    while (iceCandidateQueue.current.length > 0) {
      const candidate = iceCandidateQueue.current.shift()!
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch { /* ignore */ }
    }
  }, [])

  // Poll for signaling messages
  const startPolling = useCallback((pc: RTCPeerConnection) => {
    if (pollRef.current) return
    pollRef.current = setInterval(async () => {
      if (!sessionId || !mountedRef.current) return
      try {
        const res = await apiService.getSignals(sessionId)
        const signals = res.data || []
        for (const signal of signals) {
          if (signal.type === 'offer' && !isHost) {
            // Received offer — set remote description & create answer
            setConnectionState('connecting')
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)))
            await drainIceQueue(pc)
            const answer = await pc.createAnswer()
            await pc.setLocalDescription(answer)
            await apiService.sendSignal(sessionId, 'answer', JSON.stringify(answer))
          } else if (signal.type === 'answer' && isHost) {
            // Received answer — set remote description
            await pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(signal.data)))
            await drainIceQueue(pc)
          } else if (signal.type === 'ice-candidate') {
            const candidate = JSON.parse(signal.data)
            if (pc.remoteDescription) {
              try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch { /* ignore */ }
            } else {
              iceCandidateQueue.current.push(candidate)
            }
          }
        }
      } catch { /* network hiccup — retry next interval */ }
    }, SIGNAL_POLL_MS)
  }, [sessionId, isHost, drainIceQueue])

  // Main effect: start/stop WebRTC based on active flag
  useEffect(() => {
    if (!active || !sessionId || !localStream || startedRef.current) return

    startedRef.current = true
    const pc = createPC()

    if (isHost) {
      // Host: create offer and send it
      ;(async () => {
        try {
          setConnectionState('connecting')
          const offer = await pc.createOffer()
          await pc.setLocalDescription(offer)
          await apiService.sendSignal(sessionId, 'offer', JSON.stringify(offer))
        } catch (err) {
          console.error('WebRTC offer creation failed', err)
        }
        startPolling(pc)
      })()
    } else {
      // Guest: just start polling — will create answer when offer arrives
      startPolling(pc)
    }

    return () => {
      // Don't cleanup here — let the explicit cleanup handle it
    }
  }, [active, sessionId, localStream, isHost, createPC, startPolling])

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      cleanup()
    }
  }, [cleanup])

  // Replace tracks when localStream changes (e.g., camera toggle, screen share)
  useEffect(() => {
    const pc = pcRef.current
    if (!pc || !localStream) return
    const senders = pc.getSenders()
    localStream.getTracks().forEach(track => {
      const sender = senders.find(s => s.track?.kind === track.kind)
      if (sender) {
        sender.replaceTrack(track).catch(() => {})
      }
    })
  }, [localStream])

  return {
    remoteStream,
    connectionState,
    cleanup,
  }
}
