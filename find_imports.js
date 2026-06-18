import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/ModernAdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

for (let i = 0; i < 50; i++) {
  if (lines[i].includes('recharts') || lines[i].includes('chart')) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
// search all imports
lines.forEach((line, idx) => {
  if (idx < 100 && (line.includes('import') && (line.includes('recharts') || line.includes('lucide-react')))) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
