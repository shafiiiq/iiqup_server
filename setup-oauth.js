// setup-oauth.js (run this ONCE)
const { getAuthorizationUrl, exchangeCodeForTokens } = require('./utils/service-email.otp');

async function setupOAuth() {
  try {
    // Step 1: Get authorization URL
    const authUrl = await getAuthorizationUrl();    
    // Step 2: You'll manually paste the code here
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Paste the authorization code here: ', async (code) => {
      try {
        const tokens = await exchangeCodeForTokens(code.trim());
        process.exit(0);
      } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
      }
      readline.close();
    });
    
  } catch (error) {
    console.error('❌ Setup error:', error.message);
  }
}

setupOAuth();