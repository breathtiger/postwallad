import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Publish only fields used by the storefront, never internal costs or customer data.
const locationFields = ['location_id', '局名', '縣市', '行政區', '地址', '電話號碼', '封面圖網址', 'File ID圖片網址'];
const spaceFields = ['space_id', 'location_id', '寬cm.', '高cm', 'File ID圖片網址'];
export function publicCatalog(locations, spaces) {
  if (!Array.isArray(locations) || !locations.length || !Array.isArray(spaces) || !spaces.length) {
    throw new Error('Refusing to publish an empty or invalid catalog');
  }
  const select = (row, fields) => Object.fromEntries(fields.filter(k => k in row).map(k => [k, row[k]]));
  const catalog = {
    locations: locations.map(row => select(row, locationFields)),
    spaces: spaces.map(row => select(row, [...spaceFields, ...Object.keys(row).filter(k =>
      k.includes('狀態') || (k.includes('出租報價') && k.includes('月')) ||
      k.includes('印刷輸出報價') || k.includes('吊車費') || k.includes('施工報價'))]))
  };
  const ids = new Set(catalog.locations.map(row => row.location_id));
  if (ids.has(undefined) || catalog.spaces.some(row => !row.space_id || !ids.has(row.location_id))) {
    throw new Error('Invalid location/space identifiers');
  }
  return catalog;
}

export function parseJsonp(text) {
  const match = text.trim().match(/^probe\(([\s\S]*)\);?$/);
  if (!match) throw new Error('API did not return the expected JSONP response');
  return JSON.parse(match[1]);
}

async function refresh() {
  const source = await readFile(new URL('../site.js', import.meta.url), 'utf8');
  const endpoint = source.match(/const apiUrl = "([^"]+)"/)[1];
  async function get(action) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(`${endpoint}?action=${action}&callback=probe`, {signal: AbortSignal.timeout(45000)});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const rows = parseJsonp(await response.text());
        if (!Array.isArray(rows)) throw new Error('API returned an error');
        return rows;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  const locations = await get('locations');
  const spaces = await get('spaces');
  const catalog = {updatedAt: new Date().toISOString(), ...publicCatalog(locations, spaces)};
  await writeFile(new URL('../data/catalog.json', import.meta.url), JSON.stringify(catalog) + '\n');
  console.log(`Published ${catalog.locations.length} locations / ${catalog.spaces.length} spaces`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await refresh();
