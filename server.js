const os = require("os");
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { TelegramClient } = require("telegram");
const { CustomFile } = require("telegram/client/uploads");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");
const { Client: WhatsAppClient, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const QRCode = require("qrcode");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 10000;
const apiId = Number.parseInt(process.env.TELEGRAM_API_ID || "", 10);
const apiHash = process.env.TELEGRAM_API_HASH;
const sessionValue = process.env.TELEGRAM_SESSION;

const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

const fbPageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN || "";
const fbVerifyToken = process.env.FB_VERIFY_TOKEN || "";
const fbApiVersion = process.env.FB_GRAPH_API_VERSION || "v21.0";
const facebookReady = Boolean(fbPageAccessToken);


const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const supportedChannels = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  facebook: "Facebook",
};

let telegramClient = null;
let telegramReady = false;

let whatsappClient = null;
let whatsappReady = false;
let whatsappQrDataUrl = null;

function isAllowedOrigin(origin, host) {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function getSocketCorsOrigin(origin, callback) {
  callback(null, origin || true);
}

function getChannelStatus() {
  return {
    telegram: telegramReady,
    whatsapp: whatsappReady,
    facebook: facebookReady,
  };
}

function publishServerStatus() {
  io.emit("server-status", {
    telegramReady,
    channels: getChannelStatus(),
  });
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "Public")));

const io = new Server(server, {
  maxHttpBufferSize: 16 * 1024 * 1024,
  cors: {
    origin: getSocketCorsOrigin,
    methods: ["GET", "POST"],
  },
  allowRequest: (req, callback) => {
    callback(null, isAllowedOrigin(req.headers.origin, req.headers.host));
  },
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    telegramReady,
    whatsappReady,
    facebookReady,
    channels: getChannelStatus(),
    hasTelegramConfig: Boolean(apiId && apiHash && sessionValue),
  });
});

// --- Facebook Messenger (official Meta Messenger Platform) ------------------
// No login/password needed - this only talks to Meta's Graph API using a
// Page Access Token you generate once in developers.facebook.com after
// connecting your Facebook Page. See live-chat-server/.env.example.
const fbProfileCache = new Map();

async function getFacebookProfile(psid) {
  if (fbProfileCache.has(psid)) return fbProfileCache.get(psid);
  try {
    const url = `https://graph.facebook.com/${fbApiVersion}/${psid}?fields=first_name,last_name&access_token=${encodeURIComponent(fbPageAccessToken)}`;
    const res = await fetch(url);
    const data = await res.json();
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "Facebook User";
    fbProfileCache.set(psid, name);
    return name;
  } catch (error) {
    console.error("Could not fetch Facebook profile:", error);
    return "Facebook User";
  }
}

app.get("/webhook/facebook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token && fbVerifyToken && token === fbVerifyToken) {
    console.log("Facebook webhook verified.");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook/facebook", async (req, res) => {
  const body = req.body;
  if (body.object !== "page") {
    res.sendStatus(404);
    return;
  }

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      if (!senderId || !event.message || event.message.is_echo) continue;

      try {
        const name = await getFacebookProfile(senderId);
        const payload = {
          channel: "facebook",
          senderId,
          name,
          username: "",
          text: event.message.text || "[Media or attachment]",
          date: Math.floor((event.timestamp || Date.now()) / 1000),
        };
        io.emit("channel-message", payload);
      } catch (error) {
        console.error("Could not process Facebook message:", error);
      }
    }
  }

  res.status(200).send("EVENT_RECEIVED");
});

async function sendFacebookMessage(senderId, text) {
  const url = `https://graph.facebook.com/${fbApiVersion}/me/messages?access_token=${encodeURIComponent(fbPageAccessToken)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      messaging_type: "RESPONSE",
      message: { text },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Facebook send failed: ${errBody}`);
  }
}

function facebookAttachmentType(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "file";
}

