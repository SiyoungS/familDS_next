/**
 * HWP 5.x(.hwp) 파일에서 본문 텍스트만 추출한다.
 *
 * 구조: CFB 컨테이너 → BodyText/SectionN 스트림(필요 시 raw-deflate 압축) →
 *       레코드 스트림 → HWPTAG_PARA_TEXT(67) 레코드의 UTF-16LE 텍스트.
 *
 * 배포용 문서(DRM)인 경우 본문은 BodyText 대신 ViewText 저장소에
 * AES-128-ECB로 암호화되어 있어, 복호화 후 동일하게 파싱한다.
 *
 * 표/그림 등 개체 제어문자는 건너뛰고 순수 텍스트만 모은다.
 */

import zlib from 'zlib';
import crypto from 'crypto';
import { CompoundFile } from './cfb';

const HWPTAG_BEGIN = 0x10;
const HWPTAG_PARA_TEXT = HWPTAG_BEGIN + 51; // 67

// 1워드(2바이트)만 차지하는 제어 문자
const CHAR_CONTROLS = new Set([0, 10, 13, 24, 25, 26, 27, 28, 29, 30, 31]);

function sectionNumber(path: string): number {
  const m = path.match(/Section(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

/** PARA_TEXT 레코드 데이터(UTF-16LE + 제어문자)를 평문으로 변환 */
function decodeParaText(data: Buffer): string {
  let text = '';
  let i = 0;
  while (i + 1 < data.length) {
    const code = data.readUInt16LE(i);
    if (code < 32) {
      if (code === 10 || code === 13) text += '\n';
      // char control: 2바이트, 그 외(inline/extended control): 16바이트
      i += CHAR_CONTROLS.has(code) ? 2 : 16;
    } else {
      text += String.fromCharCode(code);
      i += 2;
    }
  }
  return text;
}

/** 압축 해제된 섹션 스트림에서 레코드를 순회하며 문단 텍스트를 모은다. */
function parseSection(data: Buffer): string {
  const paragraphs: string[] = [];
  let pos = 0;
  while (pos + 4 <= data.length) {
    const header = data.readUInt32LE(pos);
    pos += 4;
    const tagId = header & 0x3ff;
    let size = (header >> 20) & 0xfff;
    if (size === 0xfff) {
      if (pos + 4 > data.length) break;
      size = data.readUInt32LE(pos);
      pos += 4;
    }
    const body = data.subarray(pos, pos + size);
    pos += size;

    if (tagId === HWPTAG_PARA_TEXT) {
      paragraphs.push(decodeParaText(body));
    }
  }
  return paragraphs.join('\n');
}

/**
 * 배포용 문서의 ViewText 섹션을 복호화한다.
 *
 * 섹션 선두에는 HWPTAG_DISTRIBUTE_DOC_DATA(256바이트) 레코드가 있고,
 * 그 안에서 MS C 런타임 rand() 방식의 의사난수로 AES-128 키를 복원한다.
 * 나머지 데이터는 AES-128-ECB로 암호화되어 있다.
 */
function decryptViewTextSection(data: Buffer): Buffer {
  if (data.length < 4 + 256) {
    throw new Error('배포용 문서 헤더가 손상되었습니다.');
  }
  const header = data.readUInt32LE(0);
  const size = (header >> 20) & 0xfff;
  if (size < 256) {
    throw new Error('배포용 문서 헤더 크기가 올바르지 않습니다.');
  }

  const payload = Buffer.from(data.subarray(4, 4 + 256));
  let seed = payload.readUInt32LE(0);
  let n = 0;
  let xor = 0;
  for (let i = 0; i < 256; i++) {
    if (n === 0) {
      seed = (Math.imul(seed, 214013) + 2531011) >>> 0;
      xor = (seed >>> 16) & 0xff;
      seed = (Math.imul(seed, 214013) + 2531011) >>> 0;
      n = ((seed >>> 16) & 0x0f) + 1;
    }
    if (i >= 4) payload[i] ^= xor;
    n--;
  }
  const offset = 4 + (payload[0] & 0x0f);
  const key = payload.subarray(offset, offset + 16);

  let encrypted = data.subarray(4 + 256);
  // AES-ECB 블록 크기(16바이트) 배수만 처리
  encrypted = encrypted.subarray(0, encrypted.length - (encrypted.length % 16));

  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
  decipher.setAutoPadding(false);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

export function extractHwpText(buf: Buffer): string {
  // HWPX(.hwpx)는 ZIP 기반 XML 포맷이라 다른 처리가 필요하다.
  if (buf.length >= 2 && buf[0] === 0x50 && buf[1] === 0x4b) {
    throw new Error('HWPX(ZIP 기반) 파일은 지원하지 않습니다. HWP 5.x(.hwp) 파일을 올려주세요.');
  }

  const cfb = new CompoundFile(buf);

  const fileHeader = cfb.getStream('FileHeader');
  if (!fileHeader || fileHeader.length < 40) {
    throw new Error('유효한 HWP 5.x 파일이 아닙니다. (FileHeader 없음)');
  }
  const signature = fileHeader.toString('latin1', 0, 17);
  if (!signature.startsWith('HWP Document File')) {
    throw new Error('유효한 HWP 5.x 파일이 아닙니다. (시그니처 불일치)');
  }
  const props = fileHeader.readUInt32LE(36);
  const isCompressed = (props & 0x01) !== 0;
  const hasPassword = (props & 0x02) !== 0;
  const isDistribution = (props & 0x04) !== 0;
  if (hasPassword) {
    throw new Error('암호가 걸린 HWP 파일은 처리할 수 없습니다.');
  }

  // 배포용 문서는 본문이 ViewText에 암호화되어 있다.
  const storage = isDistribution ? 'ViewText' : 'BodyText';
  const sectionRe = new RegExp(`^${storage}/Section\\d+$`);
  const sections = cfb
    .listStreams()
    .filter((p) => sectionRe.test(p))
    .sort((a, b) => sectionNumber(a) - sectionNumber(b));

  if (sections.length === 0) {
    throw new Error(`본문(${storage}) 섹션을 찾을 수 없습니다.`);
  }

  const out: string[] = [];
  for (const path of sections) {
    let data = cfb.getStream(path);
    if (!data) continue;
    if (isDistribution) {
      data = decryptViewTextSection(data);
    }
    if (isCompressed) {
      data = zlib.inflateRawSync(data);
    }
    out.push(parseSection(data));
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
