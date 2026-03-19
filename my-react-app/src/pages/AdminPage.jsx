import React, { useEffect, useMemo, useState } from "react";
import { fetchAdminOverview } from "../utils/apiClient";
import "./AdminPage.css";

const AdminPage = () => {
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

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

  useEffect(() => {
    let cancelled = false;

    const loadOverview = async () => {
      try {
        const overview = await fetchAdminOverview();
        if (cancelled) return;
        setSummary(overview.summary || null);
        setUsers(Array.isArray(overview.users) ? overview.users : []);
        setDocuments(Array.isArray(overview.recentDocuments) ? overview.recentDocuments : []);
        setActiveSessions(Array.isArray(overview.activeSessions) ? overview.activeSessions : []);
      } catch (err) {
        if (cancelled) return;
        setError("Failed to load admin dashboard data");
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadOverview();

    const refreshId = window.setInterval(loadOverview, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshId);
    };
  }, []);

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
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="admin-empty">No live sessions right now.</td>
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
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
