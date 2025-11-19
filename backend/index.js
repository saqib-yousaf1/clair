require('dotenv').config()
const express = require('express')
const fetch = require('node-fetch')

const app = express()
app.use(express.json())

const crypto = require('crypto')

// Simple in-memory session store (ephemeral)
const SESSIONS = new Map()
const SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours

function createSession(username = null) {
  const id = crypto.randomBytes(24).toString('hex')
  const expires = Date.now() + SESSION_TTL
  SESSIONS.set(id, { expires, username })
  return id
}

function validateSession(id) {
  if (!id) return false
  const s = SESSIONS.get(id)
  if (!s) return false
  if (s.expires < Date.now()) {
    SESSIONS.delete(id)
    return false
  }
  s.expires = Date.now() + SESSION_TTL
  return true
}

function getCookie(req, name) {
  const header = req.headers && req.headers.cookie
  if (!header) return null
  const parts = header.split(';').map((p) => p.trim())
  for (const p of parts) {
    if (p.startsWith(name + '=')) return decodeURIComponent(p.slice(name.length + 1))
  }
  return null
}

const PASSWORD = process.env.PASSWORD || 'Hedge1'
console.log('Using password:', !!process.env.PASSWORD ? 'from env' : 'default Hedge1')

// Protect /api routes except login/auth-check. Accept either session cookie
// or x-access-password header matching PASSWORD.
app.use((req, res, next) => {
  if (!req.url || !req.url.startsWith('/api')) return next()
  if (req.url === '/api/login' || req.url === '/api/auth-check') return next()

  // check session cookie
  const sid = getCookie(req, 'lw_session')
  if (sid && validateSession(sid)) {
    req.sessionId = sid
    return next()
  }

  // header fallback
  const provided = req.headers['x-access-password'] || (req.query && req.query.password)
  if (provided && provided === PASSWORD) return next()

  // session id via header (allows client to persist session in localStorage)
  const sidHeader = req.headers['x-session-id']
  if (sidHeader && validateSession(sidHeader)) {
    req.sessionId = sidHeader
    return next()
  }

  return res.status(401).json({ error: 'Unauthorized' })
})

const ANAM_API_KEY = process.env.ANAM_API_KEY
if (!ANAM_API_KEY) {
  console.error('Missing ANAM_API_KEY in env')
  process.exit(1)
}

app.post('/api/anam/session-token', async (req, res) => {
  try {
    const personaConfig = req.body.personaConfig
    if (!personaConfig) {
      return res.status(400).json({ error: 'personaConfig required' })
    }

    const response = await fetch('https://api.anam.ai/v1/auth/session-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ANAM_API_KEY}`,
      },
      body: JSON.stringify({ personaConfig }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Bad response: ${response.status} ${text}`)
    }

    const data = await response.json()
    res.json({ sessionToken: data.sessionToken })
  } catch (err) {
    console.error('Error generating session token:', err)
    res.status(500).json({ error: err.toString() })
  }
})

  // Login route - accepts { username, password } and sets HttpOnly cookie
  app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {}
    if (!password || password !== PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }
    const id = createSession(username || null)
    let cookie = `lw_session=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_TTL/1000)}`
    if (process.env.NODE_ENV === 'production') cookie += '; Secure'
    res.setHeader('Set-Cookie', cookie)
    // Also return the session id in JSON so dev clients can persist it across
    // page reloads (useful when cookies are not reliably sent in dev).
    res.json({ ok: true, sessionId: id })
  })

  app.post('/api/logout', (req, res) => {
    const sid = getCookie(req, 'lw_session')
    if (sid) SESSIONS.delete(sid)
    let clear = 'lw_session=; Path=/; SameSite=Strict; Max-Age=0'
    if (process.env.NODE_ENV === 'production') clear += '; Secure'
    res.setHeader('Set-Cookie', clear)
    res.json({ ok: true })
  })

  app.get('/api/auth-check', (req, res) => {
    const sid = getCookie(req, 'lw_session')
    if (sid && validateSession(sid)) {
      const s = SESSIONS.get(sid)
      return res.json({ ok: true, username: s ? s.username : null })
    }
    const provided = req.headers['x-access-password'] || (req.query && req.query.password)
    if (provided && provided === PASSWORD) return res.json({ ok: true, username: null })
    return res.status(401).json({ error: 'Unauthorized' })
  })

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`)
})
