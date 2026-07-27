import { CRMContact, SupportTicket, RosterDay, AgentCredential } from './types';

/**
 * Creates a brand new Google Sheet and exports contacts and support tickets data.
 */
export async function createAndExportToSheet(
  accessToken: string,
  contacts: CRMContact[],
  tickets: SupportTicket[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = `Customer Support Export - ${new Date().toLocaleDateString()}`;

  // 1. Create Spreadsheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json();
    console.error('Error creating spreadsheet:', err);
    throw new Error(err.error?.message || 'Failed to create spreadsheet');
  }

  const spreadsheet = await createResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl;

  // 2. Prepare visual table rows
  const rows = [
    ['CUSTOMER SUPPORT WORKSPACE EXPORT'],
    [`Exported on: ${new Date().toLocaleString()}`],
    [],
    ['CRM CONTACTS'],
    ['Contact ID', 'Name', 'Email', 'Phone', 'Company', 'Customer Status', 'Notes', 'Last Contact Date'],
    ...contacts.map((c) => [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.company,
      c.status,
      c.notes,
      c.lastContactDate,
    ]),
    [],
    [],
    ['SUPPORT TICKETS'],
    ['Ticket ID', 'Contact ID', 'Contact Name', 'Title', 'Priority', 'Status', 'Category', 'Description', 'Created At'],
    ...tickets.map((t) => [
      t.id,
      t.contactId,
      t.contactName,
      t.title,
      t.priority,
      t.status,
      t.category,
      t.description,
      t.createdAt,
    ]),
  ];

  // 3. Write data to sheet
  const updateRange = 'Sheet1!A1';
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.json();
    console.error('Error updating spreadsheet values:', err);
    throw new Error(err.error?.message || 'Failed to populate spreadsheet');
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Creates a brand new Google Doc with customer dossier & support ticket details.
 */
export async function createSupportDoc(
  accessToken: string,
  ticket: SupportTicket,
  contact?: CRMContact
): Promise<{ documentId: string; documentUrl: string }> {
  const docTitle = `Support Dossier - Ticket #${ticket.id.substring(0, 5)}: ${ticket.title}`;

  // 1. Create Document
  const createResponse = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: docTitle,
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json();
    console.error('Error creating document:', err);
    throw new Error(err.error?.message || 'Failed to create document');
  }

  const document = await createResponse.json();
  const documentId = document.documentId;
  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  // 2. Format a beautiful report layout
  const docContent = `CUSTOMER SUPPORT DOSSIER & TICKET SUMMARY
===================================================
Generated on: ${new Date().toLocaleString()}

1. SUPPORT TICKET DETAILS
-------------------------
Ticket ID:   ${ticket.id}
Subject:     ${ticket.title}
Priority:    ${ticket.priority.toUpperCase()}
Status:      ${ticket.status.toUpperCase()}
Category:    ${ticket.category}
Created At:  ${new Date(ticket.createdAt).toLocaleString()}

DESCRIPTION:
${ticket.description}

2. CUSTOMER / CRM DETAILS
-------------------------
${
  contact
    ? `Name:        ${contact.name}
Email:       ${contact.email}
Phone:       ${contact.phone}
Company:     ${contact.company}
Status:      ${contact.status}
Last Active: ${new Date(contact.lastContactDate).toLocaleDateString()}

CUSTOMER PROFILE NOTES:
${contact.notes}`
    : 'No linked customer profile was identified for this ticket.'
}

3. AGENT INVESTIGATION NOTES
----------------------------
- Review past interaction records if any are linked.
- Cross-reference client account status for alignment on prioritization.
- Address issues relative to the service level agreement (SLA) for ${ticket.priority} priority.

ACTION TIMELINE & REMEDIES:
[ ] 1. Technical Triage & Verification of Issues
[ ] 2. Outlining Resolution Paths
[ ] 3. Communicating Status Update to Customer
[ ] 4. Post-Resolution Logging & Closing Ticket
`;

  // 3. Populate Document text
  const updateResponse = await fetch(
    `https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              text: docContent,
              location: {
                index: 1,
              },
            },
          },
        ],
      }),
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.json();
    console.error('Error updating document text:', err);
    throw new Error(err.error?.message || 'Failed to update document content');
  }

  return { documentId, documentUrl };
}

/**
 * Creates a brand new Google Sheet and exports the full-month roster.
 */
export async function createAndExportRosterToSheet(
  accessToken: string,
  rosterDays: RosterDay[],
  monthLabel: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const title = `Support Roster - ${monthLabel}`;

  // 1. Create Spreadsheet
  const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title,
      },
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json();
    console.error('Error creating spreadsheet:', err);
    throw new Error(err.error?.message || 'Failed to create spreadsheet');
  }

  const spreadsheet = await createResponse.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl;

  // 2. Prepare visual table rows
  const rows = [
    [`24/7 SUPPORT ROSTER - ${monthLabel.toUpperCase()}`],
    [`Exported on: ${new Date().toLocaleString()}`],
    [],
    ['Date', 'Day', 'Morning Shift (07:00 AM)', 'Standard Day (08:00 AM)', 'Late Day (10:00 AM)', 'Afternoon (02:00 PM)', 'Evening (05:00 PM)', 'Night Shift (11:00 PM)', 'Off Duty'],
    ...rosterDays.map((d) => [
      d.date,
      d.dayOfWeek,
      d.shifts.morning.join(', '),
      d.shifts.standardDay.join(', '),
      d.shifts.lateDay.join(', '),
      d.shifts.afternoon.join(', '),
      d.shifts.evening.join(', '),
      d.shifts.night.join(', '),
      d.shifts.off.join(', ')
    ])
  ];

  // 3. Write data to sheet
  const updateRange = 'Sheet1!A1';
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.json();
    console.error('Error updating spreadsheet values:', err);
    throw new Error(err.error?.message || 'Failed to populate spreadsheet');
  }

  return { spreadsheetId, spreadsheetUrl };
}

/**
 * Updates an existing Google Sheet with the latest roster days.
 */
export async function updateRosterInSheet(
  accessToken: string,
  spreadsheetId: string,
  rosterDays: RosterDay[],
  monthLabel: string
): Promise<void> {
  const rows = [
    [`24/7 SUPPORT ROSTER - ${monthLabel.toUpperCase()}`],
    [`Exported on: ${new Date().toLocaleString()}`],
    [],
    ['Date', 'Day', 'Morning Shift (07:00 AM)', 'Standard Day (08:00 AM)', 'Late Day (10:00 AM)', 'Afternoon (02:00 PM)', 'Evening (05:00 PM)', 'Night Shift (11:00 PM)', 'Off Duty'],
    ...rosterDays.map((d) => [
      d.date,
      d.dayOfWeek,
      (d.shifts?.morning || []).join(', '),
      (d.shifts?.standardDay || []).join(', '),
      (d.shifts?.lateDay || []).join(', '),
      (d.shifts?.afternoon || []).join(', '),
      (d.shifts?.evening || []).join(', '),
      (d.shifts?.night || []).join(', '),
      (d.shifts?.off || []).join(', ')
    ])
  ];

  const updateRange = 'Sheet1!A1';
  const updateResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!updateResponse.ok) {
    const err = await updateResponse.json();
    console.error('Error updating spreadsheet values:', err);
    throw new Error(err.error?.message || 'Failed to update spreadsheet');
  }
}

/**
 * Fetches and parses roster days from an existing connected Google Sheet.
 */
export async function fetchRosterFromSheet(
  accessToken: string,
  spreadsheetId: string
): Promise<RosterDay[]> {
  const range = 'Sheet1!A1:I100';
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json();
    console.error('Error fetching spreadsheet values:', err);
    throw new Error(err.error?.message || 'Failed to fetch spreadsheet');
  }

  const data = await response.json();
  const values = data.values as string[][] | undefined;
  if (!values || values.length <= 4) {
    throw new Error('Spreadsheet does not contain a valid roster');
  }

  const rosterDays: RosterDay[] = [];
  for (let i = 4; i < values.length; i++) {
    const row = values[i];
    if (!row || row.length < 2) continue; // skip empty/invalid rows
    
    const dateStr = row[0] || '';
    const dayOfWeekName = row[1] || '';
    const morning = (row[2] || '').split(',').map(s => s.trim()).filter(Boolean);
    const standardDay = (row[3] || '').split(',').map(s => s.trim()).filter(Boolean);
    const lateDay = (row[4] || '').split(',').map(s => s.trim()).filter(Boolean);
    const afternoon = (row[5] || '').split(',').map(s => s.trim()).filter(Boolean);
    const evening = (row[6] || '').split(',').map(s => s.trim()).filter(Boolean);
    const night = (row[7] || '').split(',').map(s => s.trim()).filter(Boolean);
    const off = (row[8] || '').split(',').map(s => s.trim()).filter(Boolean);

    rosterDays.push({
      id: `roster-${dateStr}`,
      date: dateStr,
      dayOfWeek: dayOfWeekName,
      shifts: {
        morning,
        standardDay,
        lateDay,
        afternoon,
        evening,
        night,
        off
      },
      notes: `Synced with Google Sheet.`,
      isAutoGenerated: false,
    });
  }

  return rosterDays;
}

const verifiedSheetsCache = new Set<string>();

/**
 * Ensures that a specific sheet tab exists inside the spreadsheet.
 * If it doesn't exist, it adds the sheet tab and populates headers.
 */
export async function ensureSheetExists(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  headers?: string[]
): Promise<void> {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    console.error(`Error fetching spreadsheet metadata for ${spreadsheetId}:`, err);
    throw new Error(err.error?.message || 'Failed to get spreadsheet metadata');
  }
  const spreadsheet = await res.json();
  const sheets = spreadsheet.sheets || [];
  const exists = sheets.some((s: any) => s.properties?.title === sheetName);

  if (!exists) {
    // Create sheet tab
    const createRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.json();
      console.error(`Error adding sheet ${sheetName}:`, err);
      throw new Error(err.error?.message || 'Failed to create sheet tab');
    }

    // Write headers if provided
    if (headers && headers.length > 0) {
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [headers],
          }),
        }
      );
    }
  }
}

/**
 * Appends a log row to a sheet tab in real-time, ensuring headers and sheet existence.
 */
export async function appendRowToSheet(
  token: string,
  spreadsheetId: string,
  sheetName: string,
  rowValues: any[],
  headers?: string[]
): Promise<void> {
  const cacheKey = `${spreadsheetId}:${sheetName}`;
  if (!verifiedSheetsCache.has(cacheKey)) {
    await ensureSheetExists(token, spreadsheetId, sheetName, headers);
    verifiedSheetsCache.add(cacheKey);
  }

  const appendRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:A:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.json();
    console.error(`Error appending row to sheet ${sheetName}:`, err);
    throw new Error(err.error?.message || 'Failed to append row');
  }
}

/**
 * Overwrites or populates a specific day's sheet tab with its updated shift assignments.
 */
export async function syncSpecificDayToSheet(
  token: string,
  spreadsheetId: string,
  day: RosterDay
): Promise<void> {
  const parts = day.date.split('-');
  const dayNum = parseInt(parts[2], 10);
  const sheetName = `Day ${dayNum}`;

  const cacheKey = `${spreadsheetId}:${sheetName}`;
  if (!verifiedSheetsCache.has(cacheKey)) {
    await ensureSheetExists(token, spreadsheetId, sheetName, ['Shift', 'Assigned Agents']);
    verifiedSheetsCache.add(cacheKey);
  }

  // Clear existing values in the sheet range
  const clearRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1:B20:clear`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      }
    }
  );
  if (!clearRes.ok) {
    console.warn("Clear day sheet response not ok:", await clearRes.json());
  }

  // Prepare table values
  const rows = [
    ['Shift', 'Assigned Agents'],
    ['Morning Shift (07:00 AM)', (day.shifts?.morning || []).join(', ')],
    ['Standard Day (08:00 AM)', (day.shifts?.standardDay || []).join(', ')],
    ['Late Day Shift (10:00 AM)', (day.shifts?.lateDay || []).join(', ')],
    ['Afternoon Shift (02:00 PM)', (day.shifts?.afternoon || []).join(', ')],
    ['Evening Shift (05:00 PM)', (day.shifts?.evening || []).join(', ')],
    ['Night Shift (11:00 PM)', (day.shifts?.night || []).join(', ')],
    ['Off Duty / Rest', (day.shifts?.off || []).join(', ')],
    [],
    ['Notes', day.notes || 'No added notes for this day.']
  ];

  // Write new values
  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A1?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: rows,
      }),
    }
  );

  if (!writeRes.ok) {
    const err = await writeRes.json();
    console.error(`Error writing to day sheet ${sheetName}:`, err);
    throw new Error(err.error?.message || 'Failed to update day sheet tab');
  }
}

