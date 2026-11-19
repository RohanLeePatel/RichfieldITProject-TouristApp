// Web Push is an outbound request. A subscriber may only name a browser push
// service, never an arbitrary Internet host or an internal HTTPS endpoint.
const isPushEndpoint = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return false;
    return ['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname)
      || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname);
  } catch {
    return false;
  }
};

module.exports = { isPushEndpoint };
