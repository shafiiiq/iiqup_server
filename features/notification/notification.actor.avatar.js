const logger = require('#shared/logger/logger');
const { resolveOptionalSignedUrl } = require('#core/s3/s3.signed.url');

const LETTER_AVATAR_ENDPOINT = 'https://ui-avatars.com/api/';
const LETTER_AVATAR_SIZE = '256';
const LETTER_AVATAR_BACKGROUND = '3443b6';
const LETTER_AVATAR_TEXT_COLOR = 'ffffff';
const FALLBACK_INITIAL = '?';

const readInitial = (name) => {
  const [firstCharacter] = Array.from(String(name || '').trim());
  return firstCharacter ? firstCharacter.toUpperCase() : FALLBACK_INITIAL;
};

const buildLetterAvatarUrl = (name) => {
  const query = new URLSearchParams({
    name: readInitial(name),
    size: LETTER_AVATAR_SIZE,
    format: 'png',
    bold: 'true',
    background: LETTER_AVATAR_BACKGROUND,
    color: LETTER_AVATAR_TEXT_COLOR,
  });
  return `${LETTER_AVATAR_ENDPOINT}?${query.toString()}`;
};

const resolveActorAvatarUrl = async (actor) => {
  if (!actor) return null;
  if (actor.profilePicPath) {
    try {
      const signedUrl = await resolveOptionalSignedUrl(actor.profilePicPath);
      if (signedUrl) return signedUrl;
    } catch (error) {
      logger.warn(`[notification.actor.avatar] signed url failed: ${error.message}`);
    }
  }
  return buildLetterAvatarUrl(actor.name);
};

module.exports = { resolveActorAvatarUrl };