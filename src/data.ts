// Types Definition
export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  status?: string;
  company?: string;
  createdAtISO?: string;
}

export interface Agent {
  agentId: string;
  name: string;
  role: 'ADMIN' | 'AGENT';
}

import { CRMContact, SupportTicket, KBArticle } from './types';

// Preset data fully removed - Keeping empty arrays for dynamic database setup
export const INITIAL_CONTACTS: CRMContact[] = [];
export const INITIAL_TICKETS: SupportTicket[] = [];
export const INITIAL_KB_ARTICLES: KBArticle[] = [];