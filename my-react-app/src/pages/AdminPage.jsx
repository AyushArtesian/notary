import React, { useCallback, useEffect, useMemo, useState } from "react";
import { deleteAdminUser, fetchAdminOverview, fetchAdminUserInfo, terminateAdminSession, updateAdminUser, fetchPendingKbaQueue, approveKbaSubmission, rejectKbaSubmission, getKbaDocumentUrl, fetchKbaDocumentAsBlob } from "../utils/apiClient";
import "./AdminPage.css";

const AdminPage = () => {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [kbaQueue, setKbaQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyUserId, setBusyUserId] = useState("");
  const [busySessionId, setBusySessionId] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedKbaSubmission, setSelectedKbaSubmission] = useState(null);
  const [kbaDocumentUrl, setKbaDocumentUrl] = useState("");
  const [kbaDocumentLoading, setKbaDocumentLoading] = useState(false);
  const [kbaDocumentError, setKbaDocumentError] = useState("");
  const [kbaRejectReason, setKbaRejectReason] = useState("");
  const [editUserForm, setEditUserForm] = useState({ username: "", email: "", role: "owner", password: "" });

  const authUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("notary.authUser") || "null") || {};
    } catch {
      return {};
    }
  })();

  const formatDate = (value) => {
    if (!value) return "-";
    const d = new Date(Number(value));
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusClassByRole = (role) => {
    const normalized = String(role || "").trim().toLowerCase();
    if (normalized === "owner") return "role-owner";
    if (normalized === "notary") return "role-notary";
    if (normalized === "admin") return "role-admin";
    return "";
  };

  const loadOverview = useCallback(async () => {
    try {
      const overview = await fetchAdminOverview();
      setSummary(overview.summary || null);
      setUsers(Array.isArray(overview.users) ? overview.users : []);
      setDocuments(Array.isArray(overview.recentDocuments) ? overview.recentDocuments : []);
      setActiveSessions(Array.isArray(overview.activeSessions) ? overview.activeSessions : []);
      
      try {
        const kbaData = await fetchPendingKbaQueue();
        setKbaQueue(Array.isArray(kbaData) ? kbaData : []);
      } catch (err) {
        console.error('Failed to load KBA queue:', err);
        setKbaQueue([]);
      }
      
      setError("");
    } catch (err) {
      setError("Failed to load admin dashboard data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const guardedLoad = async () => {
      await loadOverview();
      if (cancelled) return;
    };

    guardedLoad();

    const refreshId = window.setInterval(guardedLoad, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, [loadOverview]);

  useEffect(() => {
    if (!selectedKbaSubmission) {
      setKbaDocumentUrl("");
      setKbaDocumentError("");
      return;
    }

    let isMounted = true;

    const loadDocumentPreview = async () => {
      try {
        console.log('[KBA Document] Loading document for user:', selectedKbaSubmission.userId);
        setKbaDocumentLoading(true);
        setKbaDocumentError("");
        const blob = await fetchKbaDocumentAsBlob(selectedKbaSubmission.userId);
        console.log('[KBA Document] Received blob:', blob.size, 'bytes');
        
        if (isMounted) {
          const url = URL.createObjectURL(blob);
          setKbaDocumentUrl(url);
          console.log('[KBA Document] Document URL created successfully');
        }
      } catch (err) {
        console.error('[KBA Document] Error loading document:', err);
        if (isMounted) {
          setKbaDocumentError(err?.message || "Failed to load document preview");
          setKbaDocumentUrl("");
        }
      } finally {
        if (isMounted) {
          setKbaDocumentLoading(false);
        }
      }
    };

    loadDocumentPreview();

    return () => {
      isMounted = false;
      if (kbaDocumentUrl) {
        URL.revokeObjectURL(kbaDocumentUrl);
      }
    };
  }, [selectedKbaSubmission?.userId]);

  const clearFlashAfterDelay = () => {
    window.setTimeout(() => {
      setActionMessage("");
      setActionError("");
    }, 3500);
  };

  const handleViewUser = async (userId) => {
    try {
      setBusyUserId(userId);
      setActionError("");
      const payload = await fetchAdminUserInfo(userId);
      setSelectedUser({ mode: "view", data: payload });
    } catch (err) {
      setActionError(err?.message || "Failed to load user details");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const handleEditUser = async (userId) => {
    try {
      setBusyUserId(userId);
      setActionError("");
      const payload = await fetchAdminUserInfo(userId);
      setSelectedUser({ mode: "edit", data: payload });
      setEditUserForm({
        username: payload?.user?.username || "",
        email: payload?.user?.email || "",
        role: payload?.user?.role || "owner",
        password: "",
      });
    } catch (err) {
      setActionError(err?.message || "Failed to load user for edit");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const handleSaveUser = async () => {
    const userId = selectedUser?.data?.user?.userId;
    if (!userId) return;

    try {
      setBusyUserId(userId);
      setActionError("");
      setActionMessage("");

      await updateAdminUser(userId, {
        username: editUserForm.username,
        email: editUserForm.email,
        role: editUserForm.role,
        password: editUserForm.password || undefined,
      });

      setActionMessage("User updated successfully");
      setSelectedUser(null);
      await loadOverview();
      clearFlashAfterDelay();
    } catch (err) {
      setActionError(err?.message || "Failed to update user");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const handleDeleteUser = async (user) => {
    const shouldDelete = window.confirm(`Delete user ${user.username}? This action cannot be undone.`);
    if (!shouldDelete) return;

    try {
      setBusyUserId(user.userId);
      setActionError("");
      setActionMessage("");
      await deleteAdminUser(user.userId);
      setActionMessage(`User ${user.username} deleted`);
      await loadOverview();
      clearFlashAfterDelay();
    } catch (err) {
      setActionError(err?.message || "Failed to delete user");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const handleTerminateSession = async (session) => {
    const shouldTerminate = window.confirm(`Terminate live session ${session.sessionId}?`);
    if (!shouldTerminate) return;

    try {
      setBusySessionId(session.sessionId);
      setActionError("");
      setActionMessage("");
      await terminateAdminSession(session.sessionId, {
        adminUserId: authUser?.userId || null,
        adminName: authUser?.username || "Admin",
        reason: "Terminated by admin from dashboard",
      });
      setActionMessage(`Session ${session.sessionId} terminated`);
      await loadOverview();
      clearFlashAfterDelay();
    } catch (err) {
      setActionError(err?.message || "Failed to terminate session");
      clearFlashAfterDelay();
    } finally {
      setBusySessionId("");
    }
  };

  const handleApproveKba = async (submission) => {
    const shouldApprove = window.confirm(`Approve KBA submission from ${submission.username}?`);
    if (!shouldApprove) return;

    try {
      setBusyUserId(submission.userId);
      setActionError("");
      setActionMessage("");
      await approveKbaSubmission(submission.userId);
      setActionMessage(`KBA approved for ${submission.username}`);
      setSelectedKbaSubmission(null);
      await loadOverview();
      clearFlashAfterDelay();
    } catch (err) {
      setActionError(err?.message || "Failed to approve KBA");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const handleRejectKba = async (submission) => {
    const reason = kbaRejectReason.trim() || "KBA documents could not be verified";
    const shouldReject = window.confirm(`Reject KBA submission from ${submission.username}?\nReason: ${reason}`);
    if (!shouldReject) return;

    try {
      setBusyUserId(submission.userId);
      setActionError("");
      setActionMessage("");
      await rejectKbaSubmission(submission.userId, reason);
      setActionMessage(`KBA rejected for ${submission.username}`);
      setSelectedKbaSubmission(null);
      setKbaRejectReason("");
      await loadOverview();
      clearFlashAfterDelay();
    } catch (err) {
      setActionError(err?.message || "Failed to reject KBA");
      clearFlashAfterDelay();
    } finally {
      setBusyUserId("");
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return users.filter((user) => {
      const role = String(user.role || "").trim().toLowerCase();
      if (roleFilter !== "all" && role !== roleFilter) return false;
      if (activityFilter === "active" && !user.isActive) return false;
      if (activityFilter === "inactive" && user.isActive) return false;
      if (!needle) return true;

      const hay = `${user.username || ""} ${user.email || ""} ${user.userId || ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [users, search, roleFilter, activityFilter]);

  const roleLabel = (role) => {
    const normalized = String(role || "").trim().toLowerCase();
    return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : "Unknown";
  };

  const docStatusLabel = (doc) => {
    const status = String(doc?.status || "").trim().toLowerCase();
    if (!status) return "unknown";
    return status.replace(/_/g, " ");
  };

  return (
    <div className="admin-page">
      <div className="admin-container">
        <h1 className="admin-title">Admin Dashboard</h1>
        <p className="admin-subtitle">Monitor owners, notaries, activity status, and notarization work in one place.</p>

        {error && <p className="admin-error">{error}</p>}
        {actionError && <p className="admin-error">{actionError}</p>}
        {actionMessage && <p className="admin-success">{actionMessage}</p>}

        {loading ? (
          <p className="admin-loading">Loading admin dashboard...</p>
        ) : !summary ? (
          <p className="admin-empty">No admin data found</p>
        ) : (
          <div className="admin-content">
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <span className="admin-stat-label">Total Users</span>
                <strong>{summary.totalUsers}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Owners</span>
                <strong>{summary.owners}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Notaries</span>
                <strong>{summary.notaries}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Active Users</span>
                <strong>{summary.activeUsers}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Active Sessions</span>
                <strong>{summary.activeSessions}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Total Documents</span>
                <strong>{summary.totalDocuments}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">Notarized Docs</span>
                <strong>{summary.notarizedDocuments}</strong>
              </div>
              <div className="admin-stat-card">
                <span className="admin-stat-label">In Process Docs</span>
                <strong>{summary.inProcessDocuments}</strong>
              </div>
            </div>

            <div className="admin-filter-bar">
              <input
                className="admin-filter-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by username, email or user ID"
              />
              <select className="admin-filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="all">All roles</option>
                <option value="owner">Owners</option>
                <option value="notary">Notaries</option>
                <option value="admin">Admins</option>
              </select>
              <select className="admin-filter-select" value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)}>
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>

            <h2 className="admin-section-title">User Management</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Work</th>
                    <th>Last Activity</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.userId}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-main">{user.username}</div>
                          <div className="admin-user-sub">{user.email}</div>
                          <div className="admin-user-sub admin-user-id">{user.userId}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`role-badge ${statusClassByRole(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <span className={`admin-status-dot ${user.isActive ? "active" : "inactive"}`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                        {Array.isArray(user.activeSessionIds) && user.activeSessionIds.length > 0 && (
                          <div className="admin-user-sub">{user.activeSessionIds.length} session(s)</div>
                        )}
                      </td>
                      <td>
                        {String(user.role).toLowerCase() === "owner" ? (
                          <div className="admin-work-metrics">
                            <div>Owned: {user.work?.ownedDocuments || 0}</div>
                            <div>Notarized: {user.work?.ownedNotarizedDocuments || 0}</div>
                            <div>In process: {user.work?.ownedInProcessDocuments || 0}</div>
                          </div>
                        ) : String(user.role).toLowerCase() === "notary" ? (
                          <div className="admin-work-metrics">
                            <div>Reviewed: {user.work?.reviewedDocuments || 0}</div>
                            <div>Finalized: {user.work?.finalizedNotarizations || 0}</div>
                          </div>
                        ) : (
                          <div className="admin-work-metrics">
                            <div>Platform administration</div>
                          </div>
                        )}
                      </td>
                      <td>{formatDate(user.lastActivityAt)}</td>
                      <td>{formatDate(user.createdAt)}</td>
                      <td>
                        <div className="admin-actions-cell">
                          <button
                            className="admin-action-btn"
                            onClick={() => handleViewUser(user.userId)}
                            disabled={busyUserId === user.userId}
                          >
                            Info
                          </button>
                          <button
                            className="admin-action-btn"
                            onClick={() => handleEditUser(user.userId)}
                            disabled={busyUserId === user.userId}
                          >
                            Edit
                          </button>
                          <button
                            className="admin-action-btn danger"
                            onClick={() => handleDeleteUser(user)}
                            disabled={busyUserId === user.userId || String(user.role || "").toLowerCase() === "admin"}
                            title={String(user.role || "").toLowerCase() === "admin" ? "Admin accounts cannot be deleted here" : "Delete user"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="admin-section-title">Live Sessions</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Users</th>
                    <th>Participants</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="admin-empty">No live sessions right now.</td>
                    </tr>
                  ) : (
                    activeSessions.map((session) => (
                      <tr key={session.sessionId}>
                        <td className="admin-user-id">{session.sessionId}</td>
                        <td>{session.userCount}</td>
                        <td>
                          {(session.users || []).map((u) => `${u.username} (${u.role})`).join(', ') || '-'}
                        </td>
                        <td>{formatDate(session.createdAt)}</td>
                        <td>
                          <button
                            className="admin-action-btn danger"
                            onClick={() => handleTerminateSession(session)}
                            disabled={busySessionId === session.sessionId}
                          >
                            {busySessionId === session.sessionId ? "Terminating..." : "Terminate"}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="admin-section-title">KBA Review Queue</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Document Type</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {kbaQueue.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="admin-empty">No pending KBA submissions.</td>
                    </tr>
                  ) : (
                    kbaQueue.map((submission) => (
                      <tr key={submission.userId}>
                        <td>{submission.username}</td>
                        <td>{submission.email}</td>
                        <td>
                          <span className={`role-badge ${statusClassByRole(submission.role)}`}>
                            {roleLabel(submission.role)}
                          </span>
                        </td>
                        <td>{submission.documentType || '-'}</td>
                        <td>
                          <span className={`kba-status-badge kba-status-${(submission.kbaStatus || 'draft').toLowerCase().replace(/_/g, '-')}`}>
                            {(submission.kbaStatus || 'draft').replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td>{formatDate(submission.submittedAt)}</td>
                        <td>
                          <button
                            className="admin-action-btn"
                            onClick={() => setSelectedKbaSubmission(submission)}
                            disabled={busyUserId === submission.userId}
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <h2 className="admin-section-title">Recent Document Work</h2>
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Owner</th>
                    <th>Notary</th>
                    <th>Status</th>
                    <th>Session</th>
                    <th>Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="admin-empty">No documents found.</td>
                    </tr>
                  ) : (
                    documents.slice(0, 50).map((doc) => (
                      <tr key={doc.id}>
                        <td>{doc.name || 'Untitled'}</td>
                        <td>{doc.ownerName || doc.ownerId || '-'}</td>
                        <td>{doc.notaryName || doc.notaryId || '-'}</td>
                        <td>{docStatusLabel(doc)}</td>
                        <td className="admin-user-id">{doc.sessionId || '-'}</td>
                        <td>{formatDate(doc.uploadedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {selectedUser?.data?.user && (
              <div className="admin-user-modal-overlay" onClick={() => setSelectedUser(null)}>
                <div className="admin-user-modal" onClick={(e) => e.stopPropagation()}>
                  <h3>{selectedUser.mode === "edit" ? "Edit User" : "User Details"}</h3>

                  {selectedUser.mode === "edit" ? (
                    <div className="admin-user-form">
                      <label>
                        Username
                        <input
                          value={editUserForm.username}
                          onChange={(e) => setEditUserForm((prev) => ({ ...prev, username: e.target.value }))}
                        />
                      </label>
                      <label>
                        Email
                        <input
                          value={editUserForm.email}
                          onChange={(e) => setEditUserForm((prev) => ({ ...prev, email: e.target.value }))}
                        />
                      </label>
                      <label>
                        Role
                        <select
                          value={editUserForm.role}
                          onChange={(e) => setEditUserForm((prev) => ({ ...prev, role: e.target.value }))}
                        >
                          <option value="owner">Owner</option>
                          <option value="notary">Notary</option>
                          <option value="admin">Admin</option>
                        </select>
                      </label>
                      <label>
                        Reset Password (optional)
                        <input
                          type="password"
                          value={editUserForm.password}
                          onChange={(e) => setEditUserForm((prev) => ({ ...prev, password: e.target.value }))}
                          placeholder="Leave blank to keep current"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="admin-user-info-list">
                      <p><strong>Username:</strong> {selectedUser.data.user.username}</p>
                      <p><strong>Email:</strong> {selectedUser.data.user.email}</p>
                      <p><strong>Role:</strong> {roleLabel(selectedUser.data.user.role)}</p>
                      <p><strong>User ID:</strong> {selectedUser.data.user.userId}</p>
                      <p><strong>Created:</strong> {formatDate(selectedUser.data.user.createdAt)}</p>
                      <p><strong>Total Documents:</strong> {selectedUser.data.work?.totalDocuments || 0}</p>
                      <p><strong>Owned Documents:</strong> {selectedUser.data.work?.ownedDocuments || 0}</p>
                      <p><strong>Reviewed Documents:</strong> {selectedUser.data.work?.reviewedDocuments || 0}</p>
                    </div>
                  )}

                  <div className="admin-user-modal-actions">
                    <button className="admin-action-btn" onClick={() => setSelectedUser(null)}>
                      Close
                    </button>
                    {selectedUser.mode === "edit" && (
                      <button
                        className="admin-action-btn primary"
                        onClick={handleSaveUser}
                        disabled={busyUserId === selectedUser.data.user.userId}
                      >
                        {busyUserId === selectedUser.data.user.userId ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedKbaSubmission && (
              <div className="admin-user-modal-overlay" onClick={() => setSelectedKbaSubmission(null)}>
                <div className="admin-user-modal admin-kba-modal-landscape" onClick={(e) => e.stopPropagation()}>
                  <div className="admin-kba-modal-header">
                    <h3>KBA Submission Review</h3>
                    <button className="admin-kba-modal-close" onClick={() => setSelectedKbaSubmission(null)}>✕</button>
                  </div>

                  <div className="admin-kba-modal-content">
                    {/* Left Panel: User Info and Actions */}
                    <div className="admin-kba-left-panel">
                      <div className="admin-user-info-list">
                        <p><strong>User:</strong> {selectedKbaSubmission.username}</p>
                        <p><strong>Email:</strong> {selectedKbaSubmission.email}</p>
                        <p><strong>Role:</strong> {roleLabel(selectedKbaSubmission.role)}</p>
                        <p><strong>Document Type:</strong> {selectedKbaSubmission.documentType || '-'}</p>
                        <p><strong>File Name:</strong> {selectedKbaSubmission.fileName || '-'}</p>
                        <p><strong>Current Status:</strong> 
                          <span className={`kba-status-badge kba-status-${(selectedKbaSubmission.kbaStatus || 'draft').toLowerCase().replace(/_/g, '-')}`}>
                            {(selectedKbaSubmission.kbaStatus || 'draft').replace(/_/g, ' ')}
                          </span>
                        </p>
                        <p><strong>Submitted:</strong> {formatDate(selectedKbaSubmission.submittedAt)}</p>
                        {selectedKbaSubmission.rejectionReason && (
                          <p><strong>Previous Rejection Reason:</strong> {selectedKbaSubmission.rejectionReason}</p>
                        )}
                      </div>

                      <div className="admin-kba-actions">
                        <label>
                          Rejection Reason (optional)
                          <textarea
                            value={kbaRejectReason}
                            onChange={(e) => setKbaRejectReason(e.target.value)}
                            placeholder="If rejecting, provide a reason..."
                            rows={3}
                            style={{ minHeight: '60px', maxHeight: '100px' }}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Right Panel: Document Preview */}
                    <div className="admin-kba-right-panel">
                      <div className="admin-kba-document-section">
                        <h4>Uploaded Document</h4>
                        {kbaDocumentLoading ? (
                          <div className="admin-kba-loading">Loading document preview...</div>
                        ) : kbaDocumentError ? (
                          <div className="admin-kba-error">{kbaDocumentError}</div>
                        ) : kbaDocumentUrl && selectedKbaSubmission.mimeType ? (
                          <>
                            {selectedKbaSubmission.mimeType.startsWith('image/') ? (
                              <div className="admin-kba-image-preview">
                                <img 
                                  src={kbaDocumentUrl} 
                                  alt="KBA Document" 
                                />
                              </div>
                            ) : selectedKbaSubmission.mimeType === 'application/pdf' ? (
                              <div className="admin-kba-pdf-preview">
                                <iframe 
                                  src={kbaDocumentUrl} 
                                  title="KBA Document Preview"
                                />
                              </div>
                            ) : (
                              <div className="admin-kba-file-info">
                                <p><strong>File Type:</strong> {selectedKbaSubmission.mimeType}</p>
                                <p><strong>File Name:</strong> {selectedKbaSubmission.fileName}</p>
                              </div>
                            )}
                            <a 
                              href={kbaDocumentUrl} 
                              download={selectedKbaSubmission.fileName}
                              className="admin-kba-download-link"
                            >
                              Download Document
                            </a>
                          </>
                        ) : (
                          <p style={{ color: '#999', fontSize: '14px', textAlign: 'center', padding: '40px 20px' }}>No document available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <details style={{ marginBottom: '12px', padding: '8px', backgroundColor: '#f5f5f5', borderRadius: '6px', fontSize: '11px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#666' }}>Debug Info (click to expand)</summary>
                    <div style={{ marginTop: '8px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#333' }}>
                      User ID: {selectedKbaSubmission.userId}
                      MIME Type: {selectedKbaSubmission.mimeType}
                      Loading: {kbaDocumentLoading ? 'YES' : 'NO'} | URL Set: {kbaDocumentUrl ? 'YES' : 'NO'} | Error: {kbaDocumentError || 'None'}
                    </div>
                  </details>

                  <div className="admin-kba-modal-footer">
                    <button
                      className="admin-action-btn danger"
                      onClick={() => handleRejectKba(selectedKbaSubmission)}
                      disabled={busyUserId === selectedKbaSubmission.userId}
                    >
                      {busyUserId === selectedKbaSubmission.userId ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      className="admin-action-btn primary"
                      onClick={() => handleApproveKba(selectedKbaSubmission)}
                      disabled={busyUserId === selectedKbaSubmission.userId}
                    >
                      {busyUserId === selectedKbaSubmission.userId ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
