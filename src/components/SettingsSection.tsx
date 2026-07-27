import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Sun, 
  Moon, 
  FileSpreadsheet, 
  Save, 
  AlertCircle, 
  CheckCircle,
  HelpCircle,
  Settings,
  RefreshCw,
  LogOut,
  ExternalLink,
  Volume2,
  Clock,
  Layout,
  AlertTriangle,
  User,
  Coffee,
  Check
} from 'lucide-react';

interface SettingsSectionProps {
  token: string | null;
  isLoggingIn: boolean;
  handleGoogleSignIn: () => Promise<void>;
  connectedSpreadsheetId: string;
  connectedSpreadsheetUrl: string;
  setConnectedSpreadsheetId: (id: string) => void;
  setConnectedSpreadsheetUrl: (url: string) => void;
  saveSpreadsheetConfig: (id: string, url: string) => Promise<void>;
  logActivity: (message: string) => void;
  setToken: (token: string | null) => void;
  
  // New props for Personal Preferences
  autoClockIn: boolean;
  audioNotifications: boolean;
  defaultBreakReason: string;
  compactSidebar: boolean;
  showWarnings: boolean;
  customAlias: string;
  updatePreferences: (newPrefs: {
    autoClockIn?: boolean;
    audioNotifications?: boolean;
    defaultBreakReason?: string;
    compactSidebar?: boolean;
    showWarnings?: boolean;
    customAlias?: string;
  }) => Promise<void>;
}

