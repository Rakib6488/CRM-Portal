import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, onSnapshot, query, limit, orderBy, serverTimestamp, writeBatch, addDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { LiveAgentSession, CRMContact, SupportTicket, KBArticle, RosterDay } from './types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Helpers for Session & Duration management
export function detectDeviceType(): 'web' | 'mobile' {
  if (typeof window === 'undefined' || !window.navigator) return 'web';
  const ua = window.navigator.userAgent || '';
  const isMobile = /mobile|android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  return isMobile ? 'mobile' : 'web';
}

export function getUtcDateStr(d: Date = new Date()): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface ActiveSessionPointer {
  agentId: string;
  deviceType: 'web' | 'mobile';
  sessionId: string;
  timestamp: string;
  loginTime: string;
  userAgent?: string;
}

export const listenToActiveSession = (
  agentId: string,
  deviceType: 'web' | 'mobile',
  onUpdate: (pointer: ActiveSessionPointer | null) => void
) => {
  if (!agentId) return () => {};
  const docRef = doc(db, 'active_sessions', `${agentId.toLowerCase()}_${deviceType}`);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onUpdate(snapshot.data() as ActiveSessionPointer);
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Firestore active_sessions subscription info:', error.message);
    }
  );
};

export interface DailyDurationRecord {
  agentId: string;
  date: string;
  totalSeconds: number;
  sessionStartTimestamp: number;
  lastUpdatedISO: string;
}

export const getDailyDurationDoc = async (agentId: string, dateStr: string): Promise<DailyDurationRecord | null> => {
  if (!agentId) return null;
  const docRef = doc(db, 'daily_duration', `${agentId.toLowerCase()}_${dateStr}`);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as DailyDurationRecord;
    }
  } catch (e) {
    console.warn('Error fetching daily_duration:', e);
  }
  return null;
};

export const saveDailyDurationDoc = async (record: DailyDurationRecord) => {
  if (!record.agentId || !record.date) return;
  const docRef = doc(db, 'daily_duration', `${record.agentId.toLowerCase()}_${record.date}`);
  try {
    await setDoc(docRef, {
      ...record,
      agentId: record.agentId.toLowerCase()
    }, { merge: true });
  } catch (e) {
    console.warn('Error saving daily_duration:', e);
  }
};

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
// Cache the access token in memory.
let cachedAccessToken: string | null = null;

export const signInAnonymouslyIfNeeded = async () => {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("Failed to sign in anonymously:", e);
    }
  }
};

// Initialize auth state listener. Call this on app load.
export const initAuth = (
  onAuthSuccess?: (user: User, token: string | null) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken) {
        try {
          cachedAccessToken = sessionStorage.getItem('_g_w_token_');
        } catch (e) {
          console.error("Failed to read token from sessionStorage", e);
        }
      }
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      cachedAccessToken = null;
      try {
        sessionStorage.removeItem('_g_w_token_');
      } catch (e) {
        console.error("Failed to remove token from sessionStorage", e);
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Must be called from a button click or user interaction
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Google Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      sessionStorage.setItem('_g_w_token_', cachedAccessToken);
    } catch (e) {
      console.error("Failed to write token to sessionStorage", e);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/spreadsheets');
provider.addScope('https://www.googleapis.com/auth/documents');

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken) {
    try {
      cachedAccessToken = sessionStorage.getItem('_g_w_token_');
    } catch (e) {
      console.error("Failed to read token from sessionStorage", e);
    }
  }
  return cachedAccessToken;
};

export const logout = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  try {
    sessionStorage.removeItem('_g_w_token_');
  } catch (e) {
    console.error("Failed to remove token from sessionStorage", e);
  }
};

