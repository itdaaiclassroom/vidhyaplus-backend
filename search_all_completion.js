import fs from 'fs';
import path from 'path';

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      walkDir(dirPath, callback);
    } else {
      callback(dirPath);
    }
  });
}

const frontendSrc = 'c:/Users/venky/Desktop/Vidya_Plus_/vidhyaplus-frontend/src';
const searchTerms = ['Completion Rate', 'Lesson Completion', 'statsCompletionRate', 'statsCompletedCount'];

walkDir(frontendSrc, filePath => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    searchTerms.forEach(term => {
      if (content.includes(term)) {
        console.log(`Found "${term}" in file: ${filePath}`);
        // print matching lines
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(term)) {
            console.log(`  ${idx + 1}: ${line.trim()}`);
          }
        });
      }
    });
  }
});
