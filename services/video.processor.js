// services/video.processor.js
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

ffmpeg.setFfmpegPath(ffmpegPath);

const isVideoMime = (mimeType) =>
  !!mimeType && mimeType.toLowerCase().startsWith('video/');

/**
 * Remuxes a video buffer so its metadata (moov atom) sits at the front
 * of the file, enabling streaming playback instead of requiring a full
 * download before it can play. Uses stream copy (-c copy) so it's fast
 * and lossless — no re-encoding happens.
 */
const processVideoForStreaming = async (buffer, mimeType) => {
  if (!isVideoMime(mimeType)) return buffer;

  const id = crypto.randomBytes(8).toString('hex');
  const inputPath = path.join(os.tmpdir(), `in-${id}`);
  const outputPath = path.join(os.tmpdir(), `out-${id}.mp4`);

  try {
    fs.writeFileSync(inputPath, buffer);

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions(['-c copy', '-movflags +faststart'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const result = fs.readFileSync(outputPath);
    console.log('[VideoProcessor] processVideoForStreaming success', {
      originalSize: buffer.length,
      processedSize: result.length,
    });
    return result;
  } catch (error) {
    console.error(
      '[VideoProcessor] processVideoForStreaming failed, uploading original buffer instead',
      error
    );
    return buffer; // fail-safe: never block an upload, just skip optimization
  } finally {
    fs.unlink(inputPath, () => {});
    fs.unlink(outputPath, () => {});
  }
};

module.exports = { processVideoForStreaming, isVideoMime };