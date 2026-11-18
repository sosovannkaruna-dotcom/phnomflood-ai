// Connects the PhnomFlood Telegram bot to the live site, once, after the bot exists.
//
//   1. In Telegram, talk to @BotFather: /newbot, pick a name; it gives you a token.
//   2. In Vercel (Project → Settings → Environment Variables), add:
//        TELEGRAM_BOT_TOKEN       the token from BotFather
//        TELEGRAM_WEBHOOK_SECRET  any long random string (letters, digits, _ and -)
//      and redeploy, so the function can read them.
//   3. Run, with the same two values (PowerShell: $env:NAME = '...'; bash: NAME=... node ...):
//        node scripts/telegram-setup.mjs
//
// It registers https://phnomflood-ai.vercel.app/api/telegram-webhook as the bot's webhook (with the
// secret, so only Telegram can call it), sets the bot's command list and description, and prints
// what Telegram reports back. Run it again any time; it only overwrites the same settings.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const URL = process.env.WEBHOOK_URL ?? 'https://phnomflood-ai.vercel.app/api/telegram-webhook'

if (!TOKEN || !SECRET) {
  console.error('Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET first (see the top of this file).')
  process.exit(1)
}
if (!/^[A-Za-z0-9_-]{16,256}$/.test(SECRET)) {
  console.error('TELEGRAM_WEBHOOK_SECRET must be 16-256 letters, digits, _ or -.')
  process.exit(1)
}

async function call(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) throw new Error(`${method}: ${json.description}`)
  return json.result
}

await call('setWebhook', { url: URL, secret_token: SECRET, allowed_updates: ['message'], drop_pending_updates: true })
await call('setMyCommands', { commands: [{ command: 'start', description: 'How to report a flooded street' }] })
await call('setMyDescription', { description: 'Report a flooded Phnom Penh street: share your location, then reply with a photo. A photo check reads the depth and the report goes on the PhnomFlood live map.' })
const info = await call('getWebhookInfo', {})
console.log(`Webhook: ${info.url}`)
console.log(`Pending updates: ${info.pending_update_count}${info.last_error_message ? `; last error: ${info.last_error_message}` : ''}`)
console.log('Done. Open your bot in Telegram and send /start.')
