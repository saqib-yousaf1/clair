import { useEffect, useState, useRef } from 'react'
import './App.css'
import AnamAvatar from './AnamAvatar'
import PersonDetection from './PersonDetection'
import Login from './Login'

const DEFAULT_PERSONA_CONFIG = Object.freeze({
  personaId: 'fff175f8-0170-453b-be4b-360730a0f328',
  voiceId: '5d67e1e3-8375-4185-ac84-b05464255d9c',
  systemPrompt: 'You are helpful assistant.',
  quality: 'high',
  videoQuality: 'hd',
  videoBitrate: 5000000, // 5 Mbps for maximum quality
  audioBitrate: 192000, // 192 kbps for highest audio quality
  preferredVideoCodec: 'h264', // Better compatibility and quality
  adaptiveStreaming: false, // Disable adaptive quality to maintain high quality
})

function App() {
  const [sessionToken, setSessionToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [authenticated, setAuthenticated] = useState(false)
  const [authPassword, setAuthPassword] = useState(null)
  const [authUsername, setAuthUsername] = useState(null)
  const [authSessionId, setAuthSessionId] = useState(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isStreamConnected, setIsStreamConnected] = useState(false)
  const [personDetectionEnabled, setPersonDetectionEnabled] = useState(true)
  const [autoLaunchTriggered, setAutoLaunchTriggered] = useState(false)
  const sessionActiveRef = useRef(false)
  const launchRequestRef = useRef(0)

  useEffect(() => {
    // Try to restore sessionId from localStorage (dev fallback when cookies across ports fail)
    try {
      const sid = localStorage.getItem('lw:sessionId')
      if (sid) {
        setAuthSessionId(sid)
        // attempt to validate session with backend using header fallback
        ;(async () => {
          try {
            const res = await fetch('/api/auth-check', {
              method: 'GET',
              headers: { 'x-session-id': sid },
              credentials: 'include',
            })
            if (res.ok) {
              const data = await res.json().catch(() => ({}))
              setAuthUsername(data.username || 'The Host')
              setAuthenticated(true)
            } else {
              // invalid sessionId -> clear
              localStorage.removeItem('lw:sessionId')
              setAuthSessionId(null)
            }
          } catch (e) {
            // network error; keep sessionId but don't authenticate yet
            console.warn('Auth-check failed:', e)
          }
        })()
      }
    } catch (e) {
      // ignore storage errors
    }

    document.body.style.overflow = isFullscreen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isFullscreen])

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev)
  }

  const startSession = async () => {
    const launchId = launchRequestRef.current + 1
    launchRequestRef.current = launchId
    setLoading(true)
    setError(null)
    setIsStreamConnected(false)

    try {
  const headers = { 'Content-Type': 'application/json' }
  if (authPassword) headers['x-access-password'] = authPassword
  // dev fallback: include session id header if available
  if (authSessionId) headers['x-session-id'] = authSessionId
      const response = await fetch('/api/anam/session-token', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ personaConfig: DEFAULT_PERSONA_CONFIG }),
      })

      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Failed with status ${response.status}`)
      }

      const data = await response.json()
      if (!data.sessionToken) {
        throw new Error('No session token returned from backend')
      }

      if (launchRequestRef.current !== launchId) {
        return
      }

      setSessionToken(data.sessionToken)
    } catch (err) {
      if (launchRequestRef.current !== launchId) {
        return
      }

      console.error('Failed to start Anam session:', err)
      setError(err.message || 'Unknown error')
      setSessionToken(null)
      setIsFullscreen(false)
      setIsStreamConnected(false)
    } finally {
      if (launchRequestRef.current === launchId) {
        setLoading(false)
      }
    }
  }

  const handleStreamStatusChange = (status) => {
    if (status === 'Connected') {
      setIsStreamConnected(true)
      sessionActiveRef.current = true
      // Keep person detection enabled during session to monitor presence
      setPersonDetectionEnabled(true)
    } else if (status === 'Disconnected' || status === 'Stream error') {
      setIsStreamConnected(false)
      sessionActiveRef.current = false
      // Re-enable person detection when disconnected
      if (sessionToken) {
        setPersonDetectionEnabled(true)
        setAutoLaunchTriggered(false)
      }
    }
  }

  const handlePersonLost = () => {
    if (!sessionToken && !loading) {
      return
    }

    console.log('No person detected, closing session...')
    closeSession()
  }

  const closeSession = () => {
    launchRequestRef.current += 1
    setSessionToken(null)
    setIsStreamConnected(false)
    setIsFullscreen(false)
    sessionActiveRef.current = false
    setAutoLaunchTriggered(false)
    setPersonDetectionEnabled(true)
    setError(null)
    setLoading(false)
  }

  const handlePersonDetected = () => {
    // Auto-launch only if not already loading/connected and not already triggered
    if (!sessionToken && !loading && !autoLaunchTriggered) {
      setAutoLaunchTriggered(true)
      startSession()
    }
    // If session is active, reset is handled in PersonDetection component
  }

  const handleAuthenticated = ({ username, password }) => {
    setAuthUsername(username || null)
    setAuthPassword(password || null)
    // if login provided a sessionId (Login component persists it), read it
    try {
      const sid = localStorage.getItem('lw:sessionId')
      if (sid) setAuthSessionId(sid)
    } catch (e) {}
    setAuthenticated(true)
  }

  const logout = async () => {
    try {
      // prefer cookie-based logout
      await fetch('/api/logout', { method: 'POST', credentials: 'include' })
    } catch (e) {
      // fallback to header mode if necessary
      try {
        const headers = authSessionId ? { 'x-session-id': authSessionId } : { 'x-access-password': authPassword }
        await fetch('/api/logout', { method: 'POST', headers })
      } catch (err) {
        // ignore
      }
    }

    // clear client state
    setAuthenticated(false)
    setAuthPassword(null)
    setAuthUsername(null)
    setSessionToken(null)
    try { localStorage.removeItem('lw:sessionId') } catch (e) {}
    setAuthSessionId(null)
  }

  if (!authenticated) {
    return <Login onAuthenticated={handleAuthenticated} />
  }

  return (
    <div className={`app${isFullscreen ? ' app--fullscreen' : ''}`}>
      <div className="app__shell">
        <header className="hero">
          <h1 className="hero__title">
            <img src="/logo.png" alt="The Host" className="hero__logo" />
          </h1>
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 8 }}>
            <button
              type="button"
              onClick={startSession}
              disabled={loading}
              className="primary-button"
            >
              {loading ? 'Connecting…' : 'Launch Stream'}
            </button>
            <button
              type="button"
              onClick={logout}
              className="ghost-button ghost-button--icon logout-button"
              aria-label="Logout"
              title="Logout"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" width="20" height="20">
                <path
                  d="M12 2v10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
                <path
                  d="M5.07 6.1a8 8 0 1 0 13.86 0"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.75"
                />
              </svg>
            </button>
          </div>
          {error && (
            <div className="alert alert--error" role="alert">
              <strong>Request failed.</strong> {error}
            </div>
          )}
        </header>

        {/* Person Detection Component - Hidden UI, runs in background */}
        {personDetectionEnabled && (
          <div className="person-detection-container">
            <PersonDetection
              enabled={personDetectionEnabled}
              onPersonDetected={handlePersonDetected}
              onPersonLost={handlePersonLost}
            />
          </div>
        )}

        <main
          className={`stage${isFullscreen ? ' stage--fullscreen' : ''}`}
          aria-live="polite"
        >
          {sessionToken && isStreamConnected && (
            <div className="stage__controls">
              <button
                type="button"
                className="ghost-button ghost-button--icon"
                onClick={toggleFullscreen}
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                {isFullscreen ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M9 3H5a2 2 0 0 0-2 2v4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M3 15v4a2 2 0 0 0 2 2h4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M15 21h4a2 2 0 0 0 2-2v-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M21 9V5a2 2 0 0 0-2-2h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      d="M9 3H5a2 2 0 0 0-2 2v4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M3 9l6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="M15 21h4a2 2 0 0 0 2-2v-4"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                    <path
                      d="m15 21 6-6"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                    />
                  </svg>
                )}
              </button>
            </div>
          )}
          <div className="stage__surface">
            <div
              className={`stage__placeholder${
                sessionToken && isStreamConnected ? ' stage__placeholder--hidden' : ''
              }`}
              role="img"
              aria-label="Avatar preview"
            >
              <img
                src="/images.png"
                alt=""
                className="stage__placeholder-image"
                aria-hidden={sessionToken && isStreamConnected}
              />
            </div>
            {sessionToken && (
              <div
                className={`stage__video${
                  isStreamConnected ? ' stage__video--visible' : ''
                }`}
              >
                <AnamAvatar
                  sessionToken={sessionToken}
                  personaConfig={DEFAULT_PERSONA_CONFIG}
                  onStatusChange={handleStreamStatusChange}
                />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
