const fs = require('fs');
const path = require('path');

const vi = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/vi/translation.json'), 'utf8'));
const en = JSON.parse(fs.readFileSync(path.join(__dirname, 'src/locales/en/translation.json'), 'utf8'));

console.log("member_actions_title in VI:", vi.chat.member_actions_title);
console.log("member_actions_title in EN:", en.chat.member_actions_title);
