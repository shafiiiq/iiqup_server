// server/scripts/get-gmail-auth-url.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { getAuthorizationUrl } = require('../features/fleet/mobilization/mobilization.email');

getAuthorizationUrl()
  .then((url) => {
    console.log('FULL URL:\n', url, '\n');
    console.log('REDIRECT URI:', new URL(url).searchParams.get('redirect_uri'));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });