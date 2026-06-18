import fs from 'fs';

const content = fs.readFileSync('c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src/pages/admin/ModernAdminDashboard.tsx', 'utf-8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('<TabsContent') || line.includes('TabsContent value=')) {
    console.log(`${idx + 1}: ${line.trim()}`);
  }
});
