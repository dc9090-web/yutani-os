import { writeFile } from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";

const SPEC = "https://esi.evetech.net/meta/openapi.json";
const OUT = new URL("../src/lib/esi/types.gen.ts", import.meta.url);

const ast = await openapiTS(new URL(SPEC));
await writeFile(OUT, `// Generated from ${SPEC} by scripts/esi-types.ts — do not edit.\n` + astToString(ast));
console.log("wrote", OUT.pathname);
