const fs = require('fs');
const content = fs.readFileSync('src/hooks/useAgoraCall.js', 'utf8');
const lines = content.split('\n');
lines.forEach((line, index) => {
  if (line.includes('group_fallback') || line.includes('group') || line.includes('fallback') || line.includes('t(')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
