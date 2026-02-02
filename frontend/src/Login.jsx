import { useState } from 'react'

export default function Login({ onAuthenticated }) {
  const [username, setUsername] = useState('The Host')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        // notify parent (also pass password so parent can use header fallback in dev)
        // persist sessionId if returned so we survive page reloads in dev
        if (data.sessionId) {
          try { localStorage.setItem('lw:sessionId', data.sessionId) } catch (e) {}
        }
        onAuthenticated({ username, password, sessionId: data.sessionId || null })
        return
      }
      if (res.status === 401) {
        setError('Invalid credentials')
      } else {
        const text = await res.text()
        setError(text || 'Login failed')
      }
    } catch (err) {
      console.error('Login error', err)
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card" role="dialog" aria-labelledby="login-title">
        <div className="login-card__header">
          <img src="/logo.png" alt="The Host" className="login-card__logo login-card__logo--stack" />
          <div className="login-card__title-wrap login-card__title-wrap--center">
            <h2 id="login-title" className="login-card__title">Sign In</h2>
            <p className="login-card__subtitle">Enter the password to access the control panel</p>
          </div>
        </div>

          <form className="login-form" onSubmit={submit}>
          <div className="form-row">
            <label className="form-label" htmlFor="lw-username">Username</label>
            <input id="lw-username" className="form-input" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>

          <div className="form-row">
            <label className="form-label" htmlFor="lw-password">Password</label>
            <input id="lw-password" className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          {error && <div className="alert alert--error" role="alert">{error}</div>}

          <div className="login-row login-row--actions">
            <div className="login-help">
              
            </div>
            <div className="login-actions">
              <button type="submit" className="primary-button" disabled={loading}>{loading ? 'Signing...' : 'Sign in'}</button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
