import fs from 'fs';
import { CONV_FILE } from '../config/env.js';

let conversations = {};
if (fs.existsSync(CONV_FILE)) {
  try { conversations = JSON.parse(fs.readFileSync(CONV_FILE, 'utf-8')); }
  catch { conversations = {}; }
}

export function getConversations() {
  return conversations;
}

export function saveConversations() {
  fs.writeFileSync(CONV_FILE, JSON.stringify(conversations, null, 2));
}

export function getConversation(jid) {
  return conversations[jid];
}

export function setConversation(jid, data) {
  conversations[jid] = data;
  saveConversations();
}

export function resetConversation(jid) {
  conversations[jid] = { state: 'main' };
  saveConversations();
}