async function sendFacebookAttachment(senderId, buffer, filename, mimeType) {
  const url = `https://graph.facebook.com/${fbApiVersion}/me/messages?access_token=${encodeURIComponent(fbPageAccessToken)}`;

  const form = new FormData();
  form.append("recipient", JSON.stringify({ id: senderId }));
  form.append("messaging_type", "RESPONSE");
  form.append(
    "message",
    JSON.stringify({
      attachment: { type: facebookAttachmentType(mimeType), payload: { is_reusable: false } },
    }),
  );
  form.append("filedata", new Blob([buffer], { type: mimeType || "application/octet-stream" }), filename);

  const res = await fetch(url, { method: "POST", body: form });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Facebook attachment send failed: ${errBody}`);
  }
}


function normalizeSenderName(sender) {
  const firstName = sender?.firstName || "";
  const lastName = sender?.lastName || "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || sender?.username || "Telegram User";
}

async function startTelegramClient() {
  if (!apiId || !apiHash || !sessionValue) {
    console.warn("Telegram env is missing. Set TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_SESSION to enable live chat.");
    publishServerStatus();
    return;
  }

  telegramClient = new TelegramClient(new StringSession(sessionValue), apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await telegramClient.connect();
    telegramReady = true;
    publishServerStatus();
    console.log("Telegram client connected.");
  } catch (error) {
    telegramReady = false;
    publishServerStatus();
    console.error("Telegram connection failed:", error);
    return;
  }

  telegramClient.addEventHandler(async (event) => {
    const message = event.message;
    if (!message?.isPrivate || message.out) return;

    try {
      const sender = await message.getSender();
      const payload = {
        channel: "telegram",
        senderId: message.senderId?.toString(),
        name: normalizeSenderName(sender),
        username: sender?.username || "",
        text: message.message || "[Media or attachment]",
        date: message.date || Math.floor(Date.now() / 1000),
      };

      io.emit("channel-message", payload);
    } catch (error) {
      console.error("Could not process Telegram message:", error);
    }
  }, new NewMessage({}));
}

// --- WhatsApp (QR login, whatsapp-web.js) -----------------------------------
// This drives your personal/business WhatsApp number by controlling a hidden
// browser session, the same way WhatsApp Web works. Scan the QR once; the
// session is cached in .wwebjs_auth/ so you won't need to rescan on restart.
// NOTE: this is an unofficial method (not the Meta Cloud API) - it can break
// if WhatsApp changes WhatsApp Web, and using it for business/bulk messaging
// risks the number getting rate-limited or banned. Use a number you're OK
// taking that risk with.
function resolveChromeExecutable() {
  const userProfile = process.env.USERPROFILE || process.env.HOME || __dirname;
  const candidatePaths = [
    process.env.CHROME_BIN,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.GOOGLE_CHROME_BIN,
    path.join(userProfile, ".cache", "puppeteer", "chrome", "chrome-win64", "chrome.exe"),
    path.join(userProfile, ".cache", "puppeteer", "chrome", "win64-146.0.7680.31", "chrome-win64", "chrome.exe"),
    path.join(userProfile, ".cache", "puppeteer", "chrome", "chrome-linux64", "chrome"),
    path.join(userProfile, ".cache", "puppeteer", "chrome", "linux-146.0.7680.31", "chrome-linux64", "chrome"),
    path.join(userProfile, ".cache", "puppeteer", "chrome-headless-shell", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
    path.join(userProfile, ".cache", "puppeteer", "chrome-headless-shell", "win64-146.0.7680.31", "chrome-headless-shell-win64", "chrome-headless-shell.exe"),
    path.join(userProfile, ".cache", "puppeteer", "chrome-headless-shell", "chrome-headless-shell-linux64", "chrome-headless-shell"),
    path.join(userProfile, ".cache", "puppeteer", "chrome-headless-shell", "linux-146.0.7680.31", "chrome-headless-shell-linux64", "chrome-headless-shell"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Google", "Chrome", "Application", "chrome.exe"),
    "/opt/render/.cache/puppeteer/chrome/linux-146.0.7680.31/chrome-linux64/chrome",
    "/opt/render/.cache/puppeteer/chrome-headless-shell/linux-146.0.7680.31/chrome-headless-shell-linux64/chrome-headless-shell",
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const puppeteerRoots = [
    path.join(userProfile, ".cache", "puppeteer"),
    process.env.PUPPETEER_CACHE_DIR,
    "/opt/render/.cache/puppeteer",
  ].filter(Boolean);

  const zipPaths = [];
  for (const root of puppeteerRoots) {
    zipPaths.push(
      path.join(root, "chrome", "146.0.7680.31-chrome-win64.zip"),
      path.join(root, "chrome", "146.0.7680.31-chrome-linux64.zip"),
      path.join(root, "chrome-headless-shell", "146.0.7680.31-chrome-headless-shell-win64.zip"),
      path.join(root, "chrome-headless-shell", "146.0.7680.31-chrome-headless-shell-linux64.zip"),
    );
  }

  for (const zipPath of zipPaths) {
    if (fs.existsSync(zipPath)) {
      try {
        console.warn("Chrome executable missing; extracting the cached browser archive...");
        const outputDir = path.dirname(zipPath);
        execFileSync(
          "powershell",
          [
            "-NoProfile",
            "-Command",
            `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${outputDir}' -Force`,
          ],
          { stdio: "inherit" },
        );
      } catch (error) {
        console.error("Could not extract Chrome archive:", error);
      }
      break;
    }
  }

  const fallbackCandidates = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (/chrome(?:-headless-shell)?(?:\.exe|)$/i.test(entry.name)) {
        if (entry.name === "chrome" || entry.name === "chrome-headless-shell") {
          fallbackCandidates.push(fullPath);
        }
      }
    }
  }
  for (const root of puppeteerRoots) {
    walk(root);
  }

  return fallbackCandidates[0] || null;
}

