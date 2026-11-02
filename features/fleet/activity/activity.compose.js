const { ACTIVITY_SOURCES } = require('./activity.constant');
const { formatTimeLabel } = require('./activity.format');

const resolveThumbnail = (source, record, imageMap, operatorMap) => {
  const equipmentImage = imageMap[record.regNo]?.[0];
  if (equipmentImage) return { thumbnailKind: 'equipment', thumbnailPath: equipmentImage.path };

  const operator = source === ACTIVITY_SOURCES.OPERATOR ? operatorMap[String(record.operatorId)] : null;
  const profilePicturePath = operator?.profilePic?.filePath;
  if (profilePicturePath) return { thumbnailKind: 'operator', thumbnailPath: profilePicturePath };

  return { thumbnailKind: null, thumbnailPath: null };
};

const resolveOwnershipLabel = (record, equipmentMap) => {
  const equipment = equipmentMap[record.regNo];
  const isHired = equipment ? equipment.hired : record.hired;
  const hiredFrom = equipment ? equipment.hiredFrom : record.hiredFrom;

  if (isHired) return ['Hired', hiredFrom].filter(Boolean).join(' - ');
  return equipment?.company || '';
};

const buildFeedItem = ({ source, record, content, imageMap, operatorMap, equipmentMap }) => ({
  id: String(record._id),
  source,
  date: record.date,
  time: formatTimeLabel(record.time),
  regNo: record.regNo || '',
  machine: record.machine || '',
  ownershipLabel: resolveOwnershipLabel(record, equipmentMap),
  operatorNames: content.operatorNames,
  subject: content.subject,
  preview: content.intro,
  ...resolveThumbnail(source, record, imageMap, operatorMap),
});

const buildDetailImages = (content, imageMap) =>
  [...new Set(content.regNos.filter(Boolean))].flatMap((regNo) =>
    (imageMap[regNo] || []).map((image) => ({ regNo, path: image.path }))
  );

const buildDetail = ({ source, record, content, imageMap, operatorMap, equipmentMap }) => ({
  ...buildFeedItem({ source, record, content, imageMap, operatorMap, equipmentMap }),
  intro: content.intro,
  sections: content.sections,
  images: buildDetailImages(content, imageMap),
});

module.exports = { buildFeedItem, buildDetail };