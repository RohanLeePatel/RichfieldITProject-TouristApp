// Where the AI service (FastAPI, ai-features) is, and how to read its errors.
// Every call to it goes through the versioned API (/v1), so a response shape
// can change there without the Core API breaking mid-deploy.

const base = () => (process.env.AI_FEATURES_URL || 'https://richfield-it-project-tourist-app.vercel.app').replace(/\/$/, '');

// .../v1, for every feature route
const aiApiUrl = () => `${base()}/v1`;

// The sentence to show for a failed AI call. The service sends
// { message, code, detail }; older deployments sent only detail (a string, or a
// list of validation errors), so those are still read.
function aiMessage(data, fallback) {
  if (typeof data?.message === 'string' && data.message) return data.message;
  if (Array.isArray(data?.detail)) return data.detail[0]?.msg?.replace(/^Value error, /, '') || fallback;
  return (typeof data?.detail === 'string' && data.detail) || fallback;
}

module.exports = { aiApiUrl, aiMessage };
