import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, Upload, X, CheckCircle, AlertCircle, Trash2, 
  Search, ClipboardList, Send, RefreshCw, File, Image,
  User, Hash, Layers, ShieldAlert, KeyRound, ExternalLink
} from 'lucide-react';
import { SupportTicket } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface CsTicketFormSectionProps {
  tickets: SupportTicket[];
  setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  agentName: string;
  logActivity: (message: string) => void;
}

interface CsFormState {
  orderNumber: string;
  customerName: string;
  imei: string;
  category: string;
  trxId: string;
  detail: string;
}

interface SubmittedCsTicket {
  id: string;
  orderNumber: string;
  customerName: string;
  imei: string;
  category: string;
  trxId: string;
  detail: string;
  attachments: { name: string; size: number; type: string; dataUrl?: string }[];
  submittedAt: string;
  status: 'Pending' | 'Processing' | 'Resolved';
}

const CATEGORIES = [
  'Payment Not Update',
  'Locked After Payment',
  'Locked Before Due Date',
  'Temporary Unlock',
  'Misbehave - Collection Team / CC Agent',
  'Not Getting OTP',
  'BP Support Issue',
  'Not Verified Issue',
  'Refund Issue',
  'Phone Locked After Flashing',
  'Mobile return',
  'Law Enforcement Agency Case',
  'Fraud case'
];

