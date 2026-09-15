export const OTPTemplate = (otp, username = 'Valued Customer') => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Al Ansari - Your OTP Code</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
      body          { font-family:'Roboto',Arial,sans-serif; line-height:1.6; margin:0; padding:0; background-color:#f7f7f7; }
      .container    { max-width:600px; margin:20px auto; border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
      .content      { padding:30px; background-color:#ffffff; }
      .greeting     { font-size:22px; font-weight:500; margin-bottom:15px; color:#1a4e8e; }
      .otp-container{ margin:30px 0; padding:20px; background:linear-gradient(to right,#f9f9f9,#f3f3f3); border-radius:8px; text-align:center; border-left:4px solid #1a4e8e; }
      .otp-code     { font-size:32px; font-weight:700; letter-spacing:8px; color:#1a4e8e; padding:10px 0; }
      .timer        { display:inline-block; margin-top:10px; padding:5px 15px; background-color:#ffe8e8; color:#d83030; border-radius:15px; font-size:14px; }
      .warning      { margin-top:25px; padding:15px; background-color:#fff8e6; border-left:4px solid #ffc107; border-radius:4px; }
      .footer       { padding:20px; text-align:center; font-size:13px; color:#777777; background-color:#fafafa; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="content">
        <div class="greeting">Hello, ${username}!</div>
        <p>Your One-Time Password for secure authentication:</p>
        <div class="otp-container">
          <div class="otp-code">${otp}</div>
          <div class="timer">Expires in 5 minutes</div>
        </div>
        <div class="warning">
          <strong>Security Notice:</strong> Never share this OTP with anyone.
        </div>
      </div>
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} Al Ansari. All rights reserved.</p>
      </div>
    </div>
  </body>
  </html>
`;