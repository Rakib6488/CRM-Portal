import React, { useState, useEffect } from 'react';
import { 
  Users, Search, Plus, Trash2, Edit, AlertCircle, Calendar, 
  MessageSquare, ChevronRight, FileText, CheckCircle, Clock,
  ArrowUpDown, Upload, Download, CheckSquare, Square, ArrowLeft,
  Activity, ShieldAlert, ChevronLeft, Filter, Tag, Check, RefreshCw
} from 'lucide-react';
import { CRMContact, SupportTicket, TicketResponse } from '../types';
import ConfirmationModal from './ConfirmationModal';
import CsvImportModal from './CsvImportModal';
import {
  saveContactToFirestore,
  deleteContactFromFirestore,
  saveTicketToFirestore,
  deleteTicketFromFirestore
} from '../firebase';

interface CrmSectionProps {
  contacts: CRMContact[];
  setContacts: React.Dispatch<React.SetStateAction<CRMContact[]>>;
  tickets: SupportTicket[];
  setTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  token: string | null;
  agentName: string;
  createSupportDoc: (
    token: string,
    ticket: SupportTicket,
    contact?: CRMContact
  ) => Promise<{ documentId: string; documentUrl: string }>;
  logActivity: (message: string) => void;
  subTabDefault?: 'contacts' | 'tickets';
}

