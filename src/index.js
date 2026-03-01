import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import qrcode from 'qrcode';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

dotenv.config();

// ── Config ────────────────────────────────────────────────────────────────────
const PORT      = process.env.PORT || 3000;
const AUTH_DIR  = path.resolve(process.cwd(), './auth_info_baileys');
const MENU_FILE = path.resolve(process.cwd(), './menu.json');
const CONV_FILE = path.resolve(process.cwd(), './conversations.json');

// ── Menu ──────────────────────────────────────────────────────────────────────
if (!fs.existsSync(MENU_FILE)) {
  console.error('❌ menu.json não encontrado. Crie na raiz do projeto.');
  process.exit(1);
}
const menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf-8'));

// ── Conversas ─────────────────────────────────────────────────────────────────
let conversations = {};
if (fs.existsSync(CONV_FILE)) {
  try { conversations = JSON.parse(fs.readFileSync(CONV_FILE, 'utf-8')); }
  catch { conversations = {}; }
}
function saveConversations() {
  fs.writeFileSync(CONV_FILE, JSON.stringify(conversations, null, 2));
}

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

let latestQR = null;

app.get('/', (_req, res) => res.send('✅ WhatsApp Bot rodando'));

app.get('/qr', async (_req, res) => {
  if (!latestQR) return res.status(404).send('QR não disponível ainda. Aguarde...');
  try {
    const dataUrl = await qrcode.toDataURL(latestQR);
    res.send(`
      <html>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;flex-direction:column;gap:16px">
          <p style="color:#fff;font-family:sans-serif;font-size:18px">📱 Escaneie o QR Code com seu WhatsApp</p>
          <img src="${dataUrl}" style="width:300px;height:300px" alt="QR Code"/>
          <p style="color:#aaa;font-family:sans-serif;font-size:13px">Atualize a página se o QR expirar</p>
        </body>
      </html>
    `);
  } catch {
    res.status(500).send('Erro ao gerar QR');
  }
});

app.get('/state', (_req, res) => res.json({ total: Object.keys(conversations).length, conversations }));

// ── Helper: digitando... ──────────────────────────────────────────────────────
async function typing(sock, jid, ms = 5000) {
  await sock.sendPresenceUpdate('composing', jid);
  await new Promise(resolve => setTimeout(resolve, ms));
  await sock.sendPresenceUpdate('paused', jid);
}

// ── Helper: enviar com digitando ──────────────────────────────────────────────
async function sendWithTyping(sock, jid, text, ms = 5000) {
  await typing(sock, jid, ms);
  await sock.sendMessage(jid, { text });
}

// ── Baileys ───────────────────────────────────────────────────────────────────
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log('⏳ Iniciando conexão... versão WA:', version);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['RafaelDevs Bot', 'Chrome', '20.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      latestQR = qr;
      console.log(`📱 QR gerado! Acesse: http://localhost:${PORT}/qr`);
      qrcode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
        if (!err) console.log(str);
      });
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      latestQR = null;
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.log(`❌ Conexão fechada. Código: ${code}`);
      if (loggedOut) {
        console.log('🔒 Sessão encerrada. Delete a pasta auth_info_baileys/ e reinicie.');
      } else {
        console.log('🔄 Reconectando em 5s...');
        setTimeout(() => startSock(), 5000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key?.fromMe) continue;
      const jid  = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) continue; // ignora grupos
      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();
      if (!text) continue;
      console.log(`📩 [${jid}]: ${text}`);
      await handleMessage(jid, text, sock);
    }
  });
}

// ── Lógica de menu ────────────────────────────────────────────────────────────
async function handleMessage(jid, text, sock) {
  if (!conversations[jid]) conversations[jid] = { state: 'main' };
  const user = conversations[jid];

  const resetWords = ['menu', 'inicio', 'início', 'oi', 'olá', 'ola', 'hey', 'sair', 'voltar'];
  if (resetWords.includes(text.toLowerCase())) {
    user.state = 'main';
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

async function sendMenu(jid, sock) {
  const greet   = menu.greeting || 'Olá! Como posso ajudar?';
  const options = Object.entries(menu.options || {})
    .map(([k, v]) => `*${k}.* ${v.text}`)
    .join('\n');
  const body = `${greet}\n\n${options}\n\n_Digite o número da opção desejada._`;
  await sendWithTyping(sock, jid, body, 5000);
}

async function processOption(jid, option, sock) {
  const opt = menu.options?.[option];

  if (!opt) {
    await sendWithTyping(sock, jid, '❌ Opção inválida. Por favor, tente novamente.', 2000);
    return;
  }

  await sendWithTyping(sock, jid, opt.reply || 'Ok!', 5000);

  conversations[jid].state = opt.next || 'main';
  saveConversations();

  if (!opt.next || opt.next === 'main') {
    setTimeout(() => sendMenu(jid, sock), 2000);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
(async () => {
  app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  await startSock();
})();