import { useState } from 'react';
import { 
  BarChart, Download, CheckCircle, Clock, TrendingUp, AlertTriangle, 
  FileSpreadsheet, FileText, HelpCircle, User, Calendar, List, CheckSquare, 
  Search, ShieldAlert, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import { CRMContact, SupportTicket, RosterDay, LiveAgentSession } from '../types';

interface ReportsSectionProps {
  contacts: CRMContact[];
  tickets: SupportTicket[];
  rosterDays: RosterDay[];
  liveAgentSessions: LiveAgentSession[];
  liveBreaks?: any[];
  activityLogs?: any[];
  logActivity: (message: string) => void;
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

export default function ReportsSection({
  contacts,
  tickets,
  rosterDays,
  liveAgentSessions,
  liveBreaks = [],
  activityLogs = [],
  logActivity
}: ReportsSectionProps) {
  // Available Report Types (All Report Name Options)
  const reportOptions = [
    {
      id: 'activity_logs',
      name: 'Firebase Real-Time Granular Activity Logs',
      description: 'Second-by-second status transition logs, exact start/end timestamps per second, duty division changes, and duration audit trail.',
      badge: 'Firebase Realtime Audit',
      icon: Layers,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'work_duration',
      name: 'Duty & Work Duration Report',
      description: 'Shift sessions, duty hours, checkout activities, and cumulative working duration for agent tracking.',
      badge: 'Workforce Session',
      icon: Clock,
      color: 'text-blue-500 bg-blue-500/10 border-blue-500/20'
    },
    {
      id: 'breaks',
      name: 'Break & Compliance Report',
      description: 'Complete breakdown of break activities (Short, Meal, Prayer) with live SLA limits overrun detection.',
      badge: 'Compliance Audit',
      icon: TrendingUp,
      color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
    },
    {
      id: 'tickets',
      name: 'Support SLA Tickets Report',
      description: 'Customer ticketing histories, priority levels, resolution statuses, and agent resolution counters.',
      badge: 'SLA Performance',
      icon: FileText,
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      id: 'cs_form',
      name: 'CS Ticket Form Submissions',
      description: 'Submitted customer service forms, order statuses, IMEI verification codes, and gateway Trx IDs.',
      badge: 'Form Submissions',
      icon: FileSpreadsheet,
      color: 'text-purple-500 bg-purple-500/10 border-purple-500/20'
    },
    {
      id: 'pending_tasks',
      name: 'Pending & Remaining Tasks (Baki Work)',
      description: 'Dedicated list of unresolved items: active Support Tickets and Pending CS Ticket Form submissions.',
      badge: 'Remaining Items',
      icon: CheckSquare,
      color: 'text-red-500 bg-red-500/10 border-red-500/20 animate-pulse'
    },
    {
      id: 'master_summary',
      name: 'Unified Master Workspace Summary',
      description: 'All-inclusive multi-sheet export compiling historic rosters, client contact sheets, and general KPIs.',
      badge: 'Consolidated Sheet',
      icon: Layers,
      color: 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
    }
  ];

  const [activeReport, setActiveReport] = useState<string>('work_duration');
  const [downloadSuccess, setDownloadSuccess] = useState('');

  // Filtering configurations (Agent Filter, Date Filter)
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [reportPeriod, setReportPeriod] = useState<'all' | 'daily' | 'monthly' | 'range'>('all');
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().substring(0, 7));
  const [reportStartDate, setReportStartDate] = useState<string>(new Date().toISOString().substring(0, 10) + 'T00:00');
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().substring(0, 10) + 'T23:59');

  // Load CS ticket form submissions from LocalStorage dynamically
  const [submittedCsTickets, setSubmittedCsTickets] = useState<SubmittedCsTicket[]>(() => {
    const saved = localStorage.getItem('cs_submitted_tickets');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse CS submitted tickets in ReportsSection", e);
      }
    }
    return [];
  });

  // Unique agents compiling from all logs
  const uniqueAgents = Array.from(new Set([
    ...liveAgentSessions.map(s => JSON.stringify({ id: s.agentId || s.id, name: s.name })),
    ...liveBreaks.map(b => JSON.stringify({ id: b.agentId, name: b.agentName }))
  ].filter(Boolean))).map(str => JSON.parse(str)) as { id: string; name: string }[];

  const getSelectedAgentName = () => {
    if (selectedAgentId === 'all') return 'All Agents';
    const ag = uniqueAgents.find(a => a.id === selectedAgentId);
    return ag ? ag.name : selectedAgentId;
  };

  // Helper limits for breaks
  const getBreakLimitSeconds = (reason: string): number => {
    const r = reason.toLowerCase();
    if (r.includes('short')) return 900;
    if (r.includes('meal')) return 1800;
    if (r.includes('prayer')) return 900;
    return 9999999;
  };

  // Filter verification functions
  const isWithinDateScope = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false;
    
    if (reportPeriod === 'all') return true;
    
    const recordDate = dateStr.substring(0, 10); // YYYY-MM-DD
    
    if (reportPeriod === 'daily') {
      return recordDate === reportDate;
    }
    
    if (reportPeriod === 'monthly') {
      return dateStr.startsWith(reportMonth); // YYYY-MM
    }
    
    if (reportPeriod === 'range') {
      const recordTime = new Date(dateStr).getTime();
      const startTime = new Date(reportStartDate).getTime();
      const endTime = new Date(reportEndDate).getTime();
      return recordTime >= startTime && recordTime <= endTime;
    }
    
    return true;
  };

  const isAgentMatched = (agentIdInRecord: string | undefined, agentNameInRecord: string | undefined): boolean => {
    if (selectedAgentId === 'all') return true;
    
    const targetId = selectedAgentId.toLowerCase();
    const idMatch = agentIdInRecord?.toLowerCase() === targetId;
    
    const targetName = getSelectedAgentName().toLowerCase();
    const nameMatch = agentNameInRecord?.toLowerCase().includes(targetName) || 
                      agentIdInRecord?.toLowerCase().includes(targetName);
                      
    return idMatch || nameMatch;
  };

  // Data compilers for live metrics & previews
  const getCompiledSessions = () => {
    return liveAgentSessions.filter(s => {
      return isAgentMatched(s.agentId || s.id, s.name) && isWithinDateScope(s.loginTime);
    });
  };

  const getCompiledBreaks = () => {
    return liveBreaks.filter(b => {
      return isAgentMatched(b.agentId, b.agentName) && isWithinDateScope(b.startTime);
    });
  };

  const getCompiledTickets = () => {
    return tickets.filter(t => {
      const dateMatch = isWithinDateScope(t.createdAt);
      if (!dateMatch) return false;
      
      if (selectedAgentId === 'all') return true;
      
      const targetAgentName = getSelectedAgentName();
      const hasAgentReply = t.replies?.some(r => 
        r.author?.toLowerCase().includes(targetAgentName.toLowerCase())
      );
      return hasAgentReply;
    });
  };

  const getCompiledCsTickets = () => {
    return submittedCsTickets.filter(t => {
      return isWithinDateScope(t.submittedAt);
    });
  };

  const getCompiledPendingTasks = () => {
    const pendingSupport = tickets.filter(t => {
      const isUnresolved = t.status === 'Open' || t.status === 'In Progress';
      if (!isUnresolved) return false;
      
      const dateMatch = isWithinDateScope(t.createdAt);
      if (!dateMatch) return false;
      
      if (selectedAgentId === 'all') return true;
      
      const targetAgentName = getSelectedAgentName();
      const hasAgentReply = t.replies?.some(r => 
        r.author?.toLowerCase().includes(targetAgentName.toLowerCase())
      );
      return hasAgentReply;
    });

    const pendingCs = submittedCsTickets.filter(t => {
      const isPending = t.status === 'Pending' || t.status === 'Processing';
      if (!isPending) return false;
      
      return isWithinDateScope(t.submittedAt);
    });

    return { pendingSupport, pendingCs };
  };

  // Main KPI Stats
  const totalTickets = tickets.length;
  const openTickets = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
  const resolvedTickets = tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length;
  const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 100;
  const urgentTicketsCount = tickets.filter(t => t.priority === 'Urgent').length;
  const activeAgentsCount = liveAgentSessions.filter(s => s.status !== 'offline').length;

  // Date period helper text
  const periodLabel = reportPeriod === 'all' 
    ? 'All Time' 
    : reportPeriod === 'daily' 
      ? `Daily (${reportDate})` 
      : reportPeriod === 'monthly' 
        ? `Monthly (${reportMonth})` 
        : `Range (${reportStartDate.replace('T', ' ')} to ${reportEndDate.replace('T', ' ')})`;

  // Handle Export / CSV Download Engine
  const handleGenerateReport = () => {
    setDownloadSuccess('');
    let csvContent = "\uFEFF"; // UTF-8 BOM to prevent spreadsheet format rendering issues
    const targetAgentName = getSelectedAgentName();

    if (activeReport === 'activity_logs') {
      csvContent += `=== FIREBASE REAL-TIME GRANULAR ACTIVITY TRANSITION LOGS ===\n`;
      csvContent += `Agent ID Filter,Agent Name Filter,Date Period,Generated At\n`;
      csvContent += `"${selectedAgentId}","${targetAgentName}","${periodLabel}","${new Date().toISOString()}"\n\n`;

      csvContent += `Log ID,Timestamp (ISO),Time (Formatted),Agent ID,Agent Name,Event Type,Previous Status,New Status,Previous Activity,New Activity,Shift Timer (Sec),Break Timer (Sec),Device Info\n`;

      let filteredLogs = activityLogs.filter(l => {
        if (selectedAgentId !== 'all') {
          const matchAgent = l.agentId?.toLowerCase() === selectedAgentId.toLowerCase() ||
                             l.agentName?.toLowerCase().includes(targetAgentName.toLowerCase());
          if (!matchAgent) return false;
        }
        if (reportPeriod === 'daily' && reportDate) {
          if (!l.timestamp?.startsWith(reportDate)) return false;
        } else if (reportPeriod === 'monthly' && reportMonth) {
          if (!l.timestamp?.startsWith(reportMonth)) return false;
        } else if (reportPeriod === 'range') {
          const startTs = new Date(reportStartDate).getTime();
          const endTs = new Date(reportEndDate).getTime();
          const lTs = new Date(l.timestamp || '').getTime();
          if (lTs < startTs || lTs > endTs) return false;
        }
        return true;
      });

      if (filteredLogs.length > 0) {
        filteredLogs.forEach(l => {
          csvContent += `"${l.id || ''}","${l.timestamp || ''}","${l.formattedTime || ''}","${l.agentId || ''}","${l.agentName || ''}","${l.eventType || ''}","${l.previousStatus || ''}","${l.newStatus || ''}","${l.previousActivity || ''}","${l.newActivity || ''}","${l.shiftTimerSeconds || 0}","${l.breakTimerSeconds || 0}","${l.deviceInfo || ''}"\n`;
        });
      } else {
        // Detailed real-time snapshot fallback with second-level timestamps
        liveAgentSessions.forEach(s => {
          const nowIso = new Date().toISOString();
          const nowFmt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          csvContent += `"snapshot_${Date.now()}","${nowIso}","${nowFmt}","${s.agentId || s.id}","${s.name}","CURRENT_STATE","${s.status}","${s.status}","${s.currentActivity}","${s.currentActivity}","${s.shiftTimer || 0}","${s.breakTimer || 0}","${s.deviceInfo || ''}"\n`;
        });
      }

      logActivity(`Admin generated Granular Real-time Activity Logs Report for ${targetAgentName} (${periodLabel})`);

    } else if (activeReport === 'work_duration') {
      const compiled = getCompiledSessions();
      csvContent += `=== AGENT DUTY & WORK SESSIONS REPORT ===\n`;
      csvContent += `Agent ID Filter,Agent Name Filter,Date Period,Generated At\n`;
      csvContent += `"${selectedAgentId}","${targetAgentName}","${periodLabel}","${new Date().toISOString()}"\n\n`;
      
      csvContent += `Session ID,Agent ID,Agent Name,Login Time (ISO),Last Active Time (ISO),Shift Duration (Seconds),Shift Duration (Formatted),Current Status,Current Activity,Cumulative Break Duration (Seconds)\n`;
      
      compiled.forEach(s => {
        const sHrs = Math.floor((s.shiftTimer || 0) / 3600);
        const sMins = Math.floor(((s.shiftTimer || 0) % 3600) / 60);
        const durationFormatted = `${sHrs}h ${sMins}m`;
        
        csvContent += `"${s.id}","${s.agentId || s.id}","${s.name}","${s.loginTime || ''}","${s.lastActive || ''}","${s.shiftTimer || 0}","${durationFormatted}","${s.status}","${s.currentActivity || ''}","${s.breakTimer || 0}"\n`;
      });
      
      logActivity(`Admin generated Duty Session Report for ${targetAgentName} (${periodLabel})`);

    } else if (activeReport === 'breaks') {
      const compiled = getCompiledBreaks();
      csvContent += `=== AGENT BREAKS & SLA COMPLIANCE REPORT ===\n`;
      csvContent += `Agent ID Filter,Agent Name Filter,Date Period,Generated At\n`;
      csvContent += `"${selectedAgentId}","${targetAgentName}","${periodLabel}","${new Date().toISOString()}"\n\n`;
      
      csvContent += `Break ID,Agent ID,Agent Name,Break Reason (Type),Start Time (ISO),End Time (ISO),Duration (Seconds),Duration (Formatted),Status,SLA Compliance State\n`;
      
      compiled.forEach(b => {
        const bMin = b.duration ? Math.floor(b.duration / 60) : 0;
        const bSec = b.duration ? b.duration % 60 : 0;
        const bFormatted = `${bMin}m ${bSec}s`;
        
        const isOver = b.duration && b.duration > getBreakLimitSeconds(b.reason);
        const compliance = b.status === 'active' ? 'Active' : (isOver ? 'OVERRUN (Non-Compliant)' : 'COMPLIANT');
        
        csvContent += `"${b.id}","${b.agentId}","${b.agentName}","${b.reason}","${b.startTime}","${b.endTime || ''}","${b.duration || 0}","${bFormatted}","${b.status}","${compliance}"\n`;
      });

      logActivity(`Admin generated Break Compliance Report for ${targetAgentName} (${periodLabel})`);

    } else if (activeReport === 'tickets') {
      const compiled = getCompiledTickets();
      csvContent += `=== CUSTOMER SUPPORT SLA TICKETS REPORT ===\n`;
      csvContent += `Agent Filter,Date Period,Generated At\n`;
      csvContent += `"${targetAgentName}","${periodLabel}","${new Date().toISOString()}"\n\n`;
      
      csvContent += `Ticket ID,Customer ID,Customer Name,Subject Title,Category,Priority,Status,Created At,Replies Authored By Agent\n`;
      
      compiled.forEach(t => {
        const repliesByAgentCount = selectedAgentId === 'all' 
          ? (t.replies?.length || 0)
          : (t.replies?.filter(r => r.author?.toLowerCase().includes(targetAgentName.toLowerCase())).length || 0);
          
        csvContent += `"${t.id}","${t.contactId}","${t.contactName}","${t.title}","${t.category}","${t.priority}","${t.status}","${t.createdAt}","${repliesByAgentCount}"\n`;
      });

      logActivity(`Admin generated SLA Support Tickets Report (${periodLabel})`);

    } else if (activeReport === 'cs_form') {
      const compiled = getCompiledCsTickets();
      csvContent += `=== CUSTOMER SERVICE (CS) FORM SUBMISSIONS ===\n`;
      csvContent += `Date Period,Generated At\n`;
      csvContent += `"${periodLabel}","${new Date().toISOString()}"\n\n`;
      
      csvContent += `CS Submission ID,Customer Name,Order Number,IMEI Code,Complaint Category,Transaction ID,Status,Submitted At,Detail Description\n`;
      
      compiled.forEach(t => {
        const detailClean = t.detail.replace(/"/g, '""').replace(/\n/g, ' ');
        csvContent += `"${t.id}","${t.customerName}","${t.orderNumber}","${t.imei || ''}","${t.category}","${t.trxId || ''}","${t.status}","${t.submittedAt}","${detailClean}"\n`;
      });

      logActivity(`Admin generated CS Ticket Form Submissions Report (${periodLabel})`);

    } else if (activeReport === 'pending_tasks') {
      const { pendingSupport, pendingCs } = getCompiledPendingTasks();
      csvContent += `=== PENDING & REMAINING TASKS (BAKI WORK) REPORT ===\n`;
      csvContent += `Agent Filter,Date Period,Generated At\n`;
      csvContent += `"${targetAgentName}","${periodLabel}","${new Date().toISOString()}"\n\n`;
      
      csvContent += `Task Category/Type,Item ID,Customer Name,Category,Subject/Reason,Urgency/Priority,Current Status,Date Logged/Submitted,Detail/Description\n`;
      
      // 1. Unresolved Support Tickets
      pendingSupport.forEach(t => {
        const descClean = (t.description || '').replace(/"/g, '""').replace(/\n/g, ' ');
        csvContent += `"Support SLA Ticket","${t.id}","${t.contactName}","${t.category}","${t.title}","${t.priority}","${t.status}","${t.createdAt}","${descClean}"\n`;
      });
      
      // 2. Pending CS Form Submissions
      pendingCs.forEach(t => {
        const detailClean = t.detail.replace(/"/g, '""').replace(/\n/g, ' ');
        csvContent += `"CS Ticket Form Submission","${t.id}","${t.customerName}","${t.category}","Order #${t.orderNumber}","Medium","${t.status}","${t.submittedAt}","${detailClean}"\n`;
      });

      logActivity(`Admin generated Pending/Remaining Tasks Report (${periodLabel})`);

    } else if (activeReport === 'master_summary') {
      csvContent += `=== UNIFIED WORKSPACE MASTER DISPOSITION SUMMARY ===\n`;
      csvContent += `Generated At: ${new Date().toISOString()}\n\n`;
      
      csvContent += `=== SHIFT ROSTER SCHEDULES ===\n`;
      csvContent += `Date,Day of Week,Morning Shift,Standard Day,Late Day,Afternoon,Evening,Night,Off Duty\n`;
      rosterDays.forEach(day => {
        csvContent += `"${day.date}","${day.dayOfWeek}","${(day.shifts?.morning || []).join(';')}","${(day.shifts?.standardDay || []).join(';')}","${(day.shifts?.lateDay || []).join(';')}","${(day.shifts?.afternoon || []).join(';')}","${(day.shifts?.evening || []).join(';')}","${(day.shifts?.night || []).join(';')}","${(day.shifts?.off || []).join(';')}"\n`;
      });
      csvContent += `\n`;
      
      csvContent += `=== CRM CUSTOMERS DIRECTORY ===\n`;
      csvContent += `Contact ID,Name,Email,Phone,Company,Customer Class,Last Contact Date\n`;
      contacts.forEach(c => {
        csvContent += `"${c.id}","${c.name}","${c.email}","${c.phone}","${c.company}","${c.status}","${c.lastContactDate}"\n`;
      });

      logActivity(`Admin downloaded Consolidated Master Workspace Summary CSV`);
    }

    // Process and download the generated file
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const formattedDate = new Date().toISOString().substring(0, 10);
    link.setAttribute("download", `Workspace_Report_${activeReport}_${formattedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setDownloadSuccess(`Successfully compiled and exported "${activeReport.toUpperCase()}" report data to CSV format!`);
    setTimeout(() => setDownloadSuccess(''), 4500);
  };

  const activeReportConfig = reportOptions.find(r => r.id === activeReport) || reportOptions[0];
  const ActiveIconComp = activeReportConfig.icon;

  // Real-time Preview Counts
  const previewSessions = getCompiledSessions();
  const previewBreaks = getCompiledBreaks();
  const previewTickets = getCompiledTickets();
  const previewCs = getCompiledCsTickets();
  const { pendingSupport, pendingCs } = getCompiledPendingTasks();

  const totalShiftDurationSec = previewSessions.reduce((acc, curr) => acc + (curr.shiftTimer || 0), 0);
  const totalBreakDurationSec = previewBreaks.reduce((acc, curr) => acc + (curr.duration || 0), 0);
  const totalOverrunsCount = previewBreaks.filter(b => b.duration && b.duration > getBreakLimitSeconds(b.reason)).length;

  return (
    <div className="p-6 space-y-6 text-left bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn font-sans">
      
      {/* Header section */}
      <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-5">
        <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400 tracking-wide flex items-center gap-2 font-serif">
          <BarChart className="w-5 h-5 text-amber-500" />
          SYSTEM INTELLIGENCE & REPORT CENTRE
        </h2>
        <p className="text-xs text-zinc-500">
          Dynamic multi-metric spreadsheets, comprehensive agent performance auditing, and date-wise custom CSV report exports.
        </p>
      </div>

      {/* KPI stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Metric 1 */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-xs flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Support SLA Tickets</span>
            <span className="text-2xl font-bold font-mono text-zinc-850 dark:text-zinc-100">{totalTickets}</span>
            <span className="text-[9px] text-zinc-400 block font-mono">{openTickets} open / {resolvedTickets} closed</span>
          </div>
          <FileText className="w-8 h-8 text-amber-500/20 shrink-0" />
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-xs flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Resolution SLA Rate</span>
            <span className="text-2xl font-bold font-mono text-zinc-850 dark:text-zinc-100">{resolutionRate}%</span>
            <span className="text-[9px] text-zinc-400 block font-mono">Target benchmark: 85%</span>
          </div>
          <TrendingUp className="w-8 h-8 text-emerald-500/20 shrink-0" />
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-xs flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Remaining Unresolved Tasks</span>
            <span className="text-2xl font-bold font-mono text-red-500 dark:text-red-400">{openTickets + submittedCsTickets.filter(x => x.status !== 'Resolved').length}</span>
            <span className="text-[9px] text-zinc-400 block font-mono">Tickets: {openTickets} | CS Forms: {submittedCsTickets.filter(x => x.status !== 'Resolved').length}</span>
          </div>
          <AlertTriangle className="w-8 h-8 text-red-500/20 shrink-0" />
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 shadow-xs flex justify-between items-center">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Active Floor Personnel</span>
            <span className="text-2xl font-bold font-mono text-zinc-855 dark:text-zinc-100">{activeAgentsCount}</span>
            <span className="text-[9px] text-zinc-400 block font-mono">{liveBreaks.filter(b => b.status === 'active').length} currently on break</span>
          </div>
          <CheckCircle className="w-8 h-8 text-blue-500/20 shrink-0" />
        </div>

      </div>

      {/* Main Double Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Hand: All Report Options (Sidebar layout - Column span 4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-4 shadow-xs">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3 mb-3">
              <List className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-500 font-mono">Select Active Report Type</h3>
            </div>
            
            <div className="space-y-2">
              {reportOptions.map(opt => {
                const isSelected = activeReport === opt.id;
                const OptIcon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setActiveReport(opt.id)}
                    className={`w-full p-3.5 border text-left rounded-xl transition-all cursor-pointer flex gap-3 ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/[0.04] text-zinc-900 dark:text-zinc-50'
                        : 'border-zinc-150 dark:border-zinc-850 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/20 text-zinc-500 hover:text-zinc-850 dark:hover:text-zinc-300'
                    }`}
                  >
                    <div className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg border ${opt.color}`}>
                      <OptIcon className="w-4.5 h-4.5" />
                    </div>
                    
                    <div className="space-y-0.5 overflow-hidden">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xs truncate">{opt.name}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0 animate-ping" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-tight truncate">{opt.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Informational Standards Block */}
          <div className="bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-3 shadow-xs text-xs">
            <h4 className="font-bold text-zinc-850 dark:text-zinc-100 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-850 pb-2">
              <HelpCircle className="w-4 h-4 text-amber-500" />
              Reporting Compliance Notes
            </h4>
            <div className="space-y-2 text-zinc-500">
              <p>
                All data generated is synchronized live with internal records. All times are compiled as UTC.
              </p>
              <div className="bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-lg font-mono text-[10px] leading-relaxed border border-zinc-200 dark:border-zinc-800/60">
                Short break Limit: 15 mins (900s)<br />
                Meal break Limit: 30 mins (1800s)<br />
                Prayer break Limit: 15 mins (900s)
              </div>
            </div>
          </div>
        </div>

        {/* Right Hand: Parameters, live audit compiler and Export UI (Column span 8) */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 space-y-6 shadow-xs text-left">
          
          {/* Active Report Header Description */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800/80 pb-4">
            <div className="space-y-1">
              <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 uppercase tracking-widest border border-amber-500/10">
                {activeReportConfig.badge}
              </span>
              <h3 className="font-bold text-zinc-850 dark:text-zinc-50 text-base flex items-center gap-2 mt-1">
                <ActiveIconComp className="w-5 h-5 text-amber-500" />
                {activeReportConfig.name}
              </h3>
              <p className="text-xs text-zinc-400 max-w-xl">{activeReportConfig.description}</p>
            </div>
          </div>

          {/* Download Success Banner */}
          {downloadSuccess && (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2 animate-fadeIn">
              <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="font-medium">{downloadSuccess}</span>
            </div>
          )}

          {/* Filtering Configurations Suite (Agent, Period, Specific Date Range) */}
          <div className="space-y-4">
            <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono block tracking-wider">Configure Report Parameters</span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Parameter 1: Select Agent (Always contains option for all agents) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Agent Scope</span>
                </label>
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 cursor-pointer transition-all"
                >
                  <option value="all">All Agents (Combined Consolidated)</option>
                  {uniqueAgents.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.id})</option>
                  ))}
                </select>
                <p className="text-[10px] text-zinc-400 italic">Filter dataset by all active system personnel or specific agents.</p>
              </div>

              {/* Parameter 2: Date Scope Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Date Frequency / Period</span>
                </label>
                <select
                  value={reportPeriod}
                  onChange={(e) => setReportPeriod(e.target.value as 'all' | 'daily' | 'monthly' | 'range')}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 cursor-pointer transition-all"
                >
                  <option value="all">All-Time Cumulative</option>
                  <option value="daily">Daily Report (Select Day)</option>
                  <option value="monthly">Monthly Report (Select Month)</option>
                  <option value="range">Custom Date Range</option>
                </select>
                <p className="text-[10px] text-zinc-400 italic">Filter logs on daily basis, monthly schedules, or arbitrary date window.</p>
              </div>

            </div>

            {/* Dynamic picker input based on active reportPeriod selection */}
            {reportPeriod !== 'all' && (
              <div className="bg-zinc-50 dark:bg-zinc-950/40 p-4 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-3 animate-fadeIn">
                <span className="text-[10px] font-bold text-zinc-400 uppercase font-mono block">Configure Dates</span>
                
                {reportPeriod === 'daily' && (
                  <div className="max-w-xs">
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                )}

                {reportPeriod === 'monthly' && (
                  <div className="max-w-xs">
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                )}

                {reportPeriod === 'range' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-mono">Start Date Time</span>
                      <input
                        type="datetime-local"
                        value={reportStartDate}
                        onChange={(e) => setReportStartDate(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-mono">End Date Time</span>
                      <input
                        type="datetime-local"
                        value={reportEndDate}
                        onChange={(e) => setReportEndDate(e.target.value)}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Real-time Compiled Data Preview Panel (Pre-download audit preview) */}
          <div className="bg-zinc-50 dark:bg-zinc-950/30 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800/60 pb-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-200">Live Compilation Audit Preview</h4>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              
              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 text-center space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase block font-mono">Work Sessions</span>
                <span className="text-lg font-bold font-mono text-zinc-850 dark:text-zinc-100">{previewSessions.length}</span>
                <span className="text-[9px] text-zinc-400 block font-mono">({Math.floor(totalShiftDurationSec / 3600)}h active)</span>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 text-center space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase block font-mono">Breaks Taken</span>
                <span className="text-lg font-bold font-mono text-zinc-850 dark:text-zinc-100">{previewBreaks.length}</span>
                <span className={`text-[9px] block font-mono font-bold ${totalOverrunsCount > 0 ? 'text-red-500' : 'text-zinc-400'}`}>
                  {totalOverrunsCount} Overruns
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 text-center space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase block font-mono">Support Tickets</span>
                <span className="text-lg font-bold font-mono text-zinc-850 dark:text-zinc-100">{previewTickets.length}</span>
                <span className="text-[9px] text-zinc-400 block font-mono">
                  {previewTickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length} unresolved
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-950 p-3 rounded-xl border border-zinc-200 dark:border-zinc-850 text-center space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase block font-mono">CS Submitted Forms</span>
                <span className="text-lg font-bold font-mono text-zinc-850 dark:text-zinc-100">{previewCs.length}</span>
                <span className="text-[9px] text-zinc-400 block font-mono">
                  {previewCs.filter(x => x.status === 'Pending').length} pending review
                </span>
              </div>

            </div>

            {/* Dynamic audit feedback message explaining the active report type preview */}
            <div className="text-[11px] text-zinc-500 font-sans bg-zinc-100 dark:bg-zinc-950 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-850/60 space-y-1">
              <div>
                📢 <strong>Selected Action Preview:</strong> Compiling <strong>{activeReportConfig.name}</strong> for <strong>{getSelectedAgentName()}</strong> during <strong>{periodLabel}</strong>.
              </div>
              <div className="text-[10px] text-zinc-400 font-mono">
                {activeReport === 'work_duration' && `Found ${previewSessions.length} total agent sessions matching date filter constraints.`}
                {activeReport === 'breaks' && `Found ${previewBreaks.length} total logs with ${totalOverrunsCount} SLA compliance overruns.`}
                {activeReport === 'tickets' && `Found ${previewTickets.length} support tickets with relevant history logs.`}
                {activeReport === 'cs_form' && `Found ${previewCs.length} customer complaints submitted via CS Ticket Form.`}
                {activeReport === 'pending_tasks' && `Found ${pendingSupport.length} unresolved support tickets and ${pendingCs.length} pending CS forms remaining ("baki ache" items).`}
                {activeReport === 'master_summary' && `All workspace modules (Roster, CRM database, Tickets) will be consolidated into a master summary workbook.`}
              </div>
            </div>
          </div>

          {/* Action Trigger Block */}
          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[11px] text-zinc-400">
              CSV spreadsheet downloads are formatted for immediate Excel / Google Sheets import.
            </span>
            <button
              onClick={handleGenerateReport}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              <Download className="w-4 h-4 text-amber-200" />
              Compile & Export CSV Report
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
