const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, 'src/locales/en/translation.json');
const viPath = path.join(__dirname, 'src/locales/vi/translation.json');

if (!fs.existsSync(enPath) || !fs.existsSync(viPath)) {
  console.error("Locales files not found!");
  process.exit(1);
}

const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
const vi = JSON.parse(fs.readFileSync(viPath, 'utf8'));

function hasKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return false;
    }
    current = current[part];
  }
  return current !== undefined;
}

function getFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.expo' && file !== '.git') {
        results = results.concat(getFiles(fullPath));
      }
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      results.push(fullPath);
    }
  });
  return results;
}

const files = [...getFiles(path.join(__dirname, 'app')), ...getFiles(path.join(__dirname, 'src'))];

console.log(`Scanning ${files.length} files...`);

const missingKeys = new Map();

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match \bt('key') or \bt("key") or \bt(`key`)
  const regex = /\bt\(\s*['"`]([a-zA-Z0-9_\-\.\:\/]+)['"`]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    if (key.includes('${')) continue;

    const inEn = hasKey(en, key);
    const inVi = hasKey(vi, key);

    if (!inEn || !inVi) {
      if (!missingKeys.has(key)) {
        missingKeys.set(key, { inEn, inVi, files: [] });
      }
      missingKeys.get(key).files.push(path.relative(__dirname, file));
    }
  }
});

console.log("\n--- REPORT ---");
console.log(`Found ${missingKeys.size} missing/mismatched keys:`);
missingKeys.forEach((val, key) => {
  console.log(`\nKey: "${key}"`);
  console.log(`  Exists in EN: ${val.inEn ? 'YES' : 'NO'}`);
  console.log(`  Exists in VI: ${val.inVi ? 'YES' : 'NO'}`);
  console.log(`  Used in: ${[...new Set(val.files)].join(', ')}`);
});
