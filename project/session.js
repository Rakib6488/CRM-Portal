const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");

async function readRequiredEnvOrPrompt(envName, promptText) {
  if (process.env[envName]) return process.env[envName];
  return input.text(promptText);
}

(async () => {
  const apiIdText = await readRequiredEnvOrPrompt("TELEGRAM_API_ID", "Telegram API ID: ");
  const apiHash = await readRequiredEnvOrPrompt("TELEGRAM_API_HASH", "Telegram API Hash: ");
  const apiId = Number.parseInt(apiIdText, 10);

  if (!apiId || !apiHash) {
    throw new Error("TELEGRAM_API_ID and TELEGRAM_API_HASH are required.");
  }

  const client = new TelegramClient(new StringSession(""), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => input.text("Telegram phone number, for example +88017XXXXXXXX: "),
    password: async () => input.text("Two-step password, if enabled. Otherwise press Enter: "),
    phoneCode: async () => input.text("Telegram login code: "),
    onError: (error) => console.error(error),
  });

  console.log("Login successful. Save this value as TELEGRAM_SESSION in Render:");
  console.log(client.session.save());
  await client.disconnect();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
