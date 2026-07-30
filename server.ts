import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import helmet from "helmet";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import twilio from "twilio";
import dotenv from "dotenv";
import { initializeApp as initClientApp } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs
} from "firebase/firestore";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

dotenv.config();

// Server Secret for HMAC JWT Session Signing (Uses default dev key if process.env.SERVER_SECRET is undefined)
const SERVER_SECRET = process.env.SERVER_SECRET || "crm-default-dev-secret-key-2026-fallback";
if (!process.env.SERVER_SECRET) {
  console.warn("[Server] SERVER_SECRET environment variable is not set. Using fallback development secret.");
}

// -----------------------------------------------------------------------------
// FIREBASE SERVER-SIDE INITIALIZATION (ADMIN SDK + CLIENT SDK FALLBACK)
// -----------------------------------------------------------------------------
let adminDb: any = null;
let clientDb: any = null;

try {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  let projectId: string | undefined = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID;

  if (fs.existsSync(firebaseConfigPath)) {
    const configData = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
    projectId = projectId || configData.projectId;

    // Initialize JS Client SDK instance as secondary fallback
    const clientApp = initClientApp(configData);
    clientDb = getClientFirestore(clientApp);
  }

  // Initialize Firebase Admin SDK
  if (!getAdminApps().length) {
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    // Properly format escaped newlines in private key for cloud environments like Render
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
      ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
      : undefined;

    if (clientEmail && privateKey) {
      initAdminApp({
        credential: cert({
          projectId: projectId || 'crm-portal-3aa6b',
          clientEmail,
          privateKey,
        }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://crm-portal-3aa6b-default-rtdb.firebaseio.com"
      });
      console.log('[Server] Firebase Admin SDK authenticated via Service Account credentials.');
    } else {
      initAdminApp({
        projectId: projectId || 'crm-portal-3aa6b'
      });
      console.warn('[Server] Firebase Admin SDK initialized without service account keys. Backend operations may fall back to in-memory mode.');
    }
  }
  adminDb = getAdminFirestore();
  console.log('[Server] Firebase Admin SDK successfully initialized.');
} catch (e) {
  console.warn("[Server] Firebase Admin SDK initialization notice (using Client SDK fallback):", e);
}

// Universal database helper wrappers with timeout for robust server persistence
let adminDbAvailable = true;
let clientDbAvailable = true;

function handleFirestoreError(sdk: 'admin' | 'client', action: string, path: string, err: any) {
  const errMsg = String(err?.message || err);
  const isNotFound = errMsg.includes('5 NOT_FOUND') || errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist');

  if (isNotFound) {
    if (sdk === 'admin' && adminDbAvailable) {
      adminDbAvailable = false;
      console.warn(`[Firestore] Admin SDK disabled (Firestore database not provisioned in project). Using in-memory mode.`);
    } else if (sdk === 'client' && clientDbAvailable) {
      clientDbAvailable = false;
      console.warn(`[Firestore] Client SDK disabled (Firestore database not provisioned in project). Using in-memory mode.`);
    }
  } else {
    console.warn(`[Firestore] ${sdk === 'admin' ? 'Admin' : 'Client'} SDK ${action} failed for ${path}:`, errMsg);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number = 2000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Firestore operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

const inMemoryCredentialsMap = new Map<string, ServerAgentCredential>();

function populateDefaultInMemoryCredentials() {
  const adminCreds = createCredentialHash('AdminSecure2026!');
  const adminDoc: ServerAgentCredential = {
    agentId: 'admin',
    name: 'Administrator',
    passwordHash: adminCreds.passwordHash,
    salt: adminCreds.salt,
    role: 'ADMIN',
    failedLoginAttempts: 0,
    mustChangePassword: true,
    tokenVersion: 1,
    updatedAtISO: new Date().toISOString()
  };
  inMemoryCredentialsMap.set('admin', adminDoc);

  const agentNames = [
    'Sarah Jenkins', 'Marcus Vance', 'Elena Rostova', 'David Chen',
    'Aisha Patel', 'Liam O\'Connor', 'Sophia Martinez', 'Alex Thorne',
    'Maya Lin', 'Carlos Mendez', 'Emily Watson', 'James Wilson'
  ];

  agentNames.forEach((name, index) => {
    const padIndex = String(index + 1).padStart(2, '0');
    const agentCreds = createCredentialHash('AgentPass2026!');
    const id = `agent${padIndex}`;
    inMemoryCredentialsMap.set(id, {
      agentId: id,
      name: name,
      passwordHash: agentCreds.passwordHash,
      salt: agentCreds.salt,
      role: 'AGENT',
      failedLoginAttempts: 0,
      mustChangePassword: true,
      tokenVersion: 1,
      updatedAtISO: new Date().toISOString()
    });
  });
}

// Pre-populate memory cache on server load
populateDefaultInMemoryCredentials();

async function dbGetDoc(collectionName: string, docId: string): Promise<any> {
  const cleanId = docId.toLowerCase();
  if (collectionName === 'agent_credentials' && inMemoryCredentialsMap.has(cleanId)) {
    return inMemoryCredentialsMap.get(cleanId);
  }
  if (adminDb && adminDbAvailable) {
    try {
      const snap: any = await withTimeout(adminDb.collection(collectionName).doc(cleanId).get(), 2000);
      if (snap.exists) {
        const data = snap.data();
        if (collectionName === 'agent_credentials') inMemoryCredentialsMap.set(cleanId, data as ServerAgentCredential);
        return data;
      }
      return null;
    } catch (e) {
      handleFirestoreError('admin', 'getDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      const snap = await withTimeout(getDoc(doc(clientDb, collectionName, cleanId)), 2000);
      if (snap.exists()) {
        const data = snap.data();
        if (collectionName === 'agent_credentials') inMemoryCredentialsMap.set(cleanId, data as ServerAgentCredential);
        return data;
      }
      return null;
    } catch (e) {
      handleFirestoreError('client', 'getDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (collectionName === 'agent_credentials') {
    return inMemoryCredentialsMap.get(cleanId) || null;
  }
  return null;
}

async function dbSetDoc(collectionName: string, docId: string, data: any): Promise<boolean> {
  const cleanId = docId.toLowerCase();
  if (collectionName === 'agent_credentials') {
    inMemoryCredentialsMap.set(cleanId, data);
  }
  if (adminDb && adminDbAvailable) {
    try {
      await withTimeout(adminDb.collection(collectionName).doc(cleanId).set(data, { merge: true }), 2000);
      return true;
    } catch (e) {
      handleFirestoreError('admin', 'setDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      await withTimeout(setDoc(doc(clientDb, collectionName, cleanId), data, { merge: true }), 2000);
      return true;
    } catch (e) {
      handleFirestoreError('client', 'setDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  return collectionName === 'agent_credentials';
}

async function dbDeleteDoc(collectionName: string, docId: string): Promise<boolean> {
  const cleanId = docId.toLowerCase();
  if (collectionName === 'agent_credentials') {
    inMemoryCredentialsMap.delete(cleanId);
  }
  if (adminDb && adminDbAvailable) {
    try {
      await withTimeout(adminDb.collection(collectionName).doc(cleanId).delete(), 2000);
      return true;
    } catch (e) {
      handleFirestoreError('admin', 'deleteDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      await withTimeout(deleteDoc(doc(clientDb, collectionName, cleanId)), 2000);
      return true;
    } catch (e) {
      handleFirestoreError('client', 'deleteDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  return collectionName === 'agent_credentials';
}

async function dbGetCollectionDocs(collectionName: string): Promise<any[]> {
  if (adminDb && adminDbAvailable) {
    try {
      const snap: any = await withTimeout(adminDb.collection(collectionName).get(), 2000);
      const docs = snap.docs.map((d: any) => d.data());
      if (collectionName === 'agent_credentials' && docs.length > 0) {
        docs.forEach((c: any) => inMemoryCredentialsMap.set(c.agentId.toLowerCase(), c as ServerAgentCredential));
      }
      return docs;
    } catch (e) {
      handleFirestoreError('admin', 'getCollectionDocs', collectionName, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      const snap = await withTimeout(getDocs(collection(clientDb, collectionName)), 2000);
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push(data);
        if (collectionName === 'agent_credentials' && data.agentId) {
          inMemoryCredentialsMap.set(data.agentId.toLowerCase(), data as ServerAgentCredential);
        }
      });
      return list;
    } catch (e) {
      handleFirestoreError('client', 'getCollectionDocs', collectionName, e);
    }
  }
  if (collectionName === 'agent_credentials') {
    return Array.from(inMemoryCredentialsMap.values());
  }
  return [];
}

// Audit logging helper for admin actions
async function createAuditLog(actorId: string, actorName: string, action: string, targetId: string, details: string) {
  const auditId = 'audit_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const logEntry = {
    id: auditId,
    actorId,
    actorName,
    action,
    targetId,
    details,
    timestampISO: new Date().toISOString()
  };
  await dbSetDoc('audit_logs', auditId, logEntry);
}

// -----------------------------------------------------------------------------
// PASSWORD SECURITY & CREDENTIAL TYPES
// -----------------------------------------------------------------------------
function classifyDeviceType(uaString: string | undefined): 'web' | 'mobile' {
  if (!uaString) return 'web';
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(uaString);
  return isMobile ? 'mobile' : 'web';
}

function hashPasswordWithSalt(password: string, salt: string): string {
  if (!password || !salt) return '';
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

function createCredentialHash(password: string) {
  const salt = generateSalt();
  const passwordHash = hashPasswordWithSalt(password, salt);
  return { salt, passwordHash };
}

export function validatePasswordStrength(password: string): { valid: boolean; reason?: string } {
  if (!password || password.trim().length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long." };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one number." };
  }
  return { valid: true };
}

interface ServerAgentCredential {
  agentId: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: 'AGENT' | 'ADMIN';
  failedLoginAttempts?: number;
  lockUntilISO?: string | null;
  mustChangePassword?: boolean;
  tokenVersion?: number;
  updatedAtISO?: string;
}

// Seeding agent credentials into Firestore disabled
async function seedCredentialsIfEmpty() {
  // Demo auto-seeding disabled to keep database empty
  console.log('[Credentials] Automatic credentials seeding is disabled. Database remains clean.');
  return;
}

// -----------------------------------------------------------------------------
// PORTAL DATA SEEDING & SOFT-DELETE CLEANUP
// -----------------------------------------------------------------------------
async function seedPortalDataIfEmpty() {
  // Demo Data Seeding সম্পূর্ণ নিষ্ক্রিয় করা হয়েছে যাতে ডাটাবেজে কোনো Preset Data না থাকে।
  console.log('[Seed] Automatic portal data seeding is disabled. Database remains empty.');
  return;
}

async function purgeOldDeletedItems() {
  try {
    const items = await dbGetCollectionDocs('deleted_items');
    if (!items || items.length === 0) return;

    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let purgedCount = 0;

    for (const item of items) {
      if (item.deletedAt) {
        const deletedTime = new Date(item.deletedAt).getTime();
        if (deletedTime < thirtyDaysAgo) {
          await dbDeleteDoc('deleted_items', item.id);
          purgedCount++;
        }
      }
    }

    if (purgedCount > 0) {
      console.log(`[Purge] Purged ${purgedCount} soft-deleted items older than 30 days.`);
    }
  } catch (err) {
    console.warn('[Purge] Error during soft-delete purge:', err);
  }
}

function jsonToCsv(dataArray: any[]): string {
  if (!dataArray || dataArray.length === 0) return '';

  const headersSet = new Set<string>();
  dataArray.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(key => headersSet.add(key));
    }
  });

  const headers = Array.from(headersSet);
  const escapeCsv = (val: any) => {
    if (val === null || val === undefined) return '""';
    if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const csvRows = [
    headers.join(','),
    ...dataArray.map(item => headers.map(h => escapeCsv(item[h])).join(','))
  ];

  return csvRows.join('\r\n');
}
// -----------------------------------------------------------------------------
// JWT SESSION MANAGEMENT WITH TOKEN VERSION CHECK (Item 6)
// -----------------------------------------------------------------------------
function generateSessionToken(
  user: { id: string; name: string; role: 'AGENT' | 'ADMIN'; tokenVersion?: number },
  deviceType: 'web' | 'mobile',
  sessionId: string
): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    id: user.id.toLowerCase(),
    name: user.name,
    role: user.role,
    tokenVersion: user.tokenVersion || 1,
    deviceType,
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours validity
  })).toString('base64url');

  const signature = crypto.createHmac('sha256', SERVER_SECRET!)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

interface VerifiedSessionResult {
  valid: boolean;
  reason?: 'invalid' | 'expired' | 'revoked';
  message?: string;
  user?: {
    id: string;
    name: string;
    role: 'AGENT' | 'ADMIN';
    deviceType: 'web' | 'mobile';
    sessionId: string;
    tokenVersion?: number;
  };
}

function verifySessionToken(token: string): VerifiedSessionResult {
  try {
    if (!token) return { valid: false, reason: 'invalid' };
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, reason: 'invalid' };

    const [header, payload, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET!)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) {
      return { valid: false, reason: 'invalid' };
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && Math.floor(Date.now() / 1000) > decoded.exp) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      user: {
        id: decoded.id,
        name: decoded.name,
        role: decoded.role,
        deviceType: decoded.deviceType || 'web',
        sessionId: decoded.sessionId || '',
        tokenVersion: decoded.tokenVersion || 1
      }
    };
  } catch (e) {
    return { valid: false, reason: 'invalid' };
  }
}

async function verifyActiveSessionInFirestore(token: string): Promise<VerifiedSessionResult> {
  const baseResult = verifySessionToken(token);
  if (!baseResult.valid || !baseResult.user) {
    return baseResult;
  }

  const { id: agentId, deviceType, sessionId, tokenVersion } = baseResult.user;
  const cleanId = agentId.toLowerCase();

  try {
    // 1. Verify user token version against Firestore credential record (Item 6)
    const credDoc: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanId);
    if (credDoc) {
      const currentVersion = credDoc.tokenVersion || 1;
      if (tokenVersion && tokenVersion < currentVersion) {
        return {
          valid: false,
          reason: 'revoked',
          message: 'Session revoked because user credentials or password were updated.'
        };
      }
    }

    // 2. Verify active session pointer in Firestore
    const activeDoc = await dbGetDoc('active_sessions', `${cleanId}_${deviceType}`);
    if (activeDoc && activeDoc.sessionId && activeDoc.sessionId !== sessionId) {
      return {
        valid: false,
        reason: 'revoked',
        message: `You've been logged out because your account was signed in on another ${deviceType === 'mobile' ? 'mobile device' : 'web browser'}.`
      };
    }
  } catch (err) {
    console.warn("Firestore active_session verify check warning:", err);
  }

  return baseResult;
}

// -----------------------------------------------------------------------------
// ZOD VALIDATION SCHEMAS (Item 7)
// -----------------------------------------------------------------------------
const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  role: z.enum(['AGENT', 'ADMIN']).optional(),
  clientDeviceType: z.enum(['web', 'mobile']).optional()
});

const VerifySessionSchema = z.object({
  token: z.string().min(1, "Session token is required")
});

const UpsertAgentSchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  name: z.string().min(1, "name is required"),
  password: z.string().optional(),
  role: z.enum(['AGENT', 'ADMIN']).optional(),
  token: z.string().optional()
});

