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

// Demo preset Arrays (Empty array, dynamic database store default)
export const initialContacts: Contact[] = [];
export const defaultAgents: Agent[] = [];