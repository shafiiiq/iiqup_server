function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUniqueCode(name, qatarId) {
  const namePart = name.substring(0, 3).toUpperCase();
  const idPart = qatarId.substring(0, 3).toUpperCase();
  const randomPart = generateRandomString(5);
  
  return `ATE-${namePart}-${idPart}-${randomPart}`;
}

module.exports = { generateUniqueCode };