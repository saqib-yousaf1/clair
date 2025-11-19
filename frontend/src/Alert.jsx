import { useEffect, useState } from 'react'
import './App.css'

export default function Alert({ type = 'info', children, inline = false, onClose, autoDismiss = false, duration = 5000 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    if (!autoDismiss || !visible) return
    const id = setTimeout(() => {
      setVisible(false)
      onClose && onClose()
    }, duration)
    return () => clearTimeout(id)
  }, [autoDismiss, visible, duration, onClose])

  if (!visible) return null

  const className = `alert ${type === 'error' ? 'alert--error' : type === 'success' ? 'alert--success' : 'alert--info'}`

  if (inline) {
    return (
      <div className={className} role="alert">
        {children}
        {onClose && (
          <button className="alert__close" onClick={() => { setVisible(false); onClose() }} aria-label="Close">×</button>
        )}
      </div>
    )
  }

  return (
    <div className="toast-container">
      <div className={`toast ${type === 'error' ? 'toast--error' : ''}`} role="alert">
        {children}
        {onClose && (
          <button className="alert__close" onClick={() => { setVisible(false); onClose() }} aria-label="Close">×</button>
        )}
      </div>
    </div>
  )
}
