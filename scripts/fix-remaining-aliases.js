/**
 * Fix remaining @/ patterns including dynamic imports
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function getRelativePrefix(filePath) {
  const fromDir = path.dirname(filePath);
  const depth = path.relative(srcDir, fromDir).split(path.sep).length;
  return depth === 0 ? './' : '../'.repeat(depth);
}

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  const fromDir = path.dirname(filePath);
  const depth = path.relative(srcDir, fromDir).split(path.sep).length;
  const prefix = depth === 0 ? './' : '../'.repeat(depth);

  // Replace @/ with appropriate relative path
  const replacements = {
    "@/lib/": prefix + "lib/",
    "@/context/": prefix + "contexts/",
    "@/contexts/": prefix + "contexts/",
    "@/hooks/": prefix + "hooks/",
    "@/components/": prefix + "components/",
    "@/types/": prefix + "types/",
    "@/data/": prefix + "data/",
    "@/app/": prefix + "app/",
    "@/pages/": prefix + "pages/",
    "@/utils/": prefix + "lib/utils/",
  };

  for (const [from, to] of Object.entries(replacements)) {
    if (content.includes(from)) {
      console.log(`  ${path.relative(srcDir, filePath)}: ${from} -> ${to}`);
      content = content.split(from).join(to);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
  return modified;
}

function walkDir(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walkDir(filePath, callback);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      callback(filePath);
    }
  }
}

console.log('Fixing remaining @/ patterns...\n');

let totalModified = 0;
walkDir(srcDir, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('@/')) {
    if (fixFile(filePath)) {
      totalModified++;
    }
  }
});

console.log(`\nDone! Modified ${totalModified} files.`);
