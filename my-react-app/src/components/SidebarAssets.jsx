import React, { useState, useEffect } from "react";
import SignaturePad from "./SignaturePad";

const SidebarAssets = ({ userRole, onAssetGenerated, showAssets = true }) => {
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [assets, setAssets] = useState([
    {
      id: "stamp-official",
      name: "Official Stamp",
      type: "stamp",
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='red' stroke-width='3'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='12' fill='red' font-weight='bold'%3ENOTARIZED%3C/text%3E%3C/svg%3E",
      user: "notary",
    },
    {
      id: "stamp-approved",
      name: "Approved Stamp",
      type: "stamp",
      image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='45' fill='none' stroke='green' stroke-width='3'/%3E%3Ctext x='50' y='55' text-anchor='middle' font-size='12' fill='green' font-weight='bold'%3EAPPROVED%3C/text%3E%3C/svg%3E",
      user: "notary",
    },
    {
      id: "signature-owner",
      name: "Owner Signature",
      type: "signature",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50'%3E%3Ctext x='10' y='35' font-family='cursive' font-size='32' fill='black'%3EOwner%3C/text%3E%3C/svg%3E",
      user: "owner",
    },
    {
      id: "signature-notary",
      name: "Notary Signature",
      type: "signature",
      image:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 50'%3E%3Ctext x='10' y='35' font-family='cursive' font-size='32' fill='blue'%3ENotary%3C/text%3E%3C/svg%3E",
      user: "notary",
    },
  ]);

  // Fetch saved signatures from backend on mount
  useEffect(() => {
    const loadSignatures = async () => {
      try {
        const url = 'http://localhost:5002/api/signatures/' + userRole;
        console.log('[SidebarAssets] Fetching signatures from:', url);
        const response = await fetch(url);
        
        if (!response.ok) {
          console.warn('[SidebarAssets] Failed to fetch signatures:', response.status);
          return;
        }

        const savedSignatures = await response.json();
        console.log('[SidebarAssets] ✅ Loaded', savedSignatures.length, 'signatures');
        
        // Add saved signatures to assets with the proper structure
        const formattedSignatures = savedSignatures.map(sig => ({
          id: sig.id,
          name: sig.name,
          type: "signature",
          image: sig.image,
          user: sig.userRole,
        }));
        setAssets(prev => [...prev, ...formattedSignatures]);
      } catch (error) {
        console.error('[SidebarAssets] Error loading signatures:', error);
      }
    };

    loadSignatures();
  }, [userRole]);

  const handleDragStart = (e, asset) => {
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        image: asset.image,
        user: asset.user,
      })
    );
  };

  const handleSignatureGenerated = async (signatureImage) => {
    const newAsset = {
      id: `signature-${userRole}-${Date.now()}`,
      name: `${userRole.charAt(0).toUpperCase() + userRole.slice(1)} Signature (${new Date().toLocaleTimeString()})`,
      type: "signature",
      image: signatureImage,
      user: userRole,
    };

    console.log("📝 Creating new asset:", newAsset.id);
    
    // Add to UI immediately for instant feedback
    setAssets(prev => [...prev, newAsset]);
    onAssetGenerated?.(newAsset);

    // Save to backend asynchronously
    try {
      console.log("💾 Saving signature to MongoDB...");
      const url = 'http://localhost:5002/api/signatures';
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: newAsset.id,
          name: newAsset.name,
          image: signatureImage,
          userRole: userRole,
        }),
      });
      
      console.log("Response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to save signature`);
      }
      
      const result = await response.json();
      console.log("✅ Signature saved to backend successfully:", result.id);
    } catch (error) {
      console.error("❌ Error saving signature to backend:", error);
      alert("Error saving signature to database. It is saved locally but may not persist on reload.");
    }
    
    setShowSignaturePad(false);
  };

  // Filter assets based on user role
  const visibleAssets = assets.filter(asset => {
    // For all users, show their own drawn signatures
    if (asset.type === "signature" && asset.user === userRole) {
      return true;
    }
    
    // For notary only, show pre-made stamps and notary-specific assets
    if (userRole === "notary") {
      return asset.user === "notary" || asset.user === "owner";
    }
    
    // For owner, only show their own assets
    return false;
  });

  return (
    <div
      className="sidebar-assets"
      style={{
        width: "220px",
        backgroundColor: "#f5f5f5",
        borderRight: "2px solid #ddd",
        padding: "15px",
        overflowY: "auto",
        height: "100vh",
      }}
    >
      <h3 style={{ marginTop: 0 }}>📦 Assets</h3>

      {/* Draw Signature Button */}
      {!showSignaturePad && (
        <button
          onClick={() => setShowSignaturePad(true)}
          style={{
            width: "100%",
            padding: "10px",
            marginBottom: "15px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ✏️ Draw Signature
        </button>
      )}

      {/* Signature Pad Modal */}
      {showSignaturePad && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
              maxWidth: "500px",
            }}
          >
            <SignaturePad onSignatureGenerated={handleSignatureGenerated} title={`Draw ${userRole} Signature`} />
            <button
              onClick={() => setShowSignaturePad(false)}
              style={{
                width: "100%",
                marginTop: "10px",
                padding: "8px",
                backgroundColor: "#f44336",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Asset List */}
      {showAssets && (
        <div>
          <h4>Draggable Assets</h4>
          {visibleAssets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => handleDragStart(e, asset)}
              style={{
                padding: "10px",
                margin: "8px 0",
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "grab",
                userSelect: "none",
                transition: "all 0.2s",
                fontSize: "12px",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#e8f4f8")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "white")}
            >
              <strong>{asset.name}</strong>
              <br />
              <small style={{ color: "#666" }}>Type: {asset.type}</small>
              <img
                src={asset.image}
                alt={asset.name}
                style={{
                  maxWidth: "100%",
                  height: "40px",
                  marginTop: "5px",
                  borderRadius: "2px",
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SidebarAssets;
