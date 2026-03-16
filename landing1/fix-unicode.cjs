const fs = require('fs');

// Read as buffer to handle encoding properly
const buffer = fs.readFileSync('src/App.tsx');
let content = buffer.toString('utf8');

// Fix corrupted emoji patterns with simple text
const simpleReplacements = [
  // Check/cross marks
  ['"\u00c3\u00a2\u0153\u0085', '"[OK]'],
  ['\u00c3\u00a2\u0153\u0085 ', '[OK] '],
  ['"\u00c3\u00a2\u0152\u0152', '"[X]'],
  ['\u00c3\u00a2\u0152\u0152 ', '[X] '],
  
  // Document icons - using the corrupted byte sequences
  ['\u00c3\u00b0\u0178\u201c\u2039', '[DOC]'],   // clipboard
  ['\u00c3\u00b0\u0178\u2019\u00ac', '[CHAT]'],  // speech bubble  
  ['\u00c3\u00b0\u0178\u201c\u201e', '[REFRESH]'], // refresh
  ['\u00c3\u00b0\u0178\u201c\u2013', '[BOOK]'],  // book
];

for (const [bad, good] of simpleReplacements) {
  content = content.split(bad).join(good);
}

// Also fix using regex for common patterns
content = content.replace(/âœ…/g, '[OK]');
content = content.replace(/âŒ/g, '[X]');
content = content.replace(/ðŸ"‹/g, '[DOC]');
content = content.replace(/ðŸ'¬/g, '[CHAT]');
content = content.replace(/ðŸ"„/g, '[REFRESH]');
content = content.replace(/ðŸ"–/g, '[BOOK]');

fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed all corrupted symbols');
