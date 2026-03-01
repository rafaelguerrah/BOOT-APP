import fs from 'fs';
import { MENU_FILE } from '../config/env.js';

let menu = null;

export function loadMenu() {
  if (!menu) {
    if (!fs.existsSync(MENU_FILE)) {
      console.error('❌ menu.json não encontrado. Crie na raiz do projeto.');
      process.exit(1);
    }
    menu = JSON.parse(fs.readFileSync(MENU_FILE, 'utf-8'));
  }
  return menu;
}
