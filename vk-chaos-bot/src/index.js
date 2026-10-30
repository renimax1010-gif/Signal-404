'use strict';
require('dotenv').config();
const { VK } = require('vk-io');
const { isDirectAddress, chooseReply, chooseRandomInterjection } = require('./brain');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error('Не задана обязательная переменная окружения: ' + name);
  return value;
}
const token = required('VK_GROUP_TOKEN');
const groupId = Number(required('VK_GROUP_ID'));
if (!Number.isInteger(groupId) || groupId <= 0) throw new Error('VK_GROUP_ID должен быть положительным числом сообщества.');

const randomChance = Math.min(0.1, Math.max(0, Number(process.env.RANDOM_REPLY_CHANCE ?? 0.025)));
const globalCooldownMs = Math.max(30, Number(process.env.RANDOM_REPLY_COOLDOWN_SECONDS ?? 90)) * 1000;
const userCooldownMs = Math.max(60, Number(process.env.USER_COOLDOWN_SECONDS ?? 300)) * 1000;
const logText = process.env.LOG_MESSAGE_TEXT === 'true';
const vk = new VK({ token });
const lastRandomAtByUser = new Map();
let lastRandomAt = 0;

function log(event, details = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), event, ...details }));
}
function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

vk.updates.on('message_new', async (context) => {
  try {
    if (!context.isChat || context.isOutbox || context.isGroup) return;
    const message = cleanText(context.text);
    if (!message) return;
    const senderId = Number(context.senderId);
    const peerId = Number(context.peerId);
    if (!senderId || !peerId) return;

    const direct = isDirectAddress(message, groupId);
    const now = Date.now();
    const lastUserAt = lastRandomAtByUser.get(senderId) || 0;
    const randomReply = !direct &&
      now - lastRandomAt >= globalCooldownMs &&
      now - lastUserAt >= userCooldownMs &&
      Math.random() < randomChance;

    if (!direct && !randomReply) return;
    await context.send({
      message: direct ? chooseReply({ direct: true }) : chooseRandomInterjection(),
      reply_to: context.id
    });

    if (randomReply) {
      lastRandomAt = now;
      lastRandomAtByUser.set(senderId, now);
    }
    log(direct ? 'direct_reply_sent' : 'random_reply_sent', {
      peerId, senderId,
      ...(logText ? { message: message.slice(0, 300) } : {})
    });
  } catch (error) {
    log('message_handler_error', { message: error.message });
  }
});
vk.updates.on('error', (error) => log('vk_longpoll_error', { message: error.message }));

async function shutdown(signal) {
  log('shutdown', { signal });
  try { await vk.updates.stop(); } finally { process.exit(0); }
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

(async () => {
  log('starting', { groupId, randomChance, globalCooldownMs, userCooldownMs });
  await vk.updates.start();
  log('longpoll_started', { groupId });
})().catch((error) => {
  log('fatal_startup_error', { message: error.message });
  process.exit(1);
});
