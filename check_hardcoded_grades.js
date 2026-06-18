import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/MaterialManagement.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('[1, 2, 3') || line.includes('[1,2,3') || line.includes('Class 10') && (line.includes('map') || line.includes('<option'))) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
