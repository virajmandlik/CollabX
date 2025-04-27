# Keycloak Setup and Troubleshooting Guide

This guide provides information on how to set up and troubleshoot Keycloak integration with your application.

## System Overview

Our application consists of:
- **Keycloak Server**: Running on port 8080
- **Backend**: Node.js Express API running on port 4000
- **Frontend**: React application running on port 5173

## Prerequisites

- Docker and Docker Compose
- Node.js and npm
- Browser with developer tools

## Getting Started

1. Start the entire stack:
   ```bash
   docker-compose up
   ```

2. Run the frontend development server:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. Access the application at http://localhost:5173

## Testing the Setup

We've added several tools to help you diagnose issues:

### Backend Test Endpoints

- `GET http://localhost:4000/test` - Public endpoint, no authentication required
- `GET http://localhost:4000/debug/keycloak-config` - Shows Keycloak configuration
- `POST http://localhost:4000/debug/verify-token` - Verifies a JWT token (send as `{"token": "your-token"}`)

### Diagnostic Tools

1. **JS Diagnostic Script**: Run this to check connectivity to Keycloak and the backend:
   ```bash
   node keycloak-diagnosis.js
   ```

2. **Test HTML Page**: Open `frontend/src/keycloak-test.html` in your browser to test Keycloak authentication

## Common Issues and Troubleshooting

### 1. Authentication Fails with Invalid Redirect URI

**Problem**: Keycloak returns an error about invalid redirect URI.

**Solution**: 
- Access the Keycloak admin console (http://localhost:8080/admin/)
- Log in with username `admin` and password `admin`
- Go to Clients → whiteboard-client
- Check "Valid redirect URIs" - add `http://localhost:5173/*` and `http://localhost:4000/*`
- Check "Web origins" - add `http://localhost:5173` and `http://localhost:4000`
- Save changes

### 2. CORS Issues

**Problem**: Browser console shows CORS errors.

**Solution**:
- Verify the Web Origins are correctly set in Keycloak client settings
- Check that the backend is properly configured with CORS middleware
- Ensure URLs are consistent (http vs https, trailing slashes, etc.)

### 3. Token Expiration

**Problem**: Authentication works initially but fails after some time.

**Solution**:
- Check token refresh mechanism in the frontend code
- Verify that the token refresh is being triggered properly
- Adjust token lifespan in Keycloak if needed (Realm Settings → Tokens)

### 4. Client Not Found

**Problem**: Error message about client not found.

**Solution**:
- Verify that the client ID matches exactly between frontend config and Keycloak
- Check if the client is enabled in Keycloak admin console
- Confirm the realm name is correct

## Keycloak Configuration Details

Our application uses the following Keycloak configuration:

- **Realm**: whiteboard-app
- **Client ID**: whiteboard-client
- **Access Type**: public (frontend) and confidential (backend)
- **Authentication Flow**: Standard OAuth2 with PKCE for frontend

## Additional Resources

- [Keycloak Official Documentation](https://www.keycloak.org/documentation.html)
- [Keycloak JavaScript Adapter](https://www.keycloak.org/docs/latest/securing_apps/#_javascript_adapter)
- [Express Keycloak Integration](https://www.keycloak.org/docs/latest/securing_apps/#_nodejs_adapter) 