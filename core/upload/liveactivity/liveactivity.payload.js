const { END_DISMISSAL_SECONDS, LIVE_ACTIVITY_LOGO_NAME } = require('./liveactivity.config')

const getCurrentSeconds = () => Math.floor(Date.now() / 1000)

const buildContentState = ({ liveActivity, progress, event }) => ({
  title: liveActivity.displayName,
  subtitle:
    event === 'end'
      ? 'Upload complete'
      : `Item ${liveActivity.itemNumber} / ${liveActivity.itemCount} · ${Math.round(progress * 100)}%`,
  progress,
  imageName: LIVE_ACTIVITY_LOGO_NAME,
  dynamicIslandImageName: LIVE_ACTIVITY_LOGO_NAME,
})

const buildLiveActivityPayload = ({ liveActivity, progress, event }) => {
  const aps = {
    timestamp: getCurrentSeconds(),
    event,
    'content-state': buildContentState({ liveActivity, progress, event }),
  }
  if (event === 'end') aps['dismissal-date'] = getCurrentSeconds() + END_DISMISSAL_SECONDS
  return { aps }
}

module.exports = {
  buildLiveActivityPayload,
}