// Firestore Error Handler from Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Real-time Session helpers
export const upsertSession = async (session: LiveAgentSession) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `agent_sessions/${uid}`;
  try {
    await setDoc(doc(db, 'agent_sessions', uid), {
      ...session,
      id: uid
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteSession = async (agentId: string) => {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const path = `agent_sessions/${uid}`;
  try {
    await deleteDoc(doc(db, 'agent_sessions', uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const listenToSessions = (onUpdate: (sessions: LiveAgentSession[]) => void) => {
  const path = 'agent_sessions';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const sessions: LiveAgentSession[] = [];
      snapshot.forEach((doc) => {
        sessions.push(doc.data() as LiveAgentSession);
      });
      onUpdate(sessions);
    },
    (error) => {
      console.warn('Firestore agent_sessions subscription info (unauthenticated or offline):', error.message);
    }
  );
};

// Real-time Breaks helpers
export const upsertBreak = async (breakEvent: any) => {
  if (!auth.currentUser) return;
  const path = `breaks/${breakEvent.id}`;
  try {
    await setDoc(doc(db, 'breaks', breakEvent.id), breakEvent);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToBreaks = (onUpdate: (breaks: any[]) => void) => {
  const path = 'breaks';
  const q = query(collection(db, path), orderBy('startTime', 'desc'), limit(50));
  return onSnapshot(
    q,
    (snapshot) => {
      const breaksList: any[] = [];
      snapshot.forEach((doc) => {
        breaksList.push(doc.data());
      });
      onUpdate(breaksList);
    },
    (error) => {
      console.warn('Firestore breaks subscription info (unauthenticated or offline):', error.message);
    }
  );
};

// Global spreadsheet config helpers
export const saveSpreadsheetConfig = async (spreadsheetId: string, spreadsheetUrl: string) => {
  if (!auth.currentUser) return;
  const path = 'config/spreadsheet';
  try {
    await setDoc(doc(db, 'config', 'spreadsheet'), { spreadsheetId, spreadsheetUrl, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToSpreadsheetConfig = (onUpdate: (config: { spreadsheetId: string; spreadsheetUrl: string } | null) => void) => {
  const path = 'config/spreadsheet';
  return onSnapshot(
    doc(db, 'config', 'spreadsheet'),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          spreadsheetId: data.spreadsheetId || '',
          spreadsheetUrl: data.spreadsheetUrl || ''
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Firestore config subscription info:', error.message);
    }
  );
};

export interface PersonalPreferences {
  isDarkMode?: boolean;
  autoClockIn: boolean;
  audioNotifications: boolean;
  defaultBreakReason: string;
  compactSidebar: boolean;
  showWarnings: boolean;
  customAlias: string;
}

export interface ActivityLogEvent {
  id: string;
  agentId: string;
  agentName: string;
  eventType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END' | 'DUTY_CHANGE' | 'STATUS_UPDATE' | 'FORCE_STATUS';
  previousStatus?: string;
  newStatus: string;
  previousActivity?: string;
  newActivity: string;
  timestamp: string; // ISO timestamp with second precision
  formattedTime: string; // e.g., 03:18:29 PM
  shiftTimerSeconds?: number;
  breakTimerSeconds?: number;
  durationSeconds?: number;
  deviceInfo?: string;
  ipInfo?: string;
  notes?: string;
}

export const logActivityEvent = async (eventData: Omit<ActivityLogEvent, 'id' | 'timestamp' | 'formattedTime'> & { timestamp?: string; formattedTime?: string }) => {
  const now = new Date();
  const isoTimestamp = eventData.timestamp || now.toISOString();
  const formattedTime = eventData.formattedTime || now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  const id = `log_${now.getTime()}_${Math.random().toString(36).substring(2, 7)}`;

  const logEntry: ActivityLogEvent = {
    id,
    timestamp: isoTimestamp,
    formattedTime,
    ...eventData
  };

  try {
    const path = `activity_logs/${id}`;
    await setDoc(doc(db, 'activity_logs', id), logEntry);
  } catch (error) {
    console.warn('Firestore activity_logs write info:', error);
  }

  // Also post to local backend endpoint if active
  const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
  fetch('/api/realtime/activity-logs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ...logEntry, token })
  }).catch(() => {});

  return logEntry;
};

export const listenToActivityLogs = (onUpdate: (logs: ActivityLogEvent[]) => void) => {
  const path = 'activity_logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(1000));
  return onSnapshot(
    q,
    (snapshot) => {
      const logsList: ActivityLogEvent[] = [];
      snapshot.forEach((doc) => {
        logsList.push(doc.data() as ActivityLogEvent);
      });
      onUpdate(logsList);
    },
    (error) => {
      console.warn('Firestore activity_logs subscription info:', error.message);
    }
  );
};

export const savePersonalPreferences = async (agentId: string, prefs: PersonalPreferences) => {
  if (!auth.currentUser) return;
  const path = `config/preferences_${agentId}`;
  try {
    await setDoc(doc(db, 'config', `preferences_${agentId}`), { ...prefs, updatedAt: new Date().toISOString() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const listenToPersonalPreferences = (agentId: string, onUpdate: (prefs: PersonalPreferences | null) => void) => {
  const path = `config/preferences_${agentId}`;
  return onSnapshot(
    doc(db, 'config', `preferences_${agentId}`),
    (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        onUpdate({
          isDarkMode: data.isDarkMode ?? true,
          autoClockIn: data.autoClockIn ?? false,
          audioNotifications: data.audioNotifications ?? true,
          defaultBreakReason: data.defaultBreakReason ?? 'Short Break',
          compactSidebar: data.compactSidebar ?? false,
          showWarnings: data.showWarnings ?? true,
          customAlias: data.customAlias ?? ''
        });
      } else {
        onUpdate(null);
      }
    },
    (error) => {
      console.warn('Firestore personal preferences subscription info:', error.message);
    }
  );
};

/**
 * CRITICAL ARCHITECTURE: ANTI-DUPLICATION ENGINE & IDEMPOTENCY
 * Prevent duplicate metric entries in Firebase using unique transactional keys (`agentId_timestamp_date`).
 * Uses `setDoc(doc(db, "agent_performance_metrics", uniqueId), data, { merge: true })` instead of `addDoc`
 * to guarantee idempotency and prevent duplicate records.
 * 
 * STRICT ZERO LOCAL STORAGE RULE: All states directly stream to and read from Firebase.
 */
import { AgentPerformanceMetric, AgentCredential } from './types';

export const upsertAgentCredential = async (cred: AgentCredential) => {
  if (!cred.agentId) return;
  const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
  try {
    await fetch('/api/auth/upsert-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        agentId: cred.agentId,
        name: cred.name,
        password: cred.passwordHash,
        role: cred.role
      })
    });
  } catch (error) {
    console.warn('API upsert-agent error:', error);
  }
};

export const deleteAgentCredentialFromFirestore = async (agentId: string) => {
  if (!agentId) return;
  const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
  try {
    await fetch('/api/auth/delete-agent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ targetAgentId: agentId })
    });
  } catch (error) {
    console.warn('API delete-agent error:', error);
  }
};

export const saveAllAgentCredentialsToFirestore = async (credentials: AgentCredential[]) => {
  for (const cred of credentials) {
    await upsertAgentCredential(cred);
  }
};

export const listenToAgentCredentials = (onUpdate: (credentials: AgentCredential[]) => void) => {
  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/auth/agents');
      if (res.ok) {
        const data = await res.json();
        if (data.agents && Array.isArray(data.agents)) {
          onUpdate(data.agents);
        }
      }
    } catch (e) {
      console.warn('Fetch agents error:', e);
    }
  };

  fetchAgents();
  const interval = setInterval(fetchAgents, 15000);
  return () => clearInterval(interval);
};

export const upsertAgentMetric = async (metric: AgentPerformanceMetric) => {
  if (!metric.transactionKey) return;
  const path = `agent_performance_metrics/${metric.transactionKey}`;
  try {
    await setDoc(doc(db, 'agent_performance_metrics', metric.transactionKey), {
      ...metric,
      lastUpdatedISO: new Date().toISOString()
    }, { merge: true });
  } catch (error) {
    console.warn('Firestore agent_performance_metrics write info:', error);
  }
};

export const listenToAgentMetrics = (onUpdate: (metrics: AgentPerformanceMetric[]) => void) => {
  const path = 'agent_performance_metrics';
  const q = query(collection(db, path), orderBy('lastUpdatedISO', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const metricsMap = new Map<string, AgentPerformanceMetric>();
      snapshot.forEach((doc) => {
        const data = doc.data() as AgentPerformanceMetric;
        // Deduplication check: ensure unique key
        const key = data.transactionKey || data.uniqueCaseId;
        if (key && !metricsMap.has(key)) {
          metricsMap.set(key, data);
        }
      });
      onUpdate(Array.from(metricsMap.values()));
    },
    (error) => {
      console.warn('Firestore agent_performance_metrics subscription info:', error.message);
    }
  );
};

// -----------------------------------------------------------------------------
// CRM CONTACTS REAL-TIME FIRESTORE SERVICES
// -----------------------------------------------------------------------------
export const listenToContacts = (onUpdate: (contacts: CRMContact[]) => void) => {
  const path = 'contacts';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const contactsList: CRMContact[] = [];
      snapshot.forEach((docSnap) => {
        contactsList.push({ id: docSnap.id, ...docSnap.data() } as CRMContact);
      });
      onUpdate(contactsList);
    },
    (error) => {
      console.warn('Firestore contacts subscription error:', error.message);
    }
  );
};

export const saveContactToFirestore = async (contact: CRMContact) => {
  const path = `contacts/${contact.id}`;
  try {
    await setDoc(doc(db, 'contacts', contact.id), {
      ...contact,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteContactFromFirestore = async (contact: CRMContact, deletedBy: string = 'Current User') => {
  const batch = writeBatch(db);
  const trashRef = doc(collection(db, 'deleted_items'));
  const contactRef = doc(db, 'contacts', contact.id);

  batch.set(trashRef, {
    id: trashRef.id,
    originalCollection: 'contacts',
    originalId: contact.id,
    deletedAt: new Date().toISOString(),
    deletedBy,
    data: contact
  });

  batch.delete(contactRef);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `contacts/${contact.id}`);
  }
};

// -----------------------------------------------------------------------------
// SUPPORT TICKETS REAL-TIME FIRESTORE SERVICES
// -----------------------------------------------------------------------------
export const listenToTickets = (onUpdate: (tickets: SupportTicket[]) => void) => {
  const path = 'support_tickets';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const ticketsList: SupportTicket[] = [];
      snapshot.forEach((docSnap) => {
        ticketsList.push({ id: docSnap.id, ...docSnap.data() } as SupportTicket);
      });
      onUpdate(ticketsList);
    },
    (error) => {
      console.warn('Firestore support_tickets subscription error:', error.message);
    }
  );
};

export const saveTicketToFirestore = async (ticket: SupportTicket) => {
  const path = `support_tickets/${ticket.id}`;
  try {
    await setDoc(doc(db, 'support_tickets', ticket.id), {
      ...ticket,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteTicketFromFirestore = async (ticket: SupportTicket, deletedBy: string = 'Current User') => {
  const batch = writeBatch(db);
  const trashRef = doc(collection(db, 'deleted_items'));
  const ticketRef = doc(db, 'support_tickets', ticket.id);

  batch.set(trashRef, {
    id: trashRef.id,
    originalCollection: 'support_tickets',
    originalId: ticket.id,
    deletedAt: new Date().toISOString(),
    deletedBy,
    data: ticket
  });

  batch.delete(ticketRef);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `support_tickets/${ticket.id}`);
  }
};

// -----------------------------------------------------------------------------
// KNOWLEDGE BASE ARTICLES REAL-TIME FIRESTORE SERVICES
// -----------------------------------------------------------------------------
export const listenToKbArticles = (onUpdate: (articles: KBArticle[]) => void) => {
  const path = 'kb_articles';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const kbList: KBArticle[] = [];
      snapshot.forEach((docSnap) => {
        kbList.push({ id: docSnap.id, ...docSnap.data() } as KBArticle);
      });
      onUpdate(kbList);
    },
    (error) => {
      console.warn('Firestore kb_articles subscription error:', error.message);
    }
  );
};

export const saveKbArticleToFirestore = async (article: KBArticle) => {
  const path = `kb_articles/${article.id}`;
  try {
    await setDoc(doc(db, 'kb_articles', article.id), {
      ...article,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteKbArticleFromFirestore = async (article: KBArticle, deletedBy: string = 'Current User') => {
  const batch = writeBatch(db);
  const trashRef = doc(collection(db, 'deleted_items'));
  const kbRef = doc(db, 'kb_articles', article.id);

  batch.set(trashRef, {
    id: trashRef.id,
    originalCollection: 'kb_articles',
    originalId: article.id,
    deletedAt: new Date().toISOString(),
    deletedBy,
    data: article
  });

  batch.delete(kbRef);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `kb_articles/${article.id}`);
  }
};

// -----------------------------------------------------------------------------
// ROSTER ASSIGNMENTS REAL-TIME FIRESTORE SERVICES
// -----------------------------------------------------------------------------
export const listenToRosterAssignments = (onUpdate: (rosterDays: RosterDay[]) => void) => {
  const path = 'roster_assignments';
  return onSnapshot(
    collection(db, path),
    (snapshot) => {
      const rosterList: RosterDay[] = [];
      snapshot.forEach((docSnap) => {
        rosterList.push({ id: docSnap.id, ...docSnap.data() } as RosterDay);
      });
      onUpdate(rosterList);
    },
    (error) => {
      console.warn('Firestore roster_assignments subscription error:', error.message);
    }
  );
};

export const saveRosterDayToFirestore = async (rosterDay: RosterDay) => {
  const path = `roster_assignments/${rosterDay.id}`;
  try {
    await setDoc(doc(db, 'roster_assignments', rosterDay.id), {
      ...rosterDay,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

// -----------------------------------------------------------------------------
// RECENTLY DELETED / TRASH REAL-TIME FIRESTORE SERVICES & RESTORE
// -----------------------------------------------------------------------------
export interface DeletedItemRecord {
  id: string;
  originalCollection: string;
  originalId: string;
  deletedAt: string;
  deletedBy: string;
  data: any;
}

export const listenToDeletedItems = (onUpdate: (items: DeletedItemRecord[]) => void) => {
  const path = 'deleted_items';
  const q = query(collection(db, path), orderBy('deletedAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const deletedList: DeletedItemRecord[] = [];
      snapshot.forEach((docSnap) => {
        deletedList.push({ id: docSnap.id, ...docSnap.data() } as DeletedItemRecord);
      });
      onUpdate(deletedList);
    },
    (error) => {
      console.warn('Firestore deleted_items subscription error:', error.message);
    }
  );
};

export const restoreDeletedItemInFirestore = async (item: DeletedItemRecord) => {
  if (!item.originalCollection || !item.originalId || !item.data) return;

  const batch = writeBatch(db);
  const restoreRef = doc(db, item.originalCollection, item.originalId);
  const trashRef = doc(db, 'deleted_items', item.id);

  batch.set(restoreRef, {
    ...item.data,
    restoredAt: new Date().toISOString()
  });

  batch.delete(trashRef);

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${item.originalCollection}/${item.originalId}`);
  }
};

