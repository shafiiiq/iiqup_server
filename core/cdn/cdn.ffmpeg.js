const { spawn } = require('child_process')
const fs = require('fs/promises')
const path = require('path')
const ffmpegPath = require('ffmpeg-static')
const ffmpeg = require('fluent-ffmpeg')
const {
  CHUNK_SECONDS,
  RENDITION_INDEX_FILE_NAME,
  RENDITION_VIDEO_FILE_NAME,
  THUMBNAIL_WIDTH,
  LUMINANCE_SAMPLES_PER_SECOND,
  LUMINANCE_REGION,
} = require('./cdn.config')

ffmpeg.setFfmpegPath(ffmpegPath)

const runFfmpegCommand = (command) =>
  new Promise((resolve, reject) => {
    command.on('end', resolve).on('error', reject).run()
  })

const probeVideo = (inputPath) =>
  new Promise((resolve, reject) => {
    const probeProcess = spawn(ffmpegPath, ['-hide_banner', '-i', inputPath])
    let diagnosticOutput = ''

    probeProcess.stderr.on('data', (data) => {
      diagnosticOutput += data.toString()
    })
    probeProcess.on('error', reject)
    probeProcess.on('close', () => {
      const durationMatch = diagnosticOutput.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/)
      const videoLine = diagnosticOutput.split('\n').find((line) => /Stream #.*Video:/.test(line))
      const dimensionMatch = videoLine ? videoLine.match(/[,\s](\d{2,5})x(\d{2,5})[,\s[]/) : null

      if (!durationMatch || !dimensionMatch) {
        reject(new Error('Unable to read video metadata'))
        return
      }

      const durationSeconds =
        Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3])

      resolve({
        durationSeconds,
        width: Number(dimensionMatch[1]),
        height: Number(dimensionMatch[2]),
        hasAudio: /Stream #.*Audio:/.test(diagnosticOutput),
      })
    })
  })

const splitIntoChunks = async (inputPath, outputDirectory) => {
  const outputPattern = path.join(outputDirectory, 'chunk-%06d.mp4')

  await runFfmpegCommand(
    ffmpeg(inputPath)
      .outputOptions([
        '-map', '0:v:0',
        '-map', '0:a:0?',
        '-sn',
        '-c', 'copy',
        '-f', 'segment',
        '-segment_time', String(CHUNK_SECONDS),
        '-reset_timestamps', '1',
        '-segment_format', 'mp4',
        '-segment_format_options', 'movflags=+faststart',
      ])
      .output(outputPattern)
  )

  const fileNames = (await fs.readdir(outputDirectory)).filter((fileName) => fileName.endsWith('.mp4'))
  return fileNames.sort().map((fileName) => path.join(outputDirectory, fileName))
}

const buildScaleFilter = (targetHeight) =>
  `scale=w='if(gt(iw,ih),-2,${targetHeight})':h='if(gt(iw,ih),${targetHeight},-2)'`

const transcodeChunk = (inputPath, outputPath, rendition, hasAudio) => {
  const audioOptions = hasAudio
    ? [
        '-map', '0:a:0?',
        '-c:a', 'aac',
        '-b:a', rendition.audioBitrate,
        '-ac', '2',
        '-af', 'aresample=async=1:first_pts=0,apad',
        '-shortest',
      ]
    : ['-an']

  return runFfmpegCommand(
    ffmpeg(inputPath)
      .outputOptions([
        '-map', '0:v:0',
        ...audioOptions,
        '-sn',
        '-vf', `${buildScaleFilter(rendition.height)},fps=30`,
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-profile:v', 'high',
        '-pix_fmt', 'yuv420p',
        '-b:v', rendition.videoBitrate,
        '-maxrate', rendition.maxRate,
        '-bufsize', rendition.bufferSize,
        '-sc_threshold', '0',
        '-bf', '0',
        '-g', '150',
        '-keyint_min', '150',
        '-force_key_frames', '0',
        '-use_editlist', '0',
        '-movflags', '+faststart',
      ])
      .output(outputPath)
  )
}

const combineChunksIntoIndexedFile = async (chunkPaths, outputDirectory) => {
  const concatListPath = path.join(outputDirectory, 'concat-list.txt')
  const videoPath = path.join(outputDirectory, RENDITION_VIDEO_FILE_NAME)
  const indexPath = path.join(outputDirectory, RENDITION_INDEX_FILE_NAME)

  await fs.writeFile(concatListPath, chunkPaths.map((chunkPath) => `file '${chunkPath}'`).join('\n'))

  await runFfmpegCommand(
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0', '-fflags', '+genpts'])
      .outputOptions([
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-af', 'aresample=async=1:first_pts=0',
        '-movflags', '+faststart',
      ])
      .output(videoPath)
  )

  return { videoPath, indexPath: videoPath }
}

const extractThumbnail = (inputPath, outputPath, seekSeconds) =>
  runFfmpegCommand(
    ffmpeg(inputPath)
      .seekInput(seekSeconds)
      .outputOptions([
        '-frames:v', '1',
        '-vf', `scale=${THUMBNAIL_WIDTH}:-2`,
        '-q:v', '4',
      ])
      .output(outputPath)
  )

const sampleRegionLuminance = (inputPath) =>
  new Promise((resolve, reject) => {
    const cropFilter = `crop=iw*${LUMINANCE_REGION.width}:ih*${LUMINANCE_REGION.height}:iw*${LUMINANCE_REGION.x}:ih*${LUMINANCE_REGION.y}`
    const samplingProcess = spawn(ffmpegPath, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', inputPath,
      '-an',
      '-vf', `fps=${LUMINANCE_SAMPLES_PER_SECOND},${cropFilter},scale=1:1:flags=area,format=gray`,
      '-f', 'rawvideo',
      '-',
    ])
    const outputChunks = []

    samplingProcess.stdout.on('data', (data) => outputChunks.push(data))
    samplingProcess.on('error', reject)
    samplingProcess.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error('Unable to sample video luminance'))
        return
      }
      resolve(Array.from(Buffer.concat(outputChunks)))
    })
  })

module.exports = {
  sampleRegionLuminance,
  extractThumbnail,
  probeVideo,
  splitIntoChunks,
  transcodeChunk,
  combineChunksIntoIndexedFile,
}