const ResetPasswordSchema = z.object({
  targetAgentId: z.string().min(1, "Target agent ID is required"),
  newPassword: z.string().min(1, "New password is required"),
  token: z.string().optional()
});

const ChangePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Old password is required"),
  newPassword: z.string().min(1, "New password is required"),
  token: z.string().optional()
});

const DeleteAgentSchema = z.object({
  targetAgentId: z.string().min(1, "Target agent ID is required"),
  token: z.string().optional()
});

const VerifyActionSchema = z.object({
  password: z.string().min(1, "Password is required"),
  token: z.string().optional()
});

const ClockInSchema = z.object({
  token: z.string().optional(),
  clockInTime: z.string().optional(),
  status: z.string().optional(),
  currentActivity: z.string().optional(),
  shiftTimer: z.number().optional(),
  breakTimer: z.number().optional(),
  deviceInfo: z.string().optional(),
  ipInfo: z.string().optional(),
  userAgent: z.string().optional()
});

const ClockOutSchema = z.object({
  token: z.string().optional(),
  finalShiftTimer: z.number().optional()
});

const StatusUpdateSchema = z.object({
  token: z.string().optional(),
  status: z.string().optional(),
  currentActivity: z.string().optional(),
  shiftTimer: z.number().optional(),
  breakTimer: z.number().optional(),
  clockInTime: z.string().optional(),
  deviceInfo: z.string().optional(),
  ipInfo: z.string().optional(),
  name: z.string().optional()
});

