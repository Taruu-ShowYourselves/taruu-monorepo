#!/usr/bin/env node

import { parseArgs } from './lib.mjs';
import { sendTelegramMessage } from './telegram.mjs';

const args = parseArgs(process.argv.slice(2));
const text = args.text;

if (!text) {
  process.stderr.write('Usage: notify-telegram.mjs --text <message>\n');
  process.exit(2);
}

const result = await sendTelegramMessage({
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  text,
});

if (result.skipped) {
  throw new Error('Telegram owner notification is not configured.');
}

process.stdout.write('Telegram owner notification sent.\n');