function startWhatsAppClient() {
  const executablePath = resolveChromeExecutable();
  const whatsappAuthDir = path.join(os.homedir(), ".customer-support-portal", ".wwebjs_auth");
  fs.mkdirSync(whatsappAuthDir, { recursive: true });

  whatsappClient = new WhatsAppClient({
    authStrategy: new LocalAuth({ dataPath: whatsappAuthDir }),
    puppeteer: {
      headless: true,
      executablePath: executablePath || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  whatsappClient.on("qr", async (qr) => {
    try {
      whatsappQrDataUrl = await QRCode.toDataURL(qr);
      io.emit("whatsapp-qr", whatsappQrDataUrl);
      console.log("WhatsApp QR code ready - open the Live Chat panel to scan it.");
    } catch (error) {
      console.error("Failed to render WhatsApp QR code:", error);
    }
  });

  whatsappClient.on("ready", () => {
    whatsappReady = true;
    whatsappQrDataUrl = null;
    publishServerStatus();
    io.emit("whatsapp-qr", null);
    console.log("WhatsApp client connected.");
  });

  whatsappClient.on("disconnected", (reason) => {
    whatsappReady = false;
    publishServerStatus();
    console.warn("WhatsApp client disconnected:", reason);
  });

  whatsappClient.on("auth_failure", (message) => {
    whatsappReady = false;
    publishServerStatus();
    console.error("WhatsApp auth failed:", message);
  });

  whatsappClient.on("message", async (message) => {
    if (message.fromMe || message.isStatus) return;

    try {
      const contact = await message.getContact();
      const payload = {
        channel: "whatsapp",
        senderId: message.from,
        name: contact?.pushname || contact?.name || contact?.number || message.from,
        username: contact?.number || "",
        text: message.body || "[Media or attachment]",
        date: message.timestamp || Math.floor(Date.now() / 1000),
      };

      io.emit("channel-message", payload);
    } catch (error) {
      console.error("Could not process WhatsApp message:", error);
    }
  });

  whatsappClient.initialize().catch((error) => {
    console.error("WhatsApp startup failed:", error);
  });
}

io.on("connection", (socket) => {
  console.log("Dashboard connected:", socket.id);
  socket.emit("server-status", {
    telegramReady,
    channels: getChannelStatus(),
  });
  if (whatsappQrDataUrl && !whatsappReady) {
    socket.emit("whatsapp-qr", whatsappQrDataUrl);
  }

  socket.on("send-reply", async (data = {}) => {
    const channel = String(data.channel || "telegram").trim().toLowerCase();
    const senderId = String(data.senderId || "").trim();
    const text = String(data.text || "").trim();
    const attachment = data.attachment && typeof data.attachment === "object" ? data.attachment : null;

    if (!supportedChannels[channel]) {
      socket.emit("reply-error", "Unknown channel selected.");
      return;
    }

    if (!senderId || (!text && !attachment)) {
      socket.emit("reply-error", "Select a user and type a message or attach a file first.");
      return;
    }

    if (attachment) {
      const attachmentSize = Number(attachment.size || 0);
      if (!attachment.name || !attachment.data || attachmentSize <= 0) {
        socket.emit("reply-error", "Selected attachment is not valid.");
        return;
      }

      if (attachmentSize > MAX_ATTACHMENT_BYTES) {
        socket.emit("reply-error", "Attachment is too large. Use a file under 10 MB.");
        return;
      }
    }

    if (channel === "facebook") {
      if (!facebookReady) {
        socket.emit("reply-error", "Facebook is not connected. Set FB_PAGE_ACCESS_TOKEN on the server.");
        return;
      }

      try {
        if (attachment) {
          const buffer = Buffer.from(String(attachment.data), "base64");
          await sendFacebookAttachment(senderId, buffer, String(attachment.name), String(attachment.type || ""));
          if (text) {
            await sendFacebookMessage(senderId, text);
          }
        } else {
          await sendFacebookMessage(senderId, text);
        }

        socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
        console.log(`Reply sent to ${senderId}`);
      } catch (error) {
        console.error("Reply failed:", error);
        socket.emit("reply-error", "Reply failed. Check the server logs.");
      }
      return;
    }

    if (channel === "telegram") {
      if (!telegramClient || !telegramReady) {
        socket.emit("reply-error", "Telegram client is not connected. Check Render environment variables.");
        return;
      }

      try {
        if (attachment) {
          const buffer = Buffer.from(String(attachment.data), "base64");
          const file = new CustomFile(String(attachment.name), buffer.length, "", buffer);
          await telegramClient.sendFile(senderId, {
            file,
            caption: text,
            forceDocument: !String(attachment.type || "").startsWith("image/"),
          });
        } else {
          await telegramClient.sendMessage(senderId, { message: text });
        }

        socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
        console.log(`Reply sent to ${senderId}`);
      } catch (error) {
        console.error("Reply failed:", error);
        socket.emit("reply-error", "Reply failed. Check the server logs.");
      }
      return;
    }

    if (channel === "whatsapp") {
      if (!whatsappClient || !whatsappReady) {
        socket.emit("reply-error", "WhatsApp is not connected. Scan the QR code in the Live Chat panel first.");
        return;
      }

      try {
        if (attachment) {
          const media = new MessageMedia(
            String(attachment.type || "application/octet-stream"),
            String(attachment.data),
            String(attachment.name),
          );
          await whatsappClient.sendMessage(senderId, media, { caption: text || undefined });
        } else {
          await whatsappClient.sendMessage(senderId, text);
        }

        socket.emit("reply-sent", { channel, senderId, text, attachment: attachment ? { name: attachment.name, type: attachment.type, size: attachment.size } : null });
        console.log(`Reply sent to ${senderId}`);
      } catch (error) {
        console.error("Reply failed:", error);
        socket.emit("reply-error", "Reply failed. Check the server logs.");
      }
      return;
    }
  });

  socket.on("disconnect", () => {
    console.log("Dashboard disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startTelegramClient().catch((error) => console.error("Telegram startup failed:", error));
  startWhatsAppClient();
});

