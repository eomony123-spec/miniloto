const crypto = require("node:crypto");

const SESSION_COOKIE = "warukun_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

function getPassword() {
  return process.env.WARUKUN_PASSWORD || "1234";
}

function getCookieSecret() {
  return process.env.WARUKUN_COOKIE_SECRET || `${getPassword()}-warukun-secret`;
}

function createSessionToken() {
  const expiresAt = Date.now() + SESSION_MAX_AGE * 1000;
  const payload = String(expiresAt);
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function isAuthenticated(headers = {}) {
  const cookies = parseCookies(headers.cookie || headers.Cookie || "");
  const token = cookies[SESSION_COOKIE];
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return false;
  }

  if (sign(payload) !== signature) {
    return false;
  }

  const expiresAt = Number.parseInt(payload, 10);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function buildSessionCookie() {
  return `${SESSION_COOKIE}=${createSessionToken()}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}; Secure`;
}

function buildClearedSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0; Secure`;
}

function parseCookies(cookieHeader) {
  return cookieHeader.split(";").reduce((all, pair) => {
    const [rawKey, ...rest] = pair.trim().split("=");
    if (!rawKey) {
      return all;
    }
    all[rawKey] = rest.join("=");
    return all;
  }, {});
}

function sign(value) {
  return crypto.createHmac("sha256", getCookieSecret()).update(value).digest("hex");
}

module.exports = {
  buildClearedSessionCookie,
  buildSessionCookie,
  getPassword,
  isAuthenticated,
};
