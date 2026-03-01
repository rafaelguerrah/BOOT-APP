# WhatsApp Baileys Bot

Instruções rápidas para rodar o bot localmente.

Passos:

1. Copie `.env.example` para `.env` e ajuste `PORT` se desejar.
2. Instale dependências:

```bash
npm install
```

3. Inicie o bot:

```bash
npm start
```

4. Ao iniciar, o QR será exibido no terminal. Você também pode acessar `http://localhost:PORT/qr` para ver o QR em formato de imagem (substitua `PORT`).

Arquivos importantes:

- `menu.json`: define saudação, opções numeradas e respostas.
- `auth_info.json`: gerado automaticamente e contém credenciais (não comitar).
- `conversations.json`: estado simples por usuário.

Como funciona:

- Ao receber uma mensagem, se o usuário não estiver em um fluxo, o bot envia a saudação + menu.
- O usuário responde com o número da opção e o bot envia a resposta correspondente.
- A sessão de autenticação é persistida para evitar novo pareamento.
