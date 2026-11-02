const logger = require('#shared/logger/logger');
const { sendDueWakeRetries } = require('#features/notification/notification.delivery.wake.service');
const { WAKE_RETRY_SWEEP_INTERVAL_MS } = require('#features/notification/notification.constant');

let isSweeping = false;

const sweepWakeRetries = async () => {
  if (isSweeping) return;
  isSweeping = true;
  try {
    await sendDueWakeRetries();
  } catch (error) {
    logger.error(`[notification.wake.worker] sweep failed: ${error.message}`);
  } finally {
    isSweeping = false;
  }
};

setInterval(sweepWakeRetries, WAKE_RETRY_SWEEP_INTERVAL_MS);