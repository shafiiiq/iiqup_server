const { AppError } = require('#shared/errors/error.http');
const HTTP = require('#shared/response/response.status');
const { modelRegistry, getRegistryEntry } = require('#core/registry/model.registry');
const NotificationCategory = require('./notification.category.model');

const MAX_CATEGORY_LABEL_LENGTH = 40;
const CATEGORY_SUGGESTION_LIMIT = 20;

const slugify = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const singularize = (slug) => slug.replace(/s$/, '');

const findRegistryCategory = (slug) =>
  Object.entries(modelRegistry).find(
    ([key, entry]) =>
      singularize(slugify(key)) === singularize(slug) || singularize(slugify(entry.tabLabel)) === singularize(slug)
  );

const ensureCategory = async ({ label, uniqueCode }) => {
  const trimmedLabel = String(label || '').trim();
  const slug = slugify(trimmedLabel);
  if (!slug || trimmedLabel.length > MAX_CATEGORY_LABEL_LENGTH) {
    throw new AppError('Invalid category name', HTTP.BAD_REQUEST);
  }

  const registryMatch = findRegistryCategory(slug);
  if (registryMatch) return { key: registryMatch[0], label: registryMatch[1].tabLabel };

  const category = await NotificationCategory.findOneAndUpdate(
    { key: slug },
    { $setOnInsert: { label: trimmedLabel, createdBy: uniqueCode }, $inc: { usageCount: 1 } },
    { upsert: true, new: true }
  ).lean();
  return { key: category.key, label: category.label };
};

const searchCategories = async (term) => {
  const slug = slugify(term);

  const registryCategories = Object.entries(modelRegistry)
    .filter(([key, entry]) => !slug || slugify(key).includes(slug) || slugify(entry.tabLabel).includes(slug))
    .map(([key, entry]) => ({ key, label: entry.tabLabel, isCustom: false }));

  const customFilter = { key: { $nin: Object.keys(modelRegistry), ...(slug ? { $regex: slug } : {}) } };
  const customCategories = await NotificationCategory.find(customFilter)
    .sort({ usageCount: -1 })
    .limit(CATEGORY_SUGGESTION_LIMIT)
    .lean();

  return [
    ...registryCategories,
    ...customCategories.map((category) => ({ key: category.key, label: category.label, isCustom: true })),
  ].slice(0, CATEGORY_SUGGESTION_LIMIT);
};

const resolveCategoryLabels = async (categoryKeys) => {
  const labels = new Map();
  const customKeys = [];
  categoryKeys.forEach((key) => {
    const entry = getRegistryEntry(key);
    if (entry) labels.set(key, entry.tabLabel);
    else customKeys.push(key);
  });

  if (customKeys.length > 0) {
    const customCategories = await NotificationCategory.find({ key: { $in: customKeys } }).lean();
    customCategories.forEach((category) => labels.set(category.key, category.label));
  }

  categoryKeys.forEach((key) => {
    if (!labels.has(key)) labels.set(key, key);
  });
  return labels;
};

module.exports = { ensureCategory, searchCategories, resolveCategoryLabels };