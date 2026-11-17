import React from 'react'
import { useTranslation } from 'react-i18next'
import { VideoSession } from '../../types'
import { formatDuration } from './consultationRoomShared'

interface ConsultationVideoStageProps {
  session: VideoSession | null
  remoteVideoRef: React.RefObject<HTMLVideoElement>
  localVideoRef: React.RefObject<HTMLVideoElement>
  remoteStream: MediaStream | null
  connectionState: string
  mediaMode: 'video' | 'audio-only' | 'none'
  isScreenSharing: boolean
  isCameraOff: boolean
  cameraError: string
  isRecording: boolean
  callDuration: number
  isMuted: boolean
  doctorInitial: string
  onToggleMute: () => void
  onToggleCamera: () => void | Promise<void>
  onToggleScreenShare: () => void | Promise<void>
  onToggleRecording: () => void
  onEndCall: () => void | Promise<void>
  onStartCall: () => void | Promise<void>
}

const ConsultationVideoStage: React.FC<ConsultationVideoStageProps> = ({
  session, remoteVideoRef, localVideoRef, remoteStream, connectionState, mediaMode,
  isScreenSharing, isCameraOff, cameraError, isRecording, callDuration, isMuted, doctorInitial,
  onToggleMute, onToggleCamera, onToggleScreenShare, onToggleRecording, onEndCall, onStartCall
}) => {
  const { t } = useTranslation()

  return (
    <div className="video-main">
      {/* Main video: Show remote peer video when connected, placeholder otherwise */}
      {session?.status === 'active' ? (
        <>
          <video ref={remoteVideoRef} autoPlay playsInline
            className={`video-remote-el ${remoteStream ? 'is-visible' : ''}`} />
          {!remoteStream && (
            <div className="video-placeholder">
              <div className="video-avatar">🧑</div>
              <p>{connectionState === 'connecting' ? t('consultationRoom.connectingToPatient') : t('consultationRoom.waitingForPatientVideo')}</p>
              {mediaMode === 'audio-only' && <p className="si-8e438b3b">🎤 {t('consultationRoom.audioOnlyMode')}</p>}
              {mediaMode === 'none' && <p className="si-ff8aeeff">💬 {t('consultationRoom.chatOnlyMode')}</p>}
            </div>
          )}
          {isScreenSharing && (
            <div className="si-1ded27be">
              🖥️ {t('consultationRoom.screenSharingActive')}
            </div>
          )}
        </>
      ) : (
        <div className="video-placeholder">
          <div className="video-avatar">👨‍⚕️</div>
          <p>{t('consultationRoom.waitingForPatient')}</p>
          <p className="si-7dcbd386">
            {session ? `${t('consultationRoom.room')}: ${session.roomId}` : t('consultationRoom.creatingRoom')}
          </p>
        </div>
      )}

      {/* Camera error banner */}
      {cameraError && session?.status === 'active' && (
        <div className={`video-camera-error-banner ${mediaMode === 'none' ? 'is-critical' : ''}`}>
          {mediaMode === 'audio-only' ? '🎤' : '⚠️'} {cameraError}
        </div>
      )}

      {/* Self-view (PIP) */}
      <div className={`video-self ${isCameraOff || mediaMode !== 'video' ? '' : 'video-self--filled'}`}>
        {isCameraOff || mediaMode !== 'video' ? (
          <span className="si-ecda976e">
            {session?.status !== 'active' ? `Dr. ${doctorInitial}` :
              mediaMode === 'audio-only' ? '🎤 Audio' : mediaMode === 'none' ? '💬 Chat' : '📷 Off'}
          </span>
        ) : (
          <video ref={localVideoRef} autoPlay playsInline muted
            className="si-cb5aeea0" />
        )}
      </div>

      {/* Controls */}
      <div className="video-controls">
        {session?.status === 'waiting' && (
          <button className="btn btn-success btn-lg" onClick={onStartCall}>▶ {t('consultationRoom.startCall')}</button>
        )}
        {session?.status === 'active' && (
          <>
            <button className={`video-control-btn ${!isMuted ? 'active' : ''}`}
              onClick={onToggleMute} title={isMuted ? t('consultationRoom.unmute') : t('consultationRoom.mute')}>
              {isMuted ? '🔇' : '🎤'}
            </button>
            <button className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
              onClick={onToggleCamera} title={isCameraOff ? t('consultationRoom.turnOnCamera') : t('consultationRoom.turnOffCamera')}>
              {isCameraOff ? '📷' : '📹'}
            </button>
            <button className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={onToggleScreenShare} title={t('consultationRoom.shareScreen')}>
              🖥️
            </button>
            <button className={`video-control-btn ${isRecording ? 'recording' : ''}`}
              onClick={onToggleRecording} title={isRecording ? t('consultationRoom.stopRecording') : t('consultationRoom.startRecording')}>
              {isRecording ? '⏹️' : '⏺️'}
            </button>
            <button className="video-control-btn end-call" onClick={onEndCall} title={t('consultationRoom.endCallTitle')}>
              📞
            </button>
          </>
        )}
      </div>

      {/* Recording indicator */}
      {isRecording && (
        <div className="si-fe782970">
          <span className="si-00e70c6a" />
          REC {formatDuration(callDuration)}
        </div>
      )}
    </div>
  )
}

export default ConsultationVideoStage
