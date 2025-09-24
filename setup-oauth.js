// setup-oauth.js (run this ONCE)
const { getAuthorizationUrl, exchangeCodeForTokens } = require('./utils/service-email.otp');

async function setupOAuth() {
  try {
    // Step 1: Get authorization URL
    const authUrl = await getAuthorizationUrl();
    console.log('🔗 Visit this URL in your browser:');
    console.log(authUrl);
    console.log('\n📝 After authorization, you will see an authorization code on the page');
    console.log('💡 Copy the entire code and paste it below');
    
    // Step 2: You'll manually paste the code here
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Paste the authorization code here: ', async (code) => {
      try {
        const tokens = await exchangeCodeForTokens(code.trim());
        console.log('\n✅ Setup complete! Your refresh token has been displayed above.');
        console.log('Add it to your .env file as GMAIL_REFRESH_TOKEN');
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