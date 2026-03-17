import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuthPage.css'

const AUTH_STORAGE_KEY = 'notary.authUser'
const AUTH_SESSION_TTL_MS = 8 * 60 * 60 * 1000
const ADMIN_USERNAME = 'Priyanshu'
const ADMIN_PASSWORD = '12345678'

const AdminLoginPage = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState(ADMIN_USERNAME)
  const [password, setPassword] = useState(ADMIN_PASSWORD)
  const [error, setError] = useState('')

  const handleAdminLogin = (event) => {
    event.preventDefault()
    setError('')

    if (username.trim() !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      setError('Invalid admin credentials.')
      return
    }

    localStorage.removeItem('notary.role')
    localStorage.removeItem('notary.ownerSessionId')
    localStorage.removeItem('notary.lastSessionId')

    localStorage.setItem(
      AUTH_STORAGE_KEY,
      JSON.stringify({
        username: ADMIN_USERNAME,
        email: 'admin@notary.local',
        role: 'admin',
        token: 'hardcoded-admin-token',
        loggedInAt: Date.now(),
        expiresAt: Date.now() + AUTH_SESSION_TTL_MS,
      })
    )

    navigate('/admin', { replace: true })
  }

  const moveToUserLogin = () => {
    navigate('/login')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Admin Login</h1>
        <p className="auth-subtitle">Sign in with admin credentials to continue.</p>

        <form className="auth-form" onSubmit={handleAdminLogin}>
          <label htmlFor="admin-username" className="auth-label">
            Username
          </label>
          <input
            id="admin-username"
            type="text"
            className="auth-input"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Enter username"
            autoComplete="username"
          />

          <label htmlFor="admin-password" className="auth-label">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            className="auth-input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter password"
            autoComplete="current-password"
          />

          {error && <p className="auth-message auth-error">{error}</p>}

          <button type="submit" className="auth-button">Login</button>
        </form>

        <p className="auth-switch">
          <button type="button" className="auth-switch-link" onClick={moveToUserLogin}>
            Back to User Login
          </button>
        </p>
      </div>
    </div>
  )
}

export default AdminLoginPage
