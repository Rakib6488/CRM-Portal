import { useEffect, useState } from 'react';
import { Bot, Mic, MicOff, PhoneIncoming, Phone, PhoneOff } from 'lucide-react';
import { LiveAgentSession } from '../types';
import { CallCenterState } from '../hooks/useCallCenter';

interface CallCenterSectionProps extends CallCenterState {
  agentId: string;
  agentName: string;
  liveAgentSessions: LiveAgentSession[];
}

interface HistoryEntry {
  id: string;
  label: string;
  createdAt: string;
  csrName: string;
}

function getSessionToken(): string {
  return sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
}

const SUMMARY_CATEGORIES = ['Billing', 'Technical', 'General', 'Feature Request'];

export default function CallCenterSection(props: CallCenterSectionProps) {
  const {
    agentId, liveAgentSessions,
    deviceStatus, callState, callerNumber, currentCallSid, muted, errorMsg, ivrConfigured,
    connect, disconnectDevice, setAgentReady, acceptCall, rejectCall, hangUp, toggleMute, resetCallUi,
  } = props;

  // "Ready" reflects the agent's REAL live status (from the same realtime
  // session system the rest of the portal already uses) — not a separate,
  // easily-out-of-sync local flag. This is what fixes the toggle showing a
  // state that doesn't match reality.
  const mySession = liveAgentSessions.find(s => s.agentId && s.agentId.toLowerCase() === agentId.toLowerCase());
  const readyForCalls = mySession?.status === 'available';
  const [readySaving, setReadySaving] = useState(false);

  async function handleToggleReady() {
    setReadySaving(true);
    try {
      await setAgentReady(!readyForCalls);
    } finally {
      setReadySaving(false);
    }
  }

  // ---- transfer ----
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [localError, setLocalError] = useState('');

  // ---- customer history ----
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [contactName, setContactName] = useState('');

  // ---- summary ----
  const [summaryCategory, setSummaryCategory] = useState('');
  const [summaryRemark, setSummaryRemark] = useState('');
  const [summaryComplete, setSummaryComplete] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  // Whenever a new caller connects, reset the per-call panels and pull their history.
  useEffect(() => {
    if (!callerNumber) return;
    setSummaryCategory('');
    setSummaryRemark('');
    setSummaryComplete(false);
    setHistory([]);
    loadHistory(callerNumber);
  }, [callerNumber, currentCallSid]);

  async function loadHistory(phone: string) {
    if (!phone) return;
    setHistoryLoading(true);
    try {
      const token = getSessionToken();
      const res = await fetch(`/api/ivr/customer-history?phone=${encodeURIComponent(phone)}&token=${encodeURIComponent(token)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setHistory(data.history || []);
      setContactName(data.contact?.name || '');
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleTransfer() {
    if (!transferTarget || !currentCallSid) return;
    setTransferring(true);
    setLocalError('');
    try {
      const token = getSessionToken();
      const res = await fetch('/api/ivr/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ callSid: currentCallSid, targetAgentId: transferTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLocalError(data.error || 'Transfer failed.');
        return;
      }
      resetCallUi();
      setTransferTarget('');
    } catch {
      setLocalError('Transfer failed.');
    } finally {
      setTransferring(false);
    }
  }

  async function handleSaveSummary() {
    if (!currentCallSid) {
      setLocalError('No active or recent call to attach this summary to.');
      return;
    }
    setSavingSummary(true);
    try {
      const token = getSessionToken();
      const res = await fetch('/api/ivr/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ callSid: currentCallSid, category: summaryCategory, remark: summaryRemark }),
      });
      const data = await res.json();
      if (res.ok) {
        setSummaryComplete(!!data.call?.summaryComplete);
      } else {
        setLocalError(data.error || 'Could not save the summary.');
      }
    } catch {
      setLocalError('Could not save the summary.');
    } finally {
      setSavingSummary(false);
    }
  }

  const transferOptions = liveAgentSessions.filter(
    s => s.status === 'available' && s.agentId && s.agentId.toLowerCase() !== agentId.toLowerCase()
  );

  const canControlCall = callState === 'connected' || callState === 'on_hold';
  const combinedError = errorMsg || localError;

  return (
    <div className="space-y-6">
      {/* ---------------- Toolbar ---------------- */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-indigo-500" />
        </div>

        {deviceStatus === 'ready' || deviceStatus === 'connecting' ? (
          <button
            onClick={disconnectDevice}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={ivrConfigured === null || deviceStatus === 'connecting'}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6A00D1] hover:bg-[#5800B0] text-white transition-colors disabled:opacity-50"
          >
            Connect
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Ready:</span>
          <button
            onClick={handleToggleReady}
            disabled={readySaving}
            className={`relative w-11 h-6 rounded-full transition-colors ${readyForCalls ? 'bg-[#6A00D1]' : 'bg-slate-300 dark:bg-slate-600'} disabled:opacity-60`}
            aria-label="Toggle ready for calls"
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${readyForCalls ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Transfer:</span>
          <select
            value={transferTarget}
            onChange={e => setTransferTarget(e.target.value)}
            disabled={!canControlCall}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 disabled:opacity-50 min-w-[160px]"
          >
            <option value="">Select Transfer</option>
            {transferOptions.map(a => (
              <option key={a.agentId} value={a.agentId}>{a.name}</option>
            ))}
          </select>
          <button
            onClick={handleTransfer}
            disabled={!canControlCall || !transferTarget || transferring}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
          >
            Transfer
          </button>
        </div>

        <button
          onClick={toggleMute}
          disabled={!canControlCall}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-40"
          aria-label="Toggle mute"
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {canControlCall && (
          <button
            onClick={hangUp}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors ml-auto"
          >
            Hangup
          </button>
        )}
      </div>

      {/* Ringing banner — Answer/Decline shows here when this page is open during an incoming call */}
      {callState === 'ringing' && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2">
            <PhoneIncoming className="w-4 h-4 text-amber-600 animate-bounce" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Incoming call: {callerNumber}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={acceptCall} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors">
              <Phone className="w-3.5 h-3.5" /> Answer
            </button>
            <button onClick={rejectCall} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors">
              <PhoneOff className="w-3.5 h-3.5" /> Decline
            </button>
          </div>
        </div>
      )}

      {combinedError && (
        <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {combinedError}
        </div>
      )}

      {ivrConfigured === false && (
        <div className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          IVR is not configured yet — set the TWILIO_* variables in your .env to enable Connect.
        </div>
      )}

      {/* ---------------- Two-column body ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Customer History */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Customer History</h3>

          {!callerNumber ? (
            <p className="text-xs text-slate-400">No active call yet — customer history will appear here once a call connects.</p>
          ) : historyLoading ? (
            <p className="text-xs text-slate-400">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-400">
              No previous interactions found for {contactName || callerNumber}.
            </p>
          ) : (
            <ul className="space-y-3 border-l-2 border-[#6A00D1]/30 pl-3 max-h-64 overflow-y-auto">
              {history.map(h => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[17px] top-1.5 w-1.5 h-1.5 rounded-full bg-[#6A00D1]" />
                  <p className="text-xs font-medium text-[#6A00D1]">{h.label}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {h.createdAt ? new Date(h.createdAt).toLocaleString() : '—'}
                    <span className="mx-1">·</span>
                    CSR Name: {h.csrName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Summary</h3>
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
              summaryComplete
                ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
            }`}>
              {summaryComplete ? 'Complete Summary' : 'Incomplete Summary'}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Category:</label>
              <select
                value={summaryCategory}
                onChange={e => setSummaryCategory(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100"
              >
                <option value="">Select a category…</option>
                {SUMMARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-600 dark:text-slate-300 block mb-1">Remark:</label>
              <textarea
                value={summaryRemark}
                onChange={e => setSummaryRemark(e.target.value)}
                placeholder="Please Enter..."
                rows={3}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSummary}
                disabled={savingSummary}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#6A00D1] hover:bg-[#5800B0] text-white transition-colors disabled:opacity-50"
              >
                {savingSummary ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
