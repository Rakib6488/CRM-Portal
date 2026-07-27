import React, { useState, useEffect } from 'react';
import { 
  Wrench, Cpu, AlertTriangle, CheckCircle, Search, FileText, HelpCircle, 
  Activity, Terminal, ArrowRight, Copy, Plus, BookOpen, Wifi, 
  RefreshCw, FileSpreadsheet, Download, AlertCircle, Trash2, CheckSquare, Sparkles
} from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';

interface SOPIssue {
  id: string;
  title: string;
  category: 'APP Issue' | 'Payment & Transfer' | 'Device & POS' | 'KYC & Auth' | 'General';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  symptom: string;
  workaround: string;
  steps: string[];
  lastUpdated: string;
  affectedSystems: string[];
}

interface InteractiveSymptom {
  id: string;
  label: string;
  category: string;
  questions: {
    id: string;
    question: string;
    options: {
      text: string;
      nextStepId?: string;
      resolution?: string;
    }[];
  }[];
}

interface CustomSOP {
  id: string;
  title: string;
  category: string;
  symptom: string;
  steps: string[];
  createdAt: string;
  author: string;
}

interface SystemTroubleshootingProps {
  agentName: string;
  logActivity: (message: string) => void;
  userRole?: 'AGENT' | 'ADMIN';
}

