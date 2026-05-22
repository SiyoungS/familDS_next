import fs from 'fs';
import path from 'path';

export function getSystemPrompt_old(): string {
  const filePath = path.join(process.cwd(), process.env.DEV_TEST_PROMPT_FILE_PATH || './lib/.prompt.env_backup.txt');
  return fs.readFileSync(filePath, 'utf8');
}

export function getSystemPrompt_bowen(): string {
  const filePath = path.join(process.cwd(), process.env.DEV_TEST_PROMPT_FILE_PATH || './lib/.prompt.env_2.txt');
  return fs.readFileSync(filePath, 'utf8');
}