export default function SettingsSection({
  token,
  isLoggingIn,
  handleGoogleSignIn,
  connectedSpreadsheetId,
  connectedSpreadsheetUrl,
  setConnectedSpreadsheetId,
  setConnectedSpreadsheetUrl,
  saveSpreadsheetConfig,
  logActivity,
  setToken,

  // New preferences props
  autoClockIn,
  audioNotifications,
  defaultBreakReason,
  compactSidebar,
  showWarnings,
  customAlias,
  updatePreferences
}: SettingsSectionProps) {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const [localSpreadsheetId, setLocalSpreadsheetId] = useState(connectedSpreadsheetId);
  const [localSpreadsheetUrl, setLocalSpreadsheetUrl] = useState(connectedSpreadsheetUrl);
  const [localAlias, setLocalAlias] = useState(customAlias);
  const [localBreakReason, setLocalBreakReason] = useState(defaultBreakReason);
  
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Update local states when props change
  useEffect(() => {
    setLocalSpreadsheetId(connectedSpreadsheetId);
  }, [connectedSpreadsheetId]);

  useEffect(() => {
    setLocalSpreadsheetUrl(connectedSpreadsheetUrl);
  }, [connectedSpreadsheetUrl]);

  useEffect(() => {
    setLocalAlias(customAlias);
  }, [customAlias]);

  useEffect(() => {
    setLocalBreakReason(defaultBreakReason);
  }, [defaultBreakReason]);

  const handleSaveAllConfig = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const cleanId = localSpreadsheetId.trim();
      const cleanUrl = localSpreadsheetUrl.trim();

      // Update spreadsheet config in parent and firestore
      setConnectedSpreadsheetId(cleanId);
      setConnectedSpreadsheetUrl(cleanUrl);
      await saveSpreadsheetConfig(cleanId, cleanUrl);

      // Save all other preferences
      await updatePreferences({
        customAlias: localAlias,
        defaultBreakReason: localBreakReason,
      });

      logActivity(`Updated system gateway & personal preferences hub.`);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Failed to save configuration:", err);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = () => {
    setToken(null);
    sessionStorage.removeItem('_g_w_token_');
    logActivity("Disconnected Google Sheets Workspace connection.");
  };

  const parseUrlToId = (url: string) => {
    const cleanUrl = url.trim();
    setLocalSpreadsheetUrl(cleanUrl);
    const match = cleanUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      setLocalSpreadsheetId(match[1]);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 text-left bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-fadeIn font-sans" id="settings_section_wrapper">
      
      {/* Settings Header */}
      <div className="border-b border-slate-200 dark:border-zinc-800 pb-5" id="settings_header">
        <h2 className="text-xl font-bold text-amber-600 dark:text-amber-400 tracking-wide flex items-center gap-2.5 font-serif">
          <Settings className="w-5.5 h-5.5 text-amber-500 animate-spin-slow" />
          SYSTEM PREFERENCES & GATEWAYS
        </h2>
        <p className="text-xs text-slate-500 dark:text-zinc-450 mt-1.5 leading-relaxed">
          Manage visual appearance, configure Google Workspace sheets, and define persistent personal preferences across active portal sessions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="settings_grid">
        
        {/* LEFT PANEL: PROFILE & PERSISTENT PREFERENCES (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Section: Agent Profile Hub */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-xl p-5 shadow-xs space-y-4" id="personal_profile_card">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-850 pb-2.5 flex items-center gap-2">
              <User className="w-4 h-4 text-amber-500" />
              Agent Profile Preferences
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-450 uppercase tracking-wider block">
                  Custom Display Alias
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 dark:text-zinc-500">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={localAlias}
                    onChange={(e) => setLocalAlias(e.target.value)}
                    placeholder="Enter visual moniker/alias..."
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg pl-9 pr-3 py-2.5 text-xs outline-hidden transition-all text-slate-850 dark:text-zinc-200 font-semibold"
                    id="settings_alias_input"
                  />
                </div>
                <span className="text-[9px] text-slate-400 dark:text-zinc-550 block leading-tight">
                  Overrides default payroll roster name in current session dashboard and logs.
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-450 uppercase tracking-wider block">
                  Default Break Category Preset
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-slate-400 dark:text-zinc-500">
                    <Coffee className="w-4 h-4" />
                  </span>
                  <select
                    value={localBreakReason}
                    onChange={(e) => setLocalBreakReason(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg pl-9 pr-3 py-2.5 text-xs outline-hidden transition-all text-slate-850 dark:text-zinc-200 font-bold cursor-pointer appearance-none"
                    id="settings_break_select"
                  >
                    <option value="Short Break">Short Break (15 Min)</option>
                    <option value="Meal Break">Meal Break (30 Min)</option>
                    <option value="Prayer Break">Prayer Break (15 Min)</option>
                    <option value="Meeting">Meeting / Operations</option>
                  </select>
                </div>
                <span className="text-[9px] text-slate-400 dark:text-zinc-550 block leading-tight">
                  Automatically initializes break actions on the central dashboard console.
                </span>
              </div>
            </div>
          </div>

          {/* Section: Operational Settings */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-xl p-5 shadow-xs space-y-4" id="operational_toggles_card">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-850 pb-2.5 flex items-center gap-2">
              <Layout className="w-4 h-4 text-amber-500" />
              Session Preference Controls
            </h3>

            <div className="divide-y divide-slate-100 dark:divide-zinc-850">
              
              {/* Toggle 1: Auto Clock-In */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    Auto Duty Clock-In
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-snug">
                    Automatically verify check-in timestamp and toggle availability status on portal login.
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ autoClockIn: !autoClockIn })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    autoClockIn ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                  id="toggle_auto_clock_in"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      autoClockIn ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 2: Speech & Chime Alerts */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-amber-500" />
                    Text-To-Speech & Chimes
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-snug">
                    Use localized browser voice synthesis to announce break alerts and duty shifts.
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ audioNotifications: !audioNotifications })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    audioNotifications ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                  id="toggle_audio_alerts"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      audioNotifications ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 3: Compact Sidebar Menu */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <Layout className="w-4 h-4 text-amber-500 animate-pulse" />
                    Compact Sidebar Layout
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-snug">
                    Collapse the primary sidebar navigation to icons-only by default for maximum screen width.
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ compactSidebar: !compactSidebar })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    compactSidebar ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                  id="toggle_compact_sidebar"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      compactSidebar ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Toggle 4: Offline Warn Banners */}
              <div className="py-3.5 flex items-center justify-between gap-4">
                <div className="space-y-0.5 text-left">
                  <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Offline Workspace Warnings
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-zinc-500 leading-snug">
                    Display active header warning banners when API credentials or spreadsheets are disconnected.
                  </p>
                </div>
                <button
                  onClick={() => updatePreferences({ showWarnings: !showWarnings })}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                    showWarnings ? 'bg-amber-500' : 'bg-slate-300 dark:bg-zinc-800'
                  }`}
                  id="toggle_show_warnings"
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      showWarnings ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT PANEL: APPEARANCE & GOOGLE SHEETS CONNECTIONS (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Section: Google Sheets Connection */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-xl p-5 shadow-xs space-y-4" id="google_sheets_connection_card">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 border-b border-slate-100 dark:border-zinc-850 pb-2.5 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
              Google Sheets Linkage
            </h3>

            {/* Google Authentication Section */}
            <div className="bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/60 dark:border-zinc-850 p-4 rounded-xl space-y-3">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-850 dark:text-zinc-200 block">Workspace API Account</span>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-normal">
                  {token 
                    ? "Authenticated successfully. Database records will synchronize with your Google Spreadsheet in real-time."
                    : "No linked Google account detected. Currently logging activities locally inside the web browser's storage cache."}
                </p>
              </div>

              {token ? (
                <button
                  onClick={handleDisconnect}
                  className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2 bg-rose-550/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer whitespace-nowrap"
                  id="settings_sheets_disconnect_btn"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Disconnect Workspace
                </button>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleGoogleSignIn}
                    disabled={isLoggingIn}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-750 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    id="settings_sheets_connect_btn"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoggingIn ? 'animate-spin' : ''}`} />
                    {isLoggingIn ? 'Connecting...' : 'Authorize Sheets API'}
                  </button>
                  {isInIframe && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 dark:border-amber-500/15 rounded-xl text-left space-y-2">
                      <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 leading-normal">
                        ⚠️ <strong>Iframe Notice:</strong> Browser security blocks authorization popups within embedded preview frames. Please open the application in a new tab to complete Google authorization.
                      </p>
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-zinc-800 dark:bg-zinc-750 hover:bg-zinc-700 text-white font-bold text-[9px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-xs"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open App in New Tab
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Inputs block */}
            <div className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-450 uppercase tracking-wider block">
                  Connected Spreadsheet URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={localSpreadsheetUrl}
                    onChange={(e) => parseUrlToId(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit"
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg pl-3 pr-10 py-2 text-xs font-mono outline-hidden transition-all text-slate-800 dark:text-zinc-250"
                    id="settings_spreadsheet_url_input"
                  />
                  {localSpreadsheetUrl && (
                    <a
                      href={localSpreadsheetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-amber-500 p-0.5 transition-colors"
                      title="Open spreadsheet in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-450 uppercase tracking-wider block">
                  Spreadsheet ID
                </label>
                <input
                  type="text"
                  value={localSpreadsheetId}
                  onChange={(e) => setLocalSpreadsheetId(e.target.value.trim())}
                  placeholder="e.g. 1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360"
                  className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg px-3 py-2 text-xs font-mono outline-hidden transition-all text-slate-800 dark:text-zinc-250"
                  id="settings_spreadsheet_id_input"
                />
              </div>
            </div>
          </div>

          {/* Section: Telemetry */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-850 rounded-xl p-4 shadow-xs text-xs space-y-2.5" id="settings_status_info_card">
            <h3 className="font-bold text-[10px] uppercase tracking-widest text-slate-500 dark:text-zinc-400 block border-b border-slate-100 dark:border-zinc-850 pb-2">
              Sync Telemetry
            </h3>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500 font-semibold">Database Node:</span>
              <span className="font-mono font-bold text-emerald-500">ONLINE</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500 font-semibold">Workspace Sync:</span>
              <span className={`font-mono font-bold ${token ? 'text-emerald-500' : 'text-amber-500'}`}>
                {token ? 'CONNECTED' : 'LOCAL CACHE'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 dark:text-zinc-500 font-semibold">Global ID:</span>
              <span className="font-mono text-[10px] text-slate-450 dark:text-zinc-400 truncate max-w-[140px]" title={connectedSpreadsheetId}>
                {connectedSpreadsheetId || 'None'}
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* Global save section */}
      <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-center gap-4" id="global_save_section">
        <div className="text-xs leading-relaxed text-left">
          {saveStatus === 'success' && (
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1.5">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              All configurations and preferences synchronized successfully!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-rose-600 dark:text-rose-400 font-extrabold flex items-center gap-1.5">
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
              Failed to synchronize configuration details globally.
            </span>
          )}
          {saveStatus === 'idle' && (
            <p className="text-slate-500 dark:text-zinc-500 flex items-center gap-1.5 font-semibold">
              <HelpCircle className="w-4.5 h-4.5 text-slate-400 dark:text-zinc-600" />
              Preferences autosave on toggle. Press Save to force global database synchronization.
            </p>
          )}
        </div>

        <button
          onClick={handleSaveAllConfig}
          disabled={isSaving || !localSpreadsheetId.trim()}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md transform hover:scale-[1.01] active:scale-[0.99]"
          id="settings_save_config_btn"
        >
          <Save className="w-4 h-4" />
          {isSaving ? "Saving Config..." : "Save Settings & Sync"}
        </button>
      </div>

    </div>
  );
}
