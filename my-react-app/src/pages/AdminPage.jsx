import React from "react";

const AdminPage = () => {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f4f6fb",
      }}
    >
      <div
        style={{
          textAlign: "center",
          backgroundColor: "white",
          padding: "50px",
          borderRadius: "15px",
          boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
          maxWidth: "600px",
        }}
      >
        <h1 style={{ margin: "0 0 20px 0", color: "#333" }}>Admin Dashboard</h1>
        <p style={{ color: "#555", fontSize: "16px", marginBottom: "20px" }}>
          This is a placeholder for admin functionality. You can add management tools, user moderation, logs, and analytics here.
        </p>
        <p style={{ color: "#777", fontSize: "14px" }}>
          (Navigation and content to be implemented as needed.)
        </p>
      </div>
    </div>
  );
};

export default AdminPage;
