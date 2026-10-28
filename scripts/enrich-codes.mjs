/**
 * Enrichment script — looks up all ICD codes from realData.json via the MCP server
 * and writes a codeDescriptions.ts map with official ICD-10-CM descriptions.
 *
 * Usage: node scripts/enrich-codes.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, '..', 'src', 'data', 'realData.json');
const outPath = join(__dirname, '..', 'src', 'data', 'codeDescriptions.ts');

const MCP_URL = 'https://mcp.deepsense.ai/icd10_codes/mcp';

async function callMcp(method, params) {
  const body = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: 'lookup_code',
      arguments: params,
    },
  };
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  // MCP response contains result.content[0].text (JSON string)
  if (json.result && json.result.content) {
    for (const c of json.result.content) {
      if (c.type === 'text') {
        try { return JSON.parse(c.text); } catch { return null; }
      }
    }
  }
  return null;
}

async function main() {
  const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
  const codes = data.map(d => d.code).filter(c => /^[A-Z]\d{2}/.test(c));
  console.log(`Looking up ${codes.length} codes...`);

  const descriptions = {};
  const BATCH = 20;

  for (let i = 0; i < codes.length; i += BATCH) {
    const batch = codes.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(code =>
        callMcp('lookup_code', { code, code_type: 'diagnosis' })
          .catch(() => null)
      )
    );

    for (let j = 0; j < batch.length; j++) {
      const r = results[j];
      if (r && r.found && r.code) {
        descriptions[batch[j]] = r.code.long_description || r.code.short_description;
      }
    }
    process.stdout.write(`  ${Math.min(i + BATCH, codes.length)}/${codes.length}\r`);
  }

  console.log(`\nFound descriptions for ${Object.keys(descriptions).length} / ${codes.length} codes`);

  // Write TypeScript map
  const lines = Object.entries(descriptions)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, desc]) => `  '${code}': '${desc.replace(/'/g, "\\'")}',`);

  const ts = `/**
 * ICD-10-CM code descriptions — auto-generated from MCP server (ICD-10-CM 2026).
 * Maps 3-character category codes to their official long descriptions.
 */
export const CODE_DESCRIPTIONS: Record<string, string> = {
${lines.join('\n')}
};
`;

  writeFileSync(outPath, ts, 'utf-8');
  console.log(`Wrote ${outPath}`);

  // Also update realData.json titles in-place
  let updated = 0;
  for (const entry of data) {
    if (descriptions[entry.code]) {
      entry.title = descriptions[entry.code];
      updated++;
    }
  }
  writeFileSync(dataPath, JSON.stringify(data), 'utf-8');
  console.log(`Updated ${updated} titles in realData.json`);
}

main().catch(console.error);
