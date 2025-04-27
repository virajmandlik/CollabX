// Keycloak Diagnosis Script
const http = require('http');

console.log('======================================');
console.log('🔍 Keycloak Connectivity Diagnosis');
console.log('======================================');

// Helper function to make HTTP requests
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        return reject(new Error(`Status Code: ${res.statusCode}`));
      }
      
      const data = [];
      res.on('data', (chunk) => {
        data.push(chunk);
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(Buffer.concat(data).toString());
          resolve(parsedData);
        } catch (e) {
          resolve(Buffer.concat(data).toString());
        }
      });
    }).on('error', reject);
  });
}

// Run all checks
async function runChecks() {
  try {
    console.log('\n🔄 Checking if Keycloak is running...');
    try {
      await httpGet('http://localhost:8080');
      console.log('✅ Keycloak is running');
    } catch (error) {
      console.error('❌ Cannot connect to Keycloak:', error.message);
      console.log('Make sure docker-compose is running with docker-compose up');
      return;
    }

    console.log('\n🔄 Checking realm configuration...');
    try {
      const realmInfo = await httpGet('http://localhost:8080/realms/whiteboard-app');
      console.log('✅ Realm "whiteboard-app" exists');
      console.log(`Public key: ${realmInfo.public_key.substring(0, 20)}...`);
    } catch (error) {
      console.error('❌ Cannot access realm "whiteboard-app":', error.message);
      console.log('The realm may not be created. Check Keycloak logs');
      return;
    }

    console.log('\n🔄 Checking OpenID configuration...');
    try {
      const openidConfig = await httpGet('http://localhost:8080/realms/whiteboard-app/.well-known/openid-configuration');
      console.log('✅ OpenID configuration is available');
      console.log(`Issuer: ${openidConfig.issuer}`);
      console.log(`Token endpoint: ${openidConfig.token_endpoint}`);
    } catch (error) {
      console.error('❌ Cannot access OpenID configuration:', error.message);
      return;
    }

    console.log('\n🔄 Checking backend connectivity...');
    try {
      const backendResponse = await httpGet('http://localhost:4000/test');
      console.log('✅ Backend is running and responding');
      console.log(`Response: ${backendResponse.status} - ${backendResponse.message}`);
    } catch (error) {
      console.error('❌ Cannot connect to backend:', error.message);
      console.log('Make sure the backend service is running with docker-compose up');
      return;
    }

    console.log('\n🔄 Checking Keycloak configuration via backend...');
    try {
      const backendKeycloakConfig = await httpGet('http://localhost:4000/debug/keycloak-config');
      console.log('✅ Backend Keycloak config retrieved');
      console.log(`Server URL: ${backendKeycloakConfig.server_url}`);
      console.log(`Realm: ${backendKeycloakConfig.realm}`);
      console.log(`Client ID: ${backendKeycloakConfig.client_id}`);
    } catch (error) {
      console.error('❌ Cannot retrieve Keycloak config from backend:', error.message);
      return;
    }

    // Summary
    console.log('\n======================================');
    console.log('🎯 Diagnosis Summary');
    console.log('======================================');
    console.log('✅ Keycloak is running on http://localhost:8080');
    console.log('✅ Realm "whiteboard-app" exists');
    console.log('✅ OpenID configuration is properly configured');
    console.log('✅ Backend is running and responding');
    
    console.log('\n📝 Next Steps:');
    console.log('1. Make sure the client "whiteboard-client" is properly set up in the Keycloak admin console');
    console.log('2. Verify valid redirect URIs include http://localhost:5173/* and http://localhost:4000/*');
    console.log('3. Check that Web Origins are set to allow http://localhost:5173 and http://localhost:4000');
    console.log('4. Run your frontend with: cd frontend && npm run dev');
    console.log('5. Check browser console for any Keycloak-related errors');
    
    console.log('\n🔗 Helpful Links:');
    console.log('- Keycloak Admin Console: http://localhost:8080/admin/');
    console.log('- Keycloak Documentation: https://www.keycloak.org/documentation.html');
    console.log('======================================');
    
  } catch (error) {
    console.error('❌ Unexpected error during diagnosis:', error);
  }
}

// Run the checks
runChecks(); 