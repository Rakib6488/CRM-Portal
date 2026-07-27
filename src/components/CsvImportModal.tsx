import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, Check, AlertCircle } from 'lucide-react';
import { CRMContact, SupportTicket } from '../types';

interface CsvImportModalProps {
  isOpen: boolean;
  type: 'contacts' | 'tickets';
  onClose: () => void;
  onImportContacts?: (imported: CRMContact[]) => void;
  onImportTickets?: (imported: SupportTicket[]) => void;
  logActivity: (msg: string) => void;
}

export default function CsvImportModal({
  isOpen,
  type,
  onClose,
  onImportContacts,
  onImportTickets,
  logActivity
}: CsvImportModalProps) {
  const [csvText, setCsvText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const parseCSV = (text: string) => {
    setError(null);
    try {
      const lines = text.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        setError('CSV must contain a header row and at least one data row.');
        setParsedPreview([]);
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
      const records: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Simple CSV splitter respecting quotes
        const row = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
        const values = row.map(v => v.trim().replace(/^"|"$/g, ''));

        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = values[idx] || '';
        });
        records.push(obj);
      }

      setParsedPreview(records);
    } catch (err: any) {
      setError(`Failed to parse CSV: ${err.message}`);
      setParsedPreview([]);
    }
  };

  const handleFinalImport = () => {
    if (parsedPreview.length === 0) {
      setError('No valid records to import.');
      return;
    }

    if (type === 'contacts' && onImportContacts) {
      const contacts: CRMContact[] = parsedPreview.map((r, idx) => ({
        id: `c-csv-${Date.now()}-${idx}`,
        name: r.name || r.customer || r['contact name'] || 'CSV Contact',
        email: r.email || 'noemail@domain.com',
        phone: r.phone || r['phone number'] || 'N/A',
        company: r.company || r.organization || 'N/A',
        status: (['Lead', 'Active', 'Inactive', 'VIP'].includes(r.status) ? r.status : 'Lead') as CRMContact['status'],
        notes: r.notes || r.description || 'Imported via CSV',
        lastContactDate: new Date().toISOString()
      }));

      onImportContacts(contacts);
      logActivity(`Bulk imported ${contacts.length} CRM Contacts via CSV upload.`);
    } else if (type === 'tickets' && onImportTickets) {
      const tickets: SupportTicket[] = parsedPreview.map((r, idx) => ({
        id: `t-csv-${Date.now()}-${idx}`,
        contactId: `c-${idx}`,
        contactName: r.contactname || r.customer || r.name || 'CSV Customer',
        title: r.title || r.subject || r.issue || 'Imported Issue',
        priority: (['Low', 'Medium', 'High', 'Urgent'].includes(r.priority) ? r.priority : 'Medium') as SupportTicket['priority'],
        status: (['Open', 'In Progress', 'Resolved', 'Closed'].includes(r.status) ? r.status : 'Open') as SupportTicket['status'],
        category: (['Billing', 'Technical', 'General', 'Feature Request'].includes(r.category) ? r.category : 'General') as SupportTicket['category'],
        description: r.description || r.details || r.summary || 'Imported support ticket',
        createdAt: new Date().toISOString(),
        replies: []
      }));

      onImportTickets(tickets);
      logActivity(`Bulk imported ${tickets.length} Support Tickets via CSV upload.`);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Import {type === 'contacts' ? 'Contacts' : 'Support Tickets'} from CSV
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a CSV file or paste raw CSV comma-separated text below
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-lg flex items-center space-x-2 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Option 1: Upload .csv file
            </label>
            <input 
              type="file" 
              accept=".csv,text/csv" 
              onChange={handleFileUpload}
              className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 dark:file:bg-purple-900/30 dark:file:text-purple-300 dark:text-slate-400"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Option 2: Paste CSV Text
            </label>
            <textarea
              rows={4}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                parseCSV(e.target.value);
              }}
              placeholder={
                type === 'contacts'
                  ? "name,email,phone,company,status,notes\nJohn Doe,john@example.com,555-0192,Acme Corp,Active,VIP Customer"
                  : "contactName,title,priority,status,category,description\nJane Smith,Billing issue,High,Open,Billing,Card charged twice"
              }
              className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-600 focus:outline-none"
            />
          </div>

          {parsedPreview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Parsed Preview ({parsedPreview.length} records)
                </span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Ready to import</span>
                </span>
              </div>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg max-h-48">
                <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                  <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      {Object.keys(parsedPreview[0] || {}).map((col) => (
                        <th key={col} className="px-3 py-2 capitalize">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedPreview.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} className="px-3 py-1.5 truncate max-w-[150px]">{String(val)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end space-x-3 px-6 py-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/60">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700 rounded-lg transition-colors focus:ring-2 focus:ring-slate-400 focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleFinalImport}
            disabled={parsedPreview.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none flex items-center space-x-2"
          >
            <Upload className="w-4 h-4" />
            <span>Import {parsedPreview.length} Records</span>
          </button>
        </div>
      </div>
    </div>
  );
}
