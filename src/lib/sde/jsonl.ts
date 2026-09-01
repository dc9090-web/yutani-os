import { openPromise, type Entry, type ZipFile } from "yauzl";
import { createInterface } from "node:readline";

/**
 * Streams one member of a zip as parsed JSON records, one per line.
 *
 * `lazyEntries` means yauzl only reads the central directory entries we ask for, and
 * `openReadStreamPromise` inflates the member on demand — a 153 MB `types.jsonl` costs ~7 MB of
 * heap. Blank lines are skipped (the SDE ends every file with a newline).
 * Throws if the member does not exist, so a truncated archive fails before any data is swapped.
 */
export async function* readJsonlMember(zipPath: string, memberName: string): AsyncGenerator<Record<string, unknown>> {
  const zip = await openPromise(zipPath, { lazyEntries: true, autoClose: false });
  try {
    const entry = await findEntry(zip, memberName, zipPath);
    const stream = await zip.openReadStreamPromise(entry);
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (line.trim() === "") continue;
        yield JSON.parse(line) as Record<string, unknown>;
      }
    } finally {
      lines.close();
      stream.destroy();
    }
  } finally {
    zip.close();
  }
}

function findEntry(zip: ZipFile, memberName: string, zipPath: string): Promise<Entry> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      zip.removeListener("entry", onEntry);
      zip.removeListener("end", onEnd);
      zip.removeListener("error", onError);
    };
    const onEntry = (entry: Entry): void => {
      if (entry.fileName === memberName) { cleanup(); resolve(entry); } else { zip.readEntry(); }
    };
    const onEnd = (): void => { cleanup(); reject(new Error(`zip member not found: ${memberName} in ${zipPath}`)); };
    const onError = (err: Error): void => { cleanup(); reject(err); };
    zip.on("entry", onEntry);
    zip.on("end", onEnd);
    zip.on("error", onError);
    zip.readEntry();
  });
}
