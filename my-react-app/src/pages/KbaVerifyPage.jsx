import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchKbaStatus, sendKbaOtp, uploadKbaDocument, verifyKbaOtp } from '../utils/apiClient'
import './KbaFlow.css'

const AUTH_STORAGE_KEY = 'notary.authUser'

const getAuthUser = () => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null')
  } catch {
    return null
  }
}

const setAuthKbaFields = (user = {}) => {
  const authUser = getAuthUser()
  if (!authUser) return
  localStorage.setItem(
    AUTH_STORAGE_KEY,
    JSON.stringify({
      ...authUser,
      otpVerified: Boolean(user.otpVerified),
      kbaStatus: user.kbaStatus || authUser.kbaStatus || 'draft',
      kbaApprovedAt: user.kbaApprovedAt || null,
      kbaRejectedReason: user.kbaRejectedReason || null,
      phoneNumber: user.phoneNumber || authUser.phoneNumber || '',
    })
  )
}

const getDefaultRouteByRole = (role) => {
  if (role === 'owner') return '/owner/doc/dashboard'
  if (role === 'notary') return '/notary/doc/dashboard'
  return '/'
}

const KbaVerifyPage = () => {
  const navigate = useNavigate()
  const authUser = getAuthUser() || {}
  const [statusLoading, setStatusLoading] = useState(true)
  const [statusData, setStatusData] = useState(null)
  const [otpDestination, setOtpDestination] = useState(authUser.phoneNumber || '')
  const [otpChannel, setOtpChannel] = useState('sms')
  const [otpCode, setOtpCode] = useState('')
  const [documentType, setDocumentType] = useState('aadhaar')
  const [selectedFile, setSelectedFile] = useState(null)
  const [busyAction, setBusyAction] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const currentKbaStatus = useMemo(() => {
    return statusData?.user?.kbaStatus || authUser.kbaStatus || 'draft'
  }, [statusData, authUser.kbaStatus])

  const refreshStatus = async () => {
    setStatusLoading(true)
    setError('')

    try {
      const payload = await fetchKbaStatus()
      setStatusData(payload)
      setAuthKbaFields(payload.user)

      const status = String(payload?.user?.kbaStatus || '').toLowerCase()
      if (status === 'kba_approved') {
        navigate(getDefaultRouteByRole(authUser.role), { replace: true })
        return
      }
      if (status === 'kba_pending_review') {
        navigate('/kba/pending', { replace: true })
        return
      }
      if (status === 'kba_rejected') {
        navigate('/kba/rejected', { replace: true })
      }
    } catch (fetchError) {
      setError(fetchError.message || 'Failed to load KBA status')
    } finally {
      setStatusLoading(false)
    }
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const handleSendOtp = async () => {
    setError('')
    setSuccess('')
    if (!otpDestination.trim()) {
      setError('Phone number or email is required to send OTP')
      return
    }

    try {
      setBusyAction('send-otp')
      const payload = await sendKbaOtp(otpDestination.trim(), otpChannel)
      setSuccess(`OTP sent successfully to ${payload.destination}`)
      await refreshStatus()
    } catch (sendError) {
      setError(sendError.message || 'Failed to send OTP')
    } finally {
      setBusyAction('')
    }
  }

  const handleVerifyOtp = async () => {
    setError('')
    setSuccess('')

    if (!otpCode.trim()) {
      setError('Enter OTP code')
      return
    }

    try {
      setBusyAction('verify-otp')
      await verifyKbaOtp(otpCode.trim())
      setSuccess('OTP verified successfully')
      setOtpCode('')
      await refreshStatus()
    } catch (verifyError) {
      setError(verifyError.message || 'Failed to verify OTP')
    } finally {
      setBusyAction('')
    }
  }

  const convertFileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleUploadKba = async () => {
    setError('')
    setSuccess('')

    if (!selectedFile) {
      setError('Please select a KBA document to upload')
      return
    }

    try {
      setBusyAction('upload-kba')
      const documentDataUrl = await convertFileToDataUrl(selectedFile)
      await uploadKbaDocument({
        documentType,
        fileName: selectedFile.name,
        mimeType: selectedFile.type,
        documentDataUrl,
      })
      setSuccess('KBA document submitted successfully. Waiting for admin review.')
      navigate('/kba/pending', { replace: true })
    } catch (uploadError) {
      setError(uploadError.message || 'Failed to upload KBA document')
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div className="kba-page">
      <div className="kba-card">
        <h1 className="kba-title">Complete Your KBA Verification</h1>
        <p className="kba-subtitle">
          To use owner and notary dashboards, complete OTP verification and submit your identity document for KBA approval.
        </p>
        <div className="kba-status-pill">Current Status: {currentKbaStatus.replace(/_/g, ' ')}</div>

        {error && <div className="kba-message error">{error}</div>}
        {success && <div className="kba-message success">{success}</div>}

        <div className="kba-section">
          <h2>Step 1: Send OTP</h2>
          <p>Send a verification code to your phone number or email.</p>
          <div className="kba-form-grid">
            <input
              className="kba-input"
              value={otpDestination}
              onChange={(event) => setOtpDestination(event.target.value)}
              placeholder="+91xxxxxxxxxx or email@example.com"
            />
            <select
              className="kba-select"
              value={otpChannel}
              onChange={(event) => setOtpChannel(event.target.value)}
            >
              <option value="sms">SMS</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div className="kba-actions">
            <button className="kba-btn primary" disabled={busyAction === 'send-otp'} onClick={handleSendOtp}>
              {busyAction === 'send-otp' ? 'Sending OTP...' : 'Send OTP'}
            </button>
            <button className="kba-btn ghost" onClick={refreshStatus} disabled={statusLoading}>
              Refresh Status
            </button>
          </div>
        </div>

        <div className="kba-section">
          <h2>Step 2: Verify OTP</h2>
          <p>Enter the OTP sent to your selected destination.</p>
          <div className="kba-form-grid">
            <input
              className="kba-input"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="Enter 6-digit OTP"
            />
          </div>
          <div className="kba-actions">
            <button className="kba-btn primary" disabled={busyAction === 'verify-otp'} onClick={handleVerifyOtp}>
              {busyAction === 'verify-otp' ? 'Verifying...' : 'Verify OTP'}
            </button>
          </div>
        </div>

        <div className="kba-section">
          <h2>Step 3: Upload KBA Document</h2>
          <p>Upload a valid ID document for admin approval.</p>
          <div className="kba-form-grid">
            <select
              className="kba-select"
              value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}
            >
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="driving_license">Driving License</option>
              <option value="voter_id">Voter ID</option>
            </select>
            <input
              className="kba-input"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
            />
          </div>
          <div className="kba-actions">
            <button className="kba-btn primary" disabled={busyAction === 'upload-kba'} onClick={handleUploadKba}>
              {busyAction === 'upload-kba' ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
          {selectedFile && <div className="kba-meta">Selected file: {selectedFile.name}</div>}
        </div>

        <div className="kba-highlight">
          Your dashboard access will be enabled only after KBA approval by admin.
        </div>
      </div>
    </div>
  )
}

export default KbaVerifyPage
