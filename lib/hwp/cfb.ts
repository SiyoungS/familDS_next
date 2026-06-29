/**
 * 최소 기능의 OLE2 복합 문서(Compound File Binary, CFB) 리더.
 * HWP 5.x 파일은 CFB 컨테이너 안에 FileHeader / BodyText/SectionN 등의
 * 스트림을 담고 있어, 텍스트 추출을 위해 스트림 단위로 읽을 수 있어야 한다.
 *
 * 외부 의존성 없이 HWP 파싱에 필요한 범위만 구현한다.
 */

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;
const NOSTREAM = 0xffffffff;

interface DirEntry {
  name: string;
  type: number; // 1=storage, 2=stream, 5=root
  leftSibling: number;
  rightSibling: number;
  child: number;
  startSector: number;
  size: number;
}

export class CompoundFile {
  private buf: Buffer;
  private sectorSize: number;
  private miniSectorSize: number;
  private miniCutoff: number;
  private fat: number[] = [];
  private miniFat: number[] = [];
  private entries: DirEntry[] = [];
  private streams: Map<string, DirEntry> = new Map();
  private miniStream: Buffer = Buffer.alloc(0);

  constructor(buf: Buffer) {
    this.buf = buf;
    if (
      buf.length < 512 ||
      buf.readUInt32LE(0) !== 0xe011cfd0 ||
      buf.readUInt32LE(4) !== 0xe11ab1a1
    ) {
      throw new Error('OLE 복합 문서 형식이 아닙니다.');
    }

    const sectorShift = buf.readUInt16LE(30);
    const miniSectorShift = buf.readUInt16LE(32);
    this.sectorSize = 1 << sectorShift;
    this.miniSectorSize = 1 << miniSectorShift;
    this.miniCutoff = buf.readUInt32LE(56);

    const numFatSectors = buf.readUInt32LE(44);
    const firstDirSector = buf.readUInt32LE(48);
    const firstMiniFatSector = buf.readUInt32LE(60);
    const numMiniFatSectors = buf.readUInt32LE(64);
    const firstDifatSector = buf.readUInt32LE(68);
    const numDifatSectors = buf.readUInt32LE(72);

    this.buildFat(numFatSectors, firstDifatSector, numDifatSectors);
    this.miniFat = this.readFatChainAsTable(firstMiniFatSector, numMiniFatSectors);
    this.readDirectory(firstDirSector);
    this.buildMiniStream();
    this.buildStreamMap();
  }

  /** 일반 섹터의 파일 내 바이트 오프셋 */
  private sectorOffset(sector: number): number {
    return (sector + 1) * this.sectorSize;
  }

  private readSector(sector: number): Buffer {
    const off = this.sectorOffset(sector);
    return this.buf.subarray(off, off + this.sectorSize);
  }

  /** DIFAT을 모아 FAT 테이블을 구성한다. */
  private buildFat(numFatSectors: number, firstDifatSector: number, numDifatSectors: number) {
    const fatSectors: number[] = [];

    // 헤더 내 DIFAT (109개)
    for (let i = 0; i < 109; i++) {
      const sec = this.buf.readUInt32LE(76 + i * 4);
      if (sec === FREESECT) continue;
      fatSectors.push(sec);
    }

    // 추가 DIFAT 섹터 체인
    let difatSector = firstDifatSector;
    const entriesPerSector = this.sectorSize / 4;
    for (let n = 0; n < numDifatSectors && difatSector !== ENDOFCHAIN && difatSector !== FREESECT; n++) {
      const sec = this.readSector(difatSector);
      for (let i = 0; i < entriesPerSector - 1; i++) {
        const v = sec.readUInt32LE(i * 4);
        if (v !== FREESECT) fatSectors.push(v);
      }
      difatSector = sec.readUInt32LE((entriesPerSector - 1) * 4);
    }

    // FAT 섹터들을 읽어 단일 테이블로 연결
    const fat: number[] = [];
    for (let i = 0; i < numFatSectors && i < fatSectors.length; i++) {
      const sec = this.readSector(fatSectors[i]);
      for (let j = 0; j < entriesPerSector; j++) {
        fat.push(sec.readUInt32LE(j * 4));
      }
    }
    this.fat = fat;
  }

