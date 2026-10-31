// Field checks shared by the forms. Each returns "" when the value is fine,
// otherwise the sentence to show next to the field. The backend repeats the
// ones that guard stored data (authService.js, travelGroupController.js).

export const MAX_EMAIL = 254;
export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72; // bcrypt ignores everything after 72 bytes

// stricter than type="email", which lets "a@b" through
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// a person's name: letters from any language, then spaces . ' - between them
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u;

const sentence = (text) => `${text[0].toUpperCase()}${text.slice(1)}`;

// label reads in a sentence: "your full name", "the member's name"
export function nameError(value, label = "the name", { max = 80, required = true } = {}) {
  const name = String(value ?? "").trim();
  if (!name) return required ? `Enter ${label}.` : "";
  if (name.length < 2) return `${sentence(label)} must be at least 2 characters.`;
  if (name.length > max) return `${sentence(label)} can't be longer than ${max} characters.`;
  if (!NAME_PATTERN.test(name)) {
    return `${sentence(label)} can only use letters, spaces, hyphens, apostrophes and full stops - no numbers or symbols.`;
  }
  return "";
}

// free text such as a group name: any characters, but no markup or control codes
export function labelError(value, label = "the name", { min = 2, max = 60, required = true } = {}) {
  const text = String(value ?? "").trim();
  if (!text) return required ? `Enter ${label}.` : "";
  if (text.length < min) return `${sentence(label)} must be at least ${min} characters.`;
  if (text.length > max) return `${sentence(label)} can't be longer than ${max} characters.`;
  // eslint-disable-next-line no-control-regex -- control characters are exactly what this rejects
  if (/[<>\u0000-\u001f]/.test(text)) return `${sentence(label)} can't contain < or > or control characters.`;
  return "";
}

export function emailError(value, { required = true } = {}) {
  const email = String(value ?? "").trim();
  if (!email) return required ? "Enter your email address." : "";
  if (email.length > MAX_EMAIL) return `The email address can't be longer than ${MAX_EMAIL} characters.`;
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address, like name@example.com.";
  return "";
}

export function passwordError(value, label = "password") {
  const password = String(value ?? "");
  if (!password) return `Enter a ${label}.`;
  if (password.length < MIN_PASSWORD) return `The ${label} must be at least ${MIN_PASSWORD} characters.`;
  if (password.length > MAX_PASSWORD) return `The ${label} can't be longer than ${MAX_PASSWORD} characters.`;
  if (!password.trim()) return `The ${label} can't be only spaces.`;
  return "";
}
