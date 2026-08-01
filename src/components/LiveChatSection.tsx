import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, Paperclip, Wifi, WifiOff, Search, X } from 'lucide-react';

// URL of the live-chat bridge server (the "my-chat-app" Node/Express + socket.io service).
// Configure with VITE_LIVE_CHAT_URL in .env.local, e.g. http://localhost:10000 or your deployed Render URL.
const LIVE_CHAT_URL = (import.meta as any).env?.VITE_LIVE_CHAT_URL || 'http://localhost:10000';

type ChatChannel = 'telegram' | 'whatsapp' | 'facebook';

interface IncomingMessage {
  channel: ChatChannel;
  senderId: string;
  name: string;
  username?: string;
  text: string;
  date: number;
  attachment?: { name: string; type: string; size: number } | null;
}

interface ChatThread {
  senderId: string;
  channel: ChatChannel;
  name: string;
  username?: string;
  lastMessage: string;
  lastDate: number;
  unread: number;
  messages: IncomingMessage[];
}

interface OutgoingMessage {
  channel: ChatChannel;
  senderId: string;
  text: string;
  direction: 'out';
  date: number;
  attachment?: { name: string; type: string; size: number } | null;
}

const CHANNEL_LABEL: Record<ChatChannel, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
};

interface LiveChatSectionProps {
  agentName: string;
}

