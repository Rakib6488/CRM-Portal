import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Lock, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  Chrome,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { googleSignIn } from '../firebase';
import { User } from 'firebase/auth';

interface AuthGatewayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: User, token: string) => void;
}

export default function AuthGatewayModal({
  isOpen,
  onClose,
  onSuccess
}: AuthGatewayModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const handleAuthorizeClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsConnecting(true);
    setError(null);

    try {
      // Direct, synchronous execution within the onClick handler
      // This bypasses standard browser popup blockers by utilizing a fresh, synchronous user gesture.
      const result = await googleSignIn();
      if (result) {
        onSuccess(result.user, result.accessToken);
        onClose();
      } else {
        setError('Authorization returned no result.');
      }
    } catch (err: any) {
      console.error('Google Workspace Auth failed:', err);
      setError(err?.message || 'Failed to complete Google Workspace authorization. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md animate-fadeIn">
      {/* Modal Card */}
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-850">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-sans font-extrabold text-slate-900 dark:text-white uppercase tracking-wider">
                Workspace API Auth Gateway
              </h3>
              <p className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                Secure Google Sheets & Docs Connection
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-lg transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-5 overflow-y-auto font-sans">
          
          {/* Why is this happening explanation */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wide">
              Why is this gateway needed?
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Google Workspace APIs (Sheets & Docs) utilize secure OAuth 2.0. Standard popups can easily be blocked by modern browser security (Chrome & Safari) when initiated inside embedded frames or nested asynchronous calls. 
            </p>
          </div>

          {/* Iframe detection alert box */}
          {isInIframe ? (
            <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-bold text-amber-600 dark:text-amber-400 leading-normal">
                    Embedded Frame Restriction Detected
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Browser security policies strictly block OAuth popups inside embedded preview iframes (Cross-Origin Frame restrictions).
                  </p>
                </div>
              </div>
              
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open App in New Tab
                </a>
                <button
                  onClick={handleCopyUrl}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-750 text-slate-700 dark:text-zinc-200 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all"
                >
                  {copiedUrl ? 'Copied Link!' : 'Copy App Link'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
              <div className="flex items-start gap-2.5">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 leading-normal">
                    Standalone Tab Context Verified
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    You are in a top-level tab. Clicking the button below will initiate a direct Google popup securely with correct scope registration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Configuration Verification */}
          <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-850 rounded-xl space-y-2">
            <h5 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Secure Provider Configuration
            </h5>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
              <div className="flex flex-col p-2 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 rounded-lg">
                <span className="text-slate-400 dark:text-zinc-500">AUTH DOMAIN</span>
                <span className="text-slate-700 dark:text-zinc-300 truncate">glossy-intelligence-1t3g1.firebaseapp.com</span>
              </div>
              <div className="flex flex-col p-2 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-850 rounded-lg">
                <span className="text-slate-400 dark:text-zinc-500">REQUIRED SCOPES</span>
                <span className="text-slate-700 dark:text-zinc-300 truncate">Spreadsheets, Documents</span>
              </div>
            </div>
          </div>

          {/* Error display */}
          {error && (
            error.includes('auth/unauthorized-domain') ? (
              <div className="p-4 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-3.5 text-left animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                      Firebase Domain Authorization Required
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      This development/preview URL is not yet authorized in your Firebase console. To authorize it, please follow these simple steps:
                    </p>
                  </div>
                </div>

                <div className="text-[11px] space-y-3 bg-white dark:bg-zinc-950 p-3.5 border border-rose-500/20 rounded-xl font-sans">
                  <div className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-5 h-5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded font-bold font-mono text-[10px]">1</span>
                    <div className="flex-1 space-y-1.5">
                      <p className="text-slate-700 dark:text-zinc-300">Copy this application's domain name:</p>
                      <div className="flex items-center gap-1.5">
                        <code className="px-2 py-1 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded font-mono text-[10px] text-amber-600 dark:text-amber-400 select-all font-bold">
                          {typeof window !== 'undefined' ? window.location.hostname : ''}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof window !== 'undefined') {
                              navigator.clipboard.writeText(window.location.hostname);
                              alert('📋 Domain copied to clipboard!');
                            }
                          }}
                          className="px-2 py-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-600 dark:text-zinc-300 rounded text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all border border-slate-200 dark:border-zinc-700"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-5 h-5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded font-bold font-mono text-[10px]">2</span>
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-zinc-300">
                        Open your Firebase Console Authentication settings page:
                      </p>
                      <a
                        href="https://console.firebase.google.com/project/glossy-intelligence-1t3g1/authentication/providers"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 hover:underline"
                      >
                        Go to Firebase Auth Settings <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="flex items-center justify-center w-5 h-5 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded font-bold font-mono text-[10px]">3</span>
                    <div className="flex-1">
                      <p className="text-slate-700 dark:text-zinc-300">
                        Scroll down to <strong className="text-slate-900 dark:text-white">Authorized domains</strong>, click <strong className="text-slate-900 dark:text-white">Add domain</strong>, paste the domain from Step 1, and click save.
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed font-medium">
                  💡 <strong>Tip:</strong> If you use both the development URL and the shared URL, you should add both to your Authorized Domains list!
                </p>
              </div>
            ) : (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-2 items-start text-left">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-sans text-rose-600 dark:text-rose-400 leading-normal">
                  {error}
                </p>
              </div>
            )
          )}

        </div>

        {/* Footer actions */}
        <div className="p-5 bg-slate-50 dark:bg-zinc-900/50 border-t border-slate-100 dark:border-zinc-850 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-transparent hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-700 dark:hover:text-zinc-300 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            onClick={handleAuthorizeClick}
            disabled={isConnecting}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-750 disabled:opacity-50 text-white font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-sm"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Connecting Google...
              </>
            ) : (
              <>
                <Chrome className="w-3.5 h-3.5" />
                Authorize Google Account
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
