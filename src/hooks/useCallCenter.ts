import { useEffect, useRef, useState, useCallback } from 'react';

export type DeviceStatus = 'offline' | 'connecting' | 'ready' | 'unavailable' | 'error';
export type CallState = 'idle' | 'ringing' | 'connected' | 'on_hold';

function getSessionToken(): string {
  return sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
}

/**
 * Owns the Twilio Device + live call state at the top of the app (App.tsx),
 * so switching tabs (which unmounts CallCenterSection) does NOT drop an
 * active or ringing call. The small floating popup and the full CSR Call
 * Center page both just read from / call into this same hook instance.
 */
export function useCallCenter(isActive: boolean) {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>('offline');
  const [callState, setCallState] = useState<CallState>('idle');
  const [callerNumber, setCallerNumber] = useState('');
  const [currentCallSid, setCurrentCallSid] = useState('');
  const [muted, setMuted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [ivrConfigured, setIvrConfigured] = useState<boolean | null>(null);

  const deviceRef = useRef<any>(null);
  const activeCallRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isActive) return;
    fetch('/api/ivr/config')
      .then(r => r.json())
      .then(data => setIvrConfigured(!!data.configured))
      .catch(() => setIvrConfigured(false));
  }, [isActive]);

  // Only torn down when the agent actually logs out / the app itself unmounts
  // (this hook lives at the App level, not inside a per-tab component).
  useEffect(() => {
    return () => {
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

  const resetCallUi = useCallback(() => {
    activeCallRef.current = null;
    setCallState('idle');
    setMuted(false);
    setCallerNumber('');
    setCurrentCallSid('');
  }, []);

  const connect = useCallback(async () => {
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
        setCallerNumber(call.parameters?.From || 'Unknown number');
        setCurrentCallSid(call.parameters?.CallSid || '');
        setCallState('ringing');

        call.on('accept', () => setCallState('connected'));
        call.on('disconnect', () => resetCallUi());
        call.on('cancel', () => resetCallUi());
        call.on('reject', () => resetCallUi());
      });

      await device.register();
      deviceRef.current = device;
    } catch (err: any) {
      console.error('[CallCenter] Failed to connect:', err);
      setErrorMsg('Could not start the call device. Is @twilio/voice-sdk installed and are TWILIO_* env vars set?');
      setDeviceStatus('error');
    }
  }, [resetCallUi]);

  const disconnectDevice = useCallback(() => {
    try { activeCallRef.current?.disconnect?.(); } catch {}
    try { deviceRef.current?.unregister?.(); } catch {}
    try { deviceRef.current?.destroy?.(); } catch {}
    deviceRef.current = null;
    resetCallUi();
    setDeviceStatus('offline');
  }, [resetCallUi]);

  // Sets the agent's general availability directly (the caller derives what
  // "next" should be from the agent's real live session status — see
  // CallCenterSection — instead of this hook keeping its own separate,
  // easily-out-of-sync copy of that flag).
  const setAgentReady = useCallback(async (next: boolean) => {
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
    } catch {
      setErrorMsg('Could not update Ready status.');
    }
  }, []);

  const acceptCall = useCallback(() => { activeCallRef.current?.accept?.(); }, []);
  const rejectCall = useCallback(() => { activeCallRef.current?.reject?.(); resetCallUi(); }, [resetCallUi]);
  const hangUp = useCallback(() => { activeCallRef.current?.disconnect?.(); resetCallUi(); }, [resetCallUi]);

  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev;
      activeCallRef.current?.mute?.(next);
      return next;
    });
  }, []);

  return {
    deviceStatus, callState, callerNumber, currentCallSid, muted, elapsedSec, errorMsg, ivrConfigured,
    connect, disconnectDevice, setAgentReady, acceptCall, rejectCall, hangUp, toggleMute, resetCallUi,
  };
}

export type CallCenterState = ReturnType<typeof useCallCenter>;
