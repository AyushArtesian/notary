// API Client for backend communication
const API_BASE_URL = 'http://localhost:5002';

console.log('[API Client] Base URL:', API_BASE_URL);

async function saveSignature(signatureData) {
  try {
    const url = `${API_BASE_URL}/api/signatures`;
    console.log('[saveSignature] Sending to:', url);
    console.log('[saveSignature] Data:', { id: signatureData.id, name: signatureData.name, userRole: signatureData.userRole });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signatureData),
    });

    console.log('[saveSignature] Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    console.log('[saveSignature] ✅ Success:', responseData.id);
    return responseData;
  } catch (error) {
    console.error('[saveSignature] ❌ Error:', error);
    throw error;
  }
}

async function fetchSignatures(userRole) {
  try {
    const url = `${API_BASE_URL}/api/signatures/${userRole}`;
    console.log('[fetchSignatures] Fetching from:', url);

    const response = await fetch(url);
    console.log('[fetchSignatures] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch signatures`);
    }

    const responseData = await response.json();
    console.log('[fetchSignatures] ✅ Got', responseData.length, 'signatures');
    return responseData;
  } catch (error) {
    console.error('[fetchSignatures] ❌ Error:', error);
    return [];
  }
}

async function deleteSignature(signatureId) {
  try {
    const url = `${API_BASE_URL}/api/signatures/${signatureId}`;
    console.log('[deleteSignature] Deleting:', url);

    const response = await fetch(url, {
      method: 'DELETE',
    });

    console.log('[deleteSignature] Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to delete signature`);
    }

    const responseData = await response.json();
    console.log('[deleteSignature] ✅ Success');
    return responseData;
  } catch (error) {
    console.error('[deleteSignature] ❌ Error:', error);
    throw error;
  }
}

export { saveSignature, fetchSignatures, deleteSignature };