/**
 * Overwrites a Google Doc content with real-time active summaries.
 */
export async function updateGoogleDocLive(
  token: string,
  documentId: string,
  agentName: string,
  agentStatus: string,
  currentActivity: string,
  breaksList: any[],
  teamAgents: any[]
): Promise<void> {
  const getRes = await fetch(`https://docs.google.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!getRes.ok) {
    const err = await getRes.json();
    console.error(`Error getting Google Doc metadata for ${documentId}:`, err);
    throw new Error(err.error?.message || 'Failed to fetch Google Doc');
  }
  const doc = await getRes.json();
  const content = doc.body?.content || [];
  const lastElement = content[content.length - 1];
  const endIndex = lastElement ? lastElement.endIndex : 1;

  const todayStr = new Date().toLocaleDateString();
  const timeStr = new Date().toLocaleTimeString();

  const formattedBreaks = breaksList.length > 0
    ? breaksList.map(b => {
        const start = b.startTime ? new Date(b.startTime).toLocaleTimeString() : 'N/A';
        const end = b.endTime ? new Date(b.endTime).toLocaleTimeString() : 'Active (Ongoing)';
        const durationStr = b.duration !== undefined
          ? `${Math.round(b.duration / 60)}m (${b.duration}s)`
          : 'N/A';
        return `- ${b.reason} | Started: ${start} | Ended: ${end} | Duration: ${durationStr}`;
      }).join('\n')
    : 'No breaks taken yet today.';

  const formattedTeam = teamAgents.length > 0
    ? teamAgents.map(a => `- ${a.name} is on ${a.breakType} (Duration: ${Math.round(a.duration / 60)}m ${a.duration % 60}s)`).join('\n')
    : 'All other team members are active.';

  const docContent = `LIVE AGENT OPERATIONS DISPATCH SUMMARY
===================================================
Last Synced: ${todayStr} at ${timeStr}

1. ACTIVE AGENT PROFILE & STATUS
---------------------------------
Agent Name:   ${agentName}
Current Status:  ${agentStatus.toUpperCase().replace('_', ' ')}
Work Category:   ${currentActivity.toUpperCase().replace('_', ' ')}

2. TODAY'S ATTENDANCE & BREAK ACTIVITY LOG
-------------------------------------------
${formattedBreaks}

3. ACTIVE TEAM BREAK TIMES
---------------------------
${formattedTeam}

===================================================
Auto-saved in real-time by CRM Support Terminal.
`;

  const requests = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      text: docContent,
      location: {
        index: 1,
      },
    },
  });

  const updateRes = await fetch(`https://docs.google.com/v1/documents/${documentId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests,
    }),
  });

  if (!updateRes.ok) {
    const err = await updateRes.json();
    console.error('Error updating live document text:', err);
    throw new Error(err.error?.message || 'Failed to update Google Doc live summary');
  }
}

