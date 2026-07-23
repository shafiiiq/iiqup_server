const { getObjectUrl, putObject, objectExists } = require('../aws/s3.aws');

// ─────────────────────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a presigned GET URL for an S3 object.
 * @param {string}  s3Key
 * @param {boolean} isLong
 * @param {boolean} isAuthSign
 * @returns {Promise<object>}
 */
const fetchPresignedURL = async (s3Key, isLong, isAuthSign = false) => {
  try {
    const exists = await objectExists(s3Key);
    if (!exists) {
      console.warn('[S3Service] fetchPresignedURL object missing', { s3Key });
      return { status: 404, ok: false, message: 'S3 object not found' };
    }

    const dataUrl = await getObjectUrl(s3Key, isLong, isAuthSign);
    console.log('[S3Service] fetchPresignedURL success', {
      s3Key,
      isLong,
      isAuthSign,
    });
    return { status: 200, ok: true, dataUrl };
  } catch (error) {
    console.error('[S3Service] fetchPresignedURL:', error);
    return {
      status: 500,
      ok: false,
      message: error.message || 'Error fetching presigned URL',
    };
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to S3 via a presigned PUT URL.
 * @param {Buffer} fileBuffer
 * @param {string} s3Key
 * @param {string} mimeType
 * @returns {Promise<object>}
 */
const uploadToS3 = async (fileBuffer, s3Key, mimeType) => {
  try {
    const uploadUrl = await putObject('upload', s3Key, mimeType);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: { 'Content-Type': mimeType },
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text().catch(() => '');
      throw new Error(
        `S3 upload failed with status: ${uploadResponse.status}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    return {
      status: 200,
      ok: true,
      message: 'File uploaded successfully',
      s3Key,
      uploadUrl,
    };
  } catch (error) {
    console.error('[S3Service] uploadToS3:', error);
    throw new Error(error.message || 'Error uploading file to S3');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

module.exports = { fetchPresignedURL, uploadToS3 };
