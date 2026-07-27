import React, { useState, useRef, useEffect } from 'react';
import { 
  BookOpen, Search, Plus, Trash2, Edit, Tag, Clock, UserCheck,
  Sparkles, Send, Globe, RefreshCw, AlertCircle, ExternalLink, ArrowRight
} from 'lucide-react';
import { KBArticle } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface KbSectionProps {
  kbArticles: KBArticle[];
  setKbArticles: React.Dispatch<React.SetStateAction<KBArticle[]>>;
  agentName: string;
  logActivity: (message: string) => void;
  userRole?: 'AGENT' | 'ADMIN';
}

interface SearchMessage {
  role: 'user' | 'model';
  text: string;
  sources?: Array<{ title: string; uri: string }>;
}

export default function KbSection({
  kbArticles,
  setKbArticles,
  agentName,
  logActivity,
  userRole = 'AGENT'
}: KbSectionProps) {
  // Navigation mode
  const [kbMode, setKbMode] = useState<'docs' | 'ai_search'>('docs');

  // Local Docs states
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<KBArticle | null>(kbArticles[0] || null);

  // Modal / Form states
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KBArticle | null>(null);
  const [articleForm, setArticleForm] = useState({
    title: '',
    category: 'APP Issue',
    content: ''
  });

  // AI Search states
  const [aiHistory, setAiHistory] = useState<SearchMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aiHistory, aiSearching]);

  const searchSuggestions = [
    { label: "Pending transfer timeline", query: "How do we resolve a PalmPay transaction stuck in a 'Pending' state and when is it reversed?" },
    { label: "Account KYC tiers & limits", query: "What are the transaction caps and documentation requirements for PalmPay Tiers 1, 2, and 3?" },
    { label: "POS 'Issuer Inoperative' guide", query: "How should agents troubleshoot POS connection drops or 'Issuer Inoperative' errors?" },
    { label: "Agent commission payouts", query: "What are the commission percentages for cash-out withdrawals and how do agents execute cashouts?" },
  ];

  // AI Search Trigger
  const handleAiSearch = async (queryText: string) => {
    if (!queryText.trim() || aiSearching) return;

    const userMsg: SearchMessage = { role: 'user', text: queryText };
    setAiHistory(prev => [...prev, userMsg]);
    setAiInput('');
    setAiSearching(true);
    setAiError(null);

    try {
      const formattedHistory = aiHistory.map(h => ({
        role: h.role,
        text: h.text
      }));

      const response = await fetch("/api/gemini/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryText,
          history: formattedHistory
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const modelMsg: SearchMessage = {
        role: 'model',
        text: data.text,
        sources: data.sources || []
      };

      setAiHistory(prev => [...prev, modelMsg]);
      logActivity(`Used AI Search Grounding for query: "${queryText.substring(0, 40)}..."`);
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || "An error occurred during search grounding.");
    } finally {
      setAiSearching(false);
    }
  };

  const resetAiChat = () => {
    setAiHistory([]);
    setAiInput('');
    setAiError(null);
  };

  // Local Docs actions
  const handleOpenArticleModal = (article: KBArticle | null = null) => {
    if (article) {
      setEditingArticle(article);
      setArticleForm({
        title: article.title,
        category: article.category,
        content: article.content
      });
    } else {
      setEditingArticle(null);
      setArticleForm({
        title: '',
        category: 'APP Issue',
        content: ''
      });
    }
    setShowArticleModal(true);
  };

  const handleSaveArticle = (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'ADMIN') {
      alert('Permission denied. Only admins can add or edit knowledge base articles.');
      return;
    }
    const nowStr = new Date().toISOString();

    if (editingArticle) {
      const updated = kbArticles.map(a => a.id === editingArticle.id ? {
        ...a,
        ...articleForm,
        updatedAt: nowStr
      } : a);
      setKbArticles(updated);
      setSelectedArticle({
        ...editingArticle,
        ...articleForm,
        updatedAt: nowStr
      });
      logActivity(`Updated Knowledge Base article: "${articleForm.title}"`);
    } else {
      const newArt: KBArticle = {
        id: `kb-${Date.now()}`,
        title: articleForm.title,
        category: articleForm.category,
        content: articleForm.content,
        author: agentName || 'System Admin',
        createdAt: nowStr,
        updatedAt: nowStr
      };
      setKbArticles([newArt, ...kbArticles]);
      setSelectedArticle(newArt);
      logActivity(`Created new Knowledge Base article: "${articleForm.title}"`);
    }
    setShowArticleModal(false);
  };

  const [deleteArticleConfirm, setDeleteArticleConfirm] = useState<{ id: string; title: string } | null>(null);

  const handleDeleteArticle = (id: string, title: string) => {
    if (userRole !== 'ADMIN') {
      alert('Permission denied. Only admins can delete knowledge base articles.');
      return;
    }
    setDeleteArticleConfirm({ id, title });
  };

  const handleConfirmDeleteArticle = () => {
    if (!deleteArticleConfirm) return;
    const { id, title } = deleteArticleConfirm;
    setKbArticles(kbArticles.filter(a => a.id !== id));
    if (selectedArticle?.id === id) {
      setSelectedArticle(kbArticles.find(a => a.id !== id) || null);
    }
    logActivity(`Deleted Knowledge Base article: "${title}"`);
    setDeleteArticleConfirm(null);
  };

  // Filter Local Docs
  const categories = ['All', 'APP Issue', 'Payment method', 'Unable to pay', 'Lock', 'Watermark issue', 'Refund Issue', 'Reset Phone', 'Policy'];
  const filteredArticles = kbArticles.filter(art => {
    const matchesCategory = activeCategory === 'All' || art.category === activeCategory;
    const matchesSearch = art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      art.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Custom Inline Markdown Parser
  const parseInlineMarkdown = (text: string) => {
    // Bold parser (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-bold text-zinc-900 dark:text-white">{part.slice(2, -2)}</strong>;
      }
      
      // Inline code (`code`)
      const codeParts = part.split(/(`.*?`)/g);
      return codeParts.map((subPart, j) => {
        if (subPart.startsWith('`') && subPart.endsWith('`')) {
          return <code key={j} className="bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">{subPart.slice(1, -1)}</code>;
        }
        return subPart;
      });
    });
  };

  const renderMarkdown = (text: string) => {
    if (!text) return null;
    
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('```')) {
        return null; // Skip markdown container ticks
      }
      
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="text-xs font-bold text-zinc-850 dark:text-zinc-200 mt-3 mb-1.5 font-sans tracking-wide">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2 font-sans tracking-wide">{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('# ')) {
        return <h2 key={idx} className="text-base font-bold text-zinc-900 dark:text-zinc-50 mt-4 mb-2 font-sans tracking-wide">{line.replace('# ', '')}</h2>;
      }

      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const cleanLine = line.trim().replace(/^[\*\-]\s+/, '');
        return (
          <li key={idx} className="ml-4 list-disc text-[11px] text-zinc-600 dark:text-zinc-300 my-1 leading-relaxed">
            {parseInlineMarkdown(cleanLine)}
          </li>
        );
      }

      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <li key={idx} className="ml-4 list-decimal text-[11px] text-zinc-600 dark:text-zinc-300 my-1 leading-relaxed">
            {parseInlineMarkdown(numMatch[2])}
          </li>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed my-1.5 font-sans">
          {parseInlineMarkdown(line)}
        </p>
      );
    });
  };

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden h-[calc(100vh-120px)] bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn">
      
      {/* Left panel: Mode switch + specific list (col-span-4) */}
      <div className="lg:col-span-4 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full bg-white dark:bg-zinc-900/10 text-left">
        
        {/* Mode Selector Tab Bar */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/60 p-2 gap-1 shrink-0">
          <button
            onClick={() => setKbMode('docs')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              kbMode === 'docs'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/40'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Local SOP Docs</span>
          </button>
          <button
            onClick={() => setKbMode('ai_search')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
              kbMode === 'ai_search'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900/40'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span>AI Search Assistant</span>
          </button>
        </div>

        {kbMode === 'docs' ? (
          <>
            {/* Header search / create for local docs */}
            <div className="p-4 space-y-3 border-b border-zinc-200 dark:border-zinc-800/60">
              <div className="flex justify-between items-center gap-2">
                <h3 className="font-bold font-serif text-sm text-zinc-800 dark:text-zinc-200">Knowledge Base</h3>
                {userRole === 'ADMIN' ? (
                  <button
                    onClick={() => handleOpenArticleModal()}
                    className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase rounded-md tracking-wider transition-all cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Doc
                  </button>
                ) : (
                  <span className="text-[9px] font-mono font-bold text-zinc-400 dark:text-zinc-550 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    View-Only Mode
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search resource articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 placeholder:text-zinc-500 font-sans"
                />
              </div>

              {/* Quick categories horizontal bar */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md tracking-wider border shrink-0 transition-all cursor-pointer ${
                      activeCategory === cat
                        ? 'bg-zinc-800 dark:bg-zinc-850 text-amber-500 border-zinc-800 dark:border-zinc-700'
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-850 text-zinc-500 hover:text-zinc-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Local Article list */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800/40">
              {filteredArticles.length > 0 ? (
                filteredArticles.map(art => {
                  const isSelected = selectedArticle?.id === art.id;
                  return (
                    <div
                      key={art.id}
                      onClick={() => setSelectedArticle(art)}
                      className={`p-4 text-left transition-all cursor-pointer border-l-4 ${
                        isSelected
                          ? 'bg-zinc-100/70 dark:bg-zinc-800/45 border-amber-600 dark:border-amber-500'
                          : 'border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-850/30'
                      }`}
                    >
                      <div className="flex justify-between items-center gap-2 mb-1">
                        <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">{art.category}</span>
                        <span className="text-[9px] text-zinc-400 dark:text-zinc-550 font-mono">{new Date(art.updatedAt).toLocaleDateString()}</span>
                      </div>
                      <h4 className="font-bold text-xs text-zinc-850 dark:text-zinc-100 line-clamp-1 mb-1 font-sans">{art.title}</h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed font-sans">{art.content}</p>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-zinc-400 italic text-xs font-serif">
                  No Knowledge Base documents found.
                </div>
              )}
            </div>
          </>
        ) : (
          /* Left panel for AI Search mode */
          <div className="p-4 flex flex-col h-full justify-between overflow-y-auto">
            <div className="space-y-4 text-left">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                <h3 className="font-bold font-serif text-sm tracking-wide">AI Search Assistant</h3>
              </div>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                Powered by <strong className="text-zinc-700 dark:text-zinc-300">gemini-3.5-flash</strong> with direct <strong className="text-cyan-500">Google Search Grounding</strong>. Search the real-time live web, verify latest statuses, API references, or software changes instantly.
              </p>

              <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-4">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 font-mono block mb-2">QUICK SEARCH QUESTIONS</span>
                <div className="space-y-2">
                  {searchSuggestions.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleAiSearch(item.query)}
                      disabled={aiSearching}
                      className="w-full text-left p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-950/40 hover:bg-zinc-100 dark:hover:bg-zinc-900/60 hover:border-amber-500 dark:hover:border-amber-500/50 transition-all cursor-pointer group flex items-start gap-2 disabled:opacity-50"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
                      <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 font-sans group-hover:text-zinc-900 dark:group-hover:text-white transition-colors">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800/80 pt-4 mt-6">
              <button
                onClick={resetAiChat}
                className="w-full flex items-center justify-center gap-2 py-2 border border-zinc-250 dark:border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900/40 cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reset Search Assistant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right panel: Details view (col-span-8) */}
      <div className="lg:col-span-8 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20 text-left overflow-hidden">
        {kbMode === 'docs' ? (
          /* LOCAL DOCS RIGHT VIEW */
          selectedArticle ? (
            <div className="p-6 space-y-6 overflow-y-auto h-full flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-center gap-3 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-amber-500" />
                    <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-full border border-amber-100 dark:border-amber-900/60 uppercase tracking-wider">
                      {selectedArticle.category} CATEGORY RESOURCE
                    </span>
                  </div>

                  {userRole === 'ADMIN' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenArticleModal(selectedArticle)}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg shrink-0 cursor-pointer"
                        title="Edit Resource Doc"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteArticle(selectedArticle.id, selectedArticle.title)}
                        className="p-1.5 border border-zinc-200 dark:border-zinc-800 text-red-500 hover:text-red-700 rounded-lg shrink-0 cursor-pointer"
                        title="Delete Resource Doc"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-wide leading-snug">{selectedArticle.title}</h2>

                {/* Author / Date stamp header */}
                <div className="flex items-center gap-4 bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 p-3 rounded-lg text-[10px] text-zinc-400 dark:text-zinc-550 font-mono">
                  <span className="flex items-center gap-1"><UserCheck className="w-3.5 h-3.5 text-zinc-500" /> Author: <strong className="text-zinc-600 dark:text-zinc-350">{selectedArticle.author}</strong></span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-zinc-500" /> Created: {new Date(selectedArticle.createdAt).toLocaleDateString()}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-zinc-500" /> Updated: {new Date(selectedArticle.updatedAt).toLocaleDateString()}</span>
                </div>

                {/* Body Content */}
                <div className="bg-white dark:bg-zinc-900/35 border border-zinc-200 dark:border-zinc-850 rounded-xl p-5 shadow-xs">
                  <div className="text-xs text-zinc-700 dark:text-zinc-350 space-y-4 font-sans leading-relaxed whitespace-pre-line">
                    {selectedArticle.content}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-200 dark:border-zinc-850 pt-4 mt-8 flex items-center gap-2 text-[10px] text-zinc-400 dark:text-zinc-550 italic font-mono shrink-0 justify-center">
                <BookOpen className="w-3.5 h-3.5" />
                CONFIDENTIAL CRM SUPPORT RESOURCE • INTENDED FOR INTERNAL AGENT KNOWLEDGE AUDITING ONLY
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-zinc-500">
              <BookOpen className="w-8 h-8 text-zinc-400 mb-2 animate-pulse" />
              <p className="text-xs font-serif italic">Select a Knowledge Base document from the panel to view its full technical details and SOP checklists.</p>
            </div>
          )
        ) : (
          /* AI SEARCH CHAT VIEW */
          <div className="flex flex-col h-full justify-between">
            {aiHistory.length === 0 ? (
              /* AI SEARCH DASHBOARD INTRO */
              <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center justify-center max-w-xl mx-auto space-y-8 text-center animate-fadeIn">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/25 dark:border-amber-500/10 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-8 h-8 text-amber-500 dark:text-amber-400 animate-pulse" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                  </div>
                </div>

                <div className="space-y-2">
                  <h2 className="text-lg font-bold font-sans tracking-wide text-zinc-850 dark:text-zinc-50">Grounded Search Assistant</h2>
                  <p className="text-xs text-zinc-500 leading-relaxed max-w-md mx-auto font-sans">
                    Leverage Direct Google Search Grounding to verify current APIs, third-party software updates, error states, and live web information to provide verified support responses.
                  </p>
                </div>

                {/* Grounding Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                  <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 rounded-xl space-y-1.5 text-left">
                    <div className="flex items-center gap-1.5 text-cyan-600 dark:text-cyan-400">
                      <Globe className="w-4 h-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Web Search</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal font-sans">Searches the live web to retrieve the most up-to-date and accurate facts.</p>
                  </div>

                  <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 rounded-xl space-y-1.5 text-left">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <UserCheck className="w-4 h-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">Source Audit</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal font-sans">Extracts and indexes reference URLs for direct agent validation.</p>
                  </div>

                  <div className="p-4 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/20 rounded-xl space-y-1.5 text-left">
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wide">SOP Helper</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 leading-normal font-sans">Automatically converts live search data into clean SOP checklists.</p>
                  </div>
                </div>

                {/* Central search bar */}
                <form
                  onSubmit={(e) => { e.preventDefault(); handleAiSearch(aiInput); }}
                  className="w-full relative flex items-center bg-white dark:bg-zinc-900/40 border border-zinc-250 dark:border-zinc-800 rounded-xl p-1 shadow-sm focus-within:border-amber-500 transition-all"
                >
                  <Search className="w-4 h-4 text-zinc-400 ml-3" />
                  <input
                    type="text"
                    placeholder="Ask the Search Assistant (e.g. latest Stripe billing API release notes)..."
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    className="flex-1 bg-transparent border-none text-xs text-zinc-800 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none px-3 py-2 font-sans"
                  />
                  <button
                    type="submit"
                    disabled={!aiInput.trim()}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Send className="w-3 h-3" />
                    Search
                  </button>
                </form>
              </div>
            ) : (
              /* SCROLLABLE CHAT MESSAGES */
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {aiHistory.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col max-w-2xl text-left ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`p-4 rounded-2xl border text-xs shadow-sm ${
                        msg.role === 'user'
                          ? 'bg-amber-600 border-amber-700 text-white rounded-br-none'
                          : 'bg-white dark:bg-zinc-900/35 border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-100 rounded-bl-none'
                      }`}
                    >
                      {msg.role === 'user' ? (
                        <p className="font-sans whitespace-pre-line leading-relaxed">{msg.text}</p>
                      ) : (
                        <div className="space-y-3 leading-relaxed">
                          {renderMarkdown(msg.text)}
                        </div>
                      )}
                    </div>

                    {/* Grounding Source cards under Model messages */}
                    {msg.role === 'model' && msg.sources && msg.sources.length > 0 && (
                      <div className="mt-3 w-full">
                        <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider font-mono mb-2">
                          <Globe className="w-3 h-3 text-cyan-400 animate-pulse" />
                          <span>Grounded search citations</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {msg.sources.map((src, sIdx) => (
                            <a
                              key={sIdx}
                              href={src.uri}
                              target="_blank"
                              referrerPolicy="no-referrer"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-100/50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-850 hover:border-amber-500/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-lg text-[10px] font-bold text-zinc-600 dark:text-zinc-300 transition-all"
                            >
                              <ExternalLink className="w-3 h-3 text-zinc-400 shrink-0" />
                              <span className="truncate max-w-[180px]">{src.title}</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Searching Loader Indicator */}
                {aiSearching && (
                  <div className="flex flex-col max-w-lg mr-auto items-start animate-pulse">
                    <div className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900/35 text-zinc-400 dark:text-zinc-500 rounded-bl-none flex items-center gap-3">
                      <div className="flex space-x-1">
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-zinc-400">Consulting Google Search live index...</span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {aiError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-red-500 text-[10px] font-bold uppercase tracking-wider max-w-lg mx-auto">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            )}

            {/* Sticky Input Block */}
            {aiHistory.length > 0 && (
              <form
                onSubmit={(e) => { e.preventDefault(); handleAiSearch(aiInput); }}
                className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/10 flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  placeholder="Ask a follow-up or a new query..."
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  disabled={aiSearching}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-amber-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={!aiInput.trim() || aiSearching}
                  className="p-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl shadow-sm transition-all cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* MODAL: Create/Edit KB Article */}
      {showArticleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto animate-fadeIn backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-2xl max-w-md w-full p-6 flex flex-col gap-4 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-base font-serif tracking-wide">
                {editingArticle ? 'Edit Resource Document' : 'Create Resource Document'}
              </h3>
              <button
                onClick={() => setShowArticleModal(false)}
                className="text-zinc-500 hover:text-zinc-300 text-sm font-bold font-mono p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveArticle} className="space-y-4 font-sans text-xs">
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Article Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Setting Compound Database Indexing SOP"
                  value={articleForm.title}
                  onChange={(e) => setArticleForm({ ...articleForm, title: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Resource Category</label>
                <select
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="APP Issue">APP Issue</option>
                  <option value="Payment method">Payment method</option>
                  <option value="Unable to pay">Unable to pay</option>
                  <option value="Lock">Lock</option>
                  <option value="Watermark issue">Watermark issue</option>
                  <option value="Refund Issue">Refund Issue</option>
                  <option value="Reset Phone">Reset Phone</option>
                  <option value="Policy">Policy</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase font-mono block mb-1">Detailed Technical Content *</label>
                <textarea
                  required
                  placeholder="Draft full SOP content, guidelines, backoffs, or error code responses..."
                  rows={6}
                  value={articleForm.content}
                  onChange={(e) => setArticleForm({ ...articleForm, content: e.target.value })}
                  className="w-full bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                {editingArticle ? 'Save Changes' : 'Publish Resource'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteArticleConfirm}
        title="Delete Knowledge Base Article"
        message={`Are you sure you want to delete Knowledge Base article: "${deleteArticleConfirm?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Article"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDeleteArticle}
        onCancel={() => setDeleteArticleConfirm(null)}
      />
    </div>
  );
}
