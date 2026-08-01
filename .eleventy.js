import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy('css');
  eleventyConfig.addPassthroughCopy('js');
  eleventyConfig.addPassthroughCopy('images');
  eleventyConfig.addPassthroughCopy('.nojekyll');

  eleventyConfig.setServerOptions({
    port: 3456,
  });

  const downloadTabs = new Set(['models-3d', 'avatar-prefabs', 'shaders']);
  const noButtonTabs = new Set(['asset-websites', 'useful-things', 'luxury-trash', 'tools', 'web-apps']);
  const selectBtnTabs = new Set(['models-3d', 'avatar-prefabs', 'world-prefabs', 'shaders']);

  eleventyConfig.addGlobalData('tabs', [
    { id: 'information', label: '\u2753INFORMATION', type: 'info' },
    { id: 'websites', label: '\ud83c\udf10WEBSITES', type: 'data' },
    { id: '_section_vrchat', label: 'VRCHAT CONTENT', type: 'section' },
    { id: 'worlds', label: '\ud83c\udf0eWORLDS', type: 'dynamic', gistKey: 'community_worlds' },
    { id: 'public-avatars', label: '\ud83c\udf39PUBLIC-AVATARS', type: 'dynamic', gistKey: 'community_avatars', worldLink: 'https://vrchat.com/home/world/wrld_6e2090d1-6e1a-4098-b608-452a6ad54376', worldLabel: 'Open "AVATARS!" VRChat World' },
    { id: 'vrchat-groups', label: '\ud83d\udc65VRCHAT-GROUPS', type: 'groups' },
    { id: 'fish-members', label: '\ud83d\udc1fFISH-MEMBERS', type: 'members', submitLabel: 'OPEN MEMBER LIST', submitLink: 'https://gist.githubusercontent.com/TheZiver/def41cbeb9b2e8eb071015f58bf8eb54/raw/48b6c7290489157d85e01f23d51915e4105c78dd/fish_community_members.txt' },
    { id: '_section_community', label: 'COMMUNITY ASSETS', type: 'section' },
    { id: 'gallery', label: '\ud83c\udfb4GALLERY', type: 'embed', embedUrl: 'https://fishstructuredchaos.github.io/gallery/', openLabel: 'Open Gallery In New Window' },
    { id: 'models-3d', label: '\ud83d\udcbe3D-MODELS', type: 'data' },
    { id: 'sounds', label: '\ud83d\udd0aSOUNDS', type: 'embed', embedUrl: 'https://fishstructuredchaos.github.io/sounds/', openLabel: 'Open Soundboard In New Window' },
    { id: 'avatar-prefabs', label: '\ud83d\udce6AVATAR-PREFABS', type: 'data' },
    { id: 'world-prefabs', label: '\ud83d\udce6WORLD-PREFABS', type: 'data' },
    { id: 'shaders', label: '\ud83d\uddbc\ufe0fSHADERS', type: 'data' },
    { id: 'games', label: '\ud83c\udfaeGAMES', type: 'data' },
    { id: 'tools', label: '\ud83d\udee0\ufe0fTOOLS', type: 'data' },
    { id: 'luxury-trash', label: '\ud83d\udcb0LUXURY TRASH', type: 'data', worldLabel: 'Open "LUXURY TRASH" VRChat World' },
    { id: '_section_extra', label: 'EXTRA RESOURCES', type: 'section' },
    { id: 'useful-things', label: '\ud83d\udc96USEFUL-THINGS', type: 'data' },
    { id: 'web-apps', label: '\ud83c\udf10WEB-APPS', type: 'data' },
    { id: 'asset-websites', label: '\ud83c\udf10ASSET-WEBSITES', type: 'data' },
  ]);

  eleventyConfig.addGlobalData('tabsData', () => {
    const dataDir = path.join(__dirname, 'data');
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
    const map = {};
    for (const f of files) {
      const name = path.basename(f, '.json');
      map[name] = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf-8'));
    }
    return map;
  });

  eleventyConfig.addFilter('btnLabel', (tabId) => {
    return downloadTabs.has(tabId) ? 'DOWNLOAD' : 'OPEN';
  });

  eleventyConfig.addGlobalData('noButtonTabs', [...noButtonTabs]);

  eleventyConfig.addFilter('inList', (val, list) => {
    return Array.isArray(list) && list.includes(val);
  });

  eleventyConfig.addFilter('findCol', (headers, pattern) => {
    const re = new RegExp(pattern, 'i');
    return headers.findIndex(h => re.test(h));
  });

  eleventyConfig.addFilter('matchUrl', (text) => {
    const m = String(text).match(/(https?:\/\/[^\s]+)/);
    return { url: m ? m[1] : '#' };
  });

  eleventyConfig.addFilter('imgUrl', (val) => {
    if (!val || val.startsWith('http')) return val;
    if (val.startsWith('/images/') || val.startsWith('images/') || val.startsWith('/previews/') || val.startsWith('previews/')) {
      const clean = val.replace(/^\//, '');
      return `https://raw.githubusercontent.com/FishStructuredChaos/database/main/${clean}`;
    }
    if (val.startsWith('/r2/')) {
      return `https://rosefish-submit.ziver64.workers.dev${val}`;
    }
    return val;
  });

  eleventyConfig.addFilter('priceClass', (val) => {
    if (!val) return '';
    return String(val).toLowerCase() === 'free' ? ' price free' : ' price';
  });

  eleventyConfig.addNunjucksFilter('skipCol', (ci, picIdx, linkIdx) => {
    return ci === 0 || ci === picIdx || ci === linkIdx;
  });

  return {
    dir: {
      input: '.',
      output: 'docs',
      includes: '_includes',
      data: 'data',
    },
    templateFormats: ['njk', 'html', 'md'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
  };
}
