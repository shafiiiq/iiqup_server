// Session Manager - Maintains login session to avoid repeated logins
class AttendanceSessionManager {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:8081';
    this.cookieJar = new Map();
    this.lastLoginTime = null;
    this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    this.isLoggedIn = false;
  }

  // Check if session is still valid
  isSessionValid() {
    if (!this.isLoggedIn || !this.lastLoginTime) {
      return false;
    }

    const timeElapsed = Date.now() - this.lastLoginTime;
    return timeElapsed < this.sessionTimeout && this.cookieJar.size > 0;
  }

  // Parse and store cookies
  parseCookies(cookieHeader) {
    if (!cookieHeader) return;
    
    const cookieStrings = cookieHeader.split(/,(?=\s*[a-zA-Z])/);
    
    cookieStrings.forEach(cookieString => {
      const parts = cookieString.split(';');
      const [nameValue] = parts;
      
      if (nameValue && nameValue.includes('=')) {
        const [name, ...valueParts] = nameValue.split('=');
        const value = valueParts.join('=');
        
        if (name && value) {
          this.cookieJar.set(name.trim(), value.trim());
        }
      }
    });
  }

  // Build cookie string
  buildCookieString() {
    return Array.from(this.cookieJar.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  // Force CSRF cookie creation
  async forceCSRFCookie() {
    try {
      const response = await fetch(`${this.baseUrl}/login/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache'
        }
      });

      const setCookies = response.headers.get('set-cookie');
      if (setCookies) {
        this.parseCookies(setCookies);
      }

      const html = await response.text();
      
      // Extract CSRF token from HTML
      const patterns = [
        /name=["|']csrfmiddlewaretoken["|']\s+value=["|']([^"']+)["|']/,
        /value=["|']([^"']+)["|']\s+name=["|']csrfmiddlewaretoken["|']/,
        /<input[^>]*name=["|']csrfmiddlewaretoken["|'][^>]*value=["|']([^"']+)["|']/
      ];

      let csrfToken = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          csrfToken = match[1];
          break;
        }
      }

      if (!this.cookieJar.has('csrftoken') && csrfToken) {
        this.cookieJar.set('csrftoken', csrfToken);
      }

      return {
        csrfToken,
        csrfCookie: this.cookieJar.get('csrftoken')
      };

    } catch (error) {
      console.error('Error forcing CSRF cookie:', error);
      return null;
    }
  }

  // Login and maintain session
  async login(username, password) {
    try {
      const sessionData = await this.forceCSRFCookie();
      if (!sessionData || !sessionData.csrfToken) {
        throw new Error('Could not obtain CSRF token');
      }

      const formData = new URLSearchParams();
      formData.append('csrfmiddlewaretoken', sessionData.csrfToken);
      formData.append('username', username);
      formData.append('password', password);
      formData.append('captcha', '');
      formData.append('template10', '');
      formData.append('login_type', 'pwd');

      const cookieString = this.buildCookieString();
      const response = await fetch(`${this.baseUrl}/login/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-CSRFToken': sessionData.csrfCookie,
          'Cookie': cookieString,
          'Referer': `${this.baseUrl}/login/`,
          'Origin': this.baseUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: formData,
        redirect: 'manual'
      });

      const newCookies = response.headers.get('set-cookie');
      if (newCookies) {
        this.parseCookies(newCookies);
      }

      if (response.status === 302 || response.status === 301 || response.ok) {
        this.isLoggedIn = true;
        this.lastLoginTime = Date.now();
        console.log('✅ Login successful and session established');
        return { success: true };
      }

      return { success: false, error: 'Login failed' };

    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get attendance data with session management
  async getAttendanceData() {
    try {
      // Check if we need to login
      if (!this.isSessionValid()) {
        console.log('🔄 Session expired or invalid, logging in...');
        const loginResult = await this.login(
          process.env.ATTENDANCE_SYSTEM_UNAME, 
          process.env.ATTENDANCE_SYSTEM_PASS
        );
        
        if (!loginResult.success) {
          throw new Error('Failed to login: ' + loginResult.error);
        }
      }

      const cookieString = this.buildCookieString();
      const response = await fetch(`${this.baseUrl}/base/dashboard_transaction/`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cookie': cookieString,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': `${this.baseUrl}/login/`
        }
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          // Session expired, try to login again
          this.isLoggedIn = false;
          return await this.getAttendanceData(); // Recursive call
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const content = await response.text();
      
      // Check if we got redirected to login page
      if (content.includes('SIGN IN TO YOUR ACCOUNT')) {
        this.isLoggedIn = false;
        return await this.getAttendanceData(); // Recursive call
      }

      // Parse JSON response
      const data = JSON.parse(content);
      return {
        success: true,
        data: data.data || [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error getting attendance data:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Reset session
  resetSession() {
    this.cookieJar.clear();
    this.lastLoginTime = null;
    this.isLoggedIn = false;
  }
}

module.exports = AttendanceSessionManager;