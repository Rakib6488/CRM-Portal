import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertCircle, CheckCircle, Activity, FileSpreadsheet, 
  Plus, Search, RefreshCw, Trash2, ExternalLink, Scroll, Clock,
  Calendar, Filter, Download, FileText, Users, LayoutDashboard,
  ChevronDown, ChevronRight, Settings, Cpu, DollarSign, TrendingUp,
  Lock, Sliders, Database, Sparkles, ClipboardList, Wrench, Layers,
  Radio, FileBarChart, UserCheck, BarChart3, AlertTriangle, ArrowRight,
  UserPlus, UserCog, CheckSquare, ShieldAlert, Zap, Globe, Pencil, X
} from 'lucide-react';
import { AgentCredential, LiveAgentSession, CRMContact, SupportTicket, RosterDay } from '../types';
import { updateAgentCredentialsInSheet, ensureSheetExists } from '../workspace';
import { upsertSession, saveSpreadsheetConfig, upsertAgentCredential, deleteAgentCredentialFromFirestore } from '../firebase';
import EnterpriseAdminCore from './EnterpriseAdminCore';
import ConfirmationModal from './ConfirmationModal';

interface AdminSectionProps {
  token: string | null;
  connectedSpreadsheetId: string | null;
  connectedSpreadsheetUrl: string | null;
  setConnectedSpreadsheetId?: React.Dispatch<React.SetStateAction<string>>;
  setConnectedSpreadsheetUrl?: React.Dispatch<React.SetStateAction<string>>;
  agentCredentials: AgentCredential[];
  setAgentCredentials: React.Dispatch<React.SetStateAction<AgentCredential[]>>;
  liveAgentSessions: LiveAgentSession[];
  setLiveAgentSessions: React.Dispatch<React.SetStateAction<LiveAgentSession[]>>;
  liveBreaks: any[];
  contacts: CRMContact[];
  tickets: SupportTicket[];
  rosterDays: RosterDay[];
  setRosterDays?: React.Dispatch<React.SetStateAction<RosterDay[]>>;
  systemLogs: { message: string; timestamp: string }[];
  logActivity: (message: string) => void;
  isBreakOverrun: (breakType: string, durationSeconds: number) => boolean;
  getBreakLimitMinutes: (breakType: string) => number;
  userRole?: 'AGENT' | 'ADMIN';
  activeSubOption?: string;
  setActiveSubOption?: (id: string) => void;
  activityLogs?: any[];
}

// Navigation structure definitions
interface NavSubItem {
  id: string;
  label: string;
  icon?: any;
  badge?: string | number;
}

interface NavCategory {
  id: string;
  title: string;
  icon: any;
  subItems: NavSubItem[];
}

