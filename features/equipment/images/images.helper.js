const PUBLIC_PREFIXES = ['public/', '/public/', 'public\\', '\\public\\'];

const normaliseImagePath = (rawPath) => {
  const prefix = PUBLIC_PREFIXES.find((p) => rawPath.startsWith(p));
  const path = prefix ? rawPath.slice(prefix.length) : rawPath;
  return `/${path.replace(/\\/g, '/')}`;
};

const normaliseImages = (images = []) =>
  images.map((image) => ({ ...image, url: normaliseImagePath(image.path) }));

const buildS3Key = (equipmentNo, fileName, index, ext) =>
  `equipment-images/${equipmentNo}/${equipmentNo}-${Date.now()}-${index}${ext}`;

module.exports = {
  normaliseImagePath,
  normaliseImages,
  buildS3Key,
};
