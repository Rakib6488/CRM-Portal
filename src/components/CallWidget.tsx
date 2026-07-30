import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, PhoneIncoming, Pause, Play, Mic, MicOff, PhoneCall, WifiOff } from 'lucide-react';

interface CallWidgetProps {
  agentId: string;
  agentName: string;
  isActive: boolean; // mount/run only when the agent is logged into the portal
}

type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'unavailable' | 'error';
type CallState = 'idle' | 'ringing' | 'connected' | 'on_hold';

function getSessionToken(): string {
  return sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
}

export default function CallWidget({ agentId, agentName, isActive }: CallWidgetProps) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('offline');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callerNumber, setCallerNumber] = useState<string>('');
  const [muted, setMuted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [ivrConfigured, setIvrConfigured] = useState<boolean | null>(null);

  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check once whether the backend has Twilio credentials configured yet.
  useEffect(() => {
    if (!isActive) return;
    fetch('/api/ivr/config')
      .then(r => r.json())
      .then(data => setIvrConfigured(!!data.configured))
      .catch(() => setIvrConfigured(false));
  }, [isActive]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount / logout
      if (timerRef.current) clearInterval(timerRef.current);
      try { activeCallRef.current?.disconnect?.(); } catch {}
      try { deviceRef.current?.destroy?.(); } catch {}
    };
  }, []);

  useEffect(() => {
    if (callState === 'connected') {
      timerRef.current = setInterval(() => setElapsedSec(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (callState === 'idle') setElapsedSec(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  async function goReady() {
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

      // Loaded lazily so the bundle/app still works even before the package
      // is installed (npm install after pulling this code).
      const { Device } = await import('@twilio/voice-sdk');
      const device = new Device(data.token, { logLevel: 1 });

      device.on('registered', () => setDeviceStatus('ready'));
      device.on('unregistered', () => setDeviceStatus('offline'));
      device.on('error', (e: any) => {
        console.error('[CallWidget] Twilio Device error:', e);
        setErrorMsg(e?.message || 'Call device error.');
        setDeviceStatus('error');
      });

      device.on('incoming', (call: any) => {
        activeCallRef.current = call;
        setCallerNumber(call.parameters?.From || 'Unknown number');
        setCallState('ringing');

        call.on('accept', () => { setCallState('connected'); });
        call.on('disconnect', () => { resetCallUi(); });
        call.on('cancel', () => { resetCallUi(); });
        call.on('reject', () => { resetCallUi(); });
      });

      await device.register();
      deviceRef.current = device;
    } catch (err: any) {
      console.error('[CallWidget] Failed to go Ready:', err);
      setErrorMsg('Could not start the call device. Is @twilio/voice-sdk installed and are TWILIO_* env vars set?');
      setDeviceStatus('error');
    }
  }

  function goOffline() {
    try { activeCallRef.current?.disconnect?.(); } catch {}
    try { deviceRef.current?.unregister?.(); } catch {}
    try { deviceRef.current?.destroy?.(); } catch {}
    deviceRef.current = null;
    resetCallUi();
    setDeviceStatus('offline');
  }

  function resetCallUi() {
    activeCallRef.current = null;
    setCallState('idle');
    setMuted(false);
    setElapsedSec(0);
  }

  function acceptCall() {
    activeCallRef.current?.accept?.();
  }

  function rejectCall() {
    activeCallRef.current?.reject?.();
    resetCallUi();
  }

  function hangUp() {
    activeCallRef.current?.disconnect?.();
    resetCallUi();
  }

  function toggleMute() {
    const next = !muted;
    activeCallRef.current?.mute?.(next);
    setMuted(next);
  }

  // "Hold" approximated via mute + UI state (no hold music) — see chat notes:
  // a true network hold with music needs a Twilio conference-based flow.
  function toggleHold() {
    if (callState === 'on_hold') {
      activeCallRef.current?.mute?.(false);
      setCallState('connected');
    } else {
      activeCallRef.current?.mute?.(true);
      setCallState('on_hold');
    }
  }

  function formatTime(total: number) {
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  if (!isActive) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 select-none" data-testid="call-widget">
      <div className="rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
        {/* Header / Ready toggle */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/60">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                deviceStatus === 'ready' ? 'bg-emerald-500' :
                deviceStatus === 'connecting' ? 'bg-amber-400 animate-pulse' :
                deviceStatus === 'error' || deviceStatus === 'unavailable' ? 'bg-red-500' : 'bg-slate-400'
              }`}
            />
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-100">
              {deviceStatus === 'ready' ? 'Ready for calls' :
               deviceStatus === 'connecting' ? 'Connecting…' :
               deviceStatus === 'error' ? 'Call device error' :
               deviceStatus === 'unavailable' ? 'IVR not configured' : 'Call portal'}
            </span>
          </div>

          {ivrConfigured === false ? (
            <span title="Set TWILIO_* variables in .env" className="text-slate-400">
              <WifiOff className="w-4 h-4" />
            </span>
          ) : deviceStatus === 'ready' || deviceStatus === 'connecting' ? (
            <button
              onClick={goOffline}
              className="text-xs px-2.5 py-1 rounded-md font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              Offline
            </button>
          ) : (
            <button
              onClick={goReady}
              disabled={ivrConfigured === null}
              className="text-xs px-2.5 py-1 rounded-md font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              Ready
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
            {errorMsg}
          </div>
        )}

        {/* Idle body */}
        {callState === 'idle' && !errorMsg && (
          <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
            {deviceStatus === 'ready'
              ? `Signed in as ${agentName}. Waiting for incoming calls…`
              : 'Go Ready to start receiving calls in your browser.'}
          </div>
        )}

        {/* Ringing */}
        {callState === 'ringing' && (
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 mb-3">
              <PhoneIncoming className="w-4 h-4 text-amber-500 animate-bounce" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-100">Incoming call</span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-300 mb-3">{callerNumber}</p>
            <div className="flex gap-2">
              <button
                onClick={acceptCall}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
              >
                <Phone className="w-4 h-4" /> Receive
              </button>
              <button
                onClick={rejectCall}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> Decline
              </button>
            </div>
          </div>
        )}

        {/* Connected / On hold */}
        {(callState === 'connected' || callState === 'on_hold') && (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-100">{callerNumber}</span>
              </div>
              <span className="text-xs text-slate-400 font-mono">{formatTime(elapsedSec)}</span>
            </div>
            {callState === 'on_hold' && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">Call on hold</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={toggleHold}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                {callState === 'on_hold' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {callState === 'on_hold' ? 'Resume' : 'Hold'}
              </button>
              <button
                onClick={toggleMute}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 text-sm font-medium transition-colors"
              >
                {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={hangUp}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
              >
                <PhoneOff className="w-4 h-4" /> End
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
