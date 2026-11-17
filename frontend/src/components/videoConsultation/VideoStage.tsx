import React from 'react'
import { useTranslation } from 'react-i18next'
import { VideoSession } from '../../types'
import { formatDuration } from './videoConsultationShared'

interface VideoStageProps {
  session: VideoSession
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
  userRole?: string
  isMuted: boolean
  onToggleMute: () => void
  onToggleCamera: () => void | Promise<void>
  onToggleScreenShare: () => void | Promise<void>
  onToggleRecording: () => void
  onEndSession: () => void | Promise<void>
  onStartSession: () => void | Promise<void>
}

const VideoStage: React.FC<VideoStageProps> = ({
  session, remoteVideoRef, localVideoRef, remoteStream, connectionState, mediaMode,
  isScreenSharing, isCameraOff, cameraError, isRecording, callDuration, userRole, isMuted,
  onToggleMute, onToggleCamera, onToggleScreenShare, onToggleRecording, onEndSession, onStartSession
}) => {
  const { t } = useTranslation()

  return (
    <div className="video-main">
      {/* Main view: remote peer video when connected, placeholder otherwise */}
      {session.status === 'active' ? (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`video-remote-el ${remoteStream ? 'is-visible' : ''}`}
          />
          {!remoteStream && (
            <div className="video-placeholder">
              <div className="video-avatar">{userRole === 'veterinarian' ? '🧑' : '👨‍⚕️'}</div>
              <p>{connectionState === 'connecting' ? t('videoConsultation.connectingDoctor') : t('videoConsultation.waitingDoctorVideo')}</p>
              {mediaMode === 'audio-only' && (
                <p className="si-8e438b3b">🎤 {t('videoConsultation.audioOnlyMode')}</p>
              )}
              {mediaMode === 'none' && (
                <p className="si-ff8aeeff">💬 {t('videoConsultation.chatOnlyMode')}</p>
              )}
            </div>
          )}
          {isScreenSharing && (
            <div className="si-1ded27be">
              🖥️ {t('videoConsultation.screenSharingActive')}
            </div>
          )}
        </>
      ) : (
        <div className="video-placeholder">
          <div className="video-avatar">👨‍⚕️</div>
          <p>{t('videoConsultation.waitingForDoctor')}</p>
        </div>
      )}

      {/* Camera error / info message */}
      {cameraError && (
        <div className={`video-camera-error-banner ${mediaMode === 'none' ? 'is-critical' : ''}`}>
          {mediaMode === 'audio-only' ? '🎤' : '⚠️'} {cameraError}
        </div>
      )}

      {/* Self view - real camera feed or status indicator */}
      <div className={`video-self ${isCameraOff || mediaMode !== 'video' ? '' : 'video-self--filled'}`}>
        {isCameraOff || mediaMode !== 'video' ? (
          <span className="si-ecda976e">
            {mediaMode === 'audio-only' ? t('videoConsultation.audioOnly') : mediaMode === 'none' ? t('videoConsultation.chatOnly') : t('videoConsultation.cameraOff')}
          </span>
        ) : (
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="si-cb5aeea0"
          />
        )}
      </div>

      {/* Controls */}
      {session.status === 'active' && (
        <div className="video-controls">
          <button
            className={`video-control-btn ${!isMuted ? 'active' : ''}`}
            onClick={onToggleMute}
            title={isMuted ? t('videoConsultation.unmute') : t('videoConsultation.mute')}
          >
            {isMuted ? '🔇' : '🎤'}
          </button>
          <button
            className={`video-control-btn ${!isCameraOff ? 'active' : ''}`}
            onClick={onToggleCamera}
            title={isCameraOff ? t('videoConsultation.turnOnCamera') : t('videoConsultation.turnOffCamera')}
          >
            {isCameraOff ? '📷' : '📹'}
          </button>
          <button
            className={`video-control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={onToggleScreenShare}
            title={t('videoConsultation.shareScreen')}
          >
            🖥️
          </button>
          <button
            className={`video-control-btn ${isRecording ? 'recording' : ''}`}
            onClick={onToggleRecording}
            title={isRecording ? t('videoConsultation.stopRecording') : t('videoConsultation.startRecording')}
          >
            {isRecording ? '⏹️' : '⏺️'}
          </button>
          <button
            className="video-control-btn end-call"
            onClick={onEndSession}
            title={t('videoConsultation.endCallTitle')}
          >
            📞
          </button>
        </div>
      )}

      {session.status === 'waiting' && (
        <div className="video-controls si-fdd5bef3">
          <button className="btn btn-success btn-lg" onClick={onStartSession}>
            ▶ {t('videoConsultation.joinCall')}
          </button>
        </div>
      )}

      {isRecording && (
        <div className="si-fe782970">
          <span className="si-00e70c6a" />
          REC {formatDuration(callDuration)}
        </div>
      )}
    </div>
  )
}

export default VideoStage