export default function CrmSection({
  contacts,
  setContacts,
  tickets,
  setTickets,
  token,
  agentName,
  createSupportDoc,
  logActivity,
  subTabDefault
}: CrmSectionProps) {
  // Tabs for sub-navigation
  const [subTab, setSubTab] = useState<'contacts' | 'tickets'>(subTabDefault || 'tickets');

  useEffect(() => {
    if (subTabDefault) {
      setSubTab(subTabDefault);
    }
  }, [subTabDefault]);

  // Mobile View state: 'list' or 'detail'
  const [mobileDetailView, setMobileDetailView] = useState(false);

  // Search, Filter & Sorting states
  const [contactSearch, setContactSearch] = useState('');
  const [ticketSearch, setTicketSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  // Sorting
  const [contactSortKey, setContactSortKey] = useState<'name' | 'company' | 'status' | 'lastContactDate'>('name');
  const [contactSortDir, setContactSortDir] = useState<'asc' | 'desc'>('asc');
  const [ticketSortKey, setTicketSortKey] = useState<'createdAt' | 'priority' | 'status' | 'title'>('createdAt');
  const [ticketSortDir, setTicketSortDir] = useState<'asc' | 'desc'>('desc');

  // Pagination states
  const [contactPage, setContactPage] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Bulk Selection states
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);

  // Selected item detail states
  const [selectedContact, setSelectedContact] = useState<CRMContact | null>(contacts[0] || null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(tickets[0] || null);

  // Modal / Form Edit states
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'Lead' as CRMContact['status'],
    notes: ''
  });
  const [contactFormErrors, setContactFormErrors] = useState<Record<string, string>>({});

  const [showTicketModal, setShowTicketModal] = useState(false);
  const [editingTicket, setEditingTicket] = useState<SupportTicket | null>(null);
  const [ticketForm, setTicketForm] = useState({
    contactId: '',
    title: '',
    priority: 'Medium' as SupportTicket['priority'],
    status: 'Open' as SupportTicket['status'],
    category: 'General' as SupportTicket['category'],
    description: ''
  });
  const [ticketFormErrors, setTicketFormErrors] = useState<Record<string, string>>({});

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // CSV Import Modal state
  const [showCsvModal, setShowCsvModal] = useState(false);

  // Reply state & Export
  const [replyText, setReplyText] = useState('');
  const [isExportingDoc, setIsExportingDoc] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);

  // Reset pagination when filters change
  useEffect(() => {
    setContactPage(1);
  }, [contactSearch, contactSortKey, contactSortDir]);

  useEffect(() => {
    setTicketPage(1);
  }, [ticketSearch, statusFilter, priorityFilter, categoryFilter, ticketSortKey, ticketSortDir]);

  // Validation functions
  const validateContactForm = () => {
    const errs: Record<string, string> = {};
    if (!contactForm.name.trim()) errs.name = 'Full name is required';
    if (!contactForm.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/\S+@\S+\.\S+/.test(contactForm.email)) {
      errs.email = 'Valid email address format required (e.g. name@domain.com)';
    }
    if (!contactForm.company.trim()) errs.company = 'Company/organization is required';
    setContactFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateTicketForm = () => {
    const errs: Record<string, string> = {};
    if (!ticketForm.title.trim()) errs.title = 'Ticket subject/title is required';
    if (!ticketForm.description.trim()) errs.description = 'Issue description details are required';
    if (!ticketForm.contactId) errs.contactId = 'Please select a customer contact';
    setTicketFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Contact Handlers
  const handleOpenContactModal = (contact: CRMContact | null = null) => {
    setContactFormErrors({});
    if (contact) {
      setEditingContact(contact);
      setContactForm({
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        status: contact.status,
        notes: contact.notes
      });
    } else {
      setEditingContact(null);
      setContactForm({
        name: '',
        email: '',
        phone: '',
        company: '',
        status: 'Lead',
        notes: ''
      });
    }
    setShowContactModal(true);
  };

  const handleSaveContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateContactForm()) return;

    if (editingContact) {
      const updatedContact: CRMContact = { 
        ...editingContact, 
        ...contactForm, 
        lastContactDate: new Date().toISOString() 
      };
      saveContactToFirestore(updatedContact);
      setSelectedContact(updatedContact);
      logActivity(`Updated CRM customer profile for "${contactForm.name}"`);
    } else {
      const newContactItem: CRMContact = {
        id: `c-${Date.now()}`,
        ...contactForm,
        lastContactDate: new Date().toISOString()
      };
      saveContactToFirestore(newContactItem);
      setSelectedContact(newContactItem);
      logActivity(`Created new CRM customer profile for "${contactForm.name}"`);
    }
    setShowContactModal(false);
  };

  const handleDeleteContactConfirm = (id: string, name: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete CRM Contact',
      message: `Are you sure you want to permanently delete customer record for "${name}"? This action cannot be undone.`,
      onConfirm: () => {
        const contactToDelete = contacts.find(c => c.id === id);
        if (contactToDelete) {
          deleteContactFromFirestore(contactToDelete, agentName);
        }
        if (selectedContact?.id === id) {
          setSelectedContact(contacts.find(c => c.id !== id) || null);
        }
        logActivity(`Deleted CRM customer profile for "${name}"`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Ticket Handlers
  const handleOpenTicketModal = (ticket: SupportTicket | null = null) => {
    setTicketFormErrors({});
    if (ticket) {
      setEditingTicket(ticket);
      setTicketForm({
        contactId: ticket.contactId,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        category: ticket.category,
        description: ticket.description
      });
    } else {
      setEditingTicket(null);
      setTicketForm({
        contactId: contacts[0]?.id || '',
        title: '',
        priority: 'Medium',
        status: 'Open',
        category: 'General',
        description: ''
      });
    }
    setShowTicketModal(true);
  };

  const handleSaveTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTicketForm()) return;

    const matchedContact = contacts.find(c => c.id === ticketForm.contactId);
    const contactName = matchedContact ? matchedContact.name : 'Unknown Customer';

    if (editingTicket) {
      const updatedTicket: SupportTicket = {
        ...editingTicket,
        ...ticketForm,
        contactName
      };
      saveTicketToFirestore(updatedTicket);
      setSelectedTicket(updatedTicket);
      logActivity(`Updated support ticket #${editingTicket.id.substring(0, 5)}: "${ticketForm.title}"`);
    } else {
      const newTicketItem: SupportTicket = {
        id: `t-${Date.now()}`,
        contactName,
        ...ticketForm,
        createdAt: new Date().toISOString(),
        replies: []
      };
      saveTicketToFirestore(newTicketItem);
      setSelectedTicket(newTicketItem);
      logActivity(`Created new support ticket: "${ticketForm.title}"`);
    }
    setShowTicketModal(false);
  };

  const handleDeleteTicketConfirm = (id: string, title: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Support Ticket',
      message: `Are you sure you want to delete ticket "${title}"? All associated reply logs will be removed.`,
      onConfirm: () => {
        const ticketToDelete = tickets.find(t => t.id === id);
        if (ticketToDelete) {
          deleteTicketFromFirestore(ticketToDelete, agentName);
        }
        if (selectedTicket?.id === id) {
          setSelectedTicket(tickets.find(t => t.id !== id) || null);
        }
        logActivity(`Deleted support ticket: "${title}"`);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Reply handler
  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    const newReply: TicketResponse = {
      id: `r-${Date.now()}`,
      ticketId: selectedTicket.id,
      text: replyText.trim(),
      author: agentName || 'System Agent',
      createdAt: new Date().toISOString()
    };

    const updatedTicket: SupportTicket = {
      ...selectedTicket,
      status: 'In Progress',
      replies: [...(selectedTicket.replies || []), newReply]
    };

    saveTicketToFirestore(updatedTicket);
    setSelectedTicket(updatedTicket);
    setReplyText('');
    logActivity(`Added response message to ticket #${selectedTicket.id.substring(0, 5)}`);
  };

  // Bulk Actions
  const handleToggleSelectAllContacts = () => {
    if (selectedContactIds.length === filteredContacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(filteredContacts.map(c => c.id));
    }
  };

  const handleToggleSelectContact = (id: string) => {
    setSelectedContactIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteContacts = () => {
    if (selectedContactIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Delete ${selectedContactIds.length} Contacts`,
      message: `Are you sure you want to delete ${selectedContactIds.length} selected customer records?`,
      onConfirm: () => {
        selectedContactIds.forEach(id => {
          const c = contacts.find(item => item.id === id);
          if (c) deleteContactFromFirestore(c, agentName);
        });
        logActivity(`Bulk deleted ${selectedContactIds.length} CRM contacts.`);
        setSelectedContactIds([]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleSelectAllTickets = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(filteredTickets.map(t => t.id));
    }
  };

  const handleToggleSelectTicket = (id: string) => {
    setSelectedTicketIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDeleteTickets = () => {
    if (selectedTicketIds.length === 0) return;
    setConfirmModal({
      isOpen: true,
      title: `Delete ${selectedTicketIds.length} Tickets`,
      message: `Are you sure you want to delete ${selectedTicketIds.length} selected support tickets?`,
      onConfirm: () => {
        selectedTicketIds.forEach(id => {
          const t = tickets.find(item => item.id === id);
          if (t) deleteTicketFromFirestore(t, agentName);
        });
        logActivity(`Bulk deleted ${selectedTicketIds.length} support tickets.`);
        setSelectedTicketIds([]);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleBulkUpdateTicketStatus = (newStatus: SupportTicket['status']) => {
    if (selectedTicketIds.length === 0) return;
    selectedTicketIds.forEach(id => {
      const t = tickets.find(item => item.id === id);
      if (t) saveTicketToFirestore({ ...t, status: newStatus });
    });
    logActivity(`Bulk changed status of ${selectedTicketIds.length} tickets to ${newStatus}`);
    setSelectedTicketIds([]);
  };

  // Google Support Dossier Export
  const handleCreateSupportDossier = async () => {
    if (!selectedTicket) return;
    if (!token) {
      alert("⚠️ Google authentication token is missing or expired. Please sign in via the top-bar workspace Google Auth button first.");
      return;
    }

    setIsExportingDoc(true);
    setExportedDocUrl(null);
    try {
      const linkedContact = contacts.find(c => c.id === selectedTicket.contactId);
      const result = await createSupportDoc(token, selectedTicket, linkedContact);
      setExportedDocUrl(result.documentUrl);
      logActivity(`Created Google Doc Support Dossier for ticket: "${selectedTicket.title}"`);
    } catch (err: any) {
      alert(`Error exporting support dossier: ${err.message || err}`);
    } finally {
      setIsExportingDoc(false);
    }
  };

  // Filtering & Sorting Contacts
  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(contactSearch.toLowerCase())
  ).sort((a, b) => {
    const factor = contactSortDir === 'asc' ? 1 : -1;
    if (contactSortKey === 'name') return a.name.localeCompare(b.name) * factor;
    if (contactSortKey === 'company') return a.company.localeCompare(b.company) * factor;
    if (contactSortKey === 'status') return a.status.localeCompare(b.status) * factor;
    if (contactSortKey === 'lastContactDate') return (new Date(a.lastContactDate).getTime() - new Date(b.lastContactDate).getTime()) * factor;
    return 0;
  });

  // Filtering & Sorting Tickets
  const filteredTickets = tickets.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.contactName.toLowerCase().includes(ticketSearch.toLowerCase()) ||
      t.id.toLowerCase().includes(ticketSearch.toLowerCase());
    
    const matchesPriority = priorityFilter === 'All' || t.priority === priorityFilter;
    const matchesStatus = statusFilter === 'All' || t.status === statusFilter;
    const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;

    return matchesSearch && matchesPriority && matchesStatus && matchesCategory;
  }).sort((a, b) => {
    const factor = ticketSortDir === 'asc' ? 1 : -1;
    if (ticketSortKey === 'title') return a.title.localeCompare(b.title) * factor;
    if (ticketSortKey === 'priority') return a.priority.localeCompare(b.priority) * factor;
    if (ticketSortKey === 'status') return a.status.localeCompare(b.status) * factor;
    if (ticketSortKey === 'createdAt') return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * factor;
    return 0;
  });

  // Paginated contacts & tickets
  const totalContactPages = Math.max(1, Math.ceil(filteredContacts.length / pageSize));
  const paginatedContacts = filteredContacts.slice((contactPage - 1) * pageSize, contactPage * pageSize);

  const totalTicketPages = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const paginatedTickets = filteredTickets.slice((ticketPage - 1) * pageSize, ticketPage * pageSize);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      
      {/* Tab bar header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900/60 gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSubTab('tickets');
              setMobileDetailView(false);
            }}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'tickets' 
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Support Tickets ({tickets.length})
          </button>
          <button
            onClick={() => {
              setSubTab('contacts');
              setMobileDetailView(false);
            }}
            className={`px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
              subTab === 'contacts' 
                ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' 
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            CRM Contacts ({contacts.length})
          </button>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCsvModal(true)}
            className="flex items-center space-x-1.5 px-3 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => subTab === 'tickets' ? handleOpenTicketModal() : handleOpenContactModal()}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition-all shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{subTab === 'tickets' ? 'New Ticket' : 'New Contact'}</span>
          </button>
        </div>
      </div>

      {subTab === 'tickets' ? (
        /* --- TICKETS SECTION --- */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left panel: tickets list (Responsive mobile detail toggle) */}
          <div className={`lg:col-span-5 border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-full bg-white dark:bg-slate-900/20 ${mobileDetailView ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Search and Filters */}
            <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search tickets by title, customer, or ID..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder:text-slate-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="All">All Priorities</option>
                    <option value="Urgent">Urgent</option>
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Category</label>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-md px-2 py-1 text-xs text-slate-700 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="All">All Categories</option>
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="General">General</option>
                    <option value="Feature Request">Feature Req</option>
                  </select>
                </div>
              </div>

              {/* Sorting and Bulk bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-2 text-xs">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Sort by:</span>
                  <button 
                    onClick={() => {
                      if (ticketSortKey === 'createdAt') setTicketSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setTicketSortKey('createdAt'); setTicketSortDir('desc'); }
                    }}
                    className={`px-2 py-0.5 rounded text-xs flex items-center space-x-1 ${ticketSortKey === 'createdAt' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold' : 'text-slate-500'}`}
                  >
                    <span>Date</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => {
                      if (ticketSortKey === 'priority') setTicketSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setTicketSortKey('priority'); setTicketSortDir('asc'); }
                    }}
                    className={`px-2 py-0.5 rounded text-xs flex items-center space-x-1 ${ticketSortKey === 'priority' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold' : 'text-slate-500'}`}
                  >
                    <span>Priority</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </div>

                {selectedTicketIds.length > 0 && (
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">{selectedTicketIds.length} sel</span>
                    <button 
                      onClick={handleBulkDeleteTickets}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      title="Delete Selected"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-500" />
                  <p className="text-sm font-medium">No tickets match search or filters</p>
                  <p className="text-xs text-slate-400 mt-1">Try resetting filters or adding a new ticket</p>
                </div>
              ) : (
                paginatedTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  const isChecked = selectedTicketIds.includes(t.id);

                  let priorityBadge = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300';
                  if (t.priority === 'Urgent') priorityBadge = 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
                  else if (t.priority === 'High') priorityBadge = 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';

                  let statusBadge = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  if (t.status === 'Open') statusBadge = 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
                  else if (t.status === 'In Progress') statusBadge = 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';
                  else if (t.status === 'Resolved') statusBadge = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setSelectedTicket(t);
                        setMobileDetailView(true);
                      }}
                      className={`p-4 cursor-pointer transition-colors relative group border-l-4 ${
                        isSelected 
                          ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/20' 
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectTicket(t.id);
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-1">
                            {t.title}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${priorityBadge}`}>
                          {t.priority}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2 pl-6">
                        {t.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pl-6">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{t.contactName}</span>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-[10px] rounded-md font-medium ${statusBadge}`}>
                            {t.status}
                          </span>
                          <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalTicketPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <span>Page {ticketPage} of {totalTicketPages} ({filteredTickets.length} items)</span>
                <div className="flex items-center space-x-1">
                  <button 
                    disabled={ticketPage === 1}
                    onClick={() => setTicketPage(p => Math.max(1, p - 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    disabled={ticketPage === totalTicketPages}
                    onClick={() => setTicketPage(p => Math.min(totalTicketPages, p + 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: ticket detail (lg:col-span-7) */}
          <div className={`lg:col-span-7 flex flex-col h-full bg-white dark:bg-slate-900/40 overflow-y-auto ${!mobileDetailView ? 'hidden lg:flex' : 'flex'}`}>
            {selectedTicket ? (
              <div className="p-6 space-y-6 flex-1">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setMobileDetailView(false)}
                  className="lg:hidden flex items-center space-x-1 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to ticket list</span>
                </button>

                {/* Ticket Header Card */}
                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                          #{selectedTicket.id.substring(0, 8)}
                        </span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          {selectedTicket.category}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {selectedTicket.title}
                      </h2>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenTicketModal(selectedTicket)}
                        className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        title="Edit Ticket"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteTicketConfirm(selectedTicket.id, selectedTicket.title)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        title="Delete Ticket"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-3 border-t border-slate-200">
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Customer</span>
                      <span className="font-semibold text-slate-800">{selectedTicket.contactName}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Priority</span>
                      <span className="font-semibold text-amber-600">{selectedTicket.priority}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Status</span>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => {
                          const newStat = e.target.value as SupportTicket['status'];
                          setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, status: newStat } : t));
                          setSelectedTicket({ ...selectedTicket, status: newStat });
                          logActivity(`Changed ticket #${selectedTicket.id.substring(0, 5)} status to ${newStat}`);
                        }}
                        className="mt-0.5 bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs font-semibold text-purple-600 focus:outline-none"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Created Date</span>
                      <span className="font-semibold text-slate-700">{new Date(selectedTicket.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Description details */}
                <div className="p-5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Issue Details
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.description}
                  </p>
                </div>

                {/* Google Docs Export Dossier Button */}
                <div className="flex items-center justify-between p-4 bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">
                      Workspace Integration: Export Support Dossier
                    </h4>
                    <p className="text-[11px] text-purple-700/80 dark:text-purple-400">
                      Generate official Google Doc summary of ticket status & responses
                    </p>
                  </div>
                  <button
                    onClick={handleCreateSupportDossier}
                    disabled={isExportingDoc}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center space-x-1.5 shadow-sm focus:ring-2 focus:ring-purple-500 focus:outline-none disabled:opacity-50"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>{isExportingDoc ? 'Exporting...' : 'Export Doc'}</span>
                  </button>
                </div>

                {exportedDocUrl && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                    <span>Google Doc Support Dossier successfully generated!</span>
                    <a 
                      href={exportedDocUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="underline font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900"
                    >
                      Open Document →
                    </a>
                  </div>
                )}

                {/* Conversation & Replies Activity Timeline */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-purple-600" />
                    <span>Communication & Response Timeline ({selectedTicket.replies?.length || 0})</span>
                  </h3>

                  <div className="space-y-3">
                    {/* Original ticket log */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center justify-between mb-1 text-xs">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{selectedTicket.contactName} (Customer)</span>
                        <span className="text-slate-500 dark:text-slate-400">{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">
                        Submitted ticket: "{selectedTicket.title}"
                      </p>
                    </div>

                    {/* Replies */}
                    {selectedTicket.replies?.map((r) => (
                      <div key={r.id} className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800/40 ml-4">
                        <div className="flex items-center justify-between mb-1 text-xs">
                          <span className="font-bold text-purple-700 dark:text-purple-300">{r.author} (Agent)</span>
                          <span className="text-slate-500 dark:text-slate-400">{new Date(r.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                          {r.text}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Add Reply Input Form */}
                  <form onSubmit={handleSendReply} className="pt-2">
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Add Agent Reply / Note
                    </label>
                    <textarea
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your official customer reply or internal note..."
                      className="w-full p-3 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-purple-600 focus:outline-none placeholder:text-slate-400"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="submit"
                        disabled={!replyText.trim()}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-lg transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        Send Reply
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 my-auto">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-500" />
                <p className="text-base font-semibold">Select a support ticket to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- CONTACTS SECTION --- */
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          
          {/* Left panel: contacts list (Responsive mobile detail toggle) */}
          <div className={`lg:col-span-5 border-r border-slate-200 dark:border-slate-800/80 flex flex-col h-full bg-white dark:bg-slate-900/20 ${mobileDetailView ? 'hidden lg:flex' : 'flex'}`}>
            
            {/* Search & Sorting Controls */}
            <div className="p-4 space-y-3 border-b border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search contacts by name, company, or email..."
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600 placeholder:text-slate-400"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">Sort:</span>
                  <button 
                    onClick={() => {
                      if (contactSortKey === 'name') setContactSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setContactSortKey('name'); setContactSortDir('asc'); }
                    }}
                    className={`px-2 py-0.5 rounded text-xs flex items-center space-x-1 ${contactSortKey === 'name' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold' : 'text-slate-500'}`}
                  >
                    <span>Name</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                  <button 
                    onClick={() => {
                      if (contactSortKey === 'company') setContactSortDir(d => d === 'asc' ? 'desc' : 'asc');
                      else { setContactSortKey('company'); setContactSortDir('asc'); }
                    }}
                    className={`px-2 py-0.5 rounded text-xs flex items-center space-x-1 ${contactSortKey === 'company' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-semibold' : 'text-slate-500'}`}
                  >
                    <span>Company</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </button>
                </div>

                {selectedContactIds.length > 0 && (
                  <div className="flex items-center space-x-1 text-xs">
                    <span className="text-purple-600 dark:text-purple-400 font-semibold">{selectedContactIds.length} selected</span>
                    <button 
                      onClick={handleBulkDeleteContacts}
                      className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                      title="Delete Selected Contacts"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* List container */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredContacts.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-slate-500">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30 text-purple-500" />
                  <p className="text-sm font-medium">No contacts match search query</p>
                  <p className="text-xs text-slate-400 mt-1">Try clearing search or adding a new contact</p>
                </div>
              ) : (
                paginatedContacts.map((c) => {
                  const isSelected = selectedContact?.id === c.id;
                  const isChecked = selectedContactIds.includes(c.id);

                  let statusBadge = 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
                  if (c.status === 'VIP') statusBadge = 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 font-bold';
                  else if (c.status === 'Active') statusBadge = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300';
                  else if (c.status === 'Lead') statusBadge = 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';

                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        setSelectedContact(c);
                        setMobileDetailView(true);
                      }}
                      className={`p-4 cursor-pointer transition-colors relative group border-l-4 ${
                        isSelected 
                          ? 'border-purple-600 bg-purple-50/60 dark:bg-purple-950/20' 
                          : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleToggleSelectContact(c.id);
                            }}
                            className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {c.name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusBadge}`}>
                          {c.status}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 pl-6 space-y-0.5">
                        <p className="font-medium text-slate-700 dark:text-slate-300">{c.company}</p>
                        <p>{c.email} • {c.phone}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalContactPages > 1 && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-xs text-slate-500">
                <span>Page {contactPage} of {totalContactPages} ({filteredContacts.length} contacts)</span>
                <div className="flex items-center space-x-1">
                  <button 
                    disabled={contactPage === 1}
                    onClick={() => setContactPage(p => Math.max(1, p - 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    disabled={contactPage === totalContactPages}
                    onClick={() => setContactPage(p => Math.min(totalContactPages, p + 1))}
                    className="p-1 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel: contact detail (lg:col-span-7) */}
          <div className={`lg:col-span-7 flex flex-col h-full bg-white dark:bg-slate-900/40 overflow-y-auto ${!mobileDetailView ? 'hidden lg:flex' : 'flex'}`}>
            {selectedContact ? (
              <div className="p-6 space-y-6 flex-1">
                {/* Mobile Back Button */}
                <button
                  onClick={() => setMobileDetailView(false)}
                  className="lg:hidden flex items-center space-x-1 text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to contact directory</span>
                </button>

                <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-mono text-purple-600 dark:text-purple-400 font-semibold">
                        #{selectedContact.id}
                      </span>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {selectedContact.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedContact.company}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleOpenContactModal(selectedContact)}
                        className="p-2 text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        title="Edit Contact"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteContactConfirm(selectedContact.id, selectedContact.name)}
                        className="p-2 text-slate-500 hover:text-red-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
                        title="Delete Contact"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-3 border-t border-slate-200">
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Email</span>
                      <span className="font-semibold text-slate-800">{selectedContact.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Phone</span>
                      <span className="font-semibold text-slate-800">{selectedContact.phone || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-600 block text-[10px] uppercase font-bold">Status</span>
                      <span className="font-semibold text-purple-600">{selectedContact.status}</span>
                    </div>
                  </div>
                </div>

                {/* Notes & Overview */}
                <div className="p-5 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/80">
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Customer Notes & Context
                  </h3>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedContact.notes || 'No notes provided for this customer profile.'}
                  </p>
                </div>

                {/* Associated Tickets for this contact */}
                <div>
                  <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                    Associated Support Tickets ({tickets.filter(t => t.contactId === selectedContact.id || t.contactName === selectedContact.name).length})
                  </h3>
                  <div className="space-y-2">
                    {tickets.filter(t => t.contactId === selectedContact.id || t.contactName === selectedContact.name).map((t) => (
                      <div key={t.id} className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100">{t.title}</div>
                          <div className="text-[11px] text-slate-500">#{t.id.substring(0, 8)} • Priority: {t.priority}</div>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 dark:text-slate-500 my-auto">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30 text-purple-500" />
                <p className="text-base font-semibold">Select a customer profile to view details</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- ADD/EDIT CONTACT MODAL --- */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editingContact ? 'Edit Customer Profile' : 'Add New CRM Contact'}
              </h3>
              <button onClick={() => setShowContactModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                {contactFormErrors.name && <p className="text-[11px] text-red-500 mt-1">{contactFormErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    placeholder="sarah@acme.com"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                  {contactFormErrors.email && <p className="text-[11px] text-red-500 mt-1">{contactFormErrors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={contactForm.phone}
                    onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                    placeholder="+1 (555) 019-2834"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company / Org *</label>
                  <input
                    type="text"
                    value={contactForm.company}
                    onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })}
                    placeholder="Acme Global Inc"
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  />
                  {contactFormErrors.company && <p className="text-[11px] text-red-500 mt-1">{contactFormErrors.company}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={contactForm.status}
                    onChange={(e) => setContactForm({ ...contactForm, status: e.target.value as CRMContact['status'] })}
                    className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                  >
                    <option value="Lead">Lead</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={contactForm.notes}
                  onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                  placeholder="Key account details, preferences, or contact notes..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {editingContact ? 'Save Changes' : 'Create Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT TICKET MODAL --- */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {editingTicket ? 'Edit Support Ticket' : 'Create Support Ticket'}
              </h3>
              <button onClick={() => setShowTicketModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Customer Contact *</label>
                <select
                  value={ticketForm.contactId}
                  onChange={(e) => setTicketForm({ ...ticketForm, contactId: e.target.value })}
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                >
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.name} ({c.company})</option>
                  ))}
                </select>
                {ticketFormErrors.contactId && <p className="text-[11px] text-red-500 mt-1">{ticketFormErrors.contactId}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Title / Subject *</label>
                <input
                  type="text"
                  value={ticketForm.title}
                  onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                  placeholder="e.g. Cannot access billing invoice PDF"
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                {ticketFormErrors.title && <p className="text-[11px] text-red-500 mt-1">{ticketFormErrors.title}</p>}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as SupportTicket['priority'] })}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={ticketForm.status}
                    onChange={(e) => setTicketForm({ ...ticketForm, status: e.target.value as SupportTicket['status'] })}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value as SupportTicket['category'] })}
                    className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100"
                  >
                    <option value="Billing">Billing</option>
                    <option value="Technical">Technical</option>
                    <option value="General">General</option>
                    <option value="Feature Request">Feature Request</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Issue Description *</label>
                <textarea
                  rows={4}
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                  placeholder="Provide detailed description of the customer issue..."
                  className="w-full p-2.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                />
                {ticketFormErrors.description && <p className="text-[11px] text-red-500 mt-1">{ticketFormErrors.description}</p>}
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTicketModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors focus:ring-2 focus:ring-purple-500 focus:outline-none"
                >
                  {editingTicket ? 'Save Ticket Changes' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={showCsvModal}
        type={subTab}
        onClose={() => setShowCsvModal(false)}
        onImportContacts={(newContacts) => {
          setContacts(prev => [...newContacts, ...prev]);
        }}
        onImportTickets={(newTickets) => {
          setTickets(prev => [...newTickets, ...prev]);
        }}
        logActivity={logActivity}
      />

    </div>
  );
}
