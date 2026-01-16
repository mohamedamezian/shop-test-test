import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import { fileURLToPath } from 'url';
import archiver from 'archiver';

/**
 * Script to download NN Instagram theme files from GitHub and create a zip for distribution
 * Usage: tsx scripts/create-zip.ts
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_REPO = 'mohamedamezian/NN-Instagram-Carousel';
const GITHUB_API = 'https://api.github.com';

const appRootDir = path.resolve(__dirname, '..');
const outputThemeDir = path.join(appRootDir, 'theme');
const outputZipPath = path.join(appRootDir, 'public', 'nn-instagram-theme.zip');

console.log('🔍 Fetching Instagram files from GitHub:', GITHUB_REPO);
console.log('📁 Output directory:', outputThemeDir);
console.log('📦 Zip file location:', outputZipPath);

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

async function fetchGitHubTree(): Promise<GitHubTreeItem[]> {
  console.log('\n📡 Fetching repository tree...');
  
  // Get default branch
  const repoResponse = await fetch(`${GITHUB_API}/repos/${GITHUB_REPO}`);
  if (!repoResponse.ok) {
    throw new Error(`Failed to fetch repository info: ${repoResponse.statusText}`);
  }
  const repoData = await repoResponse.json();
  const defaultBranch = repoData.default_branch || 'main';
  
  // Get tree for default branch
  const treeResponse = await fetch(
    `${GITHUB_API}/repos/${GITHUB_REPO}/git/trees/${defaultBranch}?recursive=1`
  );
  
  if (!treeResponse.ok) {
    throw new Error(`Failed to fetch tree: ${treeResponse.statusText}`);
  }
  
  const treeData: GitHubTree = await treeResponse.json();
  
  if (treeData.truncated) {
    console.warn('⚠️  Tree was truncated, some files may be missing');
  }
  
  return treeData.tree;
}

function isInstagramFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return (
    lowerPath.includes('nn-instagram') ||
    lowerPath.includes('nn_instagram') ||
    lowerPath.includes('instagram-carousel') ||
    lowerPath.includes('instagram_carousel')
  );
}

async function downloadFile(item: GitHubTreeItem): Promise<Buffer> {
  const rawUrl = `https://raw.githubusercontent.com/${GITHUB_REPO}/main/${item.path}`;
  const response = await fetch(rawUrl);
  
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
  const allFiles = await fetchGitHubTree();
  
  // Filter for Instagram-related files (blobs only, not directories)
  const instagramFiles = allFiles.filter(
    item => item.type === 'blob' && isInstagramFile(item.path)
  );

  console.log(`\n✨ Found ${instagramFiles.length} Instagram files:`);

  if (instagramFiles.length === 0) {
    console.error('❌ No Instagram files found in repository');
    process.exit(1);
  }

  // Download and save files
  for (const file of instagramFiles) {
    const destPath = path.join(outputThemeDir, file.path);
    const destDir = path.dirname(destPath);

    console.log(`  📄 ${file.path}`);

    // Create destination directory
    fs.mkdirSync(destDir, { recursive: true });

    // Download and save file
    const content = await downloadFile(file);
    fs.writeFileSync(destPath, content);
  }

  console.log(`\n✅ Downloaded ${instagramFiles.length} files to ./theme`);
}

async function createZip() {
  console.log('\n📦 Creating zip file...');

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
      const sizeInMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      console.log(`✅ Zip file created: ${sizeInMB} MB`);
      console.log(`📍 Location: ${outputZipPath}`);
      resolve();
    });

    archive.on('error', (err) => {
      console.error('❌ Error creating zip:', err);
      reject(err);
    });

    archive.pipe(output);

    // Add the theme directory to the zip
    archive.directory(outputThemeDir, false);

    archive.finalize();
  });
}

async function main() {
  try {
    await extractFiles();
    await createZip();

    console.log('\n🎉 Successfully created NN Instagram theme package!');
    console.log('💡 Users can now download and extract this zip into their theme directory.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
