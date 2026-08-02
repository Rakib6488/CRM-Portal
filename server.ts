import express from "express";
import http from "http";
import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import helmet from "helmet";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import twilio from "twilio";
import { MongoClient, Db } from "mongodb";
import dotenv from "dotenv";
import { execFileSync } from "child_process";
import { initializeApp as initClientApp } from "firebase/app";
import { Server as SocketIOServer } from "socket.io";
import { TelegramClient } from "telegram";
import { CustomFile } from "telegram/client/uploads";
import { StringSession } from "telegram/sessions";
import { NewMessage } from "telegram/events";
import { Client as WhatsAppClient, LocalAuth, MessageMedia } from "whatsapp-web.js";
import * as QRCode from "qrcode";
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

const envLocalPath = path.resolve(process.cwd(), ".env.local");
const envPath = fs.existsSync(envLocalPath)
  ? envLocalPath
  : path.resolve(process.cwd(), ".env");
const dotenvResult = fs.existsSync(envPath)
  ? dotenv.config({ path: envPath })
  : undefined;

if (dotenvResult?.error) {
  console.warn("[Server] dotenv failed to load environment file:", dotenvResult.error);
} else if (dotenvResult?.parsed) {
  console.log("[Server] Loaded environment variables from", path.basename(envPath));
}

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
let io: SocketIOServer | null = null;