/**
 * Fetches or initializes Agent Credentials from Google Sheets tab "AgentCredentials".
 */
export async function fetchAgentCredentialsFromSheet(
  token: string,
  spreadsheetId: string,
  fallbackAgentsList: { name: string }[]
): Promise<AgentCredential[]> {
  const sheetName = 'AgentCredentials';
  const range = `${sheetName}!A2:D200`;

  // 1. Ensure sheet exists
  await ensureSheetExists(token, spreadsheetId, sheetName, ['Agent ID', 'Password', 'Agent Name', 'Role']);

  // 2. Fetch values
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const err = await response.json();
    console.error('Error fetching agent credentials:', err);
    throw new Error(err.error?.message || 'Failed to fetch agent credentials');
  }

  const data = await response.json();
  const values = data.values as string[][] | undefined;

  // 3. If empty, seed with default values
  if (!values || values.length === 0) {
    const defaultCredentials: string[][] = [
      ['admin', 'admin123', 'Administrator', 'ADMIN']
    ];

    fallbackAgentsList.forEach((agent, index) => {
      const padIndex = String(index + 1).padStart(2, '0');
      const agentId = `agent${padIndex}`;
      defaultCredentials.push([agentId, 'agent123', agent.name, 'AGENT']);
    });

    // Write default credentials to Sheet
    const seedRange = `${sheetName}!A2`;
    const seedResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${seedRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: defaultCredentials,
        }),
      }
    );

    if (!seedResponse.ok) {
      console.warn("Failed to seed default agent credentials in sheet:", await seedResponse.json());
    }

    return defaultCredentials.map(([agentId, password, name, role]) => ({
      agentId,
      passwordHash: password,
      name,
      role: role as 'AGENT' | 'ADMIN'
    }));
  }

  // 4. Map values
  return values.map((row) => ({
    agentId: row[0] || '',
    passwordHash: row[1] || '',
    name: row[2] || '',
    role: (row[3] as 'AGENT' | 'ADMIN') || 'AGENT',
  })).filter(c => c.agentId);
}

/**
 * Overwrites the full AgentCredentials sheet values with current array.
 */
export async function updateAgentCredentialsInSheet(
  token: string,
  spreadsheetId: string,
  credentials: AgentCredential[]
): Promise<void> {
  const sheetName = 'AgentCredentials';
  const range = `${sheetName}!A2:D200`;
  const values = credentials.map(c => [c.agentId, c.passwordHash, c.name, c.role]);

  // 1. Clear first
  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  // 2. Write new list
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values
      })
    }
  );

  if (!response.ok) {
    const err = await response.json();
    console.error('Error updating credentials in sheet:', err);
    throw new Error(err.error?.message || 'Failed to update credentials in sheet');
  }
}




