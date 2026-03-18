import io from "socket.io-client";

// Detect socket server URL from environment or API base
const getSocketUrl = () => {
  const env = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (env) {
    return env;
  }
  // Fallback to Railway production URL
  return 'https://web-production-de6d0.up.railway.app';
};

const SOCKET_SERVER_URL = getSocketUrl();

let socket = null;

try {
  socket = io(SOCKET_SERVER_URL, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  // Connection events
  socket.on("connect", () => {
    console.log("✅ Connected to server:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected from server");
  });

  socket.on("connect_error", (error) => {
    console.warn("⚠️ Socket connection error (this is normal if backend isn't running):", error.message);
  });
} catch (error) {
  console.warn("Socket.io initialization error:", error.message);
  // Create a mock socket that does nothing
  socket = {
    emit: () => {},
    on: () => {},
    off: () => {},
    id: "mock-socket",
  };
}

export default socket;
