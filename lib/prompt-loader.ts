import fs from 'fs';
import path from 'path';

export function getSystemPrompt(): string {
  const filePath = path.join(process.cwd(), process.env.DEV_TEST_PROMPT_FILE_PATH || './lib/.prompt.env.txt');
  return fs.readFileSync(filePath, 'utf8');
}