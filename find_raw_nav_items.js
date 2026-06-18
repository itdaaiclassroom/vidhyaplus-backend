import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/ModernAdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, idx) => {
  if (line.includes('const rawNavItems')) {
    start = idx;
  }
});

if (start !== -1) {
  console.log(`Found rawNavItems around line ${start + 1}:`);
  for (let i = Math.max(0, start - 2); i < Math.min(lines.length, start + 40); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} else {
  console.log('Could not find rawNavItems.');
}