export default function SystemTroubleshooting({
  agentName,
  logActivity,
  userRole = 'AGENT'
}: SystemTroubleshootingProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedIssueId, setSelectedIssueId] = useState<string>('sop-1');
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});
  const [copiedSuccess, setCopiedSuccess] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Custom SOP inputs
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'APP Issue' | 'Payment & Transfer' | 'Device & POS' | 'KYC & Auth' | 'General'>('APP Issue');
  const [newSymptom, setNewSymptom] = useState('');
  const [newSteps, setNewSteps] = useState('');
  
  // Troubleshooting Wizard States
  const [wizardSymptomId, setWizardSymptomId] = useState<string>('');
  const [currentQuestionId, setCurrentQuestionId] = useState<string>('q1');
  const [diagnosticHistory, setDiagnosticHistory] = useState<{question: string; answer: string}[]>([]);
  const [wizardResolution, setWizardResolution] = useState<string | null>(null);

  // Default SOP Database (SOP dewa hbe)
  const [issues, setIssues] = useState<SOPIssue[]>(() => {
    const saved = localStorage.getItem('csp_troubleshooting_sops');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse troubleshooting SOPs", e);
      }
    }
    return [
      {
        id: 'sop-1',
        title: 'POS Connection Timeout & Network Disconnects SOP',
        category: 'Device & POS',
        severity: 'High',
        symptom: 'POS terminal displays "Network Timeout" or fails to reach server during standard card swipe/insert operations.',
        workaround: 'Cycle flight mode on Android POS, check SIM profile routing, or fallback to localized Wi-Fi hotspots.',
        steps: [
          'Verify if cellular SIM card has active mobile data (Check MTN/Airtel network bars on upper right corner).',
          'Access System Settings of the Smart POS terminal (Swipe down from notifications bar, tap gear icon).',
          'Toggle "Flight Mode" ON for 10 seconds, then toggle OFF to force tower reconnection.',
          'Open "PalmPartner" app diagnostics menu and tap "Test Ping Gateway".',
          'If cell tower latency exceeds 800ms, connect the POS terminal to an external Wi-Fi hotspot with >60% signal.',
          'Instruct the agent to try the transaction again. If it fails, check for localized regional carrier outages.'
        ],
        lastUpdated: '2026-07-20T10:00:00Z',
        affectedSystems: ['Classic POS v2', 'Android SmartPOS', 'MTN/Airtel SIM Routing Gateway']
      },
      {
        id: 'sop-2',
        title: 'Instant Refund Interruption & Double-Debit SOP',
        category: 'Payment & Transfer',
        severity: 'Critical',
        symptom: 'Customer was debited twice for a single failed transaction, or transfer is marked as successful but receiver wallet has zero balance.',
        workaround: 'Instruct customer to wait 24-48 working hours for auto-reversal, or log high-priority double debit escalation.',
        steps: [
          'Request the customer to present the official Bank Account statement containing duplicate debit stamps.',
          'Obtain the transaction Session ID (30-digit NIBSS code) or Transaction Reference hash from PalmPay app history.',
          'Verify transaction state in the Admin Ledger Portal to check if an auto-reversal is already pending in the pool.',
          'If the ledger confirms double debit but no reversal is logged, create an urgent priority support ticket.',
          'Escalate the ticket directly to the "Merchant & Settlement Accounting Team" with bank statements attached.',
          'Provide clear timeline to the customer: Reversals are finalized within 3-5 standard banking business days.'
        ],
        lastUpdated: '2026-07-19T14:30:00Z',
        affectedSystems: ['NIBSS Interbank Switch', 'PalmPay Settlement Engine', 'Ledger Service']
      },
      {
        id: 'sop-3',
        title: 'SMS OTP Delivery Gateways Latency & Failure SOP',
        category: 'APP Issue',
        severity: 'High',
        symptom: 'New registrations, device transitions, or high-value transfers are blocked because SMS verification codes never arrive.',
        workaround: 'Advise user to select WhatsApp OTP dispatch route or trigger manual voice-call token readouts.',
        steps: [
          'Instruct user to verify their mobile device signal and verify that standard text message inboxes are not full.',
          'Verify that the phone number matches local country codes perfectly without extra prepended zeros.',
          'In the PalmPay App verification screen, advise the customer to wait for the 60-second cooldown timer.',
          'Select "Get Code via WhatsApp" as a high-uptime secondary dispatch route.',
          'If WhatsApp option is unavailable, select "Get Code via Voice Call" which triggers an automated automated read-out.',
          'If no codes arrive across all three media, verify cellular DND (Do Not Disturb) restrictions with network providers.'
        ],
        lastUpdated: '2026-07-20T08:15:00Z',
        affectedSystems: ['Twilio/Infobip API Gateway', 'WhatsApp Dispatch Broker', 'Local Carrier SMS Services']
      },
      {
        id: 'sop-4',
        title: 'Regulatory BVN / NIN Verification Matching Failures SOP',
        category: 'KYC & Auth',
        severity: 'Medium',
        symptom: 'Verification fails with error "Details do not match regulatory database" although the customer inputted correct numbers.',
        workaround: 'Perform manual verification via KYC dashboard by comparing name matches and spelling variations.',
        steps: [
          'Verify that the full legal name and Date of Birth on PalmPay match the BVN record exactly (No abbreviated middle names).',
          'Confirm that the phone number linked to the BVN matches the phone number of the active PalmPay wallet.',
          'Inspect NIN/BVN database state for sync delays (Regulatory servers like NIMC/NIBSS experience frequent sync timeouts).',
          'Instruct customer to upload an official printed copy of their BVN slip or NIN ID document containing clear watermarks.',
          'Use the KYC Override admin portal to perform a manual visual comparison of the biometric names and photo.',
          'Approve the tier level manually and log the justification reference inside the customer CRM comments.'
        ],
        lastUpdated: '2026-07-18T11:00:00Z',
        affectedSystems: ['NIMC Regulatory Database', 'NIBSS BVN Portal', 'KYC Verification Service']
      },
      {
        id: 'sop-5',
        title: 'POS Terminal Printer Jam & Blank Paper Roll SOP',
        category: 'Device & POS',
        severity: 'Low',
        symptom: 'POS terminal completes authorization, buzzes, but outputs blank receipts or fails to feed thermal paper rolls.',
        workaround: 'Check paper roll orientation, clean the thermal printer printhead with clean wipes, or reprint from history.',
        steps: [
          'Open the paper roll compartment cover on the top back section of the POS terminal.',
          'Verify if the thermal paper roll is oriented correctly (Thermal coating side must face the active printhead).',
          'Clear any crumpled paper scraps or glue residue blocking the feed roller rotation axis.',
          'Close the compartment door firmly until it clicks on both side latches.',
          'Navigate to "Transactions History" on the POS screen, select the last transaction, and tap "Reprint Receipt".',
          'If the receipt is still completely blank, replace the paper roll with an official PalmPay-certified thermal roll.'
        ],
        lastUpdated: '2026-07-15T09:00:00Z',
        affectedSystems: ['SmartPOS Hardware Printer', 'POS App Print Driver']
      },
      {
        id: 'sop-6',
        title: 'App Black Screen & Persistent Crashes on Launch SOP',
        category: 'APP Issue',
        severity: 'Medium',
        symptom: 'PalmPay mobile app screen goes completely black on launch, freezes on the splash screen, or force-closes repeatedly.',
        workaround: 'Clear App Cache data from device settings, update Android Webview, or reinstall the official application.',
        steps: [
          'Instruct the user to open device "Settings" -> "Apps" -> "PalmPay".',
          'Tap "Storage", select "Clear Cache", then force stop the app and launch it again.',
          'If crash persists, check the Google Play Store or Apple App Store for any pending PalmPay updates.',
          'Advise the customer to update their device\'s system application called "Android System Webview" to the latest build.',
          'As a final measure, backup any saved local transfers history, uninstall PalmPay, restart the device, and reinstall.',
          'Submit a system application diagnostic report containing the user device model, OS version, and exact app version.'
        ],
        lastUpdated: '2026-07-17T16:45:00Z',
        affectedSystems: ['PalmPay Consumer App (iOS/Android)', 'WebView Integration Node']
      }
    ];
  });

  // Save changes to localStorage for all-time durability
  useEffect(() => {
    localStorage.setItem('csp_troubleshooting_sops', JSON.stringify(issues));
  }, [issues]);

  // Static Symptoms array for Interactive Troubleshooting Wizard (Diagnostic flow)
  const interactiveSymptoms: InteractiveSymptom[] = [
    {
      id: 'wizard-pos',
      label: 'POS Card & Print Failures',
      category: 'Device & POS',
      questions: [
        {
          id: 'q1',
          question: 'What is the primary symptom showing on the POS screen?',
          options: [
            { text: 'Displays "Network Timeout" or "Connection Error"', nextStepId: 'q2_network' },
            { text: 'Displays "Declined by Issuer" or "Issuer Inoperative"', nextStepId: 'q2_declined' },
            { text: 'Prints blank receipts or roller is jammed', nextStepId: 'q2_printer' }
          ]
        },
        {
          id: 'q2_network',
          question: 'Are there active mobile network signal bars on the status bar?',
          options: [
            { text: 'Yes, but connection still times out', resolution: 'Navigate to System Settings -> Network. Cycle Flight Mode ON/OFF to reset cellular tower binding. If latency is high, connect to high-uptime local Wi-Fi.' },
            { text: 'No bars, signal is completely dead', resolution: 'SIM card is deactivated or slot is dislodged. Open the battery cover, reseat the SIM card in SIM Slot 1, and ensure active cellular subscriptions.' }
          ]
        },
        {
          id: 'q2_declined',
          question: 'Does it happen with all bank cards or only a specific bank?',
          options: [
            { text: 'Only one specific bank card is failing', resolution: 'This indicates the customer\'s issuing bank is experiencing switch downtime. Advise client to pay using an alternative bank card or execute transfer to the POS merchant account.' },
            { text: 'All cards are getting declined', resolution: 'Trigger POS master key synchronization. Open PalmPartner app, go to Settings -> Master Key Sync -> Input password -> Tap sync. If unresolved, contact PalmPay network admin.' }
          ]
        },
        {
          id: 'q2_printer',
          question: 'Is the paper roll inserted correctly with the thermal side facing the printhead?',
          options: [
            { text: 'Yes, but printing is still blank', resolution: 'Thermal printer driver has overheated. Turn off POS terminal, wait 5 minutes, clean thermal roller, and test printing again using reprint options.' },
            { text: 'I am not sure, how do I check?', resolution: 'Open printer compartment, pull 2 inches of paper out, close cover. Scratch the paper surface with a metal key. If it leaves a black mark, that is the thermal side and should face downwards.' }
          ]
        }
      ]
    },
    {
      id: 'wizard-transfer',
      label: 'Transfer & Double-Debit Debates',
      category: 'Payment & Transfer',
      questions: [
        {
          id: 'q1',
          question: 'What is the status of the customer transfer in the transaction history?',
          options: [
            { text: 'Status is "Pending" or "Processing"', nextStepId: 'q2_pending' },
            { text: 'Status is "Failed" but customer was debited', nextStepId: 'q2_failed' },
            { text: 'Customer was debited twice for same transfer', nextStepId: 'q2_double' }
          ]
        },
        {
          id: 'q2_pending',
          question: 'How long has the transaction been in the pending state?',
          options: [
            { text: 'Less than 24 hours', resolution: 'Advise customer to wait. The funds are held in interbank NIBSS switches for automatic reconciliation. It will either deliver to the receiver or reverse automatically within 24 hours.' },
            { text: 'More than 24 hours', resolution: 'Escalate immediately. Retrieve the 30-digit NIBSS Session ID from transaction details. Create an SLA Support Ticket with Category: "Failed Transfer" and assign to Accounting Team.' }
          ]
        },
        {
          id: 'q2_failed',
          question: 'Do you see an automated reversal logged in the ledger database?',
          options: [
            { text: 'Yes, reversal is recorded', resolution: 'Inform the customer that the reversal has been completed. They should check their wallet statement balance for the corresponding credit.' },
            { text: 'No reversal is listed in ledger', resolution: 'Funds are stuck in clearing partner suspense pool. Explain that the funds will automatically drop back into their wallet within 48 business hours (excluding holidays/weekends).' }
          ]
        },
        {
          id: 'q2_double',
          question: 'Do you have bank statement screenshots showing both debits with distinct references?',
          options: [
            { text: 'Yes, customer has sent the screenshots', resolution: 'Log an high-priority SLA ticket. Attach both reference codes and screenshots. Route to Merchant Settlement team. Resolution timeline is 3-5 working days.' },
            { text: 'No, customer only has SMS alerts', resolution: 'Instruct customer to request their formal bank account statement from their bank app. SMS alerts are not acceptable proof for financial reversal disputes.' }
          ]
        }
      ]
    }
  ];

  // Start a diagnostic wizard flow
  const startWizard = (sympId: string) => {
    setWizardSymptomId(sympId);
    setCurrentQuestionId('q1');
    setDiagnosticHistory([]);
    setWizardResolution(null);
  };

  const handleWizardAnswer = (optionText: string, nextId?: string, resText?: string) => {
    const symp = interactiveSymptoms.find(s => s.id === wizardSymptomId);
    if (!symp) return;

    const currentQ = symp.questions.find(q => q.id === currentQuestionId);
    if (currentQ) {
      setDiagnosticHistory(prev => [...prev, {
        question: currentQ.question,
        answer: optionText
      }]);
    }

    if (resText) {
      setWizardResolution(resText);
      logActivity(`Completed troubleshooting wizard for "${symp.label}" -> Resolved`);
    } else if (nextId) {
      setCurrentQuestionId(nextId);
    }
  };

  const selectedIssue = issues.find(i => i.id === selectedIssueId) || issues[0];

  // Handle checked steps (trace compliance)
  const toggleStep = (stepIdx: number) => {
    const key = `${selectedIssue.id}-${stepIdx}`;
    setCheckedSteps(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const resetSteps = () => {
    const updated: Record<string, boolean> = {};
    selectedIssue.steps.forEach((_, idx) => {
      updated[`${selectedIssue.id}-${idx}`] = false;
    });
    setCheckedSteps(prev => ({
      ...prev,
      ...updated
    }));
  };

  // Copy full SOP steps to clipboard for ticket logging
  const copySOPToClipboard = () => {
    if (!selectedIssue) return;
    const stepsText = selectedIssue.steps.map((s, idx) => `${idx + 1}. [${checkedSteps[`${selectedIssue.id}-${idx}`] ? 'X' : ' '}] ${s}`).join('\n');
    const fullText = `=== PalmPay SOP Audit: ${selectedIssue.title} ===\nCategory: ${selectedIssue.category}\nSeverity: ${selectedIssue.severity}\nSymptom: ${selectedIssue.symptom}\nWorkaround: ${selectedIssue.workaround}\n\nTroubleshooting Audit Steps Performed by Agent (${agentName}):\n${stepsText}\n\nGenerated At: ${new Date().toISOString()}`;
    
    navigator.clipboard.writeText(fullText);
    setCopiedSuccess(true);
    logActivity(`Copied troubleshooting logs for SOP: "${selectedIssue.title}"`);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  // Filter Issues
  const filteredIssues = issues.filter(issue => {
    const matchesCategory = activeCategory === 'All' || issue.category === activeCategory;
    const matchesSearch = issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.symptom.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.workaround.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          issue.steps.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Export SOP database as CSV
  const exportSOPsToCSV = () => {
    let csvContent = "\uFEFF"; // UTF-8 BOM to prevent character issue
    csvContent += "=== SYSTEM TROUBLESHOOTING SOPS DATABASE ===\n";
    csvContent += "SOP ID,SOP Title,Category,Severity,Symptom Description,Standard Workaround,Steps Count,Last Updated\n";
    
    issues.forEach(i => {
      const titleClean = i.title.replace(/"/g, '""');
      const sympClean = i.symptom.replace(/"/g, '""');
      const workClean = i.workaround.replace(/"/g, '""');
      csvContent += `"${i.id}","${titleClean}","${i.category}","${i.severity}","${sympClean}","${workClean}","${i.steps.length}","${i.lastUpdated}"\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `PalmPay_Troubleshooting_SOPs_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    logActivity("Exported System Troubleshooting Database to CSV");
  };

  // Add custom troubleshooting SOP
  const handleAddSOP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSymptom.trim() || !newSteps.trim()) {
      alert("Please fill in all required fields!");
      return;
    }

    const parsedSteps = newSteps.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const customId = `sop-custom-${Date.now()}`;
    const customSOP: SOPIssue = {
      id: customId,
      title: newTitle,
      category: newCategory,
      severity: 'Medium',
      symptom: newSymptom,
      workaround: parsedSteps[0] || 'Follow custom step directions.',
      steps: parsedSteps,
      lastUpdated: new Date().toISOString(),
      affectedSystems: ['Custom SOP Node']
    };

    setIssues([customSOP, ...issues]);
    setSelectedIssueId(customId);
    setShowAddModal(false);
    
    // Reset inputs
    setNewTitle('');
    setNewSymptom('');
    setNewSteps('');
    
    logActivity(`Created custom Troubleshooting SOP: "${newTitle}"`);
  };

  const [deleteSopConfirm, setDeleteSopConfirm] = useState<{ id: string; title: string } | null>(null);

  // Delete an SOP
  const handleDeleteSOP = (id: string, title: string) => {
    if (userRole !== 'ADMIN') {
      alert("Access Denied: Only administrators can delete standard SOP articles.");
      return;
    }
    setDeleteSopConfirm({ id, title });
  };

  const handleConfirmDeleteSOP = () => {
    if (!deleteSopConfirm) return;
    const { id, title } = deleteSopConfirm;
    const filtered = issues.filter(i => i.id !== id);
    setIssues(filtered);
    if (selectedIssueId === id) {
      setSelectedIssueId(filtered[0]?.id || '');
    }
    logActivity(`Deleted Troubleshooting SOP: "${title}"`);
    setDeleteSopConfirm(null);
  };

  // Find active wizard question content
  const activeSymptom = interactiveSymptoms.find(s => s.id === wizardSymptomId);
  const activeQuestion = activeSymptom?.questions.find(q => q.id === currentQuestionId);

  return (
    <div className="p-6 space-y-6 text-left bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn font-sans h-[calc(100vh-110px)] overflow-y-auto">
      
      {/* Header section */}
      <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-amber-600 dark:text-amber-400 tracking-wide flex items-center gap-2 font-serif">
            <Wrench className="w-5 h-5 text-amber-500 animate-spin-slow" />
            SYSTEM TROUBLESHOOTING & SOPS
          </h2>
          <p className="text-xs text-zinc-500">
            Automated diagnostic flowcharts, regulatory SOP manuals, and live interactive troubleshooting checklists.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportSOPsToCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export SOP DB
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Custom SOP
          </button>
        </div>
      </div>

      {/* Grid Layout: Top Interactive Wizard & Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Live Active Incident / Alarm board (col-span-4) */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-red-500 animate-pulse" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-zinc-700 dark:text-zinc-300 font-mono">Live Outages & Gateway Alerts</h3>
            </div>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          </div>

          <div className="space-y-3">
            {/* Outage 1 */}
            <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-500/20 rounded-xl text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[10px] text-red-600 dark:text-red-400 font-mono">NIBSS OUTWARD CONGESTION</span>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-red-500/10 text-red-500 uppercase">Warning</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                Interbank outward transfer latency has peaked at 30 seconds. Elevated processing failure rate on Stanbic & Zenith bank endpoints.
              </p>
              <div className="text-[9px] text-zinc-400 font-mono flex items-center gap-1.5 pt-1">
                <ArrowRight className="w-3 h-3 text-red-500" />
                <span>Recommended: Use 24h automatic reversal SOP.</span>
              </div>
            </div>

            {/* Outage 2 */}
            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-500/20 rounded-xl text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[10px] text-amber-600 dark:text-amber-400 font-mono">MTN SMS ROUTING THROTTLE</span>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-amber-500/10 text-amber-500 uppercase">Degraded</span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-tight">
                MTN carrier SMS gateways are queueing verification tokens. OTPs may suffer delays up to 120 seconds.
              </p>
              <div className="text-[9px] text-zinc-400 font-mono flex items-center gap-1.5 pt-1">
                <ArrowRight className="w-3 h-3 text-amber-500" />
                <span>Recommended: Route token delivery via WhatsApp option.</span>
              </div>
            </div>

            {/* Outage 3 */}
            <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-500/10 rounded-xl text-left space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">PALMPAY INTERNAL SYSTEMS</span>
                <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-500 uppercase">Operational</span>
              </div>
              <p className="text-[10px] text-zinc-400 leading-tight">
                Ledgers, biometric logins, POS clearing bridges, and primary databases are fully healthy.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Diagnosis Assistant / Troubleshooting Wizard (col-span-8) */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs">
          <div className="border-b border-zinc-200 dark:border-zinc-800/80 pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-xs flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Interactive Diagnostic Assistant
              </h3>
              <p className="text-[10px] text-zinc-500">Solve floor dilemmas dynamically by selecting active system symptoms.</p>
            </div>
            {wizardSymptomId && (
              <button
                onClick={() => setWizardSymptomId('')}
                className="text-[9px] font-bold uppercase tracking-wider text-amber-600 hover:text-amber-700 font-mono"
              >
                Reset Wizard
              </button>
            )}
          </div>

          {!wizardSymptomId ? (
            <div className="py-6 text-center space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto">
                <Terminal className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-100">Select Issue Symptom Category</h4>
                <p className="text-[10px] text-zinc-500 leading-normal">
                  Our interactive diagnostic wizard guides agents down step-by-step questions based on PalmPay compliance rules.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {interactiveSymptoms.map(symp => (
                  <button
                    key={symp.id}
                    onClick={() => startWizard(symp.id)}
                    className="p-3 border border-zinc-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl text-left text-xs bg-zinc-50/50 dark:bg-zinc-900/30 hover:bg-amber-500/[0.02] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold block text-zinc-800 dark:text-zinc-200">{symp.label}</span>
                      <span className="text-[9px] text-zinc-400 uppercase font-mono tracking-wider">{symp.category}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              {/* Wizard Status Bar */}
              <div className="flex items-center justify-between text-[10px] font-mono border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <span className="text-zinc-400">Diagnosis Path: <strong>{activeSymptom?.label}</strong></span>
                <span className="text-amber-500 uppercase font-bold">In Progress</span>
              </div>

              {/* Chat-like dialogue */}
              <div className="space-y-3 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-900 text-xs">
                
                {/* Previous Steps */}
                {diagnosticHistory.map((step, idx) => (
                  <div key={idx} className="space-y-1.5 border-b border-zinc-200/40 dark:border-zinc-900 pb-2">
                    <div className="text-zinc-400 font-medium">📋 Question: {step.question}</div>
                    <div className="text-amber-600 dark:text-amber-400 font-bold ml-3 flex items-center gap-1.5">
                      <CheckSquare className="w-3.5 h-3.5 shrink-0" />
                      Answer: {step.answer}
                    </div>
                  </div>
                ))}

                {/* Active Question or Resolution */}
                {!wizardResolution && activeQuestion ? (
                  <div className="space-y-3.5 pt-2">
                    <p className="font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      {activeQuestion.question}
                    </p>
                    
                    <div className="flex flex-col gap-2 max-w-md">
                      {activeQuestion.options.map((opt, oIdx) => (
                        <button
                          key={oIdx}
                          onClick={() => handleWizardAnswer(opt.text, opt.nextStepId, opt.resolution)}
                          className="p-2.5 text-left border border-zinc-200 dark:border-zinc-800 hover:border-amber-500 dark:hover:border-amber-500 bg-white dark:bg-zinc-900 rounded-lg text-[11px] cursor-pointer hover:bg-amber-500/[0.02] transition-all font-medium text-zinc-700 dark:text-zinc-200"
                        >
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 space-y-3 animate-fadeIn">
                    <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/20 rounded-xl space-y-2 text-left">
                      <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-500 shrink-0" />
                        <span>Recommended Diagnostic Resolution:</span>
                      </div>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans font-medium">
                        {wizardResolution}
                      </p>
                    </div>

                    <div className="flex justify-end gap-2.5">
                      <button
                        onClick={() => {
                          const logText = `=== DIAGNOSTIC RECORD ===\nSymptom: ${activeSymptom?.label}\n${diagnosticHistory.map((h, i) => `Step ${i+1}: ${h.question} -> ${h.answer}`).join('\n')}\nResolution: ${wizardResolution}`;
                          navigator.clipboard.writeText(logText);
                          alert("Diagnostic logs copied to clipboard!");
                        }}
                        className="px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[10px] font-bold uppercase rounded-lg"
                      >
                        Copy Diagnostic Steps
                      </button>
                      <button
                        onClick={() => setWizardSymptomId('')}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold uppercase rounded-lg"
                      >
                        Restart Wizard
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

        </div>

      </div>

      {/* Grid Layout: Main SOP Document Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left column: List of SOPs (col-span-5) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-5 space-y-4 shadow-xs text-left">
          
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 space-y-3">
            <h3 className="font-bold text-zinc-850 dark:text-zinc-100 text-xs uppercase tracking-wider font-mono">Troubleshooting Manuals</h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search error codes, keywords, symptoms..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-800 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-sans"
              />
            </div>

            {/* Category selection scroll bar */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {['All', 'APP Issue', 'Payment & Transfer', 'Device & POS', 'KYC & Auth'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 text-[9px] font-extrabold uppercase tracking-wider rounded-lg border transition-all shrink-0 cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100 text-zinc-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* List display */}
          <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin">
            {filteredIssues.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 text-xs">
                No troubleshooting SOPs match your search keywords.
              </div>
            ) : (
              filteredIssues.map(issue => {
                const isSelected = selectedIssueId === issue.id;
                return (
                  <div
                    key={issue.id}
                    onClick={() => {
                      setSelectedIssueId(issue.id);
                      resetSteps();
                    }}
                    className={`p-3.5 border rounded-xl text-left cursor-pointer transition-all flex flex-col justify-between space-y-2 relative overflow-hidden ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/[0.04]'
                        : 'border-zinc-200 dark:border-zinc-850 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/20'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                          issue.severity === 'Critical'
                            ? 'bg-red-500/15 text-red-500'
                            : issue.severity === 'High'
                              ? 'bg-amber-500/15 text-amber-500'
                              : 'bg-zinc-500/15 text-zinc-400'
                        }`}>
                          {issue.severity}
                        </span>
                        <span className="text-[9px] text-zinc-400 font-mono">
                          {issue.category}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-zinc-800 dark:text-zinc-100 line-clamp-1">
                        {issue.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 leading-tight line-clamp-2">
                        {issue.symptom}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-850 text-[9px] text-zinc-400 font-mono">
                      <span>Steps: {issue.steps.length}</span>
                      {userRole === 'ADMIN' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSOP(issue.id, issue.title);
                          }}
                          className="text-red-500 hover:text-red-600 transition-colors"
                          title="Delete SOP Manual"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column: SOP Document Details Reader (col-span-7) */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800/80 rounded-xl p-6 space-y-6 shadow-xs text-left min-h-[480px]">
          {selectedIssue ? (
            <div className="space-y-6 animate-fadeIn">
              
              {/* Document Header Metadata */}
              <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400">
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5" />
                    STANDARD OPERATING PROCEDURE (SOP)
                  </span>
                  <span>Last Checked: {new Date(selectedIssue.lastUpdated).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-zinc-850 dark:text-zinc-50 text-base">
                  {selectedIssue.title}
                </h3>
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedIssue.affectedSystems.map((sys, idx) => (
                    <span key={idx} className="bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-250 dark:border-zinc-850 text-[9px] font-mono text-zinc-500">
                      {sys}
                    </span>
                  ))}
                </div>
              </div>

              {/* Core Symptom & Workaround */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/40 rounded-xl border border-zinc-200 dark:border-zinc-850 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide block font-mono">Symptom Dilemma</span>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    {selectedIssue.symptom}
                  </p>
                </div>
                <div className="p-3.5 bg-amber-500/[0.02] rounded-xl border border-amber-500/10 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide block font-mono">Quick Workaround</span>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
                    {selectedIssue.workaround}
                  </p>
                </div>
              </div>

              {/* Step-by-step Interactive Compliance Checklist */}
              <div className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider font-mono">Diagnostic Checklist Run</span>
                  <button
                    onClick={resetSteps}
                    className="text-[9px] font-bold text-zinc-400 hover:text-zinc-200 uppercase tracking-wider"
                  >
                    Reset Steps
                  </button>
                </div>

                <div className="space-y-2.5">
                  {selectedIssue.steps.map((step, idx) => {
                    const isChecked = !!checkedSteps[`${selectedIssue.id}-${idx}`];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleStep(idx)}
                        className={`p-3 border rounded-xl text-xs flex items-start gap-3 cursor-pointer transition-all ${
                          isChecked
                            ? 'border-emerald-500 bg-emerald-500/[0.02] text-zinc-700 dark:text-zinc-200'
                            : 'border-zinc-150 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 text-zinc-600 dark:text-zinc-400'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                          isChecked
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'border-zinc-300 dark:border-zinc-700'
                        }`}>
                          {isChecked && <CheckCircle className="w-3.5 h-3.5" />}
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono text-zinc-400 font-bold block">STEP {idx + 1}</span>
                          <p className="leading-relaxed font-medium">{step}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Actions Panel (Copy compliance logs, push state) */}
              <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-[10px] text-zinc-400 italic">
                  Tick off checklist boxes as you execute diagnostics. Copied logs compile step statuses automatically.
                </p>
                <button
                  onClick={copySOPToClipboard}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
                >
                  <Copy className="w-4 h-4 text-amber-200" />
                  {copiedSuccess ? 'Logs Copied!' : 'Copy SOP Compliance Log'}
                </button>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center text-zinc-400 space-y-2 py-24">
              <BookOpen className="w-10 h-10 text-zinc-500 animate-pulse" />
              <p className="text-xs">Select an SOP manual from the directory on the left to start viewing checklist workflows.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal: Create Custom SOP */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-left">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h3 className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-500" />
                CREATE CUSTOM TROUBLESHOOTING SOP
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-zinc-200 text-xs uppercase tracking-wider"
              >
                Close
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddSOP} className="p-5 space-y-4">
              
              {/* Title */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono">SOP Title / Incident Name *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Stanbic Bank Clearing Disruption Workaround"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Grid: Category */}
              <div>
                <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono mb-1">Category Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as any)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="APP Issue">APP Issue</option>
                  <option value="Payment & Transfer">Payment & Transfer</option>
                  <option value="Device & POS">Device & POS</option>
                  <option value="KYC & Auth">KYC & Auth</option>
                  <option value="General">General</option>
                </select>
              </div>

              {/* Symptom */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono">Symptom Dilemma Description *</label>
                <textarea
                  required
                  rows={2}
                  value={newSymptom}
                  onChange={(e) => setNewSymptom(e.target.value)}
                  placeholder="Detailed description of the error code or symptom observed on screen..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* SOP Steps */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-400 uppercase block font-mono">Diagnostic SOP Steps (One per line) *</label>
                <textarea
                  required
                  rows={4}
                  value={newSteps}
                  onChange={(e) => setNewSteps(e.target.value)}
                  placeholder="Enter step 1...&#10;Enter step 2...&#10;Enter step 3..."
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-amber-500 font-mono"
                />
                <span className="text-[9px] text-zinc-400 italic block">Each line entered will be compiled into an interactive visual checkbox inside the audit checklist panel.</span>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 flex justify-end gap-2.5 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  Confirm & Save SOP
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!deleteSopConfirm}
        title="Delete Troubleshooting SOP"
        message={`Are you sure you want to permanently delete SOP: "${deleteSopConfirm?.title}"?`}
        confirmLabel="Delete SOP"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={handleConfirmDeleteSOP}
        onCancel={() => setDeleteSopConfirm(null)}
      />

    </div>
  );
}
