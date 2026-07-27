import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Users, MessageSquare, Calendar, BookOpen, ChevronRight, User } from 'lucide-react';
import { CRMContact, SupportTicket, KBArticle, AgentCredential } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacts: CRMContact[];
  tickets: SupportTicket[];
  kbArticles: KBArticle[];
  agentCredentials: AgentCredential[];
  onNavigateToTab: (tab: string, itemId?: string) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  contacts,
  tickets,
  kbArticles,
  agentCredentials,
  onNavigateToTab
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = query.trim().toLowerCase();

  const filteredContacts = trimmed 
    ? contacts.filter(c => c.name.toLowerCase().includes(trimmed) || c.email.toLowerCase().includes(trimmed) || c.company.toLowerCase().includes(trimmed))
    : [];

  const filteredTickets = trimmed
    ? tickets.filter(t => t.title.toLowerCase().includes(trimmed) || t.contactName.toLowerCase().includes(trimmed) || t.id.toLowerCase().includes(trimmed) || t.description.toLowerCase().includes(trimmed))
    : [];

  const filteredArticles = trimmed
    ? kbArticles.filter(a => a.title.toLowerCase().includes(trimmed) || a.content.toLowerCase().includes(trimmed) || a.category.toLowerCase().includes(trimmed))
    : [];

  const filteredUsers = trimmed
    ? agentCredentials.filter(u => u.name.toLowerCase().includes(trimmed) || u.agentId.toLowerCase().includes(trimmed) || u.role.toLowerCase().includes(trimmed))
    : [];

  const totalResults = filteredContacts.length + filteredTickets.length + filteredArticles.length + filteredUsers.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Search Header Input */}
        <div className="relative flex items-center px-4 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/50">
          <Search className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Global search across contacts, tickets, roster, knowledge base..."
            className="w-full py-4 px-3 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base font-medium"
          />
          <button 
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results Container */}
        <div className="p-4 overflow-y-auto space-y-6 flex-1">
          {trimmed.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40 text-purple-500" />
              <p className="text-sm">Type anything to search across CRM Contacts, Tickets, Users & KB Articles</p>
              <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-slate-400">
                <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 font-mono">Esc</kbd>
                <span>to close</span>
              </div>
            </div>
          ) : totalResults === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <p className="text-base font-medium">No matches found for "{query}"</p>
              <p className="text-xs text-slate-400 mt-1">Try searching by name, email, ticket title, or topic</p>
            </div>
          ) : (
            <>
              {/* Contacts Matches */}
              {filteredContacts.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                    <Users className="w-4 h-4" />
                    <span>Contacts ({filteredContacts.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredContacts.slice(0, 4).map(c => (
                      <div
                        key={c.id}
                        onClick={() => {
                          onNavigateToTab('crm', c.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {c.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {c.email} • {c.company}
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tickets Matches */}
              {filteredTickets.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                    <MessageSquare className="w-4 h-4" />
                    <span>Support Tickets ({filteredTickets.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredTickets.slice(0, 4).map(t => (
                      <div
                        key={t.id}
                        onClick={() => {
                          onNavigateToTab('crm', t.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {t.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Customer: {t.contactName} • #{t.id.substring(0, 6)}
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KB Matches */}
              {filteredArticles.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                    <BookOpen className="w-4 h-4" />
                    <span>Knowledge Base ({filteredArticles.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredArticles.slice(0, 4).map(a => (
                      <div
                        key={a.id}
                        onClick={() => {
                          onNavigateToTab('kb', a.id);
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {a.title}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            Category: {a.category} • {a.content}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Matches */}
              {filteredUsers.length > 0 && (
                <div>
                  <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
                    <User className="w-4 h-4" />
                    <span>Team & Users ({filteredUsers.length})</span>
                  </div>
                  <div className="space-y-1">
                    {filteredUsers.slice(0, 4).map(u => (
                      <div
                        key={u.agentId}
                        onClick={() => {
                          onNavigateToTab('admin', u.agentId);
                          onClose();
                        }}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-purple-50 dark:hover:bg-slate-700/60 cursor-pointer transition-colors group"
                      >
                        <div>
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                            {u.name} ({u.agentId})
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Role: {u.role}
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {u.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700/80 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Showing top matches across system database</span>
          <span>Press ESC to dismiss</span>
        </div>
      </div>
    </div>
  );
}
