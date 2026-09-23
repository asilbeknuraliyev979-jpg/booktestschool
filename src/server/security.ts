import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// Secure Credentials
const ADMIN_USERNAME = 'aistudio';
const ADMIN_PASSWORD = 'salom7852qaz';

// Session lifetime: 8 hours
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Maximum failed login attempts before 15-minute lock
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface SessionData {
  username: string;
  ip: string;
  expiresAt: number;
}

interface LoginAttemptRecord {
  count: number;
  lockedUntil: number;
}

// In-memory token storage (survives requests, auto-prunes)
const activeSessions = new Map<string, SessionData>();
const loginAttempts = new Map<string, LoginAttemptRecord>();

// Cleanup expired sessions every 15 minutes (unref'd to prevent blocking serverless lifecycle)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (session.expiresAt <= now) {
      activeSessions.delete(token);
    }
  }
  for (const [ip, attempt] of loginAttempts.entries()) {
    if (attempt.lockedUntil <= now && attempt.count >= MAX_LOGIN_ATTEMPTS) {
      loginAttempts.delete(ip);
    }
  }
}, 15 * 60 * 1000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Constant-time string comparison using SHA-256 digests
 * Completely protects against timing analysis attacks.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  try {
    const hashA = crypto.createHash('sha256').update(String(a)).digest();
    const hashB = crypto.createHash('sha256').update(String(b)).digest();
    return crypto.timingSafeEqual(hashA, hashB);
  } catch {
    return false;
  }
}

/**
 * Get Client IP address safely
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown-ip';
}

/**
 * Check if an IP is currently locked out due to excessive failed logins
 */
export function checkLoginBruteForce(ip: string): { isLocked: boolean; remainingSeconds: number; remainingAttempts: number } {
  const record = loginAttempts.get(ip);
  const now = Date.now();

  if (!record) {
    return { isLocked: false, remainingSeconds: 0, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  if (record.lockedUntil > now) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds, remainingAttempts: 0 };
  }

  // If lock expired, reset
  if (record.lockedUntil <= now && record.count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts.delete(ip);
    return { isLocked: false, remainingSeconds: 0, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  const remainingAttempts = Math.max(0, MAX_LOGIN_ATTEMPTS - record.count);
  return { isLocked: false, remainingSeconds: 0, remainingAttempts };
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(ip: string): { isNowLocked: boolean; remainingAttempts: number; lockoutSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };

  record.count += 1;

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    loginAttempts.set(ip, record);
    return {
      isNowLocked: true,
      remainingAttempts: 0,
      lockoutSeconds: Math.ceil(LOCKOUT_DURATION_MS / 1000),
    };
  }

  loginAttempts.set(ip, record);
  return {
    isNowLocked: false,
    remainingAttempts: MAX_LOGIN_ATTEMPTS - record.count,
    lockoutSeconds: 0,
  };
}

/**
 * Reset failed attempts upon successful login
 */
export function resetFailedLogins(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Authenticate credentials and issue a cryptographically random session token
 */
export function authenticateAdmin(
  usernameInput: string,
  passwordInput: string,
  clientIp: string
): { success: boolean; token?: string; error?: string; remainingAttempts?: number; lockedSeconds?: number } {
  const bruteForce = checkLoginBruteForce(clientIp);
  if (bruteForce.isLocked) {
    return {
      success: false,
      error: `Xavfsizlik blokirovkasi! Juda ko'p muvaffaqiyatsiz urinishlar aniqlandi. Iltimos ${bruteForce.remainingSeconds} soniyadan so'ng qayta urinib ko'ring.`,
      lockedSeconds: bruteForce.remainingSeconds,
      remainingAttempts: 0,
    };
  }

  const isUserValid = timingSafeCompare(usernameInput.trim(), ADMIN_USERNAME);
  const isPassValid = timingSafeCompare(passwordInput.trim(), ADMIN_PASSWORD);

  if (!isUserValid || !isPassValid) {
    const failedInfo = recordFailedLogin(clientIp);
    if (failedInfo.isNowLocked) {
      return {
        success: false,
        error: `Xavfsizlik tizimi: ketma-ket ${MAX_LOGIN_ATTEMPTS} ta xato kiritildi. Tizim 15 daqiqaga bloklandi.`,
        lockedSeconds: failedInfo.lockoutSeconds,
        remainingAttempts: 0,
      };
    }
    return {
      success: false,
      error: `Login yoki parol noto'g'ri! Qolgan urinishlar: ${failedInfo.remainingAttempts} ta.`,
      remainingAttempts: failedInfo.remainingAttempts,
    };
  }

  // Clear failed attempts
  resetFailedLogins(clientIp);

  // Generate 256-bit cryptographically secure token
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, {
    username: ADMIN_USERNAME,
    ip: clientIp,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return { success: true, token };
}

/**
 * Verify whether an admin session token is valid and active
 */
export function verifySessionToken(token: string | undefined): boolean {
  if (!token || typeof token !== 'string') return false;
  const session = activeSessions.get(token);
  if (!session) return false;

  if (session.expiresAt <= Date.now()) {
    activeSessions.delete(token);
    return false;
  }

  return true;
}

/**
 * Invalidate/Logout a session token
 */
export function revokeSessionToken(token: string | undefined): void {
  if (token && activeSessions.has(token)) {
    activeSessions.delete(token);
  }
}

/**
 * Express Middleware: Require Valid Admin Authentication
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: "Ruxsat berilmadi: Ushbu amal uchun admin autentifikatsiyasi (Token) talab qilinadi.",
    });
  }

  const token = authHeader.slice(7).trim();
  if (!verifySessionToken(token)) {
    return res.status(401).json({
      error: "Sessiya eskirgan yoki bekor qilingan. Iltimos, /admin orqali qayta kiring.",
    });
  }

  return next();
}

/**
 * Express Middleware: Security Headers (Helmet-style)
 */
export function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

/**
 * General In-Memory Sliding Rate Limiter Middleware
 */
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = getClientIp(req);
    const key = `${ip}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + options.windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 1;
      bucket.resetAt = now + options.windowMs;
    } else {
      bucket.count += 1;
    }

    buckets.set(key, bucket);

    if (bucket.count > options.max) {
      const waitSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      return res.status(429).json({
        error: options.message || `So'rovlar limiti oshib ketdi. Iltimos ${waitSeconds} soniyadan so'ng urinib ko'ring.`,
        retryAfter: waitSeconds,
      });
    }

    next();
  };
}

/**
 * Sanitize string inputs to neutralize XSS and script injections
 */
export function sanitizeInput(input: unknown, maxLength = 5000): string {
  if (typeof input !== 'string') return '';
  return input
    .slice(0, maxLength)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}
