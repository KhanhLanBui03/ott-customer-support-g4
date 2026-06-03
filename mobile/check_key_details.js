const fs = require('fs');
const path = require('path');

const vi = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/vi/translation.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/en/translation.json'), 'utf8'));

function findKeys(obj, term, prefix = '') {
  let results = [];
  for (const key in obj) {
    const currentKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      results = results.concat(findKeys(obj[key], term, currentKey));
    } else if (currentKey.toLowerCase().includes(term.toLowerCase()) || String(obj[key]).toLowerCase().includes(term.toLowerCase())) {
      results.push({ key: currentKey, val: obj[key] });
    }
  }
  return results;
}

console.log("--- WALLPAPER KEYS IN VI ---");
console.log(findKeys(vi, 'wallpaper'));

console.log("\n--- ROLE KEYS IN VI ---");
console.log(findKeys(vi, 'role'));

console.log("\n--- CHAT KEYS IN VI ---");
console.log(findKeys(vi, 'chat').slice(0, 10)); // just first 10
