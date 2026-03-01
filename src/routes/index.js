import express from 'express';
import qrcode from 'qrcode';
import { getLatestQR } from '../whatsapp/qr.js';
import { getConversations } from '../conversations/store.js';

const router = express.Router();

router.get('/qr', async (_req, res) => {
  const latestQR = getLatestQR();
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

router.get('/state', (_req, res) => {
  const convs = getConversations();
  res.json({ total: Object.keys(convs).length, conversations: convs });
});

export default router;