const ActivityLogSchema = z.object({
  token: z.string().optional(),
  id: z.string().optional(),
  timestamp: z.string().optional(),
  agentName: z.string().optional(),
  action: z.string().optional(),
  category: z.string().optional(),
  details: z.string().optional()
}).passthrough();

const GeminiSearchSchema = z.object({
  message: z.string().min(1, "Message is required"),
  history: z.array(z.object({
    role: z.string(),
    text: z.string()
  })).optional()
});

// -----------------------------------------------------------------------------
// REALTIME IN-MEMORY & FIRESTORE STATE MANAGEMENT (Item 1)
// -----------------------------------------------------------------------------
interface RealtimeSession {
  id: string;
  agentId: string;
  name: string;
  loginTime: string;
  clockInTime?: string;
  status: 'offline' | 'available' | 'on_break';
  currentActivity: string;
  lastActive: string;
  shiftTimer?: number;
  breakTimer?: number;
  ipInfo?: string;
  deviceInfo?: string;
  userAgent?: string;
}

const activeSessionsMap = new Map<string, RealtimeSession>();
const activityLogsList: any[] = [];
const sseClients = new Set<express.Response>();

async function loadRealtimeStateFromFirestore() {
  try {
    const sessionDocs = await dbGetCollectionDocs('realtime_sessions');
    if (sessionDocs && sessionDocs.length > 0) {
      sessionDocs.forEach((s: RealtimeSession) => {
        if (s.agentId) activeSessionsMap.set(s.agentId.toLowerCase(), s);
      });
      console.log(`[Realtime] Loaded ${sessionDocs.length} sessions from Firestore persistence.`);
    }

    const logDocs = await dbGetCollectionDocs('activity_logs');
    if (logDocs && logDocs.length > 0) {
      logDocs.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
      activityLogsList.push(...logDocs.slice(0, 500));
      console.log(`[Realtime] Loaded ${activityLogsList.length} activity logs from Firestore persistence.`);
    }
  } catch (err) {
    console.warn("[Realtime] Error loading initial state from Firestore:", err);
  }
}

function broadcastRealtimeEvent(
  type: 'USER_CLOCK_IN' | 'USER_CLOCK_OUT' | 'BROADCAST_STATUS_UPDATE' | 'ACTIVITY_LOG_ADDED',
  payload: any
) {
  const data = JSON.stringify({
    type,
    payload,
    sessions: Array.from(activeSessionsMap.values()),
    logs: activityLogsList.slice(-100),
    timestamp: new Date().toISOString()
  });

  sseClients.forEach((client) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      console.error("SSE broadcast write error:", e);
    }
  });
}

