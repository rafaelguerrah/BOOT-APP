import qrcode from 'qrcode';
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import { AUTH_DIR } from '../config/env.js';
import { setLatestQR } from './qr.js';
import { handleMessage } from '../menu/handler.js';

export async function startSock() {
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
      setLatestQR(qr);
      console.log(`📱 QR gerado! Acesse: http://localhost:${process.env.PORT || 3000}/qr`);
      qrcode.toString(qr, { type: 'terminal', small: true }, (err, str) => {
        if (!err) console.log(str);
      });
    }

    if (connection === 'open') {
      console.log('✅ Conectado ao WhatsApp!');
      setLatestQR(null);
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
