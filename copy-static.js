import fs from 'fs';
import path from 'path';

// Function to copy files recursively
function copyRecursive(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursive(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Copy static files
const filesToCopy = [
  { src: 'src/assets', dest: 'dist/assets' },
  { src: 'icons', dest: 'dist/icons' },
  { src: 'manifest.json', dest: 'dist/manifest.json' },
  { src: 'src/sidebar.html', dest: 'dist/sidebar.html' },
  { src: 'src/options.html', dest: 'dist/options.html' },
  // Note: sidebar.css is now built by Vite, so we don't copy it
  { src: 'src/content.css', dest: 'dist/content.css' },
  { src: 'src/options.css', dest: 'dist/options.css' }
];

filesToCopy.forEach(({ src, dest }) => {
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
    console.log(`Copied ${src} to ${dest}`);
  } else {
    console.warn(`Source ${src} does not exist`);
  }
});

// Copy the built sidebar CSS file to the correct name
if (fs.existsSync('dist/sidebar.css')) {
  console.log('Sidebar CSS already exists in dist/sidebar.css');
} else if (fs.existsSync('dist/styles')) {
  const sidebarCssFiles = fs.readdirSync('dist/styles').filter(file => file.startsWith('sidebar') && file.endsWith('.css'));
  if (sidebarCssFiles.length > 0) {
    const builtSidebarCss = `dist/styles/${sidebarCssFiles[0]}`;
    fs.copyFileSync(builtSidebarCss, 'dist/sidebar.css');
    console.log(`Copied built sidebar CSS: ${builtSidebarCss} to dist/sidebar.css`);
  } else {
    console.warn('No built sidebar CSS file found in dist/styles/');
  }
} else {
  // Look for sidebar CSS files in dist/ directory
  const distFiles = fs.readdirSync('dist').filter(file => file.startsWith('sidebar') && file.endsWith('.css'));
  if (distFiles.length > 0) {
    const builtSidebarCss = `dist/${distFiles[0]}`;
    fs.copyFileSync(builtSidebarCss, 'dist/sidebar.css');
    console.log(`Copied built sidebar CSS: ${builtSidebarCss} to dist/sidebar.css`);
  } else {
    console.warn('No built sidebar CSS file found in dist/');
  }
}

console.log('Static files copied successfully!');
