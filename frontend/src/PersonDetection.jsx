import { useEffect, useRef, useState } from 'react'
import * as cocoSsd from '@tensorflow-models/coco-ssd'
import '@tensorflow/tfjs'

const DETECTION_INTERVAL_MS = 1000
const PERSON_CONFIDENCE_THRESHOLD = 0.6
const PERSON_MISS_THRESHOLD = 3

function PersonDetection({ onPersonDetected, onPersonLost, enabled = true }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const modelRef = useRef(null)
  const detectionIntervalRef = useRef(null)
  const streamRef = useRef(null)
  const noPersonCountRef = useRef(0)
  const personPresentRef = useRef(false)
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [detectionStatus, setDetectionStatus] = useState('Initializing...')

  useEffect(() => {
    const cleanup = () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
        detectionIntervalRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }
      noPersonCountRef.current = 0
      personPresentRef.current = false
    }

    if (!enabled) {
      cleanup()
      return undefined
    }

    let isMounted = true

    const drawDetections = (predictions) => {
      const canvas = canvasRef.current
      const video = videoRef.current

      if (!canvas || !video) {
        return
      }

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      predictions
        .filter((pred) => pred.class === 'person' && pred.score >= PERSON_CONFIDENCE_THRESHOLD)
        .forEach((pred) => {
          const [x, y, width, height] = pred.bbox
          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 3
          ctx.strokeRect(x, y, width, height)
          ctx.font = '16px Arial'
          ctx.fillStyle = '#22c55e'
          ctx.fillText(`${Math.round(pred.score * 100)}%`, x + 4, y + 20)
        })
    }

    const startDetection = () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current)
      }

      detectionIntervalRef.current = setInterval(async () => {
        if (
          !modelRef.current ||
          !videoRef.current ||
          videoRef.current.readyState < 2 // Require at least HAVE_CURRENT_DATA
        ) {
          return
        }

        try {
          const predictions = await modelRef.current.detect(videoRef.current)
          drawDetections(predictions)

          const personDetected = predictions.some(
            (pred) => pred.class === 'person' && pred.score >= PERSON_CONFIDENCE_THRESHOLD,
          )

          if (personDetected) {
            noPersonCountRef.current = 0
            if (!personPresentRef.current) {
              personPresentRef.current = true
              setDetectionStatus('Person detected')
              onPersonDetected?.()
            } else {
              setDetectionStatus('Person detected')
            }
          } else if (personPresentRef.current) {
            noPersonCountRef.current += 1
            setDetectionStatus(`Searching... (${noPersonCountRef.current})`)

            if (noPersonCountRef.current >= PERSON_MISS_THRESHOLD) {
              personPresentRef.current = false
              noPersonCountRef.current = 0
              setDetectionStatus('Person lost')
              onPersonLost?.()
            }
          } else {
            // No person currently detected and none previously observed
            setDetectionStatus('Scanning for people...')
          }
        } catch (err) {
          console.error('Detection error:', err)
        }
      }, DETECTION_INTERVAL_MS)
    }

    const initializeDetection = async () => {
      try {
        setDetectionStatus('Loading AI model...')
        const model = await cocoSsd.load()
        if (!isMounted) return

        modelRef.current = model
        setIsModelLoading(false)
        setDetectionStatus('Starting camera...')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        })
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!isMounted) return
          setDetectionStatus('Scanning for people...')
          startDetection()
        }
      } catch (err) {
        console.error('Person detection initialization error:', err)
        setDetectionStatus(
          err?.name === 'NotAllowedError' ? 'Camera access denied' : 'Camera unavailable',
        )
        setIsModelLoading(false)
      }
    }

    initializeDetection()

    return () => {
      isMounted = false
      cleanup()
    }
  }, [enabled, onPersonDetected, onPersonLost])

  if (!enabled) {
    return null
  }

  return (
    <div className="person-detection">
      <div className="person-detection__status">
        <span className={`status-indicator ${isModelLoading ? 'loading' : 'active'}`} />
        {detectionStatus}
      </div>
      <div className="person-detection__preview">
        <video
          ref={videoRef}
          className="person-detection__video"
          width="640"
          height="480"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="person-detection__canvas"
          width="640"
          height="480"
        />
      </div>
    </div>
  )
}

export default PersonDetection

