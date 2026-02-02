import { useEffect, useId, useRef, useState } from 'react'
import { createClient } from '@anam-ai/js-sdk'

function AnamAvatar({ sessionToken, personaConfig, onStatusChange }) {
  const videoRef = useRef(null)
  const clientRef = useRef(null)
  const hasLiveStreamRef = useRef(false)
  const micStreamRef = useRef(null)
  const videoElementId = useId()
  const [status, setStatus] = useState('Disconnected')

  useEffect(() => {
    if (!sessionToken || !videoRef.current) {
      setStatus('Disconnected')
      return undefined
    }

    let isMounted = true

    const safeSetStatus = (value) => {
      if (isMounted) {
        setStatus(value)
      }
    }

    const stopMicStream = () => {
      if (!micStreamRef.current) {
        return
      }
      micStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop()
        } catch (err) {
          console.warn('Error stopping mic track', err)
        }
      })
      micStreamRef.current = null
    }

    const initialiseClient = async () => {
      await shutdownClient()

      safeSetStatus('Connecting...')

      let inputAudioStream = null
      if (navigator?.mediaDevices?.getUserMedia) {
        try {
          inputAudioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000,
              channelCount: 1,
            },
          })
          micStreamRef.current = inputAudioStream
        } catch (err) {
          console.warn('Microphone access denied, continuing without mic', err)
          inputAudioStream = null
        }
      }

      const anamClient = createClient(sessionToken, personaConfig)
      clientRef.current = anamClient

      anamClient.addListener('VIDEO_PLAY_STARTED', async () => {
        if (isMounted) {
          hasLiveStreamRef.current = true
          safeSetStatus('Connected')
          
          // Force maximum quality after connection
          try {
            // Check current quality
            const currentQuality = await anamClient.getStreamQuality?.()
            console.log('Current stream quality:', currentQuality)
            
            // Try to set to maximum quality
            if (anamClient.setStreamQuality) {
              await anamClient.setStreamQuality('high')
              console.log('Stream quality set to high')
            }
          } catch (error) {
            console.warn('Could not adjust stream quality:', error)
          }
        }
      })

      anamClient.addListener('CONNECTION_CLOSED', () => {
        if (isMounted) {
          hasLiveStreamRef.current = false
          safeSetStatus('Disconnected')
        }
      })

      try {
        await anamClient.streamToVideoElement(
          videoElementId,
          inputAudioStream ?? undefined,
        )
      } catch (err) {
        console.error('Error starting stream:', err)
        if (isMounted) {
          hasLiveStreamRef.current = false
          safeSetStatus('Stream error')
        }
      }
    }

    const shutdownClient = async () => {
      if (clientRef.current) {
        try {
          if (hasLiveStreamRef.current) {
            await clientRef.current.stopStreaming()
          }
        } catch (err) {
          console.warn('Anam stream shutdown warning:', err)
        } finally {
          hasLiveStreamRef.current = false
          clientRef.current = null
        }
      }
      stopMicStream()
      safeSetStatus('Disconnected')
    }

    initialiseClient()

    return () => {
      safeSetStatus('Disconnected')
      isMounted = false
      shutdownClient().catch(() => {})
    }
  }, [sessionToken, personaConfig])

  useEffect(() => {
    if (typeof onStatusChange === 'function') {
      onStatusChange(status)
    }
  }, [status, onStatusChange])

  return (
    <div className="avatar">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        id={videoElementId}
        className="avatar__video"
        preload="auto"
        controls={false}
        disablePictureInPicture
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          imageRendering: 'high-quality',
        }}
      />
      <div className="avatar__status">Status: {status}</div>
    </div>
  )
}

export default AnamAvatar

