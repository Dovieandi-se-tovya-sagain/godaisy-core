/**
 * Convert @/ path aliases to relative paths
 * Run with: node scripts/convert-aliases.js
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// Map @/ paths to actual directories
const aliasMap = {
  '@/context': 'contexts',
  '@/contexts': 'contexts',
  '@/lib': 'lib',
  '@/hooks': 'hooks',
  '@/components': 'components',
  '@/types': 'lib', // types are in lib/types.ts
  '@/utils': 'lib/utils',
};

function getRelativePath(fromFile, toPath) {
  const fromDir = path.dirname(fromFile);
  const relPath = path.relative(fromDir, path.join(srcDir, toPath));
  // Ensure it starts with ./ or ../
  if (!relPath.startsWith('.')) {
    return './' + relPath;
  }
  return relPath;
}

function convertImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Match both static and dynamic imports with @/ paths
  const importRegex = /(from|import)\s*\(\s*['"](@\/[^'"]+)['"]\s*\)|from\s+['"](@\/[^'"]+)['"]/g;

  content = content.replace(importRegex, (match, importPath) => {
    // Find which alias this matches
    for (const [alias, actualPath] of Object.entries(aliasMap)) {
      if (importPath.startsWith(alias + '/') || importPath === alias) {
        const restOfPath = importPath.slice(alias.length);
        const fullTargetPath = actualPath + restOfPath;
        const relativePath = getRelativePath(filePath, fullTargetPath);
        // Convert Windows backslashes to forward slashes
        const normalizedPath = relativePath.replace(/\\/g, '/');
        modified = true;
        console.log(`  ${importPath} -> ${normalizedPath}`);
        return `from '${normalizedPath}'`;
      }
    }
    // If no alias matched, just return original
    console.log(`  WARNING: No alias found for ${importPath}`);
    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
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

console.log('Converting @/ path aliases to relative paths...\n');

let totalModified = 0;
walkDir(srcDir, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes("from '@/")) {
    console.log(`Processing: ${path.relative(srcDir, filePath)}`);
    if (convertImports(filePath)) {
      totalModified++;
    }
  }
});

console.log(`\nDone! Modified ${totalModified} files.`);