export default function AdminSection({
  token,
  connectedSpreadsheetId,
  connectedSpreadsheetUrl,
  setConnectedSpreadsheetId,
  setConnectedSpreadsheetUrl,
  agentCredentials,
  setAgentCredentials,
  liveAgentSessions,
  setLiveAgentSessions,
  liveBreaks,
  contacts,
  tickets,
  rosterDays,
  setRosterDays,
  systemLogs,
  logActivity,
  isBreakOverrun,
  getBreakLimitMinutes,
  userRole = 'ADMIN',
  activeSubOption: propsActiveSubOption,
  setActiveSubOption: propsSetActiveSubOption,
  activityLogs = []
}: AdminSectionProps) {

  // Live ticker for stopwatch counters
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Active view state
  const [internalActiveSubOption, setInternalActiveSubOption] = useState<string>('dash_exec');
  const activeSubOption = propsActiveSubOption || internalActiveSubOption;
  const setActiveSubOption = (id: string) => {
    setInternalActiveSubOption(id);
    if (propsSetActiveSubOption) {
      propsSetActiveSubOption(id);
    }
  };
  
  // Expanded categories accordion state
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    'cat_dashboard': true,
    'cat_users': true,
    'cat_roster': true,
    'cat_operations': true,
    'cat_financials': true
  });

  // Sidebar search filter
  const [sidebarSearch, setSidebarSearch] = useState('');
  
  // Mobile sidebar collapsible toggle
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);

  // Agent creation form states
  const [newAgentId, setNewAgentId] = useState('');
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentPass, setNewAgentPass] = useState('');
  const [newAgentRole, setNewAgentRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [creationError, setCreationError] = useState('');
  const [creationSuccess, setCreationSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit user modal states
  const [editingAgent, setEditingAgent] = useState<AgentCredential | null>(null);
  const [editAgentName, setEditAgentName] = useState('');
  const [editAgentPass, setEditAgentPass] = useState('');
  const [editAgentRole, setEditAgentRole] = useState<'AGENT' | 'ADMIN'>('AGENT');

  // Search filter for credentials list
  const [credSearch, setCredSearch] = useState('');

  // Local notifications (toast-like) state
  const [notifications, setNotifications] = useState<string[]>([]);

  // 📈 Reports Engine State
  const [repType, setRepType] = useState<'breaks' | 'sessions' | 'tickets' | 'contacts' | 'roster' | 'users' | 'credentials' | 'activity_logs'>('breaks');
  const [repDateMode, setRepDateMode] = useState<'all' | 'day' | 'month' | 'range'>('all');
  const [repDate, setRepDate] = useState(new Date().toISOString().substring(0, 10));
  const [repMonth, setRepMonth] = useState(new Date().toISOString().substring(0, 7));
  const [repStartDate, setRepStartDate] = useState(new Date().toISOString().substring(0, 10) + 'T00:00');
  const [repEndDate, setRepEndDate] = useState(new Date().toISOString().substring(0, 10) + 'T23:59');
  const [repAgentId, setRepAgentId] = useState('all');
  const [repSearch, setRepSearch] = useState('');
  const [isPushingToSheet, setIsPushingToSheet] = useState(false);

  // Custom System Rules & Thresholds
  const [systemRules, setSystemRules] = useState([
    { id: 'rule-1', name: 'Lunch Break Max Threshold', limit: 45, unit: 'minutes', category: 'Breaks', status: 'Active' },
    { id: 'rule-2', name: 'Tea Break Max Threshold', limit: 15, unit: 'minutes', category: 'Breaks', status: 'Active' },
    { id: 'rule-3', name: 'Urgent SLA Ticket Resolution Time', limit: 2, unit: 'hours', category: 'Support', status: 'Active' },
    { id: 'rule-4', name: 'NIBSS Double Debit Reversal SLA', limit: 48, unit: 'hours', category: 'Settlement', status: 'Active' }
  ]);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleLimit, setNewRuleLimit] = useState(30);
  const [newRuleUnit, setNewRuleUnit] = useState('minutes');
  const [newRuleCategory, setNewRuleCategory] = useState('Breaks');

  // Custom Financial Dispute / Entry Ledger
  const [disputes, setDisputes] = useState([
    { id: 'TRX-98210', customer: 'Amina Bello', amount: '₦15,000', type: 'Double Debit', bank: 'Zenith Bank', status: 'Pending Reversal', date: '2026-07-24' },
    { id: 'TRX-98104', customer: 'Emeka Okafor', amount: '₦45,500', type: 'POS Timeout', bank: 'GTBank', status: 'Resolved', date: '2026-07-23' },
    { id: 'TRX-97812', customer: 'Tunde Bakare', amount: '₦8,200', type: 'NIBSS Pending', bank: 'FirstBank', status: 'Investigating', date: '2026-07-22' }
  ]);
  const [newEntryCust, setNewEntryCust] = useState('');
  const [newEntryAmount, setNewEntryAmount] = useState('');
  const [newEntryType, setNewEntryType] = useState('Double Debit');
  const [newEntryBank, setNewEntryBank] = useState('Zenith Bank');

  // Quick Roster Add State
  const [rosterAgent, setRosterAgent] = useState('');
  const [rosterShiftType, setRosterShiftType] = useState<'morning' | 'standardDay' | 'lateDay' | 'afternoon' | 'evening' | 'night' | 'off'>('morning');
  const [rosterTargetDate, setRosterTargetDate] = useState(new Date().toISOString().substring(0, 10));

  // Toggle accordion categories
  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Define Navigation Structure
  const navCategories: NavCategory[] = [
    {
      id: 'cat_dashboard',
      title: 'Dashboard & Overview',
      icon: LayoutDashboard,
      subItems: [
        { id: 'dash_exec', label: 'Executive Dashboard', icon: BarChart3 },
        { id: 'dash_mon', label: 'Real-Time Monitoring', icon: Radio, badge: liveAgentSessions.filter(s => s.status !== 'offline').length },
        { id: 'dash_daily', label: 'Daily Performance Summary', icon: Clock },
        { id: 'dash_monthly', label: 'Monthly Analytics Report', icon: FileBarChart },
        { id: 'dash_other', label: 'Quick Actions / Other Options', icon: Sparkles }
      ]
    },
    {
      id: 'cat_users',
      title: 'User Management',
      icon: Users,
      subItems: [
        { id: 'user_dash', label: 'Users Dashboard', icon: Users, badge: agentCredentials.length },
        { id: 'user_add', label: 'Add New User', icon: UserPlus },
        { id: 'user_edit', label: 'Edit / Manage User Roles', icon: UserCog },
        { id: 'user_mon', label: 'User Monitoring & Logs', icon: Activity },
        { id: 'user_daily', label: 'Daily User Activity Report', icon: Calendar },
        { id: 'user_monthly', label: 'Monthly User Growth Report', icon: TrendingUp },
        { id: 'user_pref', label: 'User Settings & Preferences', icon: Sliders }
      ]
    },
    {
      id: 'cat_roster',
      title: 'Agent Duty Status & Roster',
      icon: Calendar,
      subItems: [
        { id: 'roster_dash', label: 'Roster Dashboard', icon: Calendar, badge: '24/7' },
        { id: 'roster_add', label: 'Add New Roster / Shift', icon: Plus },
        { id: 'roster_edit', label: 'Edit Shift Schedule & Assignments', icon: Wrench },
        { id: 'roster_mon', label: 'Live Duty Status Monitoring', icon: UserCheck },
        { id: 'roster_daily', label: 'Daily Attendance & Duty Report', icon: Clock },
        { id: 'roster_monthly', label: 'Monthly Shift Summary Report', icon: FileText },
        { id: 'roster_pref', label: 'Roster Configurations & Preferences', icon: Settings }
      ]
    },
    {
      id: 'cat_operations',
      title: 'System Operations & Monitoring',
      icon: Cpu,
      subItems: [
        { id: 'ops_dash', label: 'Operations Dashboard', icon: Cpu },
        { id: 'ops_add_rule', label: 'Add System Rule / Threshold', icon: ShieldAlert },
        { id: 'ops_edit_param', label: 'Edit System Parameters', icon: Wrench },
        { id: 'ops_health', label: 'System Health Monitoring', icon: Zap },
        { id: 'ops_daily', label: 'Daily System Audit Report', icon: Scroll },
        { id: 'ops_monthly', label: 'Monthly Reliability Report', icon: Layers },
        { id: 'ops_pref', label: 'Gateway & API Preferences', icon: Globe }
      ]
    },
    {
      id: 'cat_financials',
      title: 'Financials & Customer Reports',
      icon: FileSpreadsheet,
      subItems: [
        { id: 'fin_dash', label: 'Financial Overview Dashboard', icon: DollarSign },
        { id: 'fin_add_entry', label: 'Add Entry / Invoice', icon: Plus },
        { id: 'fin_edit_trans', label: 'Edit Transactions', icon: ClipboardList },
        { id: 'fin_mon', label: 'Real-Time Revenue Monitoring', icon: TrendingUp },
        { id: 'fin_daily', label: 'Daily Operational Report', icon: FileSpreadsheet },
        { id: 'fin_monthly', label: 'Monthly Financial Summary', icon: FileText },
        { id: 'fin_pref', label: 'Export & Sync Options', icon: Download }
      ]
    }
  ];

  // Filter helper functions for reports
  const getFilteredBreaks = () => {
    return liveBreaks.filter(b => {
      if (repAgentId !== 'all') {
        const matchesAgent = b.agentId?.toLowerCase() === repAgentId.toLowerCase() || 
                             b.agentName?.toLowerCase().includes(repAgentId.toLowerCase());
        if (!matchesAgent) return false;
      }
      const startTime = b.startTime;
      if (!startTime) return false;
      if (repDateMode === 'day') {
        if (!startTime.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!startTime.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const bTs = new Date(startTime).getTime();
        if (bTs < startTs || bTs > endTs) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = b.agentName?.toLowerCase().includes(query) ||
                          b.reason?.toLowerCase().includes(query) ||
                          b.status?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredSessions = () => {
    return liveAgentSessions.filter(s => {
      if (repAgentId !== 'all') {
        const matchesAgent = s.id?.toLowerCase() === repAgentId.toLowerCase() || 
                             s.agentId?.toLowerCase() === repAgentId.toLowerCase() || 
                             s.name?.toLowerCase().includes(repAgentId.toLowerCase());
        if (!matchesAgent) return false;
      }
      const loginTime = s.loginTime;
      if (!loginTime) return false;
      if (repDateMode === 'day') {
        if (!loginTime.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!loginTime.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const sTs = new Date(loginTime).getTime();
        if (sTs < startTs || sTs > endTs) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = s.name?.toLowerCase().includes(query) ||
                          s.id?.toLowerCase().includes(query) ||
                          s.agentId?.toLowerCase().includes(query) ||
                          s.status?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredTickets = () => {
    return tickets.filter(t => {
      const createdAt = t.createdAt;
      if (!createdAt) return false;
      if (repDateMode === 'day') {
        if (!createdAt.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!createdAt.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const tTs = new Date(createdAt).getTime();
        if (tTs < startTs || tTs > endTs) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = t.id?.toLowerCase().includes(query) ||
                          t.title?.toLowerCase().includes(query) ||
                          t.contactName?.toLowerCase().includes(query) ||
                          t.category?.toLowerCase().includes(query) ||
                          t.status?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredContacts = () => {
    return contacts.filter(c => {
      const lastContactDate = c.lastContactDate;
      if (!lastContactDate) return false;
      if (repDateMode === 'day') {
        if (!lastContactDate.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!lastContactDate.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const cTs = new Date(lastContactDate).getTime();
        if (cTs < startTs || cTs > endTs) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = c.id?.toLowerCase().includes(query) ||
                          c.name?.toLowerCase().includes(query) ||
                          c.email?.toLowerCase().includes(query) ||
                          c.phone?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredRoster = () => {
    return rosterDays.filter(day => {
      const date = day.date;
      if (!date) return false;
      if (repDateMode === 'day') {
        if (date !== repDate) return false;
      } else if (repDateMode === 'month') {
        if (!date.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate.substring(0, 10)).getTime();
        const endTs = new Date(repEndDate.substring(0, 10)).getTime();
        const dTs = new Date(date).getTime();
        if (dTs < startTs || dTs > endTs) return false;
      }
      if (repAgentId !== 'all') {
        const agentNameLower = repAgentId.toLowerCase();
        const hasAgent = 
          (day.shifts?.morning || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.standardDay || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.lateDay || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.afternoon || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.evening || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.night || []).some(n => n.toLowerCase().includes(agentNameLower)) ||
          (day.shifts?.off || []).some(n => n.toLowerCase().includes(agentNameLower));
        if (!hasAgent) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = day.dayOfWeek?.toLowerCase().includes(query) ||
                          day.date?.toLowerCase().includes(query) ||
                          day.notes?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  const getFilteredActivityLogs = () => {
    return activityLogs.filter(log => {
      if (repAgentId !== 'all') {
        const matchesAgent = log.agentId?.toLowerCase() === repAgentId.toLowerCase() || 
                             log.agentName?.toLowerCase().includes(repAgentId.toLowerCase());
        if (!matchesAgent) return false;
      }
      const timestamp = log.timestamp;
      if (!timestamp) return false;
      if (repDateMode === 'day') {
        if (!timestamp.startsWith(repDate)) return false;
      } else if (repDateMode === 'month') {
        if (!timestamp.startsWith(repMonth)) return false;
      } else if (repDateMode === 'range') {
        const startTs = new Date(repStartDate).getTime();
        const endTs = new Date(repEndDate).getTime();
        const lTs = new Date(timestamp).getTime();
        if (lTs < startTs || lTs > endTs) return false;
      }
      if (repSearch.trim()) {
        const query = repSearch.toLowerCase();
        const textMatch = log.agentName?.toLowerCase().includes(query) ||
                          log.agentId?.toLowerCase().includes(query) ||
                          log.eventType?.toLowerCase().includes(query) ||
                          log.newStatus?.toLowerCase().includes(query) ||
                          log.newActivity?.toLowerCase().includes(query);
        if (!textMatch) return false;
      }
      return true;
    });
  };

  // Export custom CSV report
  const handleExportCustomReport = () => {
    try {
      let csvContent = "\uFEFF";
      let filename = "";

      // Check if current view is User Management or user credentials related
      if (
        activeSubOption === 'user_edit' ||
        activeSubOption === 'user_mgt' ||
        activeSubOption === 'user_add' ||
        activeSubOption === 'user_dash' ||
        repType === 'users' ||
        repType === 'credentials'
      ) {
        csvContent += "=== MANAGE USER CREDENTIALS & ACCESS CONTROLS ===\n";
        csvContent += "Generated At: " + new Date().toISOString() + "\n";
        csvContent += "Agent ID,Full Name,Password,Role\n";
        agentCredentials.forEach(c => {
          csvContent += `"${c.agentId || ''}","${c.name || ''}","${c.passwordHash || ''}","${c.role || ''}"\n`;
        });
        filename = `User_Credentials_Access_Controls_${new Date().toISOString().slice(0, 10)}.csv`;
      } else if (repType === 'activity_logs' || activeSubOption === 'dash_mon' || activeSubOption === 'user_mon' || activeSubOption === 'roster_mon') {
        const filtered = getFilteredActivityLogs();
        csvContent += "=== FIREBASE REAL-TIME GRANULAR ACTIVITY TRANSITION LOGS ===\n";
        csvContent += "Generated At: " + new Date().toISOString() + "\n";
        csvContent += "Log ID,Timestamp (ISO),Time (Formatted),Agent ID,Agent Name,Event Type,Previous Status,New Status,Previous Activity,New Activity,Shift Timer (Sec),Break Timer (Sec),Device Info\n";

        if (filtered.length > 0) {
          filtered.forEach(l => {
            csvContent += `"${l.id || ''}","${l.timestamp || ''}","${l.formattedTime || ''}","${l.agentId || ''}","${l.agentName || ''}","${l.eventType || ''}","${l.previousStatus || ''}","${l.newStatus || ''}","${l.previousActivity || ''}","${l.newActivity || ''}","${l.shiftTimerSeconds || 0}","${l.breakTimerSeconds || 0}","${l.deviceInfo || ''}"\n`;
          });
        } else {
          // Detailed snapshot generated per second if no historical logs match query
          liveAgentSessions.forEach(s => {
            const nowIso = new Date().toISOString();
            const nowFmt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
            csvContent += `"snapshot_${Date.now()}","${nowIso}","${nowFmt}","${s.agentId || s.id}","${s.name}","CURRENT_STATE","${s.status}","${s.status}","${s.currentActivity}","${s.currentActivity}","${s.shiftTimer || 0}","${s.breakTimer || 0}","${s.deviceInfo || ''}"\n`;
          });
        }
        filename = `Firebase_RealTime_Activity_Logs_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else if (repType === 'breaks') {
        const filtered = getFilteredBreaks();
        csvContent += "=== AGENT BREAK COMPLIANCE REPORT ===\n";
        csvContent += "Break ID,Agent ID,Agent Name,Break Type,Start Time (ISO),End Time (ISO),Duration (Seconds),Status\n";
        filtered.forEach(b => {
          csvContent += `"${b.id || ''}","${b.agentId || ''}","${b.agentName || ''}","${b.reason || ''}","${b.startTime || ''}","${b.endTime || ''}","${b.duration || 0}","${b.status || ''}"\n`;
        });
        filename = `Agent_Breaks_Compliance_Report_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else if (repType === 'sessions') {
        const filtered = getFilteredSessions();
        csvContent += "=== OPERATIONAL AGENT SESSIONS REPORT ===\n";
        csvContent += "Agent ID,Agent Name,Login Time (ISO),Current Status,Activity,Shift Duration (Sec)\n";
        filtered.forEach(s => {
          csvContent += `"${s.agentId || s.id || ''}","${s.name || ''}","${s.loginTime || ''}","${s.status || ''}","${s.currentActivity || ''}","${s.shiftTimer || 0}"\n`;
        });
        filename = `Agent_Duty_Sessions_Report_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else if (repType === 'tickets') {
        const filtered = getFilteredTickets();
        csvContent += "=== SUPPORT TICKETS SLA REPORT ===\n";
        csvContent += "Ticket ID,Customer ID,Customer Name,Subject,Category,Priority,Status,Created At\n";
        filtered.forEach(t => {
          csvContent += `"${t.id || ''}","${t.contactId || ''}","${t.contactName || ''}","${t.title || ''}","${t.category || ''}","${t.priority || ''}","${t.status || ''}","${t.createdAt || ''}"\n`;
        });
        filename = `Support_Tickets_SLA_Report_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else if (repType === 'contacts') {
        const filtered = getFilteredContacts();
        csvContent += "=== CRM CUSTOMERS DIRECTORY REPORT ===\n";
        csvContent += "Contact ID,Name,Email,Phone,Company,Status,Last Contact Date\n";
        filtered.forEach(c => {
          csvContent += `"${c.id || ''}","${c.name || ''}","${c.email || ''}","${c.phone || ''}","${c.company || ''}","${c.status || ''}","${c.lastContactDate || ''}"\n`;
        });
        filename = `CRM_Customer_Directory_Report_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else if (repType === 'roster') {
        const filtered = getFilteredRoster();
        csvContent += "=== SHIFT ROSTERS AND SCHEDULES REPORT ===\n";
        csvContent += "Date,Day of Week,Morning Shift,Standard Day,Late Day,Afternoon,Evening,Night,Off Duty\n";
        filtered.forEach(day => {
          csvContent += `"${day.date || ''}","${day.dayOfWeek || ''}","${(day.shifts?.morning || []).join(';')}","${(day.shifts?.standardDay || []).join(';')}","${(day.shifts?.lateDay || []).join(';')}","${(day.shifts?.afternoon || []).join(';')}","${(day.shifts?.evening || []).join(';')}","${(day.shifts?.night || []).join(';')}","${(day.shifts?.off || []).join(';')}"\n`;
        });
        filename = `Workforce_Shift_Rosters_Report_${repDateMode === 'all' ? 'AllTime' : repDate}.csv`;
      } else {
        // Fallback default: Export User Credentials & Access Controls
        csvContent += "=== MANAGE USER CREDENTIALS & ACCESS CONTROLS ===\n";
        csvContent += "Generated At: " + new Date().toISOString() + "\n";
        csvContent += "Agent ID,Full Name,Password,Role\n";
        agentCredentials.forEach(c => {
          csvContent += `"${c.agentId || ''}","${c.name || ''}","${c.passwordHash || ''}","${c.role || ''}"\n`;
        });
        filename = `User_Credentials_Access_Controls_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      logActivity(`Exported CSV report for (${activeSubOption || repType})`);
    } catch (e: any) {
      alert(`Error generating report: ${e.message || e}`);
    }
  };

  const [showPushConfirm, setShowPushConfirm] = useState(false);

  // Push dataset to Google Sheets
  const handlePushReportToGoogleSheet = async () => {
    if (!token || !connectedSpreadsheetId) {
      alert("⚠️ Google Spreadsheet connection is not active or OAuth token is missing. Please authorize via Google first.");
      return;
    }
    setShowPushConfirm(true);
  };

  const executePushReportToGoogleSheet = async () => {
    setShowPushConfirm(false);
    setIsPushingToSheet(true);

    let rows: any[][] = [];
    let headers: string[] = [];
    let sheetName = `${repType.toUpperCase()}_AUDIT`.substring(0, 30);

    if (repType === 'breaks') {
      const filtered = getFilteredBreaks();
      headers = ["Break ID", "Agent ID", "Agent Name", "Break Type", "Start Time", "End Time", "Duration (Sec)", "Status"];
      rows = filtered.map(b => [b.id || '', b.agentId || '', b.agentName || '', b.reason || '', b.startTime || '', b.endTime || '', String(b.duration || 0), b.status || '']);
    } else if (repType === 'sessions') {
      const filtered = getFilteredSessions();
      headers = ["Agent ID", "Agent Name", "Login Time", "Status", "Activity", "Shift Duration (Sec)"];
      rows = filtered.map(s => [s.agentId || s.id || '', s.name || '', s.loginTime || '', s.status || '', s.currentActivity || '', String(s.shiftTimer || 0)]);
    } else if (repType === 'tickets') {
      const filtered = getFilteredTickets();
      headers = ["Ticket ID", "Customer ID", "Customer Name", "Subject", "Category", "Priority", "Status", "Created At"];
      rows = filtered.map(t => [t.id || '', t.contactId || '', t.contactName || '', t.title || '', t.category || '', t.priority || '', t.status || '', t.createdAt || '']);
    } else if (repType === 'contacts') {
      const filtered = getFilteredContacts();
      headers = ["Contact ID", "Name", "Email", "Phone", "Company", "Status", "Last Contact Date"];
      rows = filtered.map(c => [c.id || '', c.name || '', c.email || '', c.phone || '', c.company || '', c.status || '', c.lastContactDate || '']);
    } else if (repType === 'roster') {
      const filtered = getFilteredRoster();
      headers = ["Date", "Day", "Morning", "Standard Day", "Late Day", "Afternoon", "Evening", "Night", "Off Duty"];
      rows = filtered.map(day => [
        day.date || '', day.dayOfWeek || '',
        (day.shifts?.morning || []).join(', '),
        (day.shifts?.standardDay || []).join(', '),
        (day.shifts?.lateDay || []).join(', '),
        (day.shifts?.afternoon || []).join(', '),
        (day.shifts?.evening || []).join(', '),
        (day.shifts?.night || []).join(', '),
        (day.shifts?.off || []).join(', ')
      ]);
    }

    try {
      await ensureSheetExists(token, connectedSpreadsheetId, sheetName, headers);
      const clearRange = `${sheetName}!A2:Z10000`;
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connectedSpreadsheetId}/values/${clearRange}:clear`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      const writeRange = `${sheetName}!A2`;
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${connectedSpreadsheetId}/values/${writeRange}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: rows })
        }
      );

      if (!response.ok) {
        throw new Error("Failed to push values to Google Sheets");
      }

      logActivity(`Pushed ${rows.length} ${repType.toUpperCase()} records to Google Sheet tab "${sheetName}".`);
      alert(`🎉 Dataset successfully synced to Google Sheet tab: ${sheetName}!`);
    } catch (e: any) {
      alert(`⚠️ Error syncing to Google Sheet: ${e.message || String(e)}`);
    } finally {
      setIsPushingToSheet(false);
    }
  };

  // Agent creation handler
  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreationError('');
    setCreationSuccess('');

    if (!newAgentId.trim() || !newAgentName.trim() || !newAgentPass.trim()) {
      setCreationError('All required fields must be filled.');
      return;
    }

    const exists = agentCredentials.some(
      (c) => c.agentId.toLowerCase().trim() === newAgentId.toLowerCase().trim()
    );

    if (exists) {
      setCreationError('An agent or admin with this ID already exists.');
      return;
    }

    setIsSubmitting(true);
    try {
      const newCred: AgentCredential = {
        agentId: newAgentId.trim().toLowerCase(),
        passwordHash: newAgentPass.trim(),
        name: newAgentName.trim(),
        role: newAgentRole
      };

      const updatedList = [...agentCredentials, newCred];

      // Direct write to Firebase Firestore
      await upsertAgentCredential(newCred);

      if (token && connectedSpreadsheetId) {
        try {
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
          setCreationSuccess(`Successfully created user ${newCred.name} and synced with Google Sheets & Firebase!`);
        } catch (sheetErr: any) {
          setCreationSuccess(`Successfully created user ${newCred.name} (Firebase synced).`);
        }
      } else {
        setCreationSuccess(`Successfully created user ${newCred.name} (Firebase synced).`);
      }

      setAgentCredentials(updatedList);

      setNewAgentId('');
      setNewAgentName('');
      setNewAgentPass('');
      logActivity(`Admin created new account credential: "${newCred.name}" (${newCred.role})`);
    } catch (err: any) {
      setCreationError(`Error saving user: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset password
  const handleResetPassword = async (agentId: string) => {
    const newPass = prompt(`Enter new password for: ${agentId}`);
    if (!newPass) return;

    try {
      const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          targetAgentId: agentId,
          newPassword: newPass.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Error resetting password: ${data.error || 'Failed'}`);
        return;
      }

      const updatedList = agentCredentials.map(c => 
        c.agentId === agentId ? { ...c, passwordHash: '••••••••' } : c
      );

      setAgentCredentials(updatedList);
      alert(`Password for "${agentId}" reset successfully.`);
      logActivity(`Admin reset password for user: ${agentId}`);
    } catch (err: any) {
      alert(`Error resetting password: ${err.message || err}`);
    }
  };

  const [revokeAgentConfirmId, setRevokeAgentConfirmId] = useState<string | null>(null);

  // Revoke access
  const handleRevokeAccess = async (agentId: string) => {
    if (agentId === 'admin') {
      alert('Cannot revoke master administrator account.');
      return;
    }
    setRevokeAgentConfirmId(agentId);
  };

  const executeRevokeAccess = async () => {
    if (!revokeAgentConfirmId) return;
    const agentId = revokeAgentConfirmId;
    try {
      await deleteAgentCredentialFromFirestore(agentId);
      const updatedList = agentCredentials.filter(c => c.agentId !== agentId);

      if (token && connectedSpreadsheetId) {
        try {
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
        } catch (e) {}
      }

      setAgentCredentials(updatedList);
      alert(`Access for user "${agentId}" revoked and deleted from Firebase.`);
      logActivity(`Admin revoked access for user: ${agentId}`);
    } catch (err: any) {
      alert(`Error revoking access: ${err.message || err}`);
    } finally {
      setRevokeAgentConfirmId(null);
    }
  };

  // Open Edit Modal for User
  const handleOpenEditModal = (c: AgentCredential) => {
    setEditingAgent(c);
    setEditAgentName(c.name);
    setEditAgentPass(c.passwordHash);
    setEditAgentRole(c.role);
  };

  // Save Edit User Changes
  const handleSaveEditedAgent = async () => {
    if (!editingAgent) return;
    try {
      const updatedCred: AgentCredential = {
        agentId: editingAgent.agentId,
        name: editAgentName.trim(),
        passwordHash: editAgentPass.trim(),
        role: editAgentRole
      };

      await upsertAgentCredential(updatedCred);

      const updatedList = agentCredentials.map(c => 
        c.agentId === editingAgent.agentId 
          ? updatedCred 
          : c
      );

      if (token && connectedSpreadsheetId) {
        try {
          await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, updatedList);
        } catch (e) {}
      }

      setAgentCredentials(updatedList);
      logActivity(`Admin updated user credentials & role for: ${editingAgent.agentId}`);
      setEditingAgent(null);
      alert(`Successfully updated user "${editingAgent.agentId}" in Firebase.`);
    } catch (err: any) {
      alert(`Error updating user: ${err.message || err}`);
    }
  };

  // Force status available
  const handleForceStatusAvailable = async (sess: LiveAgentSession) => {
    try {
      const updatedSess: LiveAgentSession = {
        ...sess,
        status: 'available',
        currentActivity: 'available',
        lastActive: new Date().toISOString()
      };
      await upsertSession(updatedSess);

      const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
      fetch('/api/realtime/status-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          token,
          agentId: sess.agentId || sess.id,
          name: sess.name,
          status: 'available',
          currentActivity: 'available'
        })
      }).catch(() => {});

      logActivity(`Admin forced status override to AVAILABLE for agent: ${sess.name}`);
      alert(`Agent "${sess.name}" set to Available.`);
    } catch (err: any) {
      alert(`Error forcing session: ${err.message || err}`);
    }
  };

  const [forceClockOutConfirmAgent, setForceClockOutConfirmAgent] = useState<{ id: string; name: string } | null>(null);

  // Force clock out
  const handleAdminForceClockOut = async (agentId: string, name: string) => {
    setForceClockOutConfirmAgent({ id: agentId, name });
  };

  const executeAdminForceClockOut = async () => {
    if (!forceClockOutConfirmAgent) return;
    const { id: agentId, name } = forceClockOutConfirmAgent;
    try {
      const offlineSession: LiveAgentSession = {
        id: agentId,
        agentId,
        name,
        loginTime: new Date().toISOString(),
        status: 'offline',
        currentActivity: 'offline',
        lastActive: new Date().toISOString(),
        shiftTimer: 0
      };
      await upsertSession(offlineSession);

      const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
      fetch('/api/realtime/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token, agentId, finalShiftTimer: 0 })
      }).catch(() => {});

      logActivity(`Admin forced CLOCK OUT override for agent: ${name}`);
      alert(`Agent "${name}" forced to Clock Out.`);
    } catch (err: any) {
      alert(`Error forcing clock out: ${err.message || err}`);
    } finally {
      setForceClockOutConfirmAgent(null);
    }
  };

  // Add system rule
  const handleAddSystemRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const ruleObj = {
      id: `rule-${Date.now()}`,
      name: newRuleName.trim(),
      limit: Number(newRuleLimit),
      unit: newRuleUnit,
      category: newRuleCategory,
      status: 'Active'
    };
    setSystemRules([ruleObj, ...systemRules]);
    setNewRuleName('');
    logActivity(`Added system operation rule: "${ruleObj.name}" (${ruleObj.limit} ${ruleObj.unit})`);
  };

  // Add financial transaction dispute
  const handleAddDisputeEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryCust.trim() || !newEntryAmount.trim()) return;
    const disputeObj = {
      id: `TRX-${Math.floor(10000 + Math.random() * 90000)}`,
      customer: newEntryCust.trim(),
      amount: newEntryAmount.startsWith('₦') ? newEntryAmount : `₦${newEntryAmount}`,
      type: newEntryType,
      bank: newEntryBank,
      status: 'Pending Reversal',
      date: new Date().toISOString().substring(0, 10)
    };
    setDisputes([disputeObj, ...disputes]);
    setNewEntryCust('');
    setNewEntryAmount('');
    logActivity(`Added financial dispute ledger entry: "${disputeObj.id}" for ${disputeObj.customer}`);
  };

  // Quick Roster Assign
  const handleAddRosterAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rosterAgent.trim()) {
      alert("Please select or type an agent name!");
      return;
    }
    
    if (setRosterDays) {
      const updatedRoster = rosterDays.map(day => {
        if (day.date === rosterTargetDate) {
          const currentShifts = day.shifts || { morning: [], standardDay: [], lateDay: [], afternoon: [], evening: [], night: [], off: [] };
          const existingList = currentShifts[rosterShiftType] || [];
          if (!existingList.includes(rosterAgent)) {
            return {
              ...day,
              shifts: {
                ...currentShifts,
                [rosterShiftType]: [...existingList, rosterAgent]
              }
            };
          }
        }
        return day;
      });
      setRosterDays(updatedRoster);
      logActivity(`Assigned agent "${rosterAgent}" to ${rosterShiftType} shift on ${rosterTargetDate}`);
      alert(`Successfully assigned ${rosterAgent} to ${rosterShiftType.toUpperCase()} shift for ${rosterTargetDate}!`);
    } else {
      alert("Roster state is active. Schedule logged.");
    }
  };

  const filteredCredentials = agentCredentials.filter(c => 
    c.name.toLowerCase().includes(credSearch.toLowerCase()) ||
    c.agentId.toLowerCase().includes(credSearch.toLowerCase())
  );

  // Get active sub item details
  let activeSubItemTitle = "Executive Dashboard";
  let activeCategoryTitle = "Dashboard & Overview";
  navCategories.forEach(cat => {
    cat.subItems.forEach(sub => {
      if (sub.id === activeSubOption) {
        activeSubItemTitle = sub.label;
        activeCategoryTitle = cat.title;
      }
    });
  });

  // Filter categories by search term if provided
  const searchFilteredCategories = navCategories.map(cat => {
    if (!sidebarSearch.trim()) return cat;
    const query = sidebarSearch.toLowerCase();
    const matchesCategory = cat.title.toLowerCase().includes(query);
    const matchingSubItems = cat.subItems.filter(sub => 
      sub.label.toLowerCase().includes(query)
    );
    if (matchesCategory || matchingSubItems.length > 0) {
      return {
        ...cat,
        subItems: matchesCategory ? cat.subItems : matchingSubItems
      };
    }
    return null;
  }).filter(Boolean) as NavCategory[];

  // Role restriction enforcement
  if (userRole !== 'ADMIN') {
    return (
      <div className="p-12 text-center space-y-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans min-h-[500px] flex flex-col justify-center items-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-red-500 animate-bounce" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400 font-serif">RESTRICTED ADMIN ACCESS</h2>
          <p className="text-xs text-zinc-500 leading-relaxed">
            The Administration Portal requires active Administrator privileges (`ADMIN` role). Please sign in with administrator credentials to manage users, roster assignments, and operational parameters.
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="w-full min-h-[calc(100vh-100px)] p-4 lg:p-6 space-y-6 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans text-left animate-fadeIn">
        
        {/* Top Breadcrumb & Quick Actions Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
              <span>ADMIN PORTAL</span>
              <ChevronRight className="w-3 h-3 text-zinc-500" />
              <span>{activeCategoryTitle}</span>
              <ChevronRight className="w-3 h-3 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400 font-bold">{activeSubItemTitle}</span>
            </div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-wide font-serif">
              {activeSubItemTitle}
            </h2>
          </div>

          {/* Persistent Quick Action buttons */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={async () => {
                if (connectedSpreadsheetUrl) {
                  window.open(connectedSpreadsheetUrl, '_blank', 'noopener,noreferrer');
                } else if (token && connectedSpreadsheetId) {
                  try {
                    await updateAgentCredentialsInSheet(token, connectedSpreadsheetId, agentCredentials);
                    alert('Successfully synced user credentials to Google Sheets!');
                  } catch (e: any) {
                    alert('Sync Error: ' + (e.message || e));
                  }
                } else {
                  alert('Google Workspace API offline. Please authorize Google Workspace using the banner or Settings tab to connect Live Sheet.');
                }
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
              title="Connect or Sync Live Google Sheet with Portal Users & Credentials"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Live Sheet
            </button>
            <button
              onClick={handleExportCustomReport}
              className="flex items-center gap-1.5 px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
              title="Export Portal Data as CSV"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>

        {/* DYNAMIC VIEW CONTENT SWITCHING BASED ON activeSubOption */}
        
        {/* CATEGORY 1: DASHBOARD & OVERVIEW VIEWS */}
        {(!activeSubOption || activeSubOption === 'dash_exec') && (
          <EnterpriseAdminCore
            liveAgentSessions={liveAgentSessions}
            tickets={tickets}
            agentCredentials={agentCredentials}
            systemLogs={systemLogs}
            logActivity={logActivity}
            userRole={userRole}
          />
        )}

        {/* Real-time Monitoring View */}
        {(activeSubOption === 'dash_mon' || activeSubOption === 'user_mon' || activeSubOption === 'roster_mon') && (
          <div className="space-y-4 animate-fadeIn">
            {/* Every Agent Duty Status & Real-Time Roster Surveillance Table */}
            {(() => {
              // 1. Calculate status counts according to attendance tracking logic:
              // Clocked In represents ALL employees currently active in a shift (including those on break)
              const clockedInCount = agentCredentials.filter(cred => {
                const s = liveAgentSessions.find(sess => 
                  sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                  sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                  sess.name?.toLowerCase() === cred.name.toLowerCase()
                );
                return s && s.status !== 'offline';
              }).length;

              // On Duty (Available) count within the clocked-in pool
              const activeOnDutyCount = agentCredentials.filter(cred => {
                const s = liveAgentSessions.find(sess => 
                  sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                  sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                  sess.name?.toLowerCase() === cred.name.toLowerCase()
                );
                return s && s.status === 'available';
              }).length;

              // On Break sub-count within the clocked-in pool
              const activeOnBreakCount = agentCredentials.filter(cred => {
                const s = liveAgentSessions.find(sess => 
                  sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                  sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                  sess.name?.toLowerCase() === cred.name.toLowerCase()
                );
                return s && s.status === 'on_break';
              }).length;

              // Clocked Out represents employees currently offline / not on shift
              const clockedOutCount = Math.max(0, agentCredentials.length - clockedInCount);

              // Real-time Duty Status Headcount Breakdown
              const dutyCounts = {
                standby: agentCredentials.filter(cred => {
                  const s = liveAgentSessions.find(sess => 
                    sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                    sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                    sess.name?.toLowerCase() === cred.name.toLowerCase()
                  );
                  if (!s || s.status !== 'available') return false;
                  const act = (s.currentActivity || '').toLowerCase();
                  return act === 'available' || act === 'standby' || act === '';
                }).length,
                inbound: agentCredentials.filter(cred => {
                  const s = liveAgentSessions.find(sess => 
                    sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                    sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                    sess.name?.toLowerCase() === cred.name.toLowerCase()
                  );
                  if (!s || s.status !== 'available') return false;
                  const act = (s.currentActivity || '').toLowerCase();
                  return act.includes('inbound');
                }).length,
                outbound: agentCredentials.filter(cred => {
                  const s = liveAgentSessions.find(sess => 
                    sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                    sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                    sess.name?.toLowerCase() === cred.name.toLowerCase()
                  );
                  if (!s || s.status !== 'available') return false;
                  const act = (s.currentActivity || '').toLowerCase();
                  return act.includes('outbound') || act.includes('bound');
                }).length,
                liveChat: agentCredentials.filter(cred => {
                  const s = liveAgentSessions.find(sess => 
                    sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                    sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                    sess.name?.toLowerCase() === cred.name.toLowerCase()
                  );
                  if (!s || s.status !== 'available') return false;
                  const act = (s.currentActivity || '').toLowerCase();
                  return act.includes('live chat') || act.includes('chat');
                }).length,
                irSupport: agentCredentials.filter(cred => {
                  const s = liveAgentSessions.find(sess => 
                    sess.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                    sess.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                    sess.name?.toLowerCase() === cred.name.toLowerCase()
                  );
                  if (!s || s.status !== 'available') return false;
                  const act = (s.currentActivity || '').toLowerCase();
                  return act.includes('ir support') || act.includes('ir');
                }).length,
              };

              // 2. Smart Sorting & Priority Grouping (ACTIVE / ON DUTY -> ON BREAK -> OFFLINE / CLOCKED OUT)
              const sortedAgentCredentials = [...agentCredentials].sort((a, b) => {
                const sessionA = liveAgentSessions.find(s => 
                  s.agentId?.toLowerCase() === a.agentId.toLowerCase() || 
                  s.id?.toLowerCase() === a.agentId.toLowerCase() ||
                  s.name?.toLowerCase() === a.name.toLowerCase()
                );
                const sessionB = liveAgentSessions.find(s => 
                  s.agentId?.toLowerCase() === b.agentId.toLowerCase() || 
                  s.id?.toLowerCase() === b.agentId.toLowerCase() ||
                  s.name?.toLowerCase() === b.name.toLowerCase()
                );

                const getRank = (sess?: LiveAgentSession) => {
                  if (!sess || sess.status === 'offline') return 3; // OFFLINE
                  if (sess.status === 'on_break') return 2; // ON BREAK
                  return 1; // ACTIVE / ON DUTY
                };

                const rankA = getRank(sessionA);
                const rankB = getRank(sessionB);

                if (rankA !== rankB) return rankA - rankB;
                return a.name.localeCompare(b.name);
              });

              return (
                <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
                  <div className="space-y-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-emerald-500 animate-pulse" />
                          Every Agent Duty Status & Real-Time Roster Surveillance
                        </h3>
                        <p className="text-[11px] text-zinc-500 font-sans">
                          Real-time priority status hierarchy (Active &rarr; On Break &rarr; Offline), live stopwatch break monitor, and admin force controls.
                        </p>
                      </div>
                      {/* Header Status Summary Badge Pills */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          {clockedInCount} Clocked In
                        </span>
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded-full font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                          {activeOnBreakCount} On Break
                        </span>
                        <span className="px-2.5 py-1 bg-zinc-500/10 text-zinc-400 border border-zinc-500/20 rounded-full font-mono text-[10px] font-bold uppercase">
                          {clockedOutCount} Clocked Out
                        </span>
                      </div>
                    </div>

                    {/* Real-Time Headcount Counter Badges Per Duty Status */}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                      <span className="text-[10px] font-mono uppercase font-bold text-zinc-400 dark:text-zinc-500 mr-1 flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        Duty Status Live Headcount:
                      </span>
                      <span className="px-2.5 py-1 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded-lg font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                        STANDBY: <span className="font-extrabold text-blue-300 bg-blue-500/20 px-1.5 py-0.5 rounded-sm">{dutyCounts.standby}</span>
                      </span>
                      <span className="px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-lg font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                        INBOUND: <span className="font-extrabold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded-sm">{dutyCounts.inbound}</span>
                      </span>
                      <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                        OUTBOUND: <span className="font-extrabold text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded-sm">{dutyCounts.outbound}</span>
                      </span>
                      <span className="px-2.5 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/30 rounded-lg font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                        LIVE CHAT: <span className="font-extrabold text-teal-300 bg-teal-500/20 px-1.5 py-0.5 rounded-sm">{dutyCounts.liveChat}</span>
                      </span>
                      <span className="px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg font-mono text-[10px] font-bold uppercase flex items-center gap-1.5 shadow-xs">
                        IR SUPPORT: <span className="font-extrabold text-cyan-300 bg-cyan-500/20 px-1.5 py-0.5 rounded-sm">{dutyCounts.irSupport}</span>
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                        <tr>
                          <th className="py-3 px-3.5">Agent Representative</th>
                          <th className="py-3 px-3.5">Live Duty Status</th>
                          <th className="py-3 px-3.5">Break Type & Active Timer</th>
                          <th className="py-3 px-3.5">Clock-In Time</th>
                          <th className="py-3 px-3.5">Shift Duration</th>
                          <th className="py-3 px-3.5">Device & IP Info</th>
                          <th className="py-3 px-3.5">Work Division</th>
                          <th className="py-3 px-3.5 text-right">Admin Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {sortedAgentCredentials.map((cred, idx) => {
                          const session = liveAgentSessions.find(s => 
                            s.agentId?.toLowerCase() === cred.agentId.toLowerCase() || 
                            s.id?.toLowerCase() === cred.agentId.toLowerCase() ||
                            s.name?.toLowerCase() === cred.name.toLowerCase()
                          );
                          const isClockedIn = session && session.status !== 'offline';
                          const isBreak = session && session.status === 'on_break';
                          
                          // Shift active duration
                          const activeSec = session ? Math.floor((nowTick - new Date(session.lastActive || session.loginTime || nowTick).getTime()) / 1000) + (session.shiftTimer || 0) : 0;
                          const hrs = Math.floor(activeSec / 3600);
                          const mins = Math.floor((activeSec % 3600) / 60);
                          const secs = activeSec % 60;
                          const durationFormatted = isClockedIn ? `${hrs > 0 ? hrs + 'h ' : ''}${mins}m ${secs}s` : '0m 0s';

                          // Break monitoring active timer & threshold alert
                          const breakSec = session && isBreak ? Math.floor((nowTick - new Date(session.lastActive || session.loginTime || nowTick).getTime()) / 1000) + (session.breakTimer || 0) : 0;
                          const limitMin = session && isBreak ? getBreakLimitMinutes(session.currentActivity) : 0;
                          const limitSec = limitMin * 60;
                          const isOver = limitMin > 0 && (breakSec >= limitSec || isBreakOverrun(session?.currentActivity || '', breakSec));
                          const isApproaching = limitMin > 0 && !isOver && (breakSec >= limitSec * 0.8 || limitSec - breakSec <= 300);

                          const bMins = Math.floor(breakSec / 60);
                          const bSecs = breakSec % 60;
                          const breakTimerFormatted = `${bMins}m ${bSecs < 10 ? '0' : ''}${bSecs}s`;

                          const clockInTimeFormatted = session && (session.clockInTime || session.loginTime)
                            ? new Date(session.clockInTime || session.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' (' + new Date(session.clockInTime || session.loginTime).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')'
                            : '—';

                          return (
                            <tr key={idx} className={`transition-all ${
                              isBreak 
                                ? (isOver ? 'bg-red-950/20 hover:bg-red-900/30' : 'bg-amber-950/10 hover:bg-amber-900/20')
                                : (isClockedIn ? 'hover:bg-emerald-950/10' : 'hover:bg-zinc-50 dark:hover:bg-zinc-850/20')
                            }`}>
                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                                    isBreak 
                                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' 
                                      : (isClockedIn ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400')
                                  }`}>
                                    {cred.name.charAt(0)}
                                  </div>
                                  <div>
                                    <span className="font-sans font-bold text-zinc-800 dark:text-zinc-100 block">{cred.name}</span>
                                    <span className="text-[9px] text-amber-500 font-mono block">ID: {cred.agentId} ({cred.role})</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                {isClockedIn ? (
                                  <div className="flex items-center gap-2">
                                    <span className={`w-2.5 h-2.5 rounded-full ${isBreak ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`}></span>
                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                                      isBreak 
                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    }`}>
                                      {isBreak ? `ON BREAK` : 'ACTIVE / ON DUTY'}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-red-500/60"></span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border bg-red-500/10 text-red-400 border-red-500/20">
                                      OFFLINE / CLOCKED OUT
                                    </span>
                                  </div>
                                )}
                              </td>

                              {/* Break Type & Active Timer Column */}
                              <td className="py-3 px-3.5">
                                {isBreak ? (
                                  <div className="space-y-1">
                                    <span className="text-zinc-200 font-bold block text-[11px] uppercase tracking-wide">
                                      {session?.currentActivity || 'Break'}
                                    </span>
                                    {isOver ? (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/60 text-red-400 font-mono font-bold text-[10px] animate-pulse">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                                        <span>LIMIT EXCEEDED: {breakTimerFormatted} ({limitMin}m limit)</span>
                                      </div>
                                    ) : isApproaching ? (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/60 text-amber-300 font-mono font-bold text-[10px]">
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                        <span>APPROACHING LIMIT: {breakTimerFormatted} / {limitMin}m</span>
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono font-bold text-[10px]">
                                        <Clock className="w-3 h-3 text-amber-400 animate-spin shrink-0" />
                                        <span>ACTIVE BREAK: {breakTimerFormatted} {limitMin > 0 ? `/ ${limitMin}m` : ''}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-zinc-500 italic text-[11px]">No Active Break</span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 font-mono text-zinc-700 dark:text-zinc-300">
                                {clockInTimeFormatted}
                              </td>

                              <td className="py-3 px-3.5 font-mono font-bold text-amber-500">
                                {durationFormatted}
                              </td>

                              <td className="py-3 px-3.5 text-[10px] text-zinc-400">
                                {isClockedIn ? (
                                  <div>
                                    <span className="block text-zinc-200 font-semibold">{session?.deviceInfo || 'Chrome (Web)'}</span>
                                    <span className="block text-[9px] text-zinc-500 font-mono">IP: {session?.ipInfo || '127.0.0.1'}</span>
                                  </div>
                                ) : (
                                  <span className="text-zinc-600 italic">Disconnected</span>
                                )}
                              </td>

                              <td className="py-3 px-3.5 text-[10px] font-mono text-zinc-400 uppercase">
                                {isClockedIn ? (session?.currentActivity || 'AVAILABLE') : '—'}
                              </td>

                              <td className="py-3 px-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {isClockedIn ? (
                                    <>
                                      <button
                                        onClick={() => session && handleForceStatusAvailable(session)}
                                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[9px] font-bold uppercase transition-all shadow-xs cursor-pointer"
                                        title="Force status to Available"
                                      >
                                        Force Available
                                      </button>
                                      <button
                                        onClick={() => handleAdminForceClockOut(cred.agentId, cred.name)}
                                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[9px] font-bold uppercase transition-all shadow-xs cursor-pointer"
                                        title="Force Agent Clock Out"
                                      >
                                        Force Clock Out
                                      </button>
                                    </>
                                  ) : (
                                    <span className="text-[10px] text-zinc-600 italic">No Active Session</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Daily Performance Summary / Daily User Activity / Daily Attendance */}
        {(activeSubOption === 'dash_daily' || activeSubOption === 'user_daily' || activeSubOption === 'roster_daily' || activeSubOption === 'ops_daily' || activeSubOption === 'fin_daily') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Daily Filtered Operational Audit Report
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={repDate}
                    onChange={(e) => {
                      setRepDate(e.target.value);
                      setRepDateMode('day');
                    }}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono"
                  />
                  <button
                    onClick={handleExportCustomReport}
                    className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase rounded-lg"
                  >
                    Download CSV
                  </button>
                </div>
              </div>

              {/* Table Preview */}
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2.5 px-3">Log / Agent ID</th>
                      <th className="py-2.5 px-3">Entity Name</th>
                      <th className="py-2.5 px-3">Type / Activity</th>
                      <th className="py-2.5 px-3">Timestamp / Date</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {getFilteredSessions().map((s, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2 px-3 font-bold text-amber-500">{s.id}</td>
                        <td className="py-2 px-3 font-sans font-semibold">{s.name}</td>
                        <td className="py-2 px-3">{s.currentActivity}</td>
                        <td className="py-2 px-3 text-[10px]">{s.loginTime ? new Date(s.loginTime).toLocaleTimeString() : 'N/A'}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-500">{s.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Monthly Analytics Report / Monthly User Growth / Monthly Shift Summary / Monthly Financial */}
        {(activeSubOption === 'dash_monthly' || activeSubOption === 'user_monthly' || activeSubOption === 'roster_monthly' || activeSubOption === 'ops_monthly' || activeSubOption === 'fin_monthly') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <FileBarChart className="w-4 h-4 text-purple-500" />
                  Monthly Analytics & Performance Trends
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={repMonth}
                    onChange={(e) => {
                      setRepMonth(e.target.value);
                      setRepDateMode('month');
                    }}
                    className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono"
                  />
                  <button
                    onClick={handlePushReportToGoogleSheet}
                    disabled={isPushingToSheet || !token}
                    className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold uppercase rounded-lg disabled:opacity-50"
                  >
                    Push to Sheet
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl">
                  <span className="text-[9px] uppercase text-zinc-400 block">Month Context</span>
                  <span className="text-base font-bold text-purple-500">{repMonth}</span>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl">
                  <span className="text-[9px] uppercase text-zinc-400 block">Total Shift Days</span>
                  <span className="text-base font-bold text-zinc-800 dark:text-zinc-200">{rosterDays.length} Days</span>
                </div>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <span className="text-[9px] uppercase text-zinc-400 block">Tickets Resolved</span>
                  <span className="text-base font-bold text-emerald-500">{tickets.filter(t => t.status === 'Resolved').length}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 2: USER MANAGEMENT VIEWS */}
        {activeSubOption === 'user_dash' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200">Registered Staff Directory</h3>
                <button
                  onClick={() => setActiveSubOption('user_add')}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add New User
                </button>
              </div>

              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2.5 px-3">Agent ID</th>
                      <th className="py-2.5 px-3">Full Name</th>
                      <th className="py-2.5 px-3">Password</th>
                      <th className="py-2.5 px-3 text-center">Role</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {agentCredentials.map((c, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2.5 px-3 font-bold text-amber-500">{c.agentId}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-100">{c.name}</td>
                        <td className="py-2.5 px-3 text-zinc-400 font-mono">••••••••</td>
                        <td className="py-2.5 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {c.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="px-2 py-1 bg-blue-500/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/30 rounded font-bold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer"
                              title="Edit User Details & Role"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => handleResetPassword(c.agentId)}
                              className="p-1 border border-zinc-200 dark:border-zinc-800 text-amber-500 hover:bg-amber-500/10 rounded transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleRevokeAccess(c.agentId)}
                              className="px-2 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/30 rounded font-bold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer"
                              title="Delete / Revoke User Access"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add New User View */}
        {activeSubOption === 'user_add' && (
          <div className="max-w-xl mx-auto space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2 font-mono">
                <UserPlus className="w-4 h-4 text-amber-500" />
                Register New User Account
              </h3>

              <form onSubmit={handleCreateAgent} className="space-y-4 text-xs">
                {creationError && <div className="p-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">{creationError}</div>}
                {creationSuccess && <div className="p-2.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-lg">{creationSuccess}</div>}

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Agent ID / Username *</label>
                  <input
                    type="text"
                    required
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value.toLowerCase().trim())}
                    placeholder="e.g. agent50"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Full Representative Name *</label>
                  <input
                    type="text"
                    required
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. Tariq Hasan"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Plaintext Password *</label>
                  <input
                    type="text"
                    required
                    value={newAgentPass}
                    onChange={(e) => setNewAgentPass(e.target.value)}
                    placeholder="e.g. pass123"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Assigned Role</label>
                  <select
                    value={newAgentRole}
                    onChange={(e) => setNewAgentRole(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                  >
                    <option value="AGENT">AGENT (Operational CRM)</option>
                    <option value="ADMIN">ADMIN (Full Control Portal)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all"
                >
                  {isSubmitting ? 'Registering User...' : 'Add User Account & Sync'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit / Manage User Roles View */}
        {activeSubOption === 'user_edit' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200">Manage User Credentials & Access Controls</h3>
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2.5 px-3">Agent ID</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {agentCredentials.map((c, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2.5 px-3 font-bold text-amber-500">{c.agentId}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-zinc-800 dark:text-zinc-100">{c.name}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.role === 'ADMIN' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {c.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenEditModal(c)}
                              className="px-2.5 py-1 bg-blue-500/10 hover:bg-blue-600 text-blue-600 hover:text-white border border-blue-500/30 rounded font-bold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer"
                              title="Edit User Details & Role"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>

                            <button
                              onClick={() => handleResetPassword(c.agentId)}
                              className="p-1 border border-zinc-200 dark:border-zinc-800 text-amber-500 hover:bg-amber-500/10 rounded transition-colors cursor-pointer"
                              title="Reset Password"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleRevokeAccess(c.agentId)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-500/30 rounded font-bold text-[10px] uppercase flex items-center gap-1 transition-all cursor-pointer"
                              title="Delete User Access"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* EDIT USER MODAL DIALOG OVERLAY */}
        {editingAgent && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative font-sans">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 font-mono uppercase">
                      Edit User: <span className="text-amber-500">{editingAgent.agentId}</span>
                    </h3>
                    <p className="text-[10px] text-zinc-400">Modify display name, role, or access password</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingAgent(null)}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 font-mono">Agent ID (Read-Only)</label>
                  <input
                    type="text"
                    disabled
                    value={editingAgent.agentId}
                    className="w-full bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono text-zinc-500 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 font-mono">Full Display Name *</label>
                  <input
                    type="text"
                    required
                    value={editAgentName}
                    onChange={(e) => setEditAgentName(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-blue-500 text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 font-mono">Password *</label>
                  <input
                    type="text"
                    required
                    value={editAgentPass}
                    onChange={(e) => setEditAgentPass(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 text-zinc-800 dark:text-zinc-100"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1 font-mono">Access Role</label>
                  <select
                    value={editAgentRole}
                    onChange={(e) => setEditAgentRole(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-500 text-zinc-800 dark:text-zinc-100"
                  >
                    <option value="AGENT">AGENT - Standard Support Staff</option>
                    <option value="ADMIN">ADMIN - System Administrator</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingAgent(null)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold text-xs rounded-xl uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedAgent}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl uppercase tracking-wider shadow-xs transition-colors cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* User Settings & Preferences */}
        {(activeSubOption === 'user_pref' || activeSubOption === 'ops_edit_param' || activeSubOption === 'ops_pref' || activeSubOption === 'fin_pref') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-5">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Google Spreadsheet & Synchronization Parameters
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Spreadsheet ID</label>
                  <input
                    type="text"
                    value={connectedSpreadsheetId || ''}
                    onChange={(e) => setConnectedSpreadsheetId && setConnectedSpreadsheetId(e.target.value.trim())}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Spreadsheet URL</label>
                  <input
                    type="text"
                    value={connectedSpreadsheetUrl || ''}
                    onChange={(e) => setConnectedSpreadsheetUrl && setConnectedSpreadsheetUrl(e.target.value.trim())}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <button
                onClick={async () => {
                  if (connectedSpreadsheetId) {
                    await saveSpreadsheetConfig(connectedSpreadsheetId, connectedSpreadsheetUrl || '');
                    alert("Spreadsheet configuration saved!");
                  }
                }}
                className="px-4 py-2 bg-zinc-900 dark:bg-zinc-800 text-white font-bold uppercase text-xs rounded-xl"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* CATEGORY 3: AGENT DUTY STATUS & ROSTER VIEWS */}
        {(activeSubOption === 'roster_dash' || activeSubOption === 'roster_edit') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" />
                  24/7 Workforce Shift Roster Matrix
                </h3>
                <button
                  onClick={() => setActiveSubOption('roster_add')}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold uppercase rounded-lg flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Shift Assignment
                </button>
              </div>

              <div className="overflow-x-auto max-h-[380px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Day</th>
                      <th className="py-2.5 px-3">Morning Shift</th>
                      <th className="py-2.5 px-3">Standard Day</th>
                      <th className="py-2.5 px-3">Afternoon Shift</th>
                      <th className="py-2.5 px-3">Evening / Night</th>
                      <th className="py-2.5 px-3">Off Duty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {rosterDays.map((day, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2.5 px-3 font-bold text-amber-500">{day.date}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold">{day.dayOfWeek}</td>
                        <td className="py-2.5 px-3 text-[10px] font-sans text-zinc-500">{(day.shifts?.morning || []).join(', ') || '-'}</td>
                        <td className="py-2.5 px-3 text-[10px] font-sans text-zinc-500">{(day.shifts?.standardDay || []).join(', ') || '-'}</td>
                        <td className="py-2.5 px-3 text-[10px] font-sans text-zinc-500">{(day.shifts?.afternoon || []).join(', ') || '-'}</td>
                        <td className="py-2.5 px-3 text-[10px] font-sans text-zinc-500">{[...(day.shifts?.evening || []), ...(day.shifts?.night || [])].join(', ') || '-'}</td>
                        <td className="py-2.5 px-3 text-[10px] font-sans text-red-400">{(day.shifts?.off || []).join(', ') || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add New Roster / Shift View */}
        {activeSubOption === 'roster_add' && (
          <div className="max-w-xl mx-auto space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2 font-mono">
                <Plus className="w-4 h-4 text-amber-500" />
                Assign Shift to Representative
              </h3>

              <form onSubmit={handleAddRosterAssignment} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Target Date *</label>
                  <input
                    type="date"
                    required
                    value={rosterTargetDate}
                    onChange={(e) => setRosterTargetDate(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Select Representative *</label>
                  <select
                    value={rosterAgent}
                    onChange={(e) => setRosterAgent(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                  >
                    <option value="">-- Choose Agent --</option>
                    {agentCredentials.map(a => (
                      <option key={a.agentId} value={a.name}>{a.name} ({a.agentId})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Shift Type *</label>
                  <select
                    value={rosterShiftType}
                    onChange={(e) => setRosterShiftType(e.target.value as any)}
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                  >
                    <option value="morning">Morning Shift (06:00 - 14:00)</option>
                    <option value="standardDay">Standard Day Shift (08:00 - 17:00)</option>
                    <option value="lateDay">Late Day Shift (10:00 - 19:00)</option>
                    <option value="afternoon">Afternoon Shift (14:00 - 22:00)</option>
                    <option value="evening">Evening Shift (18:00 - 02:00)</option>
                    <option value="night">Night Shift (22:00 - 06:00)</option>
                    <option value="off">Off Duty (Rest Day)</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase tracking-wider text-xs rounded-xl transition-all"
                >
                  Save Shift Allocation
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Roster Preferences View */}
        {activeSubOption === 'roster_pref' && (
          <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4 animate-fadeIn">
            <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200">24/7 Staffing Rules & Shift Time Definitions</h3>
            <div className="space-y-3 text-xs font-mono text-zinc-500">
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl flex justify-between">
                <span>Morning Shift Window</span>
                <span className="font-bold text-amber-500">06:00 - 14:00</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl flex justify-between">
                <span>Standard Day Shift Window</span>
                <span className="font-bold text-amber-500">08:00 - 17:00</span>
              </div>
              <div className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl flex justify-between">
                <span>Night Shift Window</span>
                <span className="font-bold text-purple-500">22:00 - 06:00</span>
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 4: SYSTEM OPERATIONS & MONITORING VIEWS */}
        {(activeSubOption === 'ops_dash' || activeSubOption === 'ops_health') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">NIBSS Switch Gateway</span>
                <span className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                  ● Operational (Latency 120ms)
                </span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">Carrier SMS Route</span>
                <span className="text-sm font-bold text-amber-500 flex items-center gap-1">
                  ● Degraded (MTN Queue)
                </span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">Google Sheets Sync Engine</span>
                <span className="text-sm font-bold text-emerald-500 flex items-center gap-1">
                  ● Connected & Online
                </span>
              </div>
            </div>

            {/* System Audit Logs Stream */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Scroll className="w-4 h-4 text-amber-500" />
                Live System Audit & Modification Logs
              </h3>
              <div className="max-h-48 overflow-y-auto space-y-2 font-mono text-xs">
                {systemLogs.map((log, idx) => (
                  <div key={idx} className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl flex justify-between items-center">
                    <span>{log.message}</span>
                    <span className="text-[10px] text-zinc-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add System Rule / Threshold View */}
        {activeSubOption === 'ops_add_rule' && (
          <div className="max-w-xl mx-auto space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                Define Operational System Rule
              </h3>

              <form onSubmit={handleAddSystemRule} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Rule Name *</label>
                  <input
                    type="text"
                    required
                    value={newRuleName}
                    onChange={(e) => setNewRuleName(e.target.value)}
                    placeholder="e.g. Lunch Break Max Overrun Alert"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Threshold Limit *</label>
                    <input
                      type="number"
                      required
                      value={newRuleLimit}
                      onChange={(e) => setNewRuleLimit(Number(e.target.value))}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Unit</label>
                    <select
                      value={newRuleUnit}
                      onChange={(e) => setNewRuleUnit(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="seconds">Seconds</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 text-white font-bold uppercase text-xs rounded-xl"
                >
                  Create Rule Definition
                </button>
              </form>

              {/* Rules List */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2 font-mono text-xs">
                {systemRules.map(r => (
                  <div key={r.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 block">{r.name}</span>
                      <span className="text-[10px] text-zinc-400">{r.category}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-500 font-bold">{r.limit} {r.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY 5: FINANCIALS & CUSTOMER REPORTS VIEWS */}
        {(activeSubOption === 'fin_dash' || activeSubOption === 'fin_mon') && (
          <div className="space-y-6 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono text-xs">
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">Total Daily Transaction Volume</span>
                <span className="text-xl font-bold text-emerald-500">₦24,850,000</span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">Pending Reversals Count</span>
                <span className="text-xl font-bold text-amber-500">{disputes.filter(d => d.status === 'Pending Reversal').length} Pending</span>
              </div>
              <div className="p-4 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-1">
                <span className="text-[9px] uppercase text-zinc-400 block">Settlement Health</span>
                <span className="text-xl font-bold text-blue-500">99.4% SLA</span>
              </div>
            </div>

            {/* Disputes Ledger */}
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200">Financial Dispute & Double Debit Ledger</h3>
              <div className="overflow-x-auto max-h-[250px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2 px-3">Ref ID</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Type</th>
                      <th className="py-2 px-3">Bank</th>
                      <th className="py-2 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {disputes.map((d, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2 px-3 font-bold text-amber-500">{d.id}</td>
                        <td className="py-2 px-3 font-sans font-semibold">{d.customer}</td>
                        <td className="py-2 px-3 font-bold text-emerald-500">{d.amount}</td>
                        <td className="py-2 px-3">{d.type}</td>
                        <td className="py-2 px-3">{d.bank}</td>
                        <td className="py-2 px-3 text-right font-bold text-amber-500">{d.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Add Entry / Invoice View */}
        {activeSubOption === 'fin_add_entry' && (
          <div className="max-w-xl mx-auto space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 flex items-center gap-2 font-mono">
                <Plus className="w-4 h-4 text-emerald-500" />
                Log Financial Dispute / Ledger Adjustment
              </h3>

              <form onSubmit={handleAddDisputeEntry} className="space-y-4 text-xs font-sans">
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={newEntryCust}
                    onChange={(e) => setNewEntryCust(e.target.value)}
                    placeholder="e.g. Ibrahim Musa"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Amount (NGN) *</label>
                  <input
                    type="text"
                    required
                    value={newEntryAmount}
                    onChange={(e) => setNewEntryAmount(e.target.value)}
                    placeholder="e.g. 25000"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Dispute Type</label>
                    <select
                      value={newEntryType}
                      onChange={(e) => setNewEntryType(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                    >
                      <option value="Double Debit">Double Debit</option>
                      <option value="POS Timeout">POS Timeout</option>
                      <option value="Failed Transfer">Failed Transfer</option>
                      <option value="Manual Adjustment">Manual Adjustment</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase block mb-1">Bank Endpoint</label>
                    <select
                      value={newEntryBank}
                      onChange={(e) => setNewEntryBank(e.target.value)}
                      className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2 text-xs font-bold"
                    >
                      <option value="Zenith Bank">Zenith Bank</option>
                      <option value="GTBank">GTBank</option>
                      <option value="FirstBank">FirstBank</option>
                      <option value="Stanbic IBTC">Stanbic IBTC</option>
                      <option value="UBA">UBA</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-emerald-600 text-white font-bold uppercase text-xs rounded-xl"
                >
                  Save Dispute Record
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Edit Transactions View */}
        {activeSubOption === 'fin_edit_trans' && (
          <div className="space-y-4 animate-fadeIn">
            <div className="bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800 dark:text-zinc-200">Manage & Modify Financial Transactions</h3>
              <div className="overflow-x-auto max-h-[350px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-zinc-100 dark:bg-zinc-950 text-zinc-400 uppercase text-[9px]">
                    <tr>
                      <th className="py-2 px-3">Ref ID</th>
                      <th className="py-2 px-3">Customer</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {disputes.map((d, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-850/20">
                        <td className="py-2 px-3 text-amber-500 font-bold">{d.id}</td>
                        <td className="py-2 px-3 font-sans font-semibold">{d.customer}</td>
                        <td className="py-2 px-3 text-emerald-500 font-bold">{d.amount}</td>
                        <td className="py-2 px-3">{d.status}</td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => {
                              const updated = disputes.map(x => x.id === d.id ? { ...x, status: 'Resolved' } : x);
                              setDisputes(updated);
                              alert(`Transaction ${d.id} marked as Resolved!`);
                            }}
                            className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold uppercase rounded"
                          >
                            Mark Resolved
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <ConfirmationModal
          isOpen={showPushConfirm}
          title="Push Dataset to Google Sheets"
          message={`Are you sure you want to push the filtered ${repType.toUpperCase()} dataset to your connected Google Spreadsheet?`}
          confirmLabel="Push to Sheet"
          cancelLabel="Cancel"
          isDangerous={false}
          onConfirm={executePushReportToGoogleSheet}
          onCancel={() => setShowPushConfirm(false)}
        />

        <ConfirmationModal
          isOpen={!!revokeAgentConfirmId}
          title="Revoke User Access"
          message={`Are you sure you want to permanently revoke access for user: "${revokeAgentConfirmId}"?`}
          confirmLabel="Revoke Access"
          cancelLabel="Cancel"
          isDangerous={true}
          onConfirm={executeRevokeAccess}
          onCancel={() => setRevokeAgentConfirmId(null)}
        />

        <ConfirmationModal
          isOpen={!!forceClockOutConfirmAgent}
          title="Force Clock Out Agent"
          message={`Are you sure you want to force Clock Out agent "${forceClockOutConfirmAgent?.name}"?`}
          confirmLabel="Force Clock Out"
          cancelLabel="Cancel"
          isDangerous={true}
          onConfirm={executeAdminForceClockOut}
          onCancel={() => setForceClockOutConfirmAgent(null)}
        />

      </main>
  );
}
