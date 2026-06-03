const fs = require('fs');
const path = require('path');

const vi = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/vi/translation.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/en/translation.json'), 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const currentKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getKeys(obj[key], currentKey));
    } else {
      keys.push(currentKey);
    }
  }
  return keys;
}

const viKeys = getKeys(vi);
const enKeys = getKeys(en);

const missingInEn = viKeys.filter(k => !enKeys.includes(k));
const missingInVi = enKeys.filter(k => !viKeys.includes(k));

console.log("--- MISSING IN EN ---");
console.log(JSON.stringify(missingInEn, null, 2));

console.log("\n--- MISSING IN VI ---");
console.log(JSON.stringify(missingInVi, null, 2));
