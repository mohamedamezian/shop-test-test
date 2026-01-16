# NN Instagram Theme Files

This script downloads NN Instagram customizations from the GitHub repository and packages them for distribution.

## Usage

### Quick Start

Simply run the script to download and package theme files:

```bash
npm run create-theme-zip
```

Or directly with tsx:

```bash
tsx scripts/create-zip.ts
```

The script will:
1. Fetch the file tree from https://github.com/mohamedamezian/NN-Instagram-Carousel
2. Filter for files containing "nn-instagram" in their path (case-insensitive)
3. Download those files maintaining the original folder structure
4. Create a zip file `nn-instagram-theme.zip` in the `public` directory

## What Gets Extracted

The script searches for all files matching these patterns:
- `*nn-instagram*`
- `*nn_instagram*`
- `*instagram-carousel*`
- `*instagram_carousel*`

Common files that will be extracted:
- `snippets/nn-instagram-*.liquid`
- `sections/nn-instagram-*.liquid`  
- `assets/nn-instagram-*.css`
- `assets/nn-instagram-*.js`
- `locales/*nn-instagram*.json`
- `config/*nn-instagram*.json`

## Folder Structure

After running the script, your directory will look like:

```
shop-test-test/
├── theme/              # Downloaded theme files (git-ignored)
│   ├── snippets/
│   ├── sections/
│   ├── assets/
│   └── ...
├── public/
│   └── nn-instagram-theme.zip   # Distribution package
└── scripts/
    └── create-zip.ts   # This script
```

## Download in App

After creating the zip file, users can download it from the app dashboard:
1. Navigate to the app dashboard
2. Find the "Theme Integration" section
3. Click "Download Horizon Files"
4. Extract the zip in your theme directory

## GitHub Actions (Future)

To automate this with GitHub Actions:

```yaml
name: Build Theme Package

on:
  workflow_dispatch:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Checkout theme repository
        uses: actions/checkout@v4
        with:
          repository: mohamedamezian/your-theme-repo
          path: theme-source
          
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - run: npm install
      
      - name: Create theme package
        run: tsx scripts/create-zip.ts ./theme-source
        
      - name: Commit updated zip
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add public/nn-instagram-theme.zip
          git commit -m "Update theme package" || exit 0
          git push
```

## Development Notes

- The `./theme` directory is gitignored and regenerated on each run
- Only the final `nn-instagram-theme.zip` is committed to the repository
- The zip file should be updated whenever theme changes are made
