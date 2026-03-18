import React, { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchNotarizedDocuments, updateDocumentReview } from '../utils/apiClient'
import socket from '../socket/socket'

const formatDate = (iso) => {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const getReviewBadgeStyle = (status) => {
  if (status === 'accepted') {
    return { background: '#d1fae5', color: '#065f46' }
  }

  if (status === 'rejected') {
    return { background: '#fee2e2', color: '#991b1b' }
  }

  return { background: '#e5e7eb', color: '#374151' }
}

const NotaryDocDashboardPage = () => {
  const navigate = useNavigate()
  const [docs, setDocs] = useState([])
  const [loading, setLoading] = useState(true)

  const handleStartSession = (doc) => {
    if (!doc.sessionId) {
      console.error('❌ Document has no sessionId!', doc);
      alert('Error: Session ID not available. Please try again.');
      return;
    }

    console.log('📤 Notary Starting Session:', { documentId: doc.id, sessionId: doc.sessionId });
    
    // Navigate with a flag to indicate this is a fresh session start
    // The NotaryPage will emit 'notarySessionStarted' once it's loaded and connected
    navigate(`/notary?sessionId=${encodeURIComponent(doc.sessionId)}&role=notary&sessionStarted=true&documentId=${encodeURIComponent(doc.id)}`);
  };

  // Load documents from backend on component mount
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true)
        const documents = await fetchNotarizedDocuments()
        setDocs(documents)
      } catch (error) {
        console.error('Failed to load notarized documents:', error)
        setDocs([])
      } finally {
        setLoading(false)
      }
    }

    loadDocuments()

    // Listen for new notarized documents via socket.io
    const onDocumentNotarized = (newDocument) => {
      console.log('[notary-dashboard] Document notarized via socket:', newDocument)
      setDocs((prevDocs) => {
        // Check if document already exists
        const exists = prevDocs.some((d) => d.id === newDocument.id)
        if (exists) {
          // Update existing document
          return prevDocs.map((d) => (d.id === newDocument.id ? newDocument : d))
        }
        // Add new document
        return [newDocument, ...prevDocs]
      })
    }

    // Listen for cancelled notarizations
    const onDocumentNotarizationCancelled = (data) => {
      console.log('[notary-dashboard] Notarization cancelled via socket:', data.documentId)
      setDocs((prevDocs) => prevDocs.filter((d) => d.id !== data.documentId))
    }

    socket.on('documentNotarized', onDocumentNotarized)
    socket.on('documentNotarizationCancelled', onDocumentNotarizationCancelled)

    return () => {
      socket.off('documentNotarized', onDocumentNotarized)
      socket.off('documentNotarizationCancelled', onDocumentNotarizationCancelled)
    }
  }, [])

  const notarizedDocs = useMemo(
    () => docs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)),
    [docs]
  )

  const handleDecision = async (docId, decision) => {
    const authUser = (() => {
      try {
        return JSON.parse(localStorage.getItem('notary.authUser') || 'null')
      } catch {
        return null
      }
    })()

    const notaryName = authUser?.username || 'Notary'

    // Optimistic update
    const updatedDocs = docs.map((doc) => {
      if (doc.id !== docId) return doc

      return {
        ...doc,
        notaryReview: decision,
        notaryReviewedAt: new Date().toISOString(),
        notaryName,
      }
    })
    setDocs(updatedDocs)

    // Call backend API
    try {
      await updateDocumentReview(docId, decision, notaryName)
    } catch (error) {
      console.error('Failed to update document review:', error)
      // Revert on error
      setDocs(docs)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6fb', padding: '36px 20px', fontFamily: "'Segoe UI', sans-serif" }}>
      <div style={{ maxWidth: '980px', margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: '#0f172a', fontSize: '30px', fontWeight: 700 }}>Notary Document Dashboard</h1>
        <p style={{ margin: '8px 0 24px 0', color: '#475569' }}>
          Review documents marked for notarization by owners.
        </p>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 1.2fr 1.5fr',
              gap: '12px',
              padding: '14px 18px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              fontWeight: 700,
              fontSize: '13px',
              color: '#334155',
            }}
          >
            <span>Document</span>
            <span>Owner Name</span>
            <span>Uploaded</span>
            <span>Status</span>
            <span>Session</span>
            <span>Actions</span>
          </div>

          {notarizedDocs.length === 0 ? (
            <div style={{ padding: '28px 18px', color: '#64748b' }}>
              No owner-notarized documents available yet.
            </div>
          ) : (
            notarizedDocs.map((doc, idx) => {
              const reviewStatus = doc.notaryReview || 'pending'
              const badgeStyle = getReviewBadgeStyle(reviewStatus)

              return (
                <div
                  key={doc.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1.2fr 1.4fr 1fr 1.2fr 1.5fr',
                    gap: '12px',
                    padding: '14px 18px',
                    alignItems: 'center',
                    borderBottom: idx === notarizedDocs.length - 1 ? 'none' : '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ color: '#0f172a', fontWeight: 600 }}>{doc.name || 'Untitled Document'}</span>
                  <span style={{ color: '#334155' }}>{doc.ownerName || 'Unknown Owner'}</span>
                  <span style={{ color: '#475569' }}>{formatDate(doc.uploadedAt)}</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 'fit-content',
                      textTransform: 'capitalize',
                      padding: '4px 10px',
                      borderRadius: '999px',
                      fontSize: '12px',
                      fontWeight: 700,
                      ...badgeStyle,
                    }}
                  >
                    {reviewStatus}
                  </span>
                  
                  <span style={{ color: '#475569', fontSize: '12px', fontFamily: 'monospace' }}>
                    {doc.sessionId ? doc.sessionId.substring(0, 20) + '...' : '-'}
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {reviewStatus === 'accepted' ? (
                      <button
                        onClick={() => handleStartSession(doc)}
                        style={{
                          border: 'none',
                          borderRadius: '8px',
                          background: '#2563eb',
                          color: '#ffffff',
                          fontWeight: 600,
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                        title="Start a session with this document"
                      >
                        Start
                      </button>
                    ) : null}
                    <button
                      onClick={() => handleDecision(doc.id, 'accepted')}
                      style={{
                        border: 'none',
                        borderRadius: '8px',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 600,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecision(doc.id, 'rejected')}
                      style={{
                        border: 'none',
                        borderRadius: '8px',
                        background: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 600,
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

export default NotaryDocDashboardPage