import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "notary.ownerDocs";

const loadDocs = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveDocs = (docs) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
};

const formatDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const STATUS_COLORS = {
  Pending: { bg: "#fff3cd", color: "#856404" },
  "In Review": { bg: "#cfe2ff", color: "#0a4e9b" },
  Completed: { bg: "#d1e7dd", color: "#0f5132" },
  Rejected: { bg: "#f8d7da", color: "#842029" },
};

const ThreeDotsMenu = ({ onView, onEditStatus }) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={menuRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "20px",
          padding: "4px 8px",
          borderRadius: "6px",
          color: "#555",
          lineHeight: 1,
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f0f0f0")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
        title="Options"
      >
        ⋮
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "110%",
            background: "#fff",
            border: "1px solid #e0e0e0",
            borderRadius: "8px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: "140px",
            zIndex: 100,
            overflow: "hidden",
          }}
        >
          <button
            onClick={() => { setOpen(false); onView(); }}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            👁 View
          </button>
          <button
            onClick={() => { setOpen(false); onEditStatus(); }}
            style={menuItemStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            ✏️ Edit Status
          </button>
        </div>
      )}
    </div>
  );
};

const menuItemStyle = {
  display: "block",
  width: "100%",
  padding: "10px 16px",
  background: "#fff",
  border: "none",
  textAlign: "left",
  cursor: "pointer",
  fontSize: "14px",
  color: "#333",
  transition: "background 0.15s",
};

const EditStatusModal = ({ doc, onClose, onSave }) => {
  const [status, setStatus] = useState(doc.status || "Pending");
  const statuses = Object.keys(STATUS_COLORS);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          padding: "28px 32px",
          minWidth: "320px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px 0", fontSize: "17px", fontWeight: 700 }}>
          Edit Status
        </h3>
        <p style={{ margin: "0 0 20px 0", color: "#777", fontSize: "13px" }}>
          {doc.name}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {statuses.map((s) => (
            <label
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                cursor: "pointer",
                padding: "8px 12px",
                borderRadius: "8px",
                border: status === s ? "2px solid #4f6ef7" : "2px solid #eee",
                background: status === s ? "#f0f4ff" : "#fff",
                transition: "all 0.15s",
              }}
            >
              <input
                type="radio"
                name="status"
                value={s}
                checked={status === s}
                onChange={() => setStatus(s)}
                style={{ accentColor: "#4f6ef7" }}
              />
              <span
                style={{
                  background: STATUS_COLORS[s].bg,
                  color: STATUS_COLORS[s].color,
                  padding: "2px 10px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                {s}
              </span>
            </label>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 20px",
              border: "1px solid #ddd",
              borderRadius: "8px",
              background: "#fff",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(status)}
            style={{
              padding: "8px 20px",
              border: "none",
              borderRadius: "8px",
              background: "#4f6ef7",
              color: "#fff",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

const OwnerDashboardPage = () => {
  const [docs, setDocs] = useState(loadDocs);
  const [editingDoc, setEditingDoc] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const newDoc = {
        id: `doc-${Date.now()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadedAt: new Date().toISOString(),
        status: "Pending",
        dataUrl: ev.target.result,
      };
      const updated = [newDoc, ...docs];
      setDocs(updated);
      saveDocs(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleView = (doc) => {
    localStorage.setItem("notary.viewDoc", JSON.stringify({ id: doc.id, name: doc.name, dataUrl: doc.dataUrl }));
    navigate(`/owner?docId=${doc.id}`);
  };

  const handleEditStatus = (doc) => {
    setEditingDoc(doc);
  };

  const handleSaveStatus = (newStatus) => {
    const updated = docs.map((d) =>
      d.id === editingDoc.id ? { ...d, status: newStatus } : d
    );
    setDocs(updated);
    saveDocs(updated);
    setEditingDoc(null);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f7f8fc", fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      {/* Top Bar */}
      <div
        style={{
          background: "#fff",
          borderBottom: "1px solid #e8eaed",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#1a1a2e" }}>
            My Documents
          </h1>
          <p style={{ margin: "2px 0 0 0", fontSize: "13px", color: "#888" }}>
            Manage and track all your notarization documents
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 22px",
            background: "#4f6ef7",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(79,110,247,0.3)",
            transition: "background 0.15s, transform 0.1s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#3a58e0")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#4f6ef7")}
        >
          <span style={{ fontSize: "18px" }}>+</span>
          Upload File
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {/* Content */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px" }}>
        {docs.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 20px",
              color: "#aaa",
            }}
          >
            <div style={{ fontSize: "56px", marginBottom: "16px" }}>📄</div>
            <p style={{ fontSize: "17px", fontWeight: 500, margin: "0 0 8px 0", color: "#888" }}>
              No documents yet
            </p>
            <p style={{ fontSize: "14px", margin: 0 }}>
              Click <strong>Upload File</strong> to add your first document.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              border: "1px solid #e8eaed",
              overflow: "hidden",
              boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            }}
          >
            {/* Table Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 120px 140px 48px",
                padding: "12px 20px",
                background: "#f9fafc",
                borderBottom: "1px solid #e8eaed",
                fontSize: "12px",
                fontWeight: 700,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              <span>Document</span>
              <span>Size</span>
              <span>Uploaded</span>
              <span></span>
            </div>

            {/* Rows */}
            {docs.map((doc, idx) => {
              const statusStyle = STATUS_COLORS[doc.status] || STATUS_COLORS["Pending"];
              return (
                <div
                  key={doc.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 120px 140px 48px",
                    padding: "14px 20px",
                    alignItems: "center",
                    borderBottom: idx < docs.length - 1 ? "1px solid #f0f0f0" : "none",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Name + status */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        background: "#eef1fe",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "18px",
                        flexShrink: 0,
                      }}
                    >
                      📄
                    </div>
                    <div style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: "14px",
                          color: "#1a1a2e",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {doc.name}
                      </div>
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: "3px",
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          padding: "1px 8px",
                          borderRadius: "10px",
                          fontSize: "11px",
                          fontWeight: 600,
                        }}
                      >
                        {doc.status}
                      </span>
                    </div>
                  </div>

                  {/* Size */}
                  <span style={{ fontSize: "13px", color: "#777" }}>{formatSize(doc.size)}</span>

                  {/* Date */}
                  <span style={{ fontSize: "12px", color: "#999" }}>{formatDate(doc.uploadedAt)}</span>

                  {/* Three dots */}
                  <ThreeDotsMenu
                    onView={() => handleView(doc)}
                    onEditStatus={() => handleEditStatus(doc)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Status Modal */}
      {editingDoc && (
        <EditStatusModal
          doc={editingDoc}
          onClose={() => setEditingDoc(null)}
          onSave={handleSaveStatus}
        />
      )}
    </div>
  );
};

export default OwnerDashboardPage;