export default function LiveChatSection({ agentName }: LiveChatSectionProps) {
  const [connected, setConnected] = useState(false);
  const [channelsReady, setChannelsReady] = useState<Record<ChatChannel, boolean>>({
    telegram: false,
    whatsapp: false,
    facebook: false,
  });
  const [threads, setThreads] = useState<Record<string, ChatThread>>({});
  const [outgoing, setOutgoing] = useState<Record<string, OutgoingMessage[]>>({});
  const [activeSenderId, setActiveSenderId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [whatsappQr, setWhatsappQr] = useState<string | null>(null);
  const [requestingQr, setRequestingQr] = useState(false);
  const [requestingTelegram, setRequestingTelegram] = useState(false);
  const [telegramStatusMessage, setTelegramStatusMessage] = useState<string | null>(null);
  const [whatsappStatusMessage, setWhatsappStatusMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const socket = io(LIVE_CHAT_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('server-status', (status: { telegramReady: boolean; channels: Record<ChatChannel, boolean> }) => {
      setChannelsReady(status.channels);
    });

    socket.on('whatsapp-qr', (dataUrl: string | null) => {
      setWhatsappQr(dataUrl);
      setRequestingQr(false);
    });

    socket.on('channel-message', (payload: IncomingMessage) => {
      setThreads((prev) => {
        const key = `${payload.channel}:${payload.senderId}`;
        const existing = prev[key];
        const thread: ChatThread = existing
          ? {
              ...existing,
              lastMessage: payload.text,
              lastDate: payload.date,
              unread: activeSenderId === key ? 0 : existing.unread + 1,
              messages: [...existing.messages, payload],
            }
          : {
              senderId: payload.senderId,
              channel: payload.channel,
              name: payload.name,
              username: payload.username,
              lastMessage: payload.text,
              lastDate: payload.date,
              unread: activeSenderId === key ? 0 : 1,
              messages: [payload],
            };
        return { ...prev, [key]: thread };
      });
    });

    socket.on(
      'reply-sent',
      (payload: { channel: ChatChannel; senderId: string; text: string; attachment?: { name: string; type: string; size: number } | null }) => {
        const key = `${payload.channel}:${payload.senderId}`;
        setOutgoing((prev) => ({
          ...prev,
          [key]: [...(prev[key] || []), { ...payload, direction: 'out', date: Math.floor(Date.now() / 1000) }],
        }));
        setError(null);
        setSending(false);
      }
    );

    socket.on('reply-error', (message: string) => {
      setError(message);
      setSending(false);
    });

    socket.on('telegram-connecting', () => {
      setTelegramStatusMessage('Connecting Telegram...');
      setRequestingTelegram(true);
    });

    socket.on('telegram-connected', () => {
      setTelegramStatusMessage('Telegram connected.');
      setRequestingTelegram(false);
    });

    socket.on('telegram-connect-failed', (message: string) => {
      setTelegramStatusMessage(message);
      setRequestingTelegram(false);
    });

    socket.on('whatsapp-connecting', () => {
      setWhatsappStatusMessage('Requesting WhatsApp QR...');
      setRequestingQr(true);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threadList = useMemo(() => {
    const list = Object.entries(threads).map(([key, thread]) => ({ key, ...thread }));
    list.sort((a, b) => b.lastDate - a.lastDate);
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (t) => t.name.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q) || t.senderId.includes(q)
    );
  }, [threads, search]);

  const activeThread = activeSenderId ? threads[activeSenderId] : null;

  const timeline = useMemo(() => {
    if (!activeSenderId || !activeThread) return [];
    const outs = outgoing[activeSenderId] || [];
    return [
      ...activeThread.messages.map((m) => ({ ...m, direction: 'in' as const })),
      ...outs,
    ].sort((a, b) => a.date - b.date);
  }, [activeSenderId, activeThread, outgoing]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [timeline.length]);

  const openThread = (key: string) => {
    setActiveSenderId(key);
    setThreads((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], unread: 0 } } : prev));
  };

  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_ATTACHMENT_BYTES) {
      setError('Attachment is too large. Use a file under 10 MB.');
      e.target.value = '';
      return;
    }
    setPendingFile(file);
    e.target.value = '';
  };

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
      reader.onerror = () => reject(new Error('Could not read file'));
      reader.readAsDataURL(file);
    });

  const sendReply = async () => {
    if (!activeThread || (!draft.trim() && !pendingFile) || !socketRef.current) return;
    setSending(true);
    setError(null);

    let attachment: { name: string; type: string; size: number; data: string } | null = null;
    if (pendingFile) {
      try {
        const data = await fileToBase64(pendingFile);
        attachment = { name: pendingFile.name, type: pendingFile.type, size: pendingFile.size, data };
      } catch {
        setError('Could not read the selected file.');
        setSending(false);
        return;
      }
    }

    socketRef.current.emit('send-reply', {
      channel: activeThread.channel,
      senderId: activeThread.senderId,
      text: draft.trim(),
      attachment,
    });
    setDraft('');
    setPendingFile(null);
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* Thread list */}
      <div className="w-80 shrink-0 flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              Live Chat
            </h2>
            <span
              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                connected ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              }`}
            >
              {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(Object.keys(CHANNEL_LABEL) as ChatChannel[]).map((ch) => (
              <span
                key={ch}
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  channelsReady[ch]
                    ? 'border-emerald-500/40 text-emerald-400'
                    : 'border-slate-700 text-slate-500'
                }`}
              >
                {CHANNEL_LABEL[ch]}
              </span>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-slate-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full bg-slate-800/60 border border-slate-700 rounded-md pl-7 pr-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {whatsappQr && !channelsReady.whatsapp && (
            <div className="p-4 border-b border-slate-800 bg-slate-800/40 text-center">
              <p className="text-[11px] text-slate-300 mb-2">
                Scan with WhatsApp (Linked Devices) to connect your number:
              </p>
              <img src={whatsappQr} alt="WhatsApp QR code" className="mx-auto rounded-md border border-slate-700" />
            </div>
          )}
          {!whatsappQr && !channelsReady.whatsapp && connected && (
            <div className="p-4 border-b border-slate-800 bg-slate-800/40 text-center">
              <p className="text-[11px] text-slate-300 mb-3">
                WhatsApp is not connected yet. Request a QR code to start the session.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRequestingQr(true);
                  setWhatsappStatusMessage('Requesting WhatsApp QR...');
                  socketRef.current?.emit('request-whatsapp-qr');
                }}
                disabled={requestingQr}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {requestingQr ? 'Waiting for QR…' : 'Connect WhatsApp'}
              </button>
              {whatsappStatusMessage && (
                <p className="mt-2 text-[10px] text-slate-400">{whatsappStatusMessage}</p>
              )}
            </div>
          )}
          {!channelsReady.telegram && connected && (
            <div className="p-4 border-b border-slate-800 bg-slate-800/40 text-center">
              <p className="text-[11px] text-slate-300 mb-3">
                Telegram is not connected. Request the server to connect Telegram now.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRequestingTelegram(true);
                  setTelegramStatusMessage('Connecting Telegram...');
                  socketRef.current?.emit('request-telegram-connect');
                }}
                disabled={requestingTelegram}
                className="rounded-md bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {requestingTelegram ? 'Connecting Telegram…' : 'Connect Telegram'}
              </button>
              {telegramStatusMessage && (
                <p className="mt-2 text-[10px] text-slate-400">{telegramStatusMessage}</p>
              )}
            </div>
          )}
          {threadList.length === 0 && (
            <p className="text-xs text-slate-500 text-center p-6">
              No conversations yet. Incoming messages will appear here in real time.
            </p>
          )}
          {threadList.map((t) => (
            <button
              key={t.key}
              onClick={() => openThread(t.key)}
              className={`w-full text-left p-3 border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors ${
                activeSenderId === t.key ? 'bg-slate-800/60' : ''
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white truncate">{t.name}</span>
                {t.unread > 0 && (
                  <span className="text-[10px] bg-emerald-500 text-slate-900 font-bold rounded-full px-1.5">
                    {t.unread}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 truncate">{t.lastMessage}</p>
              <span className="text-[10px] text-slate-600">{CHANNEL_LABEL[t.channel]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation panel */}
      <div className="flex-1 flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 overflow-hidden">
        {!activeThread ? (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
            Select a conversation to start replying as {agentName}.
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">{activeThread.name}</h3>
                <span className="text-[11px] text-slate-500">
                  {CHANNEL_LABEL[activeThread.channel]}
                  {activeThread.username ? ` · @${activeThread.username}` : ''}
                </span>
              </div>
              <button onClick={() => setActiveSenderId(null)} className="text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {timeline.map((m, i) => (
                <div key={i} className={`flex ${m.direction === 'out' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-xs ${
                      m.direction === 'out'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {m.attachment && (
                      <div className="flex items-center gap-1 text-[10px] opacity-80 mb-1">
                        <Paperclip className="w-3 h-3" />
                        {m.attachment.name}
                      </div>
                    )}
                    {m.text}
                    <div className="text-[9px] opacity-60 mt-1">
                      {new Date(m.date * 1000).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="px-4 py-2 text-[11px] text-red-400 bg-red-500/10 border-t border-red-500/20">
                {error}
              </div>
            )}

            {pendingFile && (
              <div className="px-4 py-2 border-t border-slate-800 flex items-center justify-between bg-slate-800/40">
                <span className="text-[11px] text-slate-300 flex items-center gap-1 truncate">
                  <Paperclip className="w-3 h-3 shrink-0" />
                  {pendingFile.name} ({Math.round(pendingFile.size / 1024)} KB)
                </span>
                <button onClick={() => setPendingFile(null)} className="text-slate-500 hover:text-white shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="p-3 border-t border-slate-800 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFilePick}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-500 hover:text-white p-2"
                title="Attach a file"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendReply()}
                placeholder="Type a reply..."
                className="flex-1 bg-slate-800/60 border border-slate-700 rounded-md px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                onClick={sendReply}
                disabled={(!draft.trim() && !pendingFile) || !connected || sending}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md p-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
