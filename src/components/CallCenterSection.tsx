import { useEffect, useRef, useState } from 'react';
import { Bot, Mic, MicOff } from 'lucide-react';
import { LiveAgentSession } from '../types';

interface CallCenterSectionProps {
  agentId: string;
  agentName: string;
  liveAgentSessions: LiveAgentSession[];
}

type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'unavailable' | 'error';
type CallState = 'idle' | 'ringing' | 'connected' | 'on_hold';

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

export default function CallCenterSection({ agentId, agentName, liveAgentSessions }: CallCenterSectionProps) {
  // ---- device / call state ----
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('offline');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callerNumber, setCallerNumber] = useState('');
  const [currentCallSid, setCurrentCallSid] = useState('');
  const [muted, setMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [ivrConfigured, setIvrConfigured] = useState<boolean | null>(null);

  // ---- "Ready" (separate from the phone-device connection — this is the
  // agent's general availability, the same status used for IVR routing) ----
  const [readyForCalls, setReadyForCalls] = useState(false);
  const [readySaving, setReadySaving] = useState(false);

  // ---- transfer ----
  const [transferTarget, setTransferTarget] = useState('');
  const [transferring, setTransferring] = useState(false);

  // ---- customer history ----
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [contactName, setContactName] = useState('');

  // ---- summary ----
  const [summaryCategory, setSummaryCategory] = useState('');
  const [summaryRemark, setSummaryRemark] = useState('');
  const [summaryComplete, setSummaryComplete] = useState(false);
  const [savingSummary, setSavingSummary] = useState(false);

  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);

  useEffect(() => {
    fetch('/api/ivr/config')
      .then(r => r.json())
      .then(data => setIvrConfigured(!!data.configured))
      .catch(() => setIvrConfigured(false));

    return () => {
      try { activeCallRef.current?.disconnect?.(); } catch {}
      try { deviceRef.current?.destroy?.(); } catch {}
    };
  }, []);

  function resetForNewCall(from: string, sid: string) {
    setCallerNumber(from);
    setCurrentCallSid(sid);
    setSummaryCategory('');
    setSummaryRemark('');
    setSummaryComplete(false);
    setHistory([]);
    loadHistory(from);
  }

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

  function resetCallUi() {
    activeCallRef.current = null;
    setCallState('idle');
    setMuted(false);
    setTransferTarget('');
  }

  async function handleConnect() {
    setErrorMsg('');
    setDeviceStatus('connecting');
    try {
      const token = getSessionToken();
      const res = await fetch('/api/ivr/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setErrorMsg(data.error || 'IVR is not configured yet.');
        setDeviceStatus('unavailable');
        return;
      }

      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(data.token, { logLevel: 1 });

      device.on('registered', () => setDeviceStatus('ready'));
      device.on('unregistered', () => setDeviceStatus('offline'));
      device.on('error', (e: any) => {
        console.error('[CallCenter] Twilio Device error:', e);
        setErrorMsg(e?.message || 'Call device error.');
        setDeviceStatus('error');
      });

      device.on('incoming', (call: any) => {
        activeCallRef.current = call;
        const from = call.parameters?.From || 'Unknown number';
        const sid = call.parameters?.CallSid || '';
        resetForNewCall(from, sid);
        setCallState('ringing');

        call.on('accept', () => setCallState('connected'));
        call.on('disconnect', () => resetCallUi());
        call.on('cancel', () => resetCallUi());
        call.on('reject', () => resetCallUi());

        // For this reference layout, calls auto-answer straight into the CSR
        // screen (matches "Disconnect" already showing as the connected state
        // in the reference design). Remove this line if you'd rather show a
        // manual Accept/Decline step first.
        call.accept();
      });

      await device.register();
      deviceRef.current = device;
    } catch (err: any) {
      console.error('[CallCenter] Failed to connect:', err);
      setErrorMsg('Could not start the call device. Is @twilio/voice-sdk installed and are TWILIO_* env vars set?');
      setDeviceStatus('error');
    }
  }

  function handleDisconnect() {
    try { activeCallRef.current?.disconnect?.(); } catch {}
    try { deviceRef.current?.unregister?.(); } catch {}
    try { deviceRef.current?.destroy?.(); } catch {}
    deviceRef.current = null;
    resetCallUi();
    setDeviceStatus('offline');
  }

  async function toggleReady() {
    const next = !readyForCalls;
    setReadySaving(true);
    try {
      const token = getSessionToken();
      await fetch('/api/realtime/status-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          token,
          status: next ? 'available' : 'on_break',
          currentActivity: next ? 'Ready for calls' : 'Not ready for calls',
        }),
      });
      setReadyForCalls(next);
    } catch {
      setErrorMsg('Could not update Ready status.');
    } finally {
      setReadySaving(false);
    }
  }

  function toggleMute() {
    const next = !muted;
    activeCallRef.current?.mute?.(next);
    setMuted(next);
  }

  function hangUp() {
    activeCallRef.current?.disconnect?.();
    resetCallUi();
  }

  async function handleTransfer() {
    if (!transferTarget || !currentCallSid) return;
    setTransferring(true);
    setErrorMsg('');
    try {
      const token = getSessionToken();
      const res = await fetch('/api/ivr/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ callSid: currentCallSid, targetAgentId: transferTarget }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Transfer failed.');
        return;
      }
      resetCallUi();
    } catch {
      setErrorMsg('Transfer failed.');
    } finally {
      setTransferring(false);
    }
  }

  async function handleSaveSummary() {
    if (!currentCallSid) {
      setErrorMsg('No active or recent call to attach this summary to.');
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
        setErrorMsg(data.error || 'Could not save the summary.');
      }
    } catch {
      setErrorMsg('Could not save the summary.');
    } finally {
      setSavingSummary(false);
    }
  }

  const transferOptions = liveAgentSessions.filter(
    s => s.status === 'available' && s.agentId && s.agentId.toLowerCase() !== agentId.toLowerCase()
  );

  const isConnectedOrRinging = callState !== 'idle';
  const canControlCall = callState === 'connected' || callState === 'on_hold';

  return (
    <div className="space-y-6">
      {/* ---------------- Toolbar ---------------- */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-indigo-500" />
        </div>

        {deviceStatus === 'ready' || deviceStatus === 'connecting' ? (
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={ivrConfigured === null || deviceStatus === 'connecting'}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#6A00D1] hover:bg-[#5800B0] text-white transition-colors disabled:opacity-50"
          >
            Connect
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600 dark:text-slate-300">Ready:</span>
          <button
            onClick={toggleReady}
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

        <button
          onClick={hangUp}
          disabled={!isConnectedOrRinging}
          className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 ml-auto"
        >
          Hangup
        </button>
      </div>

      {errorMsg && (
        <div className="px-4 py-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg">
          {errorMsg}
        </div>
      )}

      {ivrConfigured === false && (
        <div className="px-4 py-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
          IVR is not configured yet — set the TWILIO_* variables in your .env to enable Connect.
        </div>
      )}

      {/* ---------------- Two-column body ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer History */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4">Customer History</h3>

          {!callerNumber ? (
            <p className="text-sm text-slate-400">No active call yet — customer history will appear here once a call connects.</p>
          ) : historyLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-slate-400">
              No previous interactions found for {contactName || callerNumber}.
            </p>
          ) : (
            <ul className="space-y-4 border-l-2 border-[#6A00D1]/30 pl-4">
              {history.map(h => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#6A00D1]" />
                  <p className="text-sm font-medium text-[#6A00D1]">{h.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
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
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Summary</h3>
            <span className={`px-3 py-1 rounded-md text-xs font-medium border ${
              summaryComplete
                ? 'border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
            }`}>
              {summaryComplete ? 'Complete Summary' : 'Incomplete Summary'}
            </span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300 block mb-1">Category:</label>
              <select
                value={summaryCategory}
                onChange={e => setSummaryCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100"
              >
                <option value="">Select a category…</option>
                {SUMMARY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-600 dark:text-slate-300 block mb-1">Remark:</label>
              <textarea
                value={summaryRemark}
                onChange={e => setSummaryRemark(e.target.value)}
                placeholder="Please Enter..."
                rows={6}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-100 resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSaveSummary}
                disabled={savingSummary}
                className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#6A00D1] hover:bg-[#5800B0] text-white transition-colors disabled:opacity-50"
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