const apiId = Number.parseInt(process.env.TELEGRAM_API_ID || "", 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionValue = process.env.TELEGRAM_SESSION;
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const fbPageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN || "";
const fbVerifyToken = process.env.FB_VERIFY_TOKEN || "";
const fbApiVersion = process.env.FB_GRAPH_API_VERSION || "v21.0";
const facebookReady = Boolean(fbPageAccessToken);

const fbProfileCache = new Map<string, string>();

async function getFacebookProfile(psid: string) {
  if (fbProfileCache.has(psid)) return fbProfileCache.get(psid)!;
  try {
    const url = `https://graph.facebook.com/${fbApiVersion}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(fbPageAccessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Facebook User";
    fbProfileCache.set(psid, name);
    return name;
  } catch (error) {
    console.error("Could not fetch Facebook profile:", error);
    return "Facebook User";
  }
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const supportedChannels = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
};

let telegramClient: TelegramClient | null = null;
let telegramReady = false;
let telegramConnectBlocked = false;
let whatsappClient: WhatsAppClient | null = null;
let whatsappReady = false;
let whatsappQrDataUrl: string | null = null;

function isAllowedOrigin(origin: string | undefined, host: string | undefined) {
  if (!origin) return true;
  if (allowedOrigins.has("*")) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getSocketCorsOrigin(origin: string | undefined, callback: (err: Error | null, allow?: boolean | string) => void) {
  callback(null, origin || true);
}

function getChannelStatus() {
  return {
    telegram: telegramReady,
    whatsapp: whatsappReady,
    facebook: facebookReady,
  };
}

function publishServerStatus() {
  io?.emit("server-status", {
    telegramReady,
    channels: getChannelStatus(),
  });
}

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

function withTimeout<T>(promise: Promise<T>, ms: number = 8000): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Firestore operation timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

const inMemoryCredentialsMap = new Map<string, ServerAgentCredential>();

function populateDefaultInMemoryCredentials() {
  const adminUsername = (process.env.ADMIN_LOGIN_USERNAME || 'admin').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_LOGIN_PASSWORD || 'AdminSecure2026!';
  const agentPassword = process.env.AGENT_LOGIN_PASSWORD || 'AgentPass2026!';
  const adminCreds = createCredentialHash(adminPassword);
  const adminDoc: ServerAgentCredential = {
    agentId: adminUsername,
    name: 'Administrator',
    passwordHash: adminCreds.passwordHash,
    salt: adminCreds.salt,
    role: 'ADMIN',
    failedLoginAttempts: 0,
    mustChangePassword: true,
    tokenVersion: 1,
    updatedAtISO: new Date().toISOString()
  };
  inMemoryCredentialsMap.set(adminUsername, adminDoc);

  const agentNames = [
    'Sarah Jenkins', 'Marcus Vance', 'Elena Rostova', 'David Chen',
    'Aisha Patel', 'Liam O\'Connor', 'Sophia Martinez', 'Alex Thorne',
    'Maya Lin', 'Carlos Mendez', 'Emily Watson', 'James Wilson'
  ];

  agentNames.forEach((name, index) => {
    const padIndex = String(index + 1).padStart(2, '0');
    const agentCreds = createCredentialHash(agentPassword);
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
  if (adminDb && adminDbAvailable) {
    try {
      const snap: any = await withTimeout(adminDb.collection(collectionName).doc(cleanId).get(), 8000);
      if (snap.exists) {
        const data = snap.data();
        if (collectionName === 'agent_credentials') inMemoryCredentialsMap.set(cleanId, data as ServerAgentCredential);
        return data;
      }
      return collectionName === 'agent_credentials' ? inMemoryCredentialsMap.get(cleanId) || null : null;
    } catch (e) {
      handleFirestoreError('admin', 'getDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      const snap = await withTimeout(getDoc(doc(clientDb, collectionName, cleanId)), 8000);
      if (snap.exists()) {
        const data = snap.data();
        if (collectionName === 'agent_credentials') inMemoryCredentialsMap.set(cleanId, data as ServerAgentCredential);
        return data;
      }
      return collectionName === 'agent_credentials' ? inMemoryCredentialsMap.get(cleanId) || null : null;
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
      await withTimeout(adminDb.collection(collectionName).doc(cleanId).set(data, { merge: true }), 8000);
      return true;
    } catch (e) {
      handleFirestoreError('admin', 'setDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      await withTimeout(setDoc(doc(clientDb, collectionName, cleanId), data, { merge: true }), 8000);
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
      await withTimeout(adminDb.collection(collectionName).doc(cleanId).delete(), 8000);
      return true;
    } catch (e) {
      handleFirestoreError('admin', 'deleteDoc', `${collectionName}/${cleanId}`, e);
    }
  }
  if (clientDb && clientDbAvailable) {
    try {
      await withTimeout(deleteDoc(doc(clientDb, collectionName, cleanId)), 8000);
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
      const snap: any = await withTimeout(adminDb.collection(collectionName).get(), 8000);
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
      const snap = await withTimeout(getDocs(collection(clientDb, collectionName)), 8000);
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
    iat?: number;
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
        tokenVersion: decoded.tokenVersion || 1,
        iat: decoded.iat || 0
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

  const { id: agentId, deviceType, sessionId, tokenVersion, iat } = baseResult.user;
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
      const activeTimestamp = activeDoc.timestamp ? Date.parse(activeDoc.timestamp) : 0;
      const tokenIssuedAt = iat ? iat * 1000 : 0;

      // If the token was issued after the recorded active-session pointer, refresh the pointer and allow.
      if (tokenIssuedAt >= activeTimestamp) {
        await dbSetDoc('active_sessions', `${cleanId}_${deviceType}`, {
          agentId: cleanId,
          deviceType,
          sessionId,
          timestamp: new Date().toISOString(),
          loginTime: activeDoc.loginTime || new Date().toISOString(),
          userAgent: activeDoc.userAgent || ''
        });
        return baseResult;
      }

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
  const PORT = Number(process.env.PORT || process.env.SERVER_PORT || 10000);

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
    max: 25,
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

  // POST /api/auth/logout
  app.post("/api/auth/logout", async (req, res) => {
    const parseResult = VerifySessionSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ success: false, error: "Session token is required." });
    }

    const baseResult = verifySessionToken(parseResult.data.token);
    if (!baseResult.valid || !baseResult.user) {
      return res.json({ success: true });
    }

    const { id: agentId, deviceType } = baseResult.user;
    try {
      await dbDeleteDoc('active_sessions', `${agentId.toLowerCase()}_${deviceType}`);
    } catch (err) {
      console.warn("Failed to clear active session during logout:", err);
    }

    return res.json({ success: true });
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
      'deleted_items', 'realtime_sessions', 'activity_logs', 'audit_logs', 'ivr_calls'
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
      // ivr_calls lives in MongoDB Atlas, not Firestore — everything else stays on Firestore.
      const docs = collectionName === 'ivr_calls'
        ? await mongoGetAllCalls()
        : await dbGetCollectionDocs(collectionName);
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

  // -----------------------------------------------------------------------------
  // MONGODB ATLAS — IVR CALL LOGS STORAGE
  // -----------------------------------------------------------------------------
  // Call logs live in MongoDB Atlas instead of Firestore. Everything else in this
  // app (auth, tickets, CRM, roster, etc.) stays on Firestore as before.
  const MONGODB_URI = process.env.MONGODB_URI || "";
  const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "customer_support_portal";
  let mongoClient: MongoClient | null = null;
  let mongoDb: Db | null = null;
  const inMemoryCallLogs: any[] = []; // fallback if Atlas is unreachable

  async function connectMongo() {
    if (!MONGODB_URI) {
      console.warn("[MongoDB] MONGODB_URI not set. IVR call logs will use an in-memory fallback only (lost on restart).");
      return;
    }
    try {
      mongoClient = new MongoClient(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
        socketTimeoutMS: 10000,
      });
      await mongoClient.connect();
      mongoDb = mongoClient.db(MONGODB_DB_NAME);
      await mongoDb.collection("ivr_calls").createIndex({ callSid: 1 }, { unique: true });
      console.log(`[MongoDB] Connected to Atlas database "${MONGODB_DB_NAME}". IVR call logs will persist there.`);
    } catch (err: any) {
      console.warn("[MongoDB] Connection failed — falling back to in-memory call logs:", err?.message || err);
      mongoDb = null;
    }
  }

  async function mongoUpsertCall(entry: any) {
    if (mongoDb) {
      try {
        await mongoDb.collection("ivr_calls").updateOne(
          { callSid: entry.callSid },
          { $set: entry },
          { upsert: true }
        );
        return;
      } catch (err) {
        console.warn("[MongoDB] upsert failed for call log, using in-memory fallback:", err);
      }
    }
    const idx = inMemoryCallLogs.findIndex(c => c.callSid === entry.callSid);
    if (idx >= 0) inMemoryCallLogs[idx] = { ...inMemoryCallLogs[idx], ...entry };
    else inMemoryCallLogs.unshift(entry);
  }

  async function mongoGetCall(callSid: string): Promise<any | null> {
    if (mongoDb) {
      try {
        return await mongoDb.collection("ivr_calls").findOne({ callSid });
      } catch (err) {
        console.warn("[MongoDB] findOne failed for call log:", err);
      }
    }
    return inMemoryCallLogs.find(c => c.callSid === callSid) || null;
  }

  async function mongoGetAllCalls(): Promise<any[]> {
    if (mongoDb) {
      try {
        return await mongoDb.collection("ivr_calls").find().sort({ startedAtISO: -1 }).limit(200).toArray();
      } catch (err) {
        console.warn("[MongoDB] find failed for call logs:", err);
      }
    }
    return [...inMemoryCallLogs]
      .sort((a, b) => new Date(b.startedAtISO || 0).getTime() - new Date(a.startedAtISO || 0).getTime())
      .slice(0, 200);
  }

  connectMongo().catch(err => console.warn("[MongoDB] Background connect warning:", err));

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
  const twilioRestClient = twilioConfigured ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

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
    await mongoUpsertCall(entry);
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
      const existing = await mongoGetCall(callSid);
      if (existing) {
        existing.outcome = recordingUrl ? "voicemail" : (dialCallStatus === "completed" ? "connected" : "missed");
        existing.durationSeconds = callDuration ? Number(callDuration) : existing.durationSeconds;
        existing.recordingUrl = recordingUrl || existing.recordingUrl;
        existing.endedAtISO = new Date().toISOString();
        await mongoUpsertCall(existing);
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
    const calls = await mongoGetAllCalls();
    res.json({ calls });
  });

  // GET /api/ivr/config — lets the frontend know whether Twilio is configured yet,
  // and hands over the (non-secret) IVR menu so the widget/UI can render it.
  app.get("/api/ivr/config", async (_req, res) => {
    res.json({ configured: twilioConfigured, menu: IVR_MENU, callerId: twilioConfigured ? TWILIO_CALLER_ID : null });
  });

  // POST /api/ivr/transfer — warm-hands a LIVE call to another available agent's browser Client.
  app.post("/api/ivr/transfer", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";
    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid) return res.status(401).json({ error: "Unauthorized" });

    if (!twilioRestClient) {
      return res.status(503).json({ error: "IVR is not configured yet." });
    }

    const { callSid, targetAgentId } = req.body || {};
    if (!callSid || !targetAgentId) {
      return res.status(400).json({ error: "callSid and targetAgentId are required." });
    }

    const targetSession = activeSessionsMap.get(String(targetAgentId).toLowerCase());
    if (!targetSession || targetSession.status !== "available") {
      return res.status(409).json({ error: "That agent is not currently available." });
    }

    try {
      const VoiceResponse = twilio.twiml.VoiceResponse;
      const twiml = new VoiceResponse();
      twiml.dial().client(targetSession.agentId);
      await twilioRestClient.calls(callSid).update({ twiml: twiml.toString() });

      const existing = (await mongoGetCall(callSid)) || { callSid };
      existing.routedAgentId = targetSession.agentId;
      existing.routedAgentName = targetSession.name;
      await mongoUpsertCall(existing);

      res.json({ success: true });
    } catch (err: any) {
      console.error("[IVR] Transfer failed:", err);
      res.status(500).json({ error: err?.message || "Transfer failed." });
    }
  });

  // POST /api/ivr/summary — save the wrap-up Category/Remark for a call (the "Summary" panel).
  app.post("/api/ivr/summary", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace("Bearer ", "") || "";
    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid) return res.status(401).json({ error: "Unauthorized" });

    const { callSid, category, remark } = req.body || {};
    if (!callSid) return res.status(400).json({ error: "callSid is required." });

    const existing = (await mongoGetCall(callSid)) || { callSid, startedAtISO: new Date().toISOString(), direction: "inbound", fromNumber: "unknown", toNumber: TWILIO_CALLER_ID, outcome: "connected" };
    existing.summaryCategory = category ?? existing.summaryCategory;
    existing.summaryRemark = remark ?? existing.summaryRemark;
    existing.summaryComplete = !!(existing.summaryCategory && existing.summaryRemark);
    await mongoUpsertCall(existing);

    res.json({ success: true, call: existing });
  });

  // GET /api/ivr/customer-history?phone=... — past tickets/interactions for the caller currently on the line,
  // shown in the "Customer History" panel (matched against the CRM contact's phone number).
  app.get("/api/ivr/customer-history", async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = (req.query.token as string) || authHeader?.replace("Bearer ", "") || "";
    const session = await verifyActiveSessionInFirestore(token);
    if (!session.valid) return res.status(401).json({ error: "Unauthorized" });

    const phone = ((req.query.phone as string) || "").trim();
    if (!phone) return res.json({ history: [], contact: null });

    const normalizedPhone = phone.replace(/\D/g, "").slice(-10);
    const contacts = await dbGetCollectionDocs("contacts");
    const matchedContact = contacts.find((c: any) => (c.phone || "").replace(/\D/g, "").slice(-10) === normalizedPhone);

    if (!matchedContact) return res.json({ history: [], contact: null });

    const tickets = await dbGetCollectionDocs("support_tickets");
    const contactTickets = tickets
      .filter((t: any) => t.contactId === matchedContact.id)
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    const history = contactTickets.map((t: any) => ({
      id: t.id,
      label: `${t.category || "General"} / ${t.title || "Issue"}`,
      createdAt: t.createdAt,
      csrName: (t.replies && t.replies.length > 0) ? t.replies[t.replies.length - 1].author : "Unassigned",
    }));

    res.json({ history, contact: { id: matchedContact.id, name: matchedContact.name, phone: matchedContact.phone } });
  });

  app.get("/webhook/facebook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token && fbVerifyToken && token === fbVerifyToken) {
      console.log("Facebook webhook verified.");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  app.post("/webhook/facebook", async (req, res) => {
    const body = req.body;
    if (body.object !== "page") {
      res.sendStatus(404);
      return;
    }

    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (!senderId || !event.message || event.message.is_echo) continue;

        try {
          const name = await getFacebookProfile(senderId);
          const payload = {
            channel: "facebook",
            senderId,
            name,
            username: "",
            text: event.message.text || "[Media or attachment]",
            date: Math.floor((event.timestamp || Date.now()) / 1000),
          };
          io?.emit("channel-message", payload);
        } catch (error) {
          console.error("Could not process Facebook message:", error);
        }
      }
    }

    res.status(200).send("EVENT_RECEIVED");
  });

  async function sendFacebookMessage(senderId: string, text: string) {
    const url = `https://graph.facebook.com/${fbApiVersion}/me/messages?access_token=${encodeURIComponent(fbPageAccessToken)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: senderId },
        messaging_type: "RESPONSE",
        message: { text },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Facebook send failed: ${errBody}`);
    }
  }

  function facebookAttachmentType(mimeType: string) {
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("video/")) return "video";
    if (mimeType.startsWith("audio/")) return "audio";
    return "file";
  }

  async function sendFacebookAttachment(senderId: string, buffer: Buffer, filename: string, mimeType: string) {
    const url = `https://graph.facebook.com/${fbApiVersion}/me/messages?access_token=${encodeURIComponent(fbPageAccessToken)}`;
    const form = new FormData();
    form.append("recipient", JSON.stringify({ id: senderId }));
    form.append("messaging_type", "RESPONSE");
    form.append(
      "message",
      JSON.stringify({
        attachment: { type: facebookAttachmentType(mimeType), payload: { is_reusable: false } },
      }),
    );

    const uploadBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const uploadBlob = new Blob([uploadBuffer], { type: mimeType || "application/octet-stream" });
    form.append("filedata", uploadBlob, filename);

    const res = await fetch(url, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Facebook attachment send failed: ${errBody}`);
    }
  }

  function normalizeSenderName(sender: any) {
    const firstName = sender?.firstName || "";
    const lastName = sender?.lastName || "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || sender?.username || "Telegram User";
  }

  async function startTelegramClient() {
    if (telegramConnectBlocked) {
      io?.emit("telegram-connect-failed", "Telegram is disabled for this instance because its session is already active elsewhere. Replace TELEGRAM_SESSION or stop the other Telegram process, then redeploy.");
      return;
    }

    if (!apiId || !apiHash) {
      console.warn("Telegram env is missing. Set TELEGRAM_API_ID and TELEGRAM_API_HASH to enable live chat.");
      io?.emit("telegram-connect-failed", "Telegram env missing. Set TELEGRAM_API_ID and TELEGRAM_API_HASH.");
      publishServerStatus();
      return;
    }

    if (!sessionValue) {
      console.warn("Telegram session string is missing. Set TELEGRAM_SESSION to connect your Telegram account.");
      io?.emit("telegram-connect-failed", "Telegram auth session missing. Set TELEGRAM_SESSION.");
      publishServerStatus();
      return;
    }

    telegramClient = new TelegramClient(new StringSession(sessionValue), apiId, apiHash, {
      connectionRetries: 5,
    });

    try {
      await Promise.race([
        telegramClient.connect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Telegram connection timed out after 15 seconds")), 15000)),
      ]);
      const authorized = await telegramClient.checkAuthorization();
      if (!authorized) {
        throw new Error("Telegram session is not authorized. Generate a new TELEGRAM_SESSION.");
      }
      telegramReady = true;
      publishServerStatus();
      io?.emit("telegram-connected");
      console.log("Telegram client connected.");
    } catch (error: any) {
      telegramReady = false;
      const errorCode = error?.code;
      const errorMessage = String(error?.errorMessage || error?.message || error);
      const duplicatedAuthKey = errorCode === 406 || errorMessage.includes("AUTH_KEY_DUPLICATED");
      if (duplicatedAuthKey) {
        telegramConnectBlocked = true;
        console.error("Telegram connection failed: AUTH_KEY_DUPLICATED. TELEGRAM_SESSION is active in another process or deployment. Stop the other client or generate a new session string.");
        io?.emit("telegram-connect-failed", "Telegram session is already active elsewhere. Stop the other Telegram client or replace TELEGRAM_SESSION, then redeploy.");
      } else {
        console.error("Telegram connection failed:", error);
        io?.emit("telegram-connect-failed", "Telegram connection failed. Check server logs and environment variables.");
      }
      try {
        await telegramClient?.disconnect();
      } catch {
        // The connection may already be closed after an authentication failure.
      }
      telegramClient = null;
      publishServerStatus();
      return;
    }

    telegramClient.addEventHandler(async (event) => {
      const message = event.message;
      if (!message?.isPrivate || message.out) return;

      try {
        const sender = await message.getSender();
        const payload = {
          channel: "telegram",
          senderId: message.senderId?.toString(),
          name: normalizeSenderName(sender),
          username: (sender as any)?.username || "",
          text: message.message || "[Media or attachment]",
          date: message.date || Math.floor(Date.now() / 1000),
        };

        io?.emit("channel-message", payload);
      } catch (error) {
        console.error("Could not process Telegram message:", error);
      }
    }, new NewMessage({}));
  }

  function resolveChromeExecutable() {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.CHROME_BIN || process.env.GOOGLE_CHROME_BIN;
    const isWindowsPath = (candidate: string) => /^[a-zA-Z]:[\\/]/.test(candidate);

    if (process.platform === "linux") {
      if (envPath && isWindowsPath(envPath)) {
        console.warn("[Server] Ignoring Windows browser path on Linux:", envPath);
        delete process.env.PUPPETEER_EXECUTABLE_PATH;
        delete process.env.CHROME_BIN;
        delete process.env.GOOGLE_CHROME_BIN;
      } else if (envPath && fs.existsSync(envPath)) {
        console.log("[Server] Using configured Chromium executable:", envPath);
        return envPath;
      }
      const cachePath = process.env.PUPPETEER_CACHE_DIR;
      if (cachePath && isWindowsPath(cachePath)) {
        console.warn("[Server] Ignoring Windows Puppeteer cache path on Linux:", cachePath);
        delete process.env.PUPPETEER_CACHE_DIR;
      }
    }

    if (envPath && process.platform !== "linux" && fs.existsSync(envPath)) {
      return envPath;
    } else if (envPath && process.platform !== "linux") {
      console.warn("[Server] Configured browser path does not exist:", envPath);
    }
    let puppeteerPath: string | null = null;
    try {
      // Use installed puppeteer binary if available.
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
      const puppeteerModule = require("puppeteer");
      if (typeof puppeteerModule?.executablePath === "function") {
        puppeteerPath = puppeteerModule.executablePath();
      }
    } catch (error) {
      console.warn("[Server] Could not resolve Puppeteer executable via require('puppeteer'):", error);
    }

    if (puppeteerPath && fs.existsSync(puppeteerPath)) {
      return puppeteerPath;
    }

    if (process.platform === "linux") {
      const renderCandidate = "/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome";
      if (fs.existsSync(renderCandidate)) {
        return renderCandidate;
      }
      const renderHeadlessCandidate = "/opt/render/.cache/puppeteer/chrome-headless-shell/linux-146.0.7680.31/chrome-headless-shell-linux64/chrome";
      if (fs.existsSync(renderHeadlessCandidate)) {
        return renderHeadlessCandidate;
      }
    }

    return null;
  }

  function startWhatsAppClient() {
    if (whatsappClient) {
      return;
    }
    const executablePath = resolveChromeExecutable();
    if (!executablePath) {
      const message = "WhatsApp is unavailable because no Chromium browser was found. Install Chromium during deployment or set PUPPETEER_EXECUTABLE_PATH to a valid Linux executable.";
      console.warn(`[Server] ${message}`);
      io?.emit("whatsapp-connect-failed", message);
      return;
    }

    const whatsappAuthDir = path.join(os.homedir(), ".customer-support-portal", ".wwebjs_auth");
    fs.mkdirSync(whatsappAuthDir, { recursive: true });

    const puppeteerLaunchOptions: any = {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    };

    if (executablePath) {
      puppeteerLaunchOptions.executablePath = executablePath;
    }
    console.log("[Server] WhatsApp Puppeteer executablePath:", executablePath || "auto");

    whatsappClient = new WhatsAppClient({
      authStrategy: new LocalAuth({ dataPath: whatsappAuthDir }),
      puppeteer: puppeteerLaunchOptions,
    });

    whatsappClient.on("qr", async (qr) => {
      try {
        whatsappQrDataUrl = await QRCode.toDataURL(qr);
        io?.emit("whatsapp-qr", whatsappQrDataUrl);
        console.log("WhatsApp QR code ready - open the Live Chat panel to scan it.");
      } catch (error) {
        console.error("Failed to render WhatsApp QR code:", error);
      }
    });

    whatsappClient.on("ready", () => {
      whatsappReady = true;
      whatsappQrDataUrl = null;
      publishServerStatus();
      io?.emit("whatsapp-qr", null);
      console.log("WhatsApp client connected.");
    });

    whatsappClient.on("disconnected", (reason) => {
      whatsappReady = false;
      publishServerStatus();
      const message = `WhatsApp disconnected: ${reason || "session ended"}. Request a new QR code.`;
      console.warn(message);
      io?.emit("whatsapp-connect-failed", message);
      whatsappQrDataUrl = null;
    });

    whatsappClient.on("auth_failure", (message) => {
      whatsappReady = false;
      publishServerStatus();
      const status = `WhatsApp authentication failed: ${message || "QR expired or was rejected"}. Generate a new QR code.`;
      console.error(status);
      io?.emit("whatsapp-connect-failed", status);
      whatsappQrDataUrl = null;
    });

    whatsappClient.on("message", async (message) => {
      if (message.fromMe || message.isStatus) return;

      try {
        const contact = await message.getContact();
        const payload = {
          channel: "whatsapp",
          senderId: message.from,
          name: contact?.pushname || contact?.name || contact?.number || message.from,
          username: contact?.number || "",
          text: message.body || "[Media or attachment]",
          date: message.timestamp || Math.floor(Date.now() / 1000),
        };

        io?.emit("channel-message", payload);
      } catch (error) {
        console.error("Could not process WhatsApp message:", error);
      }
    });

    whatsappClient.initialize().catch((error) => {
      const message = `WhatsApp startup failed: ${error?.message || error}`;
      console.error(message);
      io?.emit("whatsapp-connect-failed", message);
    });
  }

  const server = http.createServer(app);
  io = new SocketIOServer(server, {
    maxHttpBufferSize: 16 * 1024 * 1024,
    cors: {
      origin: getSocketCorsOrigin,
      methods: ["GET", "POST"],
    },
    allowRequest: (req, callback) => {
      callback(null, isAllowedOrigin(req.headers.origin as string | undefined, req.headers.host));
    },
  });

  io.on("connection", (socket) => {
    console.log("Dashboard connected:", socket.id);
    socket.emit("server-status", {
      telegramReady,
      channels: getChannelStatus(),
    });
    if (whatsappQrDataUrl && !whatsappReady) {
      socket.emit("whatsapp-qr", whatsappQrDataUrl);
    }

    socket.on("send-reply", async (data = {}) => {
      const channel = String(data.channel || "telegram").trim().toLowerCase();
      const senderId = String(data.senderId || "").trim();
      const text = String(data.text || "").trim();
      const attachment = data.attachment && typeof data.attachment === "object" ? data.attachment : null;

      if (!supportedChannels[channel as keyof typeof supportedChannels]) {
        socket.emit("reply-error", "Unknown channel selected.");
        return;
      }

      if (!senderId || (!text && !attachment)) {
        socket.emit("reply-error", "Select a user and type a message or attach a file first.");
        return;
      }

      if (attachment) {
        const attachmentSize = Number(attachment.size || 0);
        if (!attachment.name || !attachment.data || attachmentSize <= 0) {
          socket.emit("reply-error", "Selected attachment is not valid.");
          return;
        }

        if (attachmentSize > MAX_ATTACHMENT_BYTES) {
          socket.emit("reply-error", "Attachment is too large. Use a file under 10 MB.");
          return;
        }
      }

      if (channel === "facebook") {
        if (!facebookReady) {
          socket.emit("reply-error", "Facebook is not connected. Set FB_PAGE_ACCESS_TOKEN on the server.");
          return;
        }

        try {
          if (attachment) {
            const buffer = Buffer.from(String(attachment.data), "base64");
            await sendFacebookAttachment(senderId, buffer, String(attachment.name), String(attachment.type || "application/octet-stream"));
            if (text) {
              await sendFacebookMessage(senderId, text);
            }
          } else {
            await sendFacebookMessage(senderId, text);
          }

          socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
          console.log(`Reply sent to ${senderId}`);
        } catch (error) {
          console.error("Reply failed:", error);
          socket.emit("reply-error", "Reply failed. Check the server logs.");
        }
        return;
      }

      if (channel === "telegram") {
        if (!telegramClient || !telegramReady) {
          socket.emit("reply-error", "Telegram client is not connected. Check Render environment variables.");
          return;
        }

        try {
          if (attachment) {
            const buffer = Buffer.from(String(attachment.data), "base64");
            const file = new CustomFile(String(attachment.name), buffer.length, "", buffer);
            await telegramClient.sendFile(senderId, {
              file,
              caption: text,
              forceDocument: !String(attachment.type || "").startsWith("image/"),
            });
          } else {
            await telegramClient.sendMessage(senderId, { message: text });
          }

          socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
          console.log(`Reply sent to ${senderId}`);
        } catch (error) {
          console.error("Reply failed:", error);
          socket.emit("reply-error", "Reply failed. Check the server logs.");
        }
        return;
      }

      if (channel === "whatsapp") {
        if (!whatsappClient || !whatsappReady) {
          socket.emit("reply-error", "WhatsApp is not connected. Scan the QR code in the Live Chat panel first.");
          return;
        }

        try {
          if (attachment) {
            const media = new MessageMedia(
              String(attachment.type || "application/octet-stream"),
              String(attachment.data),
              String(attachment.name),
            );
            await whatsappClient.sendMessage(senderId, media, { caption: text || undefined });
          } else {
            await whatsappClient.sendMessage(senderId, text);
          }

          socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
          console.log(`Reply sent to ${senderId}`);
        } catch (error) {
          console.error("Reply failed:", error);
          socket.emit("reply-error", "Reply failed. Check the server logs.");
        }
        return;
      }
    });

    socket.on("request-whatsapp-qr", () => {
      socket.emit("whatsapp-connecting");
      if (whatsappQrDataUrl && !whatsappReady) {
        socket.emit("whatsapp-qr", whatsappQrDataUrl);
        return;
      }
      if (!whatsappClient) {
        startWhatsAppClient();
      } else if (!whatsappReady) {
        startWhatsAppClient();
      }
    });

    socket.on("request-telegram-connect", () => {
      socket.emit("telegram-connecting");
      if (!telegramClient) {
        startTelegramClient();
      } else if (!telegramReady) {
        startTelegramClient();
      } else {
        socket.emit("telegram-connected");
      }
    });

    socket.on("disconnect", () => {
      console.log("Dashboard disconnected:", socket.id);
    });
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Production/Dev server running on http://0.0.0.0:${PORT}`);
    startTelegramClient().catch((error) => console.error("Telegram startup failed:", error));
    startWhatsAppClient();
  });
}

startServer();
