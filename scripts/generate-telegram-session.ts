import { existsSync } from "node:fs";
import path from "node:path";
import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import input from "input";
import dotenv from "dotenv";

const rootEnv = path.resolve(process.cwd(), ".env.local");
const parentEnv = path.resolve(process.cwd(), "..", ".env.local");
dotenv.config({ path: existsSync(rootEnv) ? rootEnv : parentEnv });

async function main() {
  const apiId = Number.parseInt(process.env.TELEGRAM_API_ID || "", 10);
  const apiHash = process.env.TELEGRAM_API_HASH || "";

  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH must be set in .env.local");
  }

  const client = new TelegramClient(
    new StringSession(""),
    apiId,
    apiHash,
    { connectionRetries: 5 },
  );

  console.log("Telegram session setup. Keep this terminal private.");

  await client.start({
    phoneNumber: async () => input.text("Phone number (with country code): "),
    password: async () => input.text("2FA password (leave blank if disabled): "),
    phoneCode: async () => input.text("Telegram login code: "),
    onError: (error) => console.error("Telegram login error:", error),
  });

  console.log("\nYour new TELEGRAM_SESSION is below. Copy it to Render Environment Variables:");
  console.log(client.session.save());

  await client.disconnect();
}

main().catch((error) => {
  console.error("Could not generate Telegram session:", error);
  process.exitCode = 1;
});