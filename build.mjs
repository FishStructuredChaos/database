import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const GIST_TEXT = 'https://gist.githubusercontent.com/TheZiver/9b85c8b8b6c1b4caa17dda8d37dc18ac/raw';
const GIST_JSON = 'https://gist.githubusercontent.com/TheZiver/bb99f9facb8d14fd607dbb79e9a99d83/raw';
const ALLOWED_TAGS = ['ROSE_FISH', 'FISH'];

async function fetchText(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  return resp.text();
}

async function fetchJson(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${url}`);
  return resp.json();
}

function parseMembers(rawText) {
  const lines = rawText.split('\n');
  const members = [];
  for (let i = 0; i < lines.length - 1; i++) {
    const line1 = lines[i].trim();
    const line2 = lines[i + 1].trim();
    if (line1.startsWith('<size=20>') && line1.endsWith('</size>') &&
        line2.startsWith('<size=10>') && line2.endsWith('</size>')) {
      const nameRaw = line1.substring(9, line1.length - 7).trim();
      const contributionRaw = line2.substring(9, line2.length - 7).trim();
      const nameClean = nameRaw.replace(/<[^>]+>/g, '').trim();
      const contributionClean = contributionRaw.replace(/<[^>]+>/g, '').trim();
      if (nameClean || contributionClean) {
        members.push({ name: nameClean || 'N/A', contribution: contributionClean || 'N/A' });
      }
      i++;
    }
  }
  return members;
}

function parseVrcItems(items, type) {
  if (!items || !Array.isArray(items)) return [];
  return items
    .filter(item => item && item.tags && Array.isArray(item.tags) && item.tags.some(t => ALLOWED_TAGS.includes(t)))
    .sort((a, b) => {
      const aRose = a.tags.includes('ROSE_FISH');
      const bRose = b.tags.includes('ROSE_FISH');
      return aRose && !bRose ? -1 : !aRose && bRose ? 1 : 0;
    })
    .map(item => ({
      [type === 'avatar' ? 'name' : 'name']: item[type === 'avatar' ? 'avatar_name' : 'world_name'],
      author: item.author,
      image: item[type === 'avatar' ? 'avatar_image_url' : 'world_image_url'],
      link: item[type === 'avatar' ? 'avatar_link' : 'world_link'],
      tags: item.tags,
    }));
}

async function main() {
  console.log('=== ROSE FISH DATABASE BUILD ===\n');

  // 1. Fetch members from text gist
  console.log('Fetching members from text gist...');
  try {
    const rawText = await fetchText(GIST_TEXT);
    const members = parseMembers(rawText);
    fs.writeFileSync(path.join(DATA_DIR, 'members.json'), JSON.stringify({ members }, null, 2));
    console.log(`  -> ${members.length} members saved to data/members.json`);
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
  }

  // 2. Fetch avatars/worlds from JSON gist
  console.log('Fetching VRChat data from JSON gist...');
  try {
    const json = await fetchJson(GIST_JSON);
    const avatars = parseVrcItems(json.community_avatars, 'avatar');
    const worlds = parseVrcItems(json.community_worlds, 'world');
    fs.writeFileSync(path.join(DATA_DIR, 'avatars.json'), JSON.stringify({ avatars }, null, 2));
    fs.writeFileSync(path.join(DATA_DIR, 'worlds.json'), JSON.stringify({ worlds }, null, 2));
    console.log(`  -> ${avatars.length} avatars saved to data/avatars.json`);
    console.log(`  -> ${worlds.length} worlds saved to data/worlds.json`);
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
  }

  // 3. Static data files already exist - just report them
  const staticFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !['members.json', 'avatars.json', 'worlds.json'].includes(f));
  console.log(`\nStatic data files present: ${staticFiles.length}`);

  console.log('\n=== BUILD COMPLETE ===');
}

main().catch(console.error);
