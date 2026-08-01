import { Headphones, Phone, PhoneOff, Mic, MicOff, Maximize2 } from 'lucide-react';
import { CallCenterState } from '../hooks/useCallCenter';

interface CallFloatingPopupProps extends Pick<CallCenterState,
  'callState' | 'callerNumber' | 'muted' | 'elapsedSec' | 'acceptCall' | 'rejectCall' | 'hangUp' | 'toggleMute'
> {
  onOpenFullPage: () => void;
}

function formatTime(total: number) {
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function CallFloatingPopup({
  callState, callerNumber, muted, elapsedSec,
  acceptCall, rejectCall, hangUp, toggleMute,
  onOpenFullPage,
}: CallFloatingPopupProps) {
  if (callState === 'idle') return null;

  const isRinging = callState === 'ringing';

  return (
    <div
      className="fixed right-4 top-24 z-50 w-[200px] rounded-2xl shadow-2xl overflow-hidden bg-slate-900 border border-slate-700/80 text-slate-100 select-none"
      data-testid="call-floating-popup"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700/60">
        <div className="flex items-center gap-1.5">
          <Headphones className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">IVR CALL</span>
        </div>
        <button
          onClick={onOpenFullPage}
          className="text-slate-400 hover:text-white transition-colors"
          aria-label="Open full call center page"
          title="Open CSR Call Center"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1.5 mb-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${isRinging ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
          <span className={`text-[10px] font-semibold tracking-wide ${isRinging ? 'text-amber-400' : 'text-emerald-400'}`}>
            {isRinging ? 'INCOMING CALL' : callState === 'on_hold' ? 'ON HOLD' : 'ON CALL'}
          </span>
        </div>

        <p className="text-sm font-bold text-white truncate">{callerNumber || 'Unknown'}</p>

        {!isRinging && (
          <p className="text-xs text-slate-400 font-mono mt-0.5">{formatTime(elapsedSec)}</p>
        )}

        {/* Controls */}
        {isRinging ? (
          <div className="flex justify-center gap-3 mt-3">
            <button
              onClick={acceptCall}
              className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center transition-colors"
              aria-label="Answer"
              title="Answer"
            >
              <Phone className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={rejectCall}
              className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
              aria-label="Decline"
              title="Decline"
            >
              <PhoneOff className="w-4 h-4 text-white" />
            </button>
          </div>
        ) : (
          <div className="flex justify-center gap-2 mt-3">
            <button
              onClick={toggleMute}
              className="w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center transition-colors"
              aria-label={muted ? 'Unmute' : 'Mute'}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
            </button>
            <button
              onClick={hangUp}
              className="w-9 h-9 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center transition-colors"
              aria-label="Hangup"
              title="Hangup"
            >
              <PhoneOff className="w-4 h-4 text-white" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