// -----------------------------------------------------------------------------
// SERVER APPLICATION STARTUP
// -----------------------------------------------------------------------------
async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Item 7: Security Headers using Helmet
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  app.use(express.json());
  // Twilio webhooks (voice, gather, status callback) POST as application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false }));

  // Trigger background seed credentials, portal data, and realtime state load without blocking server listen
  seedCredentialsIfEmpty().catch(err => console.warn("[Credentials] Background seed warning:", err));
  seedPortalDataIfEmpty().catch(err => console.warn("[PortalSeed] Background seed warning:", err));
  loadRealtimeStateFromFirestore().catch(err => console.warn("[Realtime] Background load warning:", err));
  purgeOldDeletedItems().catch(err => console.warn("[Purge] Background purge warning:", err));

  // Schedule periodic soft-delete purge every 6 hours
  setInterval(() => {
    purgeOldDeletedItems().catch(err => console.warn("[Purge] Scheduled purge warning:", err));
  }, 6 * 60 * 60 * 1000);

  // Initialize Gemini Client
  const getGeminiClient = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    return new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // Item 9: Health Check with Active Firestore Ping Test
  app.get("/api/health", async (req, res) => {
    try {
      const pingDoc = { timestamp: new Date().toISOString() };
      const firestoreOk = await dbSetDoc('health_check', 'ping', pingDoc);
      return res.status(200).json({
        status: "ok",
        firestore: firestoreOk ? "connected" : "in-memory-fallback",
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(200).json({
        status: "ok",
        firestore: "in-memory-fallback",
        timestamp: new Date().toISOString()
      });
    }
  });

  // =========================================================================
  // AUTHENTICATION & CREDENTIAL ENDPOINTS
  // =========================================================================

  const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many login attempts from this IP address. Please try again after 15 minutes." }
  });

  // POST /api/auth/login (Items 1, 5, 7)
  app.post("/api/auth/login", loginRateLimiter, async (req, res) => {
    const parseResult = LoginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const { username, password, role, clientDeviceType } = parseResult.data;
    const cleanInputId = username.trim().toLowerCase();
    const cleanInputPass = password.trim();

    let normalizedId = cleanInputId;
    if (/^agent\d$/i.test(cleanInputId)) {
      normalizedId = cleanInputId.replace(/^agent(\d)$/i, "agent0$1");
    } else if (/^\d{1,2}$/.test(cleanInputId)) {
      normalizedId = `agent${cleanInputId.padStart(2, "0")}`;
    }

    // Persisted Firestore Credential Lookup (Item 1)
    let user: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanInputId);
    if (!user && normalizedId !== cleanInputId) {
      user = await dbGetDoc('agent_credentials', normalizedId);
    }

    if (!user) {
      const allCreds = await dbGetCollectionDocs('agent_credentials');
      user = allCreds.find((c: ServerAgentCredential) => c.name.toLowerCase() === cleanInputId);
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Item 5: Per-account Login Lockout check
    if (user.lockUntilISO) {
      const lockTime = new Date(user.lockUntilISO).getTime();
      if (Date.now() < lockTime) {
        const remainingMins = Math.ceil((lockTime - Date.now()) / (60 * 1000));
        return res.status(423).json({
          error: `Account ${user.agentId} is locked due to 5 consecutive failed login attempts. Please try again in ${remainingMins} minute(s) or contact an administrator.`
        });
      }
    }

    if (role && user.role !== role) {
      return res.status(403).json({ error: `Account ${user.agentId} does not have ${role} role privileges.` });
    }

    // Password verification with unique salt
    const hashedInput = hashPasswordWithSalt(cleanInputPass, user.salt);

    if (user.passwordHash !== hashedInput) {
      // Failed login logic
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntilISO = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      user.updatedAtISO = new Date().toISOString();
      await dbSetDoc('agent_credentials', user.agentId.toLowerCase(), user);

      if (user.failedLoginAttempts >= 5) {
        return res.status(423).json({
          error: `Account ${user.agentId} is now locked due to 5 consecutive failed login attempts. Please try again after 15 minutes or contact an admin.`
        });
      }

      return res.status(401).json({ error: "Invalid username or password." });
    }

    // Successful login -> Reset lockout counter
    user.failedLoginAttempts = 0;
    user.lockUntilISO = null;
    user.updatedAtISO = new Date().toISOString();
    await dbSetDoc('agent_credentials', user.agentId.toLowerCase(), user);

    const deviceType: 'web' | 'mobile' = clientDeviceType === 'mobile' || clientDeviceType === 'web'
      ? clientDeviceType
      : classifyDeviceType(req.headers['user-agent']);

    const sessionId = 'sess_' + crypto.randomBytes(16).toString('hex');

    // Overwrite active session in Firestore
    await dbSetDoc('active_sessions', `${user.agentId.toLowerCase()}_${deviceType}`, {
      agentId: user.agentId.toLowerCase(),
      deviceType,
      sessionId,
      timestamp: new Date().toISOString(),
      loginTime: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || ''
    });

    const sessionToken = generateSessionToken({
      id: user.agentId,
      name: user.name,
      role: user.role,
      tokenVersion: user.tokenVersion || 1
    }, deviceType, sessionId);

    return res.json({
      success: true,
      user: {
        id: user.agentId,
        name: user.name,
        role: user.role,
        deviceType,
        sessionId,
        mustChangePassword: user.mustChangePassword || false
      },
      sessionToken,
      deviceType,
      sessionId,
      mustChangePassword: user.mustChangePassword || false
    });
  });

  // POST /api/auth/verify
  app.post("/api/auth/verify", async (req, res) => {
    const parseResult = VerifySessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.json({ valid: false });
    }
    const result = await verifyActiveSessionInFirestore(parseResult.data.token);
    return res.json(result);
  });

  // GET /api/auth/agents (Returns safe list)
  app.get("/api/auth/agents", async (req, res) => {
    const allCreds = await dbGetCollectionDocs('agent_credentials');
    const agents = allCreds.map((c: ServerAgentCredential) => ({
      agentId: c.agentId,
      name: c.name,
      role: c.role,
      mustChangePassword: c.mustChangePassword || false,
      passwordHash: "••••••••"
    }));
    res.json({ agents });
  });

  // POST /api/auth/upsert-agent (Admin only - Items 4, 8, 10)
  app.post("/api/auth/upsert-agent", async (req, res) => {
    const parseResult = UpsertAgentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || session.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { agentId, name, password, role } = parseResult.data;
    const cleanId = agentId.trim().toLowerCase();
    const existing: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanId);

    // Item 4: Remove predictable default password - Require explicit password when creating NEW agent
    if (!existing && (!password || password.trim().length === 0)) {
      return res.status(400).json({
        error: "An explicit temporary password is required when creating a new agent account."
      });
    }

    let userSalt = existing ? existing.salt : generateSalt();
    let userHash = existing ? existing.passwordHash : '';

    if (password && password.trim().length > 0) {
      // Item 10: Enforce password strength
      const strengthCheck = validatePasswordStrength(password.trim());
      if (!strengthCheck.valid) {
        return res.status(400).json({ error: strengthCheck.reason });
      }
      userSalt = generateSalt();
      userHash = hashPasswordWithSalt(password.trim(), userSalt);
    }

    const updatedUser: ServerAgentCredential = {
      agentId: cleanId,
      name: name.trim(),
      passwordHash: userHash,
      salt: userSalt,
      role: role || (existing ? existing.role : 'AGENT'),
      failedLoginAttempts: 0,
      lockUntilISO: null,
      mustChangePassword: password ? true : (existing?.mustChangePassword ?? false),
      tokenVersion: existing ? existing.tokenVersion || 1 : 1,
      updatedAtISO: new Date().toISOString()
    };

    await dbSetDoc('agent_credentials', cleanId, updatedUser);

    // Item 8: Audit Logging
    await createAuditLog(
      session.user.id,
      session.user.name,
      existing ? 'AGENT_UPDATED' : 'AGENT_CREATED',
      cleanId,
      `Agent ${cleanId} (${updatedUser.name}) ${existing ? 'updated' : 'created'} with role ${updatedUser.role}`
    );

    res.json({
      success: true,
      agent: {
        agentId: updatedUser.agentId,
        name: updatedUser.name,
        role: updatedUser.role,
        mustChangePassword: updatedUser.mustChangePassword,
        passwordHash: "••••••••"
      }
    });
  });

  // POST /api/auth/reset-password (Admin only - Items 6, 8, 10)
  app.post("/api/auth/reset-password", async (req, res) => {
    const parseResult = ResetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || session.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { targetAgentId, newPassword } = parseResult.data;
    const cleanId = targetAgentId.trim().toLowerCase();
    const existing: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanId);

    if (!existing) {
      return res.status(404).json({ error: `Agent ${targetAgentId} not found.` });
    }

    // Item 10: Enforce password strength
    const strengthCheck = validatePasswordStrength(newPassword.trim());
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.reason });
    }

    const newSalt = generateSalt();
    existing.salt = newSalt;
    existing.passwordHash = hashPasswordWithSalt(newPassword.trim(), newSalt);
    existing.failedLoginAttempts = 0;
    existing.lockUntilISO = null;
    existing.mustChangePassword = true;
    existing.tokenVersion = (existing.tokenVersion || 1) + 1; // Item 6: Session revocation
    existing.updatedAtISO = new Date().toISOString();

    await dbSetDoc('agent_credentials', cleanId, existing);

    // Item 8: Audit Logging
    await createAuditLog(
      session.user.id,
      session.user.name,
      'PASSWORD_RESET',
      cleanId,
      `Admin reset password for agent ${cleanId}`
    );

    res.json({ success: true, message: `Password for ${targetAgentId} reset successfully.` });
  });

  // POST /api/auth/change-password (Self-service password update - Items 4, 6, 10)
  app.post("/api/auth/change-password", async (req, res) => {
    const parseResult = ChangePasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const { oldPassword, newPassword } = parseResult.data;
    const cleanId = session.user.id.toLowerCase();
    const existing: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanId);

    if (!existing) {
      return res.status(404).json({ error: "User record not found." });
    }

    const oldHashed = hashPasswordWithSalt(oldPassword.trim(), existing.salt);
    if (oldHashed !== existing.passwordHash) {
      return res.status(400).json({ error: "Incorrect current password." });
    }

    const strengthCheck = validatePasswordStrength(newPassword.trim());
    if (!strengthCheck.valid) {
      return res.status(400).json({ error: strengthCheck.reason });
    }

    const newSalt = generateSalt();
    existing.salt = newSalt;
    existing.passwordHash = hashPasswordWithSalt(newPassword.trim(), newSalt);
    existing.mustChangePassword = false;
    existing.tokenVersion = (existing.tokenVersion || 1) + 1;
    existing.updatedAtISO = new Date().toISOString();

    await dbSetDoc('agent_credentials', cleanId, existing);

    res.json({ success: true, message: "Password changed successfully." });
  });

  // POST /api/auth/delete-agent (Admin only - Items 6, 8)
  app.post("/api/auth/delete-agent", async (req, res) => {
    const parseResult = DeleteAgentSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || session.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: "Admin authorization required." });
    }

    const { targetAgentId } = parseResult.data;
    const cleanId = targetAgentId.trim().toLowerCase();

    if (cleanId === 'admin') {
      return res.status(400).json({ error: "Cannot delete master administrator account." });
    }

    await dbDeleteDoc('agent_credentials', cleanId);

    // Item 8: Audit Logging
    await createAuditLog(
      session.user.id,
      session.user.name,
      'AGENT_DELETE',
      cleanId,
      `Admin deleted agent ${cleanId}`
    );

    res.json({ success: true, message: `Agent ${targetAgentId} deleted successfully.` });
  });

  // POST /api/auth/verify-action
  app.post("/api/auth/verify-action", async (req, res) => {
    const parseResult = VerifyActionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const { password } = parseResult.data;

    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid || !session.user?.id) {
      return res.status(401).json({ error: "Unauthorized session." });
    }

    const cleanId = session.user.id.trim().toLowerCase();
    const user: ServerAgentCredential = await dbGetDoc('agent_credentials', cleanId);
    if (!user) {
      return res.json({ success: false, error: "User not found." });
    }

    const hashedInput = hashPasswordWithSalt(password.trim(), user.salt);
    if (user.passwordHash === hashedInput) {
      return res.json({ success: true });
    }

    return res.json({ success: false, error: "Incorrect password." });
  });

  // =========================================================================
  // AUTHENTICATED REALTIME & PRESENCE ENDPOINTS (Item 2, Item 3)
  // =========================================================================

  // GET /api/realtime/stream - SSE Stream (Item 3: Locked down & CORS restricted)
  app.get("/api/realtime/stream", async (req, res) => {
    const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '') || '';
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || !session.user) {
      return res.status(401).json({ error: "Unauthorized SSE stream connection." });
    }

    const requestOrigin = req.headers.origin || req.headers.host || '*';
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
    res.flushHeaders();

    sseClients.add(res);

    const initData = JSON.stringify({
      type: 'BROADCAST_STATUS_UPDATE',
      payload: null,
      sessions: Array.from(activeSessionsMap.values()),
      timestamp: new Date().toISOString()
    });
    res.write(`data: ${initData}\n\n`);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  // GET /api/realtime/sessions
  app.get("/api/realtime/sessions", async (req, res) => {
    const token = (req.query.token as string) || req.headers.authorization?.replace('Bearer ', '') || '';
    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    res.json({ sessions: Array.from(activeSessionsMap.values()) });
  });

  // POST /api/realtime/clock-in (Item 2: Derived agentId from authenticated session)
  app.post("/api/realtime/clock-in", async (req, res) => {
    const parseResult = ClockInSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user) {
      return res.status(401).json({ error: "Unauthorized: Valid session token required." });
    }

    const authenticatedAgentId = sessionResult.user.id.toLowerCase();
    const authenticatedName = sessionResult.user.name;

    const { clockInTime, status, currentActivity, shiftTimer, breakTimer, ipInfo, deviceInfo, userAgent } = parseResult.data;

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientUserAgent = req.headers['user-agent'] || 'Browser Client';

    const sessionData: RealtimeSession = {
      id: authenticatedAgentId,
      agentId: authenticatedAgentId,
      name: authenticatedName,
      loginTime: clockInTime || new Date().toISOString(),
      clockInTime: clockInTime || new Date().toISOString(),
      status: (status as any) || 'available',
      currentActivity: currentActivity || 'available',
      lastActive: new Date().toISOString(),
      shiftTimer: shiftTimer || 0,
      breakTimer: breakTimer || 0,
      ipInfo: ipInfo || (Array.isArray(clientIp) ? clientIp[0] : String(clientIp)),
      deviceInfo: deviceInfo || 'Web Client',
      userAgent: userAgent || clientUserAgent
    };

    activeSessionsMap.set(authenticatedAgentId, sessionData);
    await dbSetDoc('realtime_sessions', authenticatedAgentId, sessionData); // Item 1

    broadcastRealtimeEvent('USER_CLOCK_IN', sessionData);
    res.json({ success: true, session: sessionData });
  });

  // POST /api/realtime/clock-out (Item 2: Authenticated)
  app.post("/api/realtime/clock-out", async (req, res) => {
    const parseResult = ClockOutSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user) {
      return res.status(401).json({ error: "Unauthorized: Valid session token required." });
    }

    const authenticatedAgentId = sessionResult.user.id.toLowerCase();
    const { finalShiftTimer } = parseResult.data;

    const existing = activeSessionsMap.get(authenticatedAgentId);
    if (existing) {
      existing.status = 'offline';
      existing.currentActivity = 'offline';
      existing.lastActive = new Date().toISOString();
      if (finalShiftTimer !== undefined) existing.shiftTimer = finalShiftTimer;
      activeSessionsMap.set(authenticatedAgentId, existing);
      await dbSetDoc('realtime_sessions', authenticatedAgentId, existing);
      broadcastRealtimeEvent('USER_CLOCK_OUT', existing);
    } else {
      const offlineSession: RealtimeSession = {
        id: authenticatedAgentId,
        agentId: authenticatedAgentId,
        name: sessionResult.user.name,
        loginTime: new Date().toISOString(),
        status: 'offline',
        currentActivity: 'offline',
        lastActive: new Date().toISOString(),
        shiftTimer: finalShiftTimer || 0
      };
      activeSessionsMap.set(authenticatedAgentId, offlineSession);
      await dbSetDoc('realtime_sessions', authenticatedAgentId, offlineSession);
      broadcastRealtimeEvent('USER_CLOCK_OUT', offlineSession);
    }

    res.json({ success: true });
  });

  // POST /api/realtime/status-update (Item 2: Authenticated)
  app.post("/api/realtime/status-update", async (req, res) => {
    const parseResult = StatusUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user) {
      return res.status(401).json({ error: "Unauthorized: Valid session token required." });
    }

    const authenticatedAgentId = sessionResult.user.id.toLowerCase();
    const { status, currentActivity, shiftTimer, breakTimer, clockInTime, deviceInfo, ipInfo, name } = parseResult.data;

    const existing = activeSessionsMap.get(authenticatedAgentId) || {
      id: authenticatedAgentId,
      agentId: authenticatedAgentId,
      name: sessionResult.user.name,
      loginTime: clockInTime || new Date().toISOString(),
      clockInTime: clockInTime || new Date().toISOString(),
      status: (status as any) || 'available',
      currentActivity: currentActivity || 'available',
      lastActive: new Date().toISOString(),
      shiftTimer: shiftTimer || 0,
      breakTimer: breakTimer || 0,
      ipInfo: ipInfo || '127.0.0.1',
      deviceInfo: deviceInfo || 'Web Client'
    };

    if (name) existing.name = name;
    if (status) existing.status = status as any;
    if (currentActivity) existing.currentActivity = currentActivity;
    if (shiftTimer !== undefined) existing.shiftTimer = shiftTimer;
    if (breakTimer !== undefined) existing.breakTimer = breakTimer;
    if (clockInTime) existing.clockInTime = clockInTime;
    if (ipInfo) existing.ipInfo = ipInfo;
    if (deviceInfo) existing.deviceInfo = deviceInfo;
    existing.lastActive = new Date().toISOString();

    activeSessionsMap.set(authenticatedAgentId, existing);
    await dbSetDoc('realtime_sessions', authenticatedAgentId, existing);

    broadcastRealtimeEvent('BROADCAST_STATUS_UPDATE', existing);
    res.json({ success: true, session: existing });
  });

  // GET /api/realtime/activity-logs
  app.get("/api/realtime/activity-logs", async (req, res) => {
    res.json({ logs: activityLogsList });
  });

  // POST /api/realtime/activity-logs (Item 2: Authenticated)
  app.post("/api/realtime/activity-logs", async (req, res) => {
    const parseResult = ActivityLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || parseResult.data.token || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user) {
      return res.status(401).json({ error: "Unauthorized session token required for logging." });
    }

    const logEntry = {
      ...parseResult.data,
      agentId: sessionResult.user.id.toLowerCase(),
      agentName: parseResult.data.agentName || sessionResult.user.name,
      timestamp: parseResult.data.timestamp || new Date().toISOString()
    };

    activityLogsList.unshift(logEntry);
    if (activityLogsList.length > 2000) {
      activityLogsList.pop();
    }

    if (logEntry.id) {
      await dbSetDoc('activity_logs', logEntry.id, logEntry); // Item 1
    }

    broadcastRealtimeEvent('ACTIVITY_LOG_ADDED', logEntry);
    res.json({ success: true, log: logEntry });
  });

  // =========================================================================
  // GEMINI SEARCH GROUNDING ENDPOINT WITH RATE LIMITING (Item 7)
  // =========================================================================

  const geminiRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many search queries. Limit is 20 requests per hour per IP address." }
  });

  app.post("/api/gemini/search", geminiRateLimiter, async (req, res) => {
    const parseResult = GeminiSearchSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: "Invalid request payload", details: parseResult.error.format() });
    }

    try {
      const { message, history } = parseResult.data;
      const ai = getGeminiClient();

      const contents = [];
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: "You are a professional CRM Knowledge Base Search Assistant. Help customer support agents find accurate, up-to-date, and verified information using your Google Search Grounding capabilities. Be precise, clear, and cite sources from the grounding metadata. Format your answer with elegant Markdown.",
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "";
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      const sources = chunks
        .map((c: any) => {
          if (c.web) {
            return {
              title: c.web.title || "Source",
              uri: c.web.uri || ""
            };
          }
          return null;
        })
        .filter(Boolean);

      const uniqueSources: any[] = [];
      const seenUris = new Set();
      for (const src of sources) {
        if (src && src.uri && !seenUris.has(src.uri)) {
          seenUris.add(src.uri);
          uniqueSources.push(src);
        }
      }

      res.json({
        text,
        sources: uniqueSources
      });
    } catch (error: any) {
      console.error("Gemini search grounding error:", error);
      res.status(500).json({ error: error.message || "An error occurred during search grounding" });
    }
  });

  // =========================================================================
  // ADMIN CSV EXPORT & SOFT-DELETE PURGE ENDPOINTS (Items 4, 7)
  // =========================================================================

  // GET /api/admin/export-csv - Admin server-side full collection CSV export streaming (Item 7)
  app.get("/api/admin/export-csv", async (req, res) => {
    const collectionName = (req.query.collection as string) || 'contacts';
    const allowedCollections = [
      'contacts', 'support_tickets', 'kb_articles', 'roster_assignments',
      'deleted_items', 'realtime_sessions', 'activity_logs', 'audit_logs'
    ];

    if (!allowedCollections.includes(collectionName)) {
      return res.status(400).json({ error: `Invalid collection name. Allowed: ${allowedCollections.join(', ')}` });
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || (req.query.token as string) || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user) {
      return res.status(401).json({ error: "Unauthorized: Valid admin session token required." });
    }

    if (sessionResult.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "Forbidden: Admin privileges required to export complete server datasets." });
    }

    try {
      const docs = await dbGetCollectionDocs(collectionName);
      const csvData = jsonToCsv(docs);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${collectionName}_full_export_${Date.now()}.csv"`);
      return res.status(200).send(csvData);
    } catch (err: any) {
      console.error("Server-side CSV export error:", err);
      return res.status(500).json({ error: err.message || "Failed to generate CSV export" });
    }
  });

  // POST /api/admin/purge-deleted-items - Admin endpoint to manually trigger 30-day trash purge (Item 4)
  app.post("/api/admin/purge-deleted-items", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '') || req.body.token || '';
    const sessionResult = await verifyActiveSessionInFirestore(token);

    if (!sessionResult.valid || !sessionResult.user || sessionResult.user.role !== 'ADMIN') {
      return res.status(401).json({ error: "Unauthorized: Admin privileges required." });
    }

    await purgeOldDeletedItems();
    return res.json({ success: true, message: "Soft-delete trash purge check completed successfully." });
  });

  /*
   * =========================================================================
   * FIRESTORE BACKUP & POINT-IN-TIME RECOVERY (PITR) DOCUMENTATION (Item 8)
   * =========================================================================
   *
   * To protect against accidental bulk data changes, database corruption, or
   * unexpected system bugs separate from per-item trash recovery:
   *
   * 1. Enable Firestore Point-in-Time Recovery (PITR):
   *    gcloud firestore databases update --pitr
   *    - PITR retains continuous database history up to 7 days, enabling recovery
   *      to any exact microsecond within that window.
   *
   * 2. Configure Scheduled Backups to Google Cloud Storage (GCS):
   *    gcloud firestore backups schedules create \
   *      --database='(default)' \
   *      --recurrence=DAILY \
   *      --retention=30d
   *
   * 3. Manual On-Demand Backup:
   *    gcloud firestore export gs://[YOUR_BACKUP_BUCKET_NAME]
   *
   * 4. Restore from Backup:
   *    gcloud firestore import gs://[YOUR_BACKUP_BUCKET_NAME]/[EXPORT_FOLDER]
   */

  // =========================================================================
  // IVR / CALL PORTAL (TWILIO) — TEST MODE
  // =========================================================================
  // NOTE: This whole section is built for a Twilio TRIAL/test account.
  // In trial mode Twilio will only actually connect calls to/from phone
  // numbers you have verified in the Twilio Console, and every call plays a
  // short "trial account" disclaimer before your TwiML runs. None of that
  // needs any code change — it goes away automatically once the account is
  // upgraded (paid).

  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || "";
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";
  const TWILIO_API_KEY_SID = process.env.TWILIO_API_KEY_SID || "";
  const TWILIO_API_KEY_SECRET = process.env.TWILIO_API_KEY_SECRET || "";
  const TWILIO_TWIML_APP_SID = process.env.TWILIO_TWIML_APP_SID || "";
  const TWILIO_CALLER_ID = process.env.TWILIO_CALLER_ID || "";
  const twilioConfigured = !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_API_KEY_SID && TWILIO_API_KEY_SECRET && TWILIO_TWIML_APP_SID);

  if (!twilioConfigured) {
    console.warn("[IVR] Twilio environment variables are not fully set. IVR/call endpoints will respond with a clear 'not configured' error until they are.");
  }

  // Simple IVR menu — digit pressed -> department. Edit this to change the menu.
  const IVR_MENU: { digit: string; label: string; department: string }[] = [
    { digit: "1", label: "General Support", department: "General" },
    { digit: "2", label: "Billing", department: "Billing" },
    { digit: "3", label: "Technical Issue", department: "Technical" },
  ];

  // Round-robin pointer so repeated calls don't always hit the same agent
  let lastRoutedAgentIndex = 0;

  function getAvailableAgents(): RealtimeSession[] {
    return Array.from(activeSessionsMap.values()).filter(s => s.status === "available");
  }

  function pickNextAvailableAgent(): RealtimeSession | null {
    const available = getAvailableAgents();
    if (available.length === 0) return null;
    lastRoutedAgentIndex = (lastRoutedAgentIndex + 1) % available.length;
    return available[lastRoutedAgentIndex];
  }

  async function logCall(entry: any) {
    await dbSetDoc("ivr_calls", entry.callSid || `call_${Date.now()}`, entry);
    broadcastRealtimeEvent("ACTIVITY_LOG_ADDED" as any, { ivrCall: entry });
  }

  // POST /api/ivr/token — mints a short-lived Twilio Access Token so the agent's
  // browser (Twilio Voice JS SDK) can register as a "Client" and receive calls.
  app.post("/api/ivr/token", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || req.body?.token || "";
    const session = await verifyActiveSessionInFirestore(token);

    if (!session.valid || !session.user) {
      return res.status(401).json({ error: "Unauthorized: valid session required." });
    }

    if (!twilioConfigured) {
      return res.status(503).json({ error: "IVR is not configured yet. Ask an admin to set the TWILIO_* environment variables (see .env.example)." });
    }

    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    const identity = session.user.id.toLowerCase();
    const accessToken = new AccessToken(TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, {
      identity,
      ttl: 3600,
    });
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });
    accessToken.addGrant(voiceGrant);

    res.json({ token: accessToken.toJwt(), identity });
  });

  // POST /api/ivr/voice — Twilio hits this the moment a real call comes into
  // your Twilio number. Set this exact URL as the number's "A call comes in"
  // webhook (or as the TwiML App's Request URL): {APP_URL}/api/ivr/voice
  app.post("/api/ivr/voice", async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const gather = twiml.gather({
      numDigits: 1,
      timeout: 8,
      action: "/api/ivr/route",
      method: "POST",
    });
    gather.say(
      "Thank you for calling. " +
      IVR_MENU.map(o => `Press ${o.digit} for ${o.label}.`).join(" ")
    );

    // If caller doesn't press anything, loop the menu once more then fall back to routing as general.
    twiml.redirect("/api/ivr/voice");

    res.type("text/xml").send(twiml.toString());
  });

  // POST /api/ivr/route — called by Twilio with the digit the caller pressed.
  // Finds an available agent and bridges the call to their browser widget
  // (Twilio Client), or falls back gracefully if nobody is available.
  app.post("/api/ivr/route", async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const digit = (req.body?.Digits as string) || "";
    const callSid = (req.body?.CallSid as string) || "";
    const fromNumber = (req.body?.From as string) || "unknown";
    const toNumber = (req.body?.To as string) || TWILIO_CALLER_ID;
    const menuOption = IVR_MENU.find(o => o.digit === digit);
    const department = menuOption?.department || "General";

    const agent = pickNextAvailableAgent();

    if (!agent) {
      twiml.say("Sorry, all our agents are currently busy. Please leave a message after the tone, and we will get back to you.");
      twiml.record({ maxLength: 90, action: "/api/ivr/status-callback", playBeep: true });
      await logCall({
        callSid,
        fromNumber,
        toNumber,
        direction: "inbound",
        digitPressed: digit,
        department,
        outcome: "no_agents_available",
        startedAtISO: new Date().toISOString(),
      });
      res.type("text/xml").send(twiml.toString());
      return;
    }

    const dial = twiml.dial({
      timeout: 20,
      action: "/api/ivr/status-callback",
      method: "POST",
    });
    dial.client(agent.agentId);

    await logCall({
      callSid,
      fromNumber,
      toNumber,
      direction: "inbound",
      digitPressed: digit,
      department,
      routedAgentId: agent.agentId,
      routedAgentName: agent.name,
      outcome: "in_progress",
      startedAtISO: new Date().toISOString(),
    });

    res.type("text/xml").send(twiml.toString());
  });

  // POST /api/ivr/status-callback — Twilio posts the final call/dial/recording
  // status here. We use it to close out the call log entry.
  app.post("/api/ivr/status-callback", async (req, res) => {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    const callSid = (req.body?.CallSid as string) || "";
    const dialCallStatus = (req.body?.DialCallStatus as string) || "";
    const recordingUrl = (req.body?.RecordingUrl as string) || undefined;
    const callDuration = req.body?.DialCallDuration || req.body?.RecordingDuration;

    if (callSid) {
      const existing = await dbGetDoc("ivr_calls", callSid);
      if (existing) {
        existing.outcome = recordingUrl ? "voicemail" : (dialCallStatus === "completed" ? "connected" : "missed");
        existing.durationSeconds = callDuration ? Number(callDuration) : existing.durationSeconds;
        existing.recordingUrl = recordingUrl || existing.recordingUrl;
        existing.endedAtISO = new Date().toISOString();
        await dbSetDoc("ivr_calls", callSid, existing);
        broadcastRealtimeEvent("ACTIVITY_LOG_ADDED" as any, { ivrCall: existing });
      }
    }

    if (dialCallStatus && dialCallStatus !== "completed" && !recordingUrl) {
      twiml.say("The agent could not be reached. Please try again later. Goodbye.");
    }
    res.type("text/xml").send(twiml.toString());
  });

  // GET /api/ivr/calls — authenticated call-log fetch for the portal UI (Reports / Dashboard).
  app.get("/api/ivr/calls", async (req, res) => {
    const token = (req.query.token as string) || req.headers.authorization?.replace("Bearer ", "") || "";
    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const calls = await dbGetCollectionDocs("ivr_calls");
    calls.sort((a: any, b: any) => new Date(b.startedAtISO || 0).getTime() - new Date(a.startedAtISO || 0).getTime());
    res.json({ calls: calls.slice(0, 200) });
  });

  // GET /api/ivr/config — lets the frontend know whether Twilio is configured yet,
  // and hands over the (non-secret) IVR menu so the widget/UI can render it.
  app.get("/api/ivr/config", async (_req, res) => {
    res.json({ configured: twilioConfigured, menu: IVR_MENU, callerId: twilioConfigured ? TWILIO_CALLER_ID : null });
  });

  // =========================================================================
  // VITE DEV / PRODUCTION MIDDLEWARE
  // =========================================================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Production/Dev server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
