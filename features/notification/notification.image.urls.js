const { getObjectUrl } = require('#core/s3/s3.config');

const resolveImageUrls = async (imagePaths = []) => {
  const results = await Promise.allSettled(imagePaths.map((imagePath) => getObjectUrl(imagePath, true)));
  return results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
};

module.exports = { resolveImageUrls };