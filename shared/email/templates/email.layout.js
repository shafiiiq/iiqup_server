// shared/templates/email.layout.js
const { loadImageAsBase64 } = require('../helpers/email.helper');

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SOCIAL_LINKS = {
  facebook: 'https://www.facebook.com/profile.php?id=100095544335543',
  instagram: 'https://www.instagram.com/al_ansari_transport',
  linkedin:
    'https://www.linkedin.com/in/al-ansari-transport-and-enterprises-455b53253/',
};

// ─────────────────────────────────────────────────────────────────────────────
// Logo + Social Icons Block (identical across all templates)
// ─────────────────────────────────────────────────────────────────────────────

const buildSignatureBlock = () => {
  const signatureLogo = loadImageAsBase64('signature-logo.png');
  const sigLogo = loadImageAsBase64('sig-logo.png');
  const sigFacebook = loadImageAsBase64('sig-facebook.png');
  const sigInstagram = loadImageAsBase64('sig-instagram.png');
  const sigLinkedin = loadImageAsBase64('sig-linkedin.png');

  return `
    ${signatureLogo ? `<img src="${signatureLogo}" width="200" style="display:block;" alt="Signature" />` : ''}

    <table cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;">
      <tr>
        <td style="padding-right:8px;">${sigLogo ? `<img src="${sigLogo}" width="72" height="32" alt="Logo" />` : ''}</td>
        <td style="padding-right:8px;">${sigFacebook ? `<a href="${SOCIAL_LINKS.facebook}" target="_blank"><img src="${sigFacebook}" width="27" height="27" alt="Facebook" /></a>` : ''}</td>
        <td style="padding-right:8px;">${sigInstagram ? `<a href="${SOCIAL_LINKS.instagram}" target="_blank"><img src="${sigInstagram}" width="27" height="27" alt="Instagram" /></a>` : ''}</td>
        <td>${sigLinkedin ? `<a href="${SOCIAL_LINKS.linkedin}" target="_blank"><img src="${sigLinkedin}" width="27" height="27" alt="LinkedIn" /></a>` : ''}</td>
      </tr>
    </table>
  `;
};

// ─────────────────────────────────────────────────────────────────────────────
// Sign-off Block (name/title/mobile differ per sender)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {{name:string, title:string, mobile:string, fontColor?:string, companyColor?:string}} opts
 */
const buildSignOff = ({
  name,
  title,
  mobile,
  fontColor = '#666',
  companyColor = '#444',
}) => `
  <p>
    Thanks &amp; Regards,<br/><br/>
    <strong style="font-family:tahoma,sans-serif;color:${fontColor};">${name}</strong><br/>
    <span style="font-family:tahoma,sans-serif;color:${fontColor};">${title}</span><br/>
    <span style="font-family:tahoma,sans-serif;color:${fontColor};">Mob: ${mobile}</span><br/><br/>
    <strong style="font-family:tahoma,sans-serif;color:${companyColor};font-size:18px;">AL ANSARI TRANSPORT &amp; ENTERPRISES W.L.L</strong><br/>
    <span style="font-family:tahoma,sans-serif;color:#444;">T +974 44505 700/800 | F +974 44505 900 | P.O BOX: 1265 | Doha, Qatar</span><br/>
    <a href="http://www.ansarigroup.co">www.ansarigroup.co</a>
  </p>
`;

// ─────────────────────────────────────────────────────────────────────────────
// Full Footer = Sign-off + Signature Block
// ─────────────────────────────────────────────────────────────────────────────

const buildEmailFooter = (signOffOptions) => `
  <br/>
  ${buildSignOff(signOffOptions)}
  ${buildSignatureBlock()}
`;

module.exports = { buildEmailFooter, buildSignatureBlock, buildSignOff };