// main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import WhiteboardCanvas from './components/WhiteboardCanvas';
import keycloak from './keycloak';
import { ThemeProvider } from './ThemeContext';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import './theme.css';

console.log("Keycloak config:", {
  url: keycloak.authServerUrl,
  realm: keycloak.realm,
  clientId: keycloak.clientId
});

// Initialize Keycloak with more detailed logging
keycloak.init({
  onLoad: 'login-required',
  checkLoginIframe: false,
  pkceMethod: 'S256',
  enableLogging: true // Enable detailed logging
}).then(authenticated => {
  console.log("✅ Keycloak initialized, authenticated:", authenticated);
  if (authenticated) {
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/whiteboard/:id" element={<WhiteboardCanvas />} />
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </React.StrictMode>
    );
  } else {
    console.log("Not authenticated, redirecting to login");
    keycloak.login();
  }
}).catch(err => {
  console.error("❌ Keycloak initialization failed", err);
});


