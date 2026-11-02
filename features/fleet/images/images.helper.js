const PUBLIC_PREFIXES = ['public/', '/public/', 'public\\', '\\public\\'];

const normaliseImageKey = (rawPath) => {
  const prefix = PUBLIC_PREFIXES.find((p) => rawPath.startsWith(p));
  const path = prefix ? rawPath.slice(prefix.length) : rawPath;
  return path.replace(/\\/g, '/').replace(/^\/+/, '');
};

const normaliseImagePath = (rawPath) => `/${normaliseImageKey(rawPath)}`;

const normaliseImages = (images = []) =>
  [...images]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((image) => ({
      ...image,
      key: normaliseImageKey(image.path),
      url: normaliseImagePath(image.path),
    }));

const buildS3Key = (equipmentNo, fileName, index, ext) =>
  `equipment-images/${equipmentNo}/${equipmentNo}-${Date.now()}-${index}${ext}`;

module.exports = {
  normaliseImageKey,
  normaliseImagePath,
  normaliseImages,
  buildS3Key,
};
