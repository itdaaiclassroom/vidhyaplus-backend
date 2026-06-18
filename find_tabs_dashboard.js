import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/ModernAdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('Teachers Info') || line.includes('activeTab') || line.includes('activeSubTab') || line.includes('Teacher Directory') || line.includes('subTab') || line.includes('subtab')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
