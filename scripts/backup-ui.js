const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.resolve(__dirname, '../ui_v1_backup');
const ROOT = path.resolve(__dirname, '..');

const FILES_TO_BACKUP = [
  'src/components',
  'src/pages',
  'src/assets',
  'src/i18n',
  'src/App.tsx',
  'src/index.css',
  'public'
];

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR);
}

console.log('--- UI BACKUP START ---');

FILES_TO_BACKUP.forEach(file => {
  const src = path.join(ROOT, file);
  const dest = path.join(BACKUP_DIR, file);

  if (fs.existsSync(src)) {
    const destParent = path.dirname(dest);
    if (!fs.existsSync(destParent)) {
      fs.mkdirSync(destParent, { recursive: true });
    }

    console.log(`Copying ${file}...`);
    try {
      // Use recursive copy if it's a directory
      fs.cpSync(src, dest, { recursive: true });
      console.log(`Successfully backed up ${file}`);
    } catch (err) {
      console.error(`Error backing up ${file}:`, err);
    }
  } else {
    console.warn(`Warning: ${file} not found, skipping.`);
  }
});

console.log('--- UI BACKUP COMPLETE ---');
console.log(`Backup saved to: ${BACKUP_DIR}`);
