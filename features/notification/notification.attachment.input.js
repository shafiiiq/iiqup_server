const normalizeAttachmentInputs = (attachments = []) =>
  attachments
    .filter((attachment) => attachment?.filePath)
    .map((attachment) => ({
      filePath: attachment.filePath,
      fileName: attachment.fileName || '',
      mimeType: attachment.mimeType || '',
    }));

module.exports = { normalizeAttachmentInputs };