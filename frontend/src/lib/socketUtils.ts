import { io, Socket } from 'socket.io-client';
import keycloak from '../keycloak';

// Function to create an authenticated socket connection
export const createAuthenticatedSocket = async (): Promise<Socket> => {
  // Try to refresh the token if needed
  try {
    const refreshed = await keycloak.updateToken(70);
    if (refreshed) {
      console.log('Token refreshed for socket connection');
    }
  } catch (error) {
    console.error('Failed to refresh token for socket connection:', error);
    keycloak.login();
    throw new Error('Authentication failed');
  }

  // Create socket with auth token
  const socket = io('http://localhost:4000', {
    auth: {
      token: keycloak.token
    },
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000
  });

  // Add listeners for connection events
  socket.on('connect', () => {
    console.log('Connected to socket server');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  return socket;
}; 