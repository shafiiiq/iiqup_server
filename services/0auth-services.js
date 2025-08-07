const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const { generateTokens } = require("../utils/jwt");

module.exports = {
    authRefresh: (refreshToken) => {
        return new Promise(async (resolve, reject) => {
            try {
                if (!refreshToken) {
                    return resolve({
                        status: 401,
                        success: false,
                        message: 'Refresh token is required'
                    });
                }

                // Handle cases where the token is JSON-stringified (wrapped in quotes)
                let actualToken = refreshToken;
                if (typeof refreshToken === 'string' && refreshToken.startsWith('"') && refreshToken.endsWith('"')) {
                    try {
                        actualToken = JSON.parse(refreshToken); // Remove extra quotes
                    } catch (e) {
                        console.error('Failed to parse refreshToken:', e.message);
                    }
                }

                // Trim any whitespace
                actualToken = actualToken.trim();

                // Verify the token
                const decoded = jwt.verify(actualToken, JWT_SECRET);

                // Check token type
                if (decoded.type !== 'refresh') {
                    return resolve({
                        status: 403,
                        success: false,
                        message: 'Invalid token type (must be refresh)'
                    });
                }

                // Generate new tokens
                const user = { 
                    _id: decoded.id, 
                    email: decoded.email, 
                    role: decoded.role 
                };
                const tokens = generateTokens(user);

                return resolve({
                    status: 200,
                    success: true,
                    accessToken: tokens.accessToken,
                    refreshToken: tokens.refreshToken
                });

            } catch (error) {
                console.error('Refresh token verification failed:', error.message);

                // Specific error messages for debugging
                let message = 'Invalid refresh token';
                if (error.name === 'TokenExpiredError') {
                    message = 'Refresh token expired';
                } else if (error.name === 'JsonWebTokenError') {
                    message = 'Malformed refresh token';
                }

                return resolve({
                    status: 403,
                    success: false,
                    message: message
                });
            }
        });
    },
};