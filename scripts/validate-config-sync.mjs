// fallow-ignore-file
import { readFileSync } from 'fs';

const fields = ['deviceSizes', 'imageSizes', 'qualities', 'formats', 'dangerouslyAllowSVG'];

function extractField(text, name) {
  const re = new RegExp(name + "\\s*:\\s*(\\[[^\\]]+\\]|true|false)");
  const m = text.match(re);
  if (!m) throw new Error('Could not find field: ' + name);
  // Normalise single-quoted strings to double so JSON.parse accepts them
  const normalised = m[1].replace(/'/g, '"');
  return JSON.stringify(JSON.parse(normalised));
}

const server = readFileSync(
  'packages/strapi-plugin-next-image/server/src/config.ts',
  'utf8',
);
const client = readFileSync('packages/strapi-next-image/src/image-config.ts', 'utf8');

let ok = true;
for (const field of fields) {
  const sv = extractField(server, field);
  const cv = extractField(client, field);
  if (sv !== cv) {
    console.error(`Mismatch in ${field}:`);
    console.error(`  server: ${sv}`);
    console.error(`  client: ${cv}`);
    ok = false;
  }
}
if (!ok) {
  console.error('');
  console.error('Config defaults have drifted between server and client.');
  console.error('Server canonical source: packages/strapi-plugin-next-image/server/src/config.ts');
  console.error('Client mirror: packages/strapi-next-image/src/image-config.ts');
  process.exit(1);
}
console.log('Config defaults in sync ✓');
