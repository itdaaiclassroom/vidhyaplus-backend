import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/ModernAdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

let start = -1;
lines.forEach((line, idx) => {
  if (line.includes('const navItems') || line.includes('const adminNavItems') || line.includes('const menuItems')) {
    start = idx;
  }
});

if (start !== -1) {
  console.log(`Found navigation items around line ${start + 1}:`);
  for (let i = Math.max(0, start - 5); i < Math.min(lines.length, start + 40); i++) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
} else {
  console.log('Could not find navItems definition.');
  // Let's print lines containing 'label: "Teachers Info"'
  lines.forEach((line, idx) => {
    if (line.includes('label: "Teachers Info"')) {
      console.log(`Found label at line ${idx + 1}: ${line}`);
      for (let i = Math.max(0, idx - 15); i < Math.min(lines.length, idx + 15); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
      }
    }
  });
}
