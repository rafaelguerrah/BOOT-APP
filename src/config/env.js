import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PORT = process.env.PORT || 3000;
export const AUTH_DIR = path.resolve(process.cwd(), './auth_info_baileys');
export const MENU_FILE = path.resolve(process.cwd(), './menu.json');
export const CONV_FILE = path.resolve(process.cwd(), './conversations.json');