  /** start 섹터부터 FAT 체인을 따라 데이터를 모은다. */
  private readChain(start: number): Buffer {
    const parts: Buffer[] = [];
    let sector = start;
    let guard = 0;
    while (sector !== ENDOFCHAIN && sector !== FREESECT && sector < this.fat.length) {
      parts.push(this.readSector(sector));
      sector = this.fat[sector];
      if (++guard > this.fat.length + 1) break; // 순환 방지
    }
    return Buffer.concat(parts);
  }

  /** miniFAT 섹터 체인을 읽어 테이블로 반환 */
  private readFatChainAsTable(firstSector: number, count: number): number[] {
    if (count === 0 || firstSector === ENDOFCHAIN) return [];
    const data = this.readChain(firstSector);
    const table: number[] = [];
    for (let i = 0; i + 4 <= data.length; i += 4) {
      table.push(data.readUInt32LE(i));
    }
    return table;
  }

  private readDirectory(firstDirSector: number) {
    const dir = this.readChain(firstDirSector);
    const count = Math.floor(dir.length / 128);
    for (let i = 0; i < count; i++) {
      const base = i * 128;
      const nameLen = dir.readUInt16LE(base + 64);
      let name = '';
      if (nameLen > 2) {
        name = dir.toString('utf16le', base, base + nameLen - 2);
      }
      this.entries.push({
        name,
        type: dir.readUInt8(base + 66),
        leftSibling: dir.readUInt32LE(base + 68),
        rightSibling: dir.readUInt32LE(base + 72),
        child: dir.readUInt32LE(base + 76),
        startSector: dir.readUInt32LE(base + 116),
        size: dir.readUInt32LE(base + 120),
      });
    }
  }

  private buildMiniStream() {
    const root = this.entries[0];
    if (root && root.type === 5 && root.size > 0) {
      this.miniStream = this.readChain(root.startSector).subarray(0, root.size);
    }
  }

  /** 디렉터리 트리를 순회하며 "Storage/Stream" 경로 → 엔트리 맵 구성 */
  private buildStreamMap() {
    const root = this.entries[0];
    if (!root) return;
    const visit = (id: number, prefix: string) => {
      if (id === NOSTREAM || id >= this.entries.length) return;
      const e = this.entries[id];
      visit(e.leftSibling, prefix);
      const path = prefix + e.name;
      if (e.type === 2) {
        this.streams.set(path, e);
      } else if (e.type === 1) {
        visit(e.child, path + '/');
      }
      visit(e.rightSibling, prefix);
    };
    visit(root.child, '');
  }

  /** 미니 스트림에서 start 미니섹터부터 체인을 따라 읽는다. */
  private readMiniChain(start: number, size: number): Buffer {
    const parts: Buffer[] = [];
    let sector = start;
    let guard = 0;
    while (sector !== ENDOFCHAIN && sector !== FREESECT && sector < this.miniFat.length) {
      const off = sector * this.miniSectorSize;
      parts.push(this.miniStream.subarray(off, off + this.miniSectorSize));
      sector = this.miniFat[sector];
      if (++guard > this.miniFat.length + 1) break;
    }
    return Buffer.concat(parts).subarray(0, size);
  }

  /** 스트림 경로로 데이터를 읽는다. (예: "FileHeader", "BodyText/Section0") */
  getStream(path: string): Buffer | null {
    const e = this.streams.get(path);
    if (!e) return null;
    if (e.size < this.miniCutoff) {
      return this.readMiniChain(e.startSector, e.size);
    }
    return this.readChain(e.startSector).subarray(0, e.size);
  }

  listStreams(): string[] {
    return Array.from(this.streams.keys());
  }
}
