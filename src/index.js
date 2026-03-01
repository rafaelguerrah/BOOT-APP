import express from 'express';
import cors from 'cors';

import { PORT } from './config/env.js';
import { loadMenu } from './menu/loader.js';
import routes from './routes/index.js';
import { startSock } from './whatsapp/socket.js';

// make sure menu is loaded (fails fast if missing)
loadMenu();

const app = express();
app.use(cors());
app.use(express.json());
app.use('/', routes);

app.get('/', (_req, res) => res.send('✅ WhatsApp Bot rodando'));

// -- Start ---------------------------------------------------------------------
(async () => {
  app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
  await startSock();
})();