export default function CsTicketFormSection({
  tickets,
  setTickets,
  agentName,
  logActivity
}: CsTicketFormSectionProps) {
  // 1. Form States
  const [form, setForm] = useState<CsFormState>(() => {
    const saved = localStorage.getItem('cs_ticket_form_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse CS draft", e);
      }
    }
    return {
      orderNumber: '',
      customerName: '',
      imei: '',
      category: 'Payment Not Update',
      trxId: '',
      detail: ''
    };
  });

  // 2. Attachments State (with base64 mock upload)
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string; dataUrl?: string }[]>(() => {
    const saved = localStorage.getItem('cs_ticket_form_attachments_draft');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse CS attachments draft", e);
      }
    }
    return [];
  });

  // 3. Submitted Tickets Log State (local persistence)
  const [submittedTickets, setSubmittedTickets] = useState<SubmittedCsTicket[]>(() => {
    const saved = localStorage.getItem('cs_submitted_tickets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse CS submitted tickets", e);
      }
    }
    return [];
  });

  // Selected ticket for details view
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');

  // UI States
  const [errors, setErrors] = useState<Partial<Record<keyof CsFormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft on form change
  useEffect(() => {
    localStorage.setItem('cs_ticket_form_draft', JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    localStorage.setItem('cs_ticket_form_attachments_draft', JSON.stringify(attachments));
  }, [attachments]);

  useEffect(() => {
    localStorage.setItem('cs_submitted_tickets', JSON.stringify(submittedTickets));
  }, [submittedTickets]);

  // Validation function
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CsFormState, string>> = {};

    // Order number: Required, exactly 11 digits, typically starting with 01
    if (!form.orderNumber) {
      newErrors.orderNumber = 'Order Number is required';
    } else if (!/^01\d{9}$/.test(form.orderNumber)) {
      newErrors.orderNumber = 'Order number must be exactly 11 digits starting with "01" (e.g., 01XXXXXXXXX)';
    }

    // Customer name: Required
    if (!form.customerName.trim()) {
      newErrors.customerName = 'Customer Name is required';
    }

    // Category: Required and must be valid
    if (!form.category) {
      newErrors.category = 'Category selection is required';
    } else if (!CATEGORIES.includes(form.category)) {
      newErrors.category = 'Please select a valid ticket category';
    }

    // Detail: Required
    if (!form.detail.trim()) {
      newErrors.detail = 'Detail is required';
    } else if (form.detail.trim().length < 10) {
      newErrors.detail = 'Please provide more details (at least 10 characters)';
    }

    // IMEI is optional, but if entered, let's validate that it is 15 digits
    if (form.imei && !/^\d{15}$/.test(form.imei)) {
      newErrors.imei = 'IMEI must be exactly 15 digits if provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (field: keyof CsFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    // Clear errors inline
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Drag and Drop files
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFiles = (files: FileList) => {
    const validFiles: typeof attachments = [];
    const maxAllowed = 3 - attachments.length;

    if (maxAllowed <= 0) {
      alert("⚠️ You can upload a maximum of 3 attachments.");
      return;
    }

    Array.from(files).slice(0, maxAllowed).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachments(prev => {
          if (prev.length >= 3) return prev;
          return [...prev, {
            name: file.name,
            size: file.size,
            type: file.type,
            dataUrl: typeof reader.result === 'string' ? reader.result : undefined
          }];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFiles(e.target.files);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const clearDraft = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClearDraft = () => {
    setForm({
      orderNumber: '',
      customerName: '',
      imei: '',
      category: 'Payment Not Update',
      trxId: '',
      detail: ''
    });
    setAttachments([]);
    setErrors({});
    logActivity("Cleared Customer Service ticket form draft.");
    setShowClearConfirm(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);

    // Simulate server submission or process directly
    setTimeout(() => {
      const ticketId = `cs-${Date.now()}`;
      const nowStr = new Date().toISOString();

      const newSubmitted: SubmittedCsTicket = {
        id: ticketId,
        orderNumber: form.orderNumber,
        customerName: form.customerName,
        imei: form.imei,
        category: form.category,
        trxId: form.trxId,
        detail: form.detail,
        attachments: [...attachments],
        submittedAt: nowStr,
        status: 'Pending'
      };

      // Add to local submissions log
      setSubmittedTickets(prev => [newSubmitted, ...prev]);

      // Map to SupportTicket system for agents
      const sysTicket: SupportTicket = {
        id: `t-${ticketId}`,
        contactId: `c-${Date.now()}`,
        contactName: form.customerName,
        title: `[CS Ticket: ${form.category}] Order #${form.orderNumber}`,
        priority: ['Fraud case', 'Law Enforcement Agency Case'].includes(form.category) ? 'Urgent' : 'Medium',
        status: 'Open',
        category: 'Technical',
        description: `--- CUSTOMER SERVICE TICKET SUBMISSION ---
Category: ${form.category}
Order Number: ${form.orderNumber}
Customer Name: ${form.customerName}
IMEI: ${form.imei || 'Not Provided'}
Trx ID: ${form.trxId || 'Not Provided'}

Detail Description:
${form.detail}

Attachments: ${attachments.map(a => `${a.name} (${Math.round(a.size / 1024)} KB)`).join(', ') || 'None'}`,
        createdAt: nowStr,
        replies: []
      };

      setTickets(prev => [sysTicket, ...prev]);
      logActivity(`Submitted Customer Service Ticket: "${form.category}" for order #${form.orderNumber}`);

      // Reset form states
      setForm({
        orderNumber: '',
        customerName: '',
        imei: '',
        category: 'Payment Not Update',
        trxId: '',
        detail: ''
      });
      setAttachments([]);
      setErrors({});
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setSelectedTicketId(ticketId); // auto-select newly submitted ticket
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSubmitSuccess(false), 5000);
    }, 1000);
  };

  // Filter submitted tickets log
  const filteredSubmitted = submittedTickets.filter(t => {
    const q = ticketSearchQuery.toLowerCase();
    return t.orderNumber.toLowerCase().includes(q) ||
      t.customerName.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q);
  });

  const selectedTicket = submittedTickets.find(t => t.id === selectedTicketId) || submittedTickets[0];

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-120px)] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn font-sans">
      
      {/* LEFT COLUMN: CS Ticket Form (col-span-7) */}
      <div className="lg:col-span-7 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full bg-white dark:bg-zinc-900/10 text-left overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex justify-between items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-lg font-bold font-serif tracking-wide text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <ClipboardList className="w-5.5 h-5.5 text-amber-500" />
                Customer Service Ticket Form
              </h2>
              <p className="text-[11px] text-zinc-500 mt-1">
                Log, submit and verify customer complaints and update systems directly.
              </p>
            </div>
            
            <button
              type="button"
              onClick={clearDraft}
              className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900/40 transition-all cursor-pointer"
            >
              Clear Draft
            </button>
          </div>

          {submitSuccess && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/35 rounded-xl text-emerald-800 dark:text-emerald-400 text-xs flex items-center gap-3 animate-fadeIn">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <div>
                <span className="font-bold">CS Ticket Submitted Successfully!</span>
                <span className="block text-[10px] opacity-90 mt-0.5">The ticket is now active in the system queue and accessible under "Support Tickets Center".</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 01 ORDER NUMBER */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">01</span>
                  <span>Order Number <span className="text-red-500">*</span></span>
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">11-digit (e.g., 01XXXXXXXXX)</span>
              </div>
              <div className="relative">
                <Hash className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  maxLength={11}
                  placeholder="Please enter..."
                  value={form.orderNumber}
                  onChange={(e) => handleInputChange('orderNumber', e.target.value.replace(/\D/g, ''))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-950 border ${
                    errors.orderNumber 
                      ? 'border-red-500/60 focus:border-red-500' 
                      : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                  } rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400`}
                />
              </div>
              {errors.orderNumber && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.orderNumber}</span>
                </p>
              )}
            </div>

            {/* 02 CUSTOMER NAME */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">02</span>
                <span>Customer Name <span className="text-red-500">*</span></span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Please enter..."
                  value={form.customerName}
                  onChange={(e) => handleInputChange('customerName', e.target.value)}
                  className={`w-full bg-zinc-50 dark:bg-zinc-950 border ${
                    errors.customerName 
                      ? 'border-red-500/60 focus:border-red-500' 
                      : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                  } rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400`}
                />
              </div>
              {errors.customerName && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.customerName}</span>
                </p>
              )}
            </div>

            {/* 03 IMEI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">03</span>
                  <span>IMEI</span>
                </label>
                <span className="text-[10px] text-zinc-400 italic">Optional • 15-digit code</span>
              </div>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  maxLength={15}
                  placeholder="Please enter..."
                  value={form.imei}
                  onChange={(e) => handleInputChange('imei', e.target.value.replace(/\D/g, ''))}
                  className={`w-full bg-zinc-50 dark:bg-zinc-950 border ${
                    errors.imei 
                      ? 'border-red-500/60 focus:border-red-500' 
                      : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                  } rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400`}
                />
              </div>
              {errors.imei && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.imei}</span>
                </p>
              )}
            </div>

            {/* 04 CATEGORY */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">04</span>
                <span>Category <span className="text-red-500">*</span></span>
              </label>
              <div className="relative">
                <Layers className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3.5" />
                <select
                  value={form.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className={`w-full appearance-none bg-zinc-50 dark:bg-zinc-950 border ${
                    errors.category 
                      ? 'border-red-500/60 focus:border-red-500' 
                      : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                  } rounded-xl pl-10 pr-8 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer`}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-3 pointer-events-none text-zinc-400">
                  ▼
                </div>
              </div>
              {errors.category && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.category}</span>
                </p>
              )}
            </div>

            {/* 05 TRX ID */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">05</span>
                  <span>Trx ID</span>
                </label>
                <span className="text-[10px] text-zinc-400 italic">Optional • Payment gateway transaction code</span>
              </div>
              <div className="relative">
                <FileText className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Please enter..."
                  value={form.trxId}
                  onChange={(e) => handleInputChange('trxId', e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400"
                />
              </div>
            </div>

            {/* 06 DETAIL */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">06</span>
                <span>Detail <span className="text-red-500">*</span></span>
              </label>
              <textarea
                rows={4}
                placeholder="Please enter..."
                value={form.detail}
                onChange={(e) => handleInputChange('detail', e.target.value)}
                className={`w-full bg-zinc-50 dark:bg-zinc-950 border ${
                  errors.detail 
                    ? 'border-red-500/60 focus:border-red-500' 
                    : 'border-zinc-200 dark:border-zinc-800 focus:border-amber-500'
                } rounded-xl px-4 py-3 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none placeholder:text-zinc-400`}
              />
              {errors.detail && (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{errors.detail}</span>
                </p>
              )}
            </div>

            {/* 07 ATTACHMENT */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-2">
                  <span className="w-5 h-5 flex items-center justify-center bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-mono text-[10px] rounded-md font-bold">07</span>
                  <span>Attachment</span>
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">Upload up to 3 items, Currently uploaded {attachments.length}/3 items</span>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                  dragActive 
                    ? 'border-amber-500 bg-amber-500/5 dark:bg-amber-500/2' 
                    : 'border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/20 hover:border-amber-500/50 hover:bg-zinc-100 dark:hover:bg-zinc-900/10'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  multiple
                  disabled={attachments.length >= 3}
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx"
                />
                
                <Upload className="w-6.5 h-6.5 mx-auto text-zinc-400 mb-2 animate-bounce" />
                <p className="text-[11px] font-bold text-zinc-700 dark:text-zinc-350">Drag and drop files here, or click to browse</p>
                <p className="text-[10px] text-zinc-400 mt-1">Supports PNG, JPG, PDF, Word (Max. 3 items)</p>
              </div>

              {/* Uploaded Attachments Chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {attachments.map((file, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-700 dark:text-zinc-300 animate-fadeIn"
                    >
                      {file.type.startsWith('image/') ? (
                        <Image className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      )}
                      <span className="truncate max-w-[120px] font-medium">{file.name}</span>
                      <span className="text-[9px] text-zinc-400 font-mono">({Math.round(file.size / 1024)} KB)</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                        className="text-zinc-400 hover:text-red-500 p-0.5 rounded cursor-pointer"
                        title="Remove file"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Block */}
            <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 flex gap-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Complaint...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-amber-200" />
                    <span>Submit CS Ticket</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: Submitted CS Tickets History & Detail Pane (col-span-5) */}
      <div className="lg:col-span-5 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20 text-left overflow-hidden">
        
        {/* Sub-header list filter */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/10 flex flex-col gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500 font-mono">CS Submission History ({submittedTickets.length})</h3>
            <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-mono">Logged Local</span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by Name, Category, Order..."
              value={ticketSearchQuery}
              onChange={(e) => setTicketSearchQuery(e.target.value)}
              className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-zinc-850 dark:text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Dynamic Splits: List + Selected Detail */}
        <div className="flex-1 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800/60 overflow-hidden">
          
          {/* Top Panel: Submitted lists */}
          <div className="h-2/5 overflow-y-auto divide-y divide-zinc-150 dark:divide-zinc-800/40 min-h-[140px]">
            {filteredSubmitted.length > 0 ? (
              filteredSubmitted.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-3 text-left transition-all cursor-pointer border-l-4 ${
                      isSelected
                        ? 'bg-zinc-100/80 dark:bg-zinc-800/40 border-amber-500'
                        : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900/10'
                    }`}
                  >
                    <div className="flex justify-between items-center gap-1.5 mb-1.5">
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full uppercase tracking-wider border border-amber-100/30 truncate max-w-[170px]">
                        {t.category}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">{new Date(t.submittedAt).toLocaleDateString()}</span>
                    </div>
                    
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-150 font-sans leading-tight line-clamp-1">{t.customerName}</h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">Order: {t.orderNumber}</p>
                      </div>
                      
                      <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 rounded font-bold font-mono uppercase tracking-wide shrink-0">
                        Pending
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center italic text-zinc-400 text-xs font-serif">
                No submitted CS tickets logged.
              </div>
            )}
          </div>

          {/* Bottom Panel: Selected Detail view */}
          <div className="flex-1 overflow-y-auto p-4 bg-white/50 dark:bg-zinc-900/5 text-left flex flex-col justify-between">
            {selectedTicket ? (
              <div className="space-y-4">
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Complaint Detail Logs</span>
                      <h3 className="font-serif font-bold text-sm text-zinc-800 dark:text-zinc-100 mt-1">{selectedTicket.customerName}</h3>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
                      ID: #{selectedTicket.id.substring(3, 10)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-850 rounded-lg">
                    <span className="text-[9px] font-bold text-zinc-400 block uppercase font-mono mb-0.5">Order Number</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-350">{selectedTicket.orderNumber}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-850 rounded-lg">
                    <span className="text-[9px] font-bold text-zinc-400 block uppercase font-mono mb-0.5">IMEI Number</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-350">{selectedTicket.imei || 'Not entered'}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-850 rounded-lg">
                    <span className="text-[9px] font-bold text-zinc-400 block uppercase font-mono mb-0.5">Complaint Category</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400 text-[10px] leading-tight">{selectedTicket.category}</span>
                  </div>
                  <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-850 rounded-lg">
                    <span className="text-[9px] font-bold text-zinc-400 block uppercase font-mono mb-0.5">Trx ID</span>
                    <span className="font-mono font-bold text-zinc-700 dark:text-zinc-350">{selectedTicket.trxId || 'Not entered'}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono">Detail Description</span>
                  <div className="bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-250 dark:border-zinc-850 rounded-xl p-3 text-xs leading-relaxed text-zinc-600 dark:text-zinc-350 whitespace-pre-line min-h-[70px]">
                    {selectedTicket.detail}
                  </div>
                </div>

                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-bold text-zinc-400 uppercase font-mono block">Ticket Attachments ({selectedTicket.attachments.length})</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTicket.attachments.map((file, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center gap-1 px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-[9px] text-zinc-500 font-mono"
                        >
                          <File className="w-3 h-3 text-amber-500" />
                          <span className="truncate max-w-[140px]">{file.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                <ClipboardList className="w-8 h-8 text-zinc-400 mb-1 animate-pulse" />
                <p className="text-[11px] font-serif italic text-center">Select a submitted ticket from the top list to audit full data fields.</p>
              </div>
            )}
            
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3 mt-4 text-center text-[9px] font-mono text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-3 h-3 text-amber-500 animate-pulse" />
              <span>Verified Agent Audit Record System</span>
            </div>
          </div>

        </div>
      </div>

      <ConfirmationModal
        isOpen={showClearConfirm}
        title="Clear Form Draft"
        message="Are you sure you want to clear the form draft? All unsaved inputs will be lost."
        confirmLabel="Clear Draft"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmClearDraft}
        onCancel={() => setShowClearConfirm(false)}
      />
    </div>
  );
}
