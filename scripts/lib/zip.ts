import { deflateRawSync } from "node:zlib";
import { writeFile } from "node:fs/promises";

export interface ZipMember { name: string; content: string }

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Writes a minimal PKZIP archive (one deflated entry per member, no zip64, no data descriptors).
 * yauzl reads it. We hand-roll it because yauzl is read-only and no zip *writer* dependency is
 * allowed; `deflateRawSync` produces exactly the raw deflate stream compression method 8 wants.
 * Every member is buffered in memory (content, deflated bytes and both headers) before anything is
 * written — fine for small test fixtures, not for anything approaching real SDE archive sizes.
 */
export async function writeZip(destPath: string, members: ZipMember[]): Promise<void> {
  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const member of members) {
    const name = Buffer.from(member.name, "utf8");
    const raw = Buffer.from(member.content, "utf8");
    const deflated = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);   // local file header signature
    header.writeUInt16LE(20, 4);           // version needed to extract (2.0)
    header.writeUInt16LE(0x0800, 6);       // general purpose flag: UTF-8 names
    header.writeUInt16LE(8, 8);            // compression method: deflate
    header.writeUInt16LE(0, 10);           // mod time
    header.writeUInt16LE(0, 12);           // mod date
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(deflated.length, 18);
    header.writeUInt32LE(raw.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);           // extra field length
    local.push(header, name, deflated);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);      // central directory signature
    dir.writeUInt16LE(20, 4);              // version made by
    dir.writeUInt16LE(20, 6);              // version needed
    dir.writeUInt16LE(0x0800, 8);          // general purpose flag
    dir.writeUInt16LE(8, 10);              // compression method
    dir.writeUInt16LE(0, 12);              // mod time
    dir.writeUInt16LE(0, 14);              // mod date
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(deflated.length, 20);
    dir.writeUInt32LE(raw.length, 24);
    dir.writeUInt16LE(name.length, 28);
    dir.writeUInt32LE(offset, 42);         // relative offset of local header
    central.push(dir, name);

    offset += header.length + name.length + deflated.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);        // end of central directory signature
  end.writeUInt16LE(members.length, 8);
  end.writeUInt16LE(members.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  await writeFile(destPath, Buffer.concat([...local, centralBuf, end]));
}
