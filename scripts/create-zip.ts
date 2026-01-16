import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

/**
 * Script to download Instagram-specific theme files from GitHub and create a distributable zip
 * The zip maintains the exact folder structure so merchants can drag-and-drop into their theme
 * Usage: tsx scripts/create-zip.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = 'mohamedamezian/NN-Instagram-Carousel';
const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN; // Optional: for private repos or to avoid rate limits

const appRootDir = path.resolve(__dirname, '..');
const outputThemeDir = path.join(appRootDir, 'theme');
const outputZipPath = path.join(appRootDir, 'public', 'nn-instagram-theme.zip');

console.log('🔍 Downloading Instagram theme files from:', GITHUB_REPO);
console.log('📁 Temporary directory:', outputThemeDir);
console.log('📦 Output zip:', outputZipPath);

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GitHubTree {
  sha: string;
  url: string;
  tree: GitHubTreeItem[];
  truncated: boolean;
}

interface RepoData {
  default_branch: string;
}

async function fetchGitHubTree(): Promise<{ tree: GitHubTreeItem[]; defaultBranch: string }> {
  console.log('\n📡 Fetching repository information...');
  
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };
  
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
    console.log('🔑 Using GitHub token for authentication');
  }
  
  // Get default branch
  const repoResponse = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`, { headers });
  if (!repoResponse.ok) {
    throw new Error(`Failed to fetch repository info: ${repoResponse.statusText}`);
  }
  const repoData: RepoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch || 'main';
  
  console.log(`📌 Default branch: ${defaultBranch}`);
  
  // Get tree for default branch
  const treeResponse = await fetch(
    `${GITHUB_API}/repos/${GITHUB_REPO}/git/trees/${defaultBranch}?recursive=1`,
    { headers }
  );
  
  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch tree: ${treeResponse.statusText}`);
  }
  
  const treeData: GitHubTree = await treeResponse.json();
  
  if (treeData.truncated) {
    console.warn('⚠️  Tree was truncated, some files may be missing');
  }
  
  return { tree: treeData.tree, defaultBranch };
}

function isInstagramFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  
  // Check if the file path or filename contains "instagram"
  return lowerPath.includes('instagram');
}

function isThemeFile(filePath: string): boolean {
  // Only include files that are in typical Shopify theme directories
  const themeDirs = ['sections', 'blocks', 'snippets', 'templates', 'assets', 'layout', 'locales', 'config'];
  const pathParts = filePath.split('/');
  
  // Check if the first directory is a theme directory
  return themeDirs.includes(pathParts[0]);
}

async function downloadFile(item: GitHubTreeItem, defaultBranch: string): Promise<Buffer> {
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/${defaultBranch}/${item.path}`;
  
  const headers: HeadersInit = {};
  if (GITHUB_TOKEN) {
    headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  }
  
  const response = await fetch(rawUrl, { headers });
  
  if (!response.ok) {
    throw new Error(`Failed to download ${item.path}: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractFiles() {
  // Clean up existing theme directory
  if (fs.existsSync(outputThemeDir)) {
    console.log('🧹 Cleaning up existing theme directory...');
    fs.rmSync(outputThemeDir, { recursive: true, force: true });
  }

  // Create theme directory
  fs.mkdirSync(outputThemeDir, { recursive: true });

  // Fetch repository tree
  const { tree: allFiles, defaultBranch } = await fetchGitHubTree();
  
  // Filter for Instagram-related theme files (blobs only, not directories)
  const instagramFiles = allFiles.filter(
    item => item.type === 'blob' && isInstagramFile(item.path) && isThemeFile(item.path)
  );

  console.log(`\n✨ Found ${instagramFiles.length} Instagram theme files:\n`);

  if (instagramFiles.length === 0) {
    console.error('❌ No Instagram theme files found in repository');
    console.log('💡 Make sure the repository contains files with "instagram" in their name/path');
    process.exit(1);
  }

  // Group files by directory for better logging
  const filesByDir: Record<string, string[]> = {};
  instagramFiles.forEach(file => {
    const dir = path.dirname(file.path);
    if (!filesByDir[dir]) filesByDir[dir] = [];
    filesByDir[dir].push(path.basename(file.path));
  });

  // Log grouped files
  Object.entries(filesByDir).forEach(([dir, files]) => {
    console.log(`  📁 ${dir}/`);
    files.forEach(file => console.log(`     └─ ${file}`));
  });

  console.log('\n⬇️  Downloading files...');

  // Download and save files, preserving folder structure
  for (const file of instagramFiles) {
    const destPath = path.join(outputThemeDir, file.path);
    const destDir = path.dirname(destPath);

    // Create destination directory structure
    fs.mkdirSync(destDir, { recursive: true });

    // Download and save file
    try {
      const content = await downloadFile(file, defaultBranch);
      fs.writeFileSync(destPath, content);
      console.log(`  ✓ ${file.path}`);
    } catch (error) {
      console.error(`  ✗ Failed to download ${file.path}:`, error);
      throw error;
    }
  }

  console.log(`\n✅ Downloaded ${instagramFiles.length} files to ./theme`);
}

async function createZip() {
  console.log('\n📦 Creating zip file with theme structure...');

  // Ensure public directory exists
  const publicDir = path.join(appRootDir, 'public');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Remove existing zip if it exists
  if (fs.existsSync(outputZipPath)) {
    fs.unlinkSync(outputZipPath);
  }

  return new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputZipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeInKB = (archive.pointer() / 1024).toFixed(2);
      console.log(`✅ Zip file created: ${sizeInKB} KB`);
      console.log(`📍 Location: ${outputZipPath}`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Error creating zip:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add the theme directory contents to the zip root
    // This preserves the folder structure (sections/, blocks/, etc.)
    archive.directory(outputThemeDir, false);

    archive.finalize();
  });
}

async function main() {
  try {
    console.log('╔════════════════════════════════════════════════════════╗');
    console.log('║  NN Instagram Theme Package Creator                    ║');
    console.log('╚════════════════════════════════════════════════════════╝\n');

    await extractFiles();
    await createZip();

    console.log('\n╔════════════════════════════════════════════════════════╗');
    console.log('║  🎉 Successfully created Instagram theme package!      ║');
    console.log('╚════════════════════════════════════════════════════════╝');
    console.log('\n📦 Zip structure:');
    console.log('   sections/');
    console.log('     └─ instagram-carousel.liquid');
    console.log('   blocks/');
    console.log('     └─ instagram-post-*.liquid');
    console.log('   ...\n');
    console.log('💡 Merchants can:');
    console.log('   1. Download the zip file');
    console.log('   2. Extract it');
    console.log('   3. Drag folders into their theme directory\n');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();