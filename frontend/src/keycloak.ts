import Keycloak from 'keycloak-js';

// Determine the current host
const currentHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? 'localhost' 
  : window.location.hostname;

// Initialize Keycloak
const keycloak = new Keycloak({
  url: `http://${currentHost}:8080`,
  realm: 'whiteboard-app',
  clientId: 'whiteboard-client'
});

// Log some helpful debug information
console.log("[Keycloak] Configuration initialized with:", {
  keycloakUrl: `http://${currentHost}:8080`,
  realm: 'whiteboard-app',
  clientId: 'whiteboard-client'
});

// Setup token refresh
keycloak.onTokenExpired = () => {
  console.log('[Keycloak] Token expired, refreshing...');
  keycloak.updateToken(30).then((refreshed) => {
    if (refreshed) {
      console.log('[Keycloak] Token refreshed successfully');
    } else {
      console.log('[Keycloak] Token not refreshed, still valid');
    }
  }).catch(error => {
    console.error('[Keycloak] Failed to refresh token', error);
    keycloak.login();
  });
};

export default keycloak;
