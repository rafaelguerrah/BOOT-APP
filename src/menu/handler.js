import { loadMenu } from './loader.js';
import {
  getConversations,
  setConversation,
  resetConversation,
  saveConversations
} from '../conversations/store.js';

// helpers
async function typing(sock, jid, ms = 5000) {
  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(resolve => setTimeout(resolve, ms));
  await sock.sendPresenceUpdate('paused', jid);
}

async function sendWithTyping(sock, jid, text, ms = 5000) {
  await typing(sock, jid, ms);
  await sock.sendMessage(jid, { text });
}

const resetWords = ['menu', 'inicio', 'início', 'oi', 'olá', 'ola', 'hey', 'sair', 'voltar'];

export async function handleMessage(jid, text, sock) {
  const menu = loadMenu();
  let conversations = getConversations();

  if (!conversations[jid]) {
    setConversation(jid, { state: 'main' });
    conversations = getConversations();
  }
  const user = conversations[jid];

  if (resetWords.includes(text.toLowerCase())) {
    resetConversation(jid);
    return sendMenu(jid, sock);
  }

  if (user.state === 'main') {
    if (/^\d+$/.test(text) && menu.options?.[text]) {
      await processOption(jid, text, sock);
      return;
    }
    await sendMenu(jid, sock);
    user.state = 'awaiting_choice';
    saveConversations();
    return;
  }

  if (user.state === 'awaiting_choice') {
    if (/^\d+$/.test(text)) {
      await processOption(jid, text, sock);
    } else {
      await sendWithTyping(sock, jid, '⚠️ Por favor, digite apenas o *número* da opção desejada.', 2000);
    }
  }
}

export async function sendMenu(jid, sock) {
  const menu = loadMenu();
  const greet   = menu.greeting || 'Olá! Como posso ajudar?';
  const options = Object.entries(menu.options || {})
    .map(([k, v]) => `*${k}.* ${v.text}`)
    .join('\n');
  const body = `${greet}\n\n${options}\n\n_Digite o número da opção desejada._`;
  await sendWithTyping(sock, jid, body, 5000);
}

export async function processOption(jid, option, sock) {
  const menu = loadMenu();
  const opt = menu.options?.[option];

  if (!opt) {
    await sendWithTyping(sock, jid, '❌ Opção inválida. Por favor, tente novamente.', 2000);
    return;
  }

  await sendWithTyping(sock, jid, opt.reply || 'Ok!', 5000);

  setConversation(jid, { state: opt.next || 'main' });

  if (!opt.next || opt.next === 'main') {
    setTimeout(() => sendMenu(jid, sock), 2000);
  }
}
