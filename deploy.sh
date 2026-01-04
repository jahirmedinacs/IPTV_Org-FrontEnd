#!/bin/bash
set -e

# Configuration
BRANCH="gh-pages"
SOURCE_DIR="src"
FILES_TO_SYNC=("README.md" ".gitignore")

echo "🚀 Starting deployment to $BRANCH..."

# Ensure we are on main
current_branch=$(git branch --show-current)
if [ "$current_branch" != "main" ]; then
  echo "⚠️  You are not on main branch. Switching to main..."
  git checkout main
fi

# Delete local deployment branch if it exists to start fresh
git branch -D $BRANCH 2>/dev/null || true

# Create orphan branch
echo "🌱 Creating orphan branch..."
git checkout --orphan $BRANCH

# Remove all files from the new branch (starts with staged files from main in orphan mode)
# git rm -rf . removes tracked files
# git clean -fdx removes untracked/ignored files (crucial for excluding node_modules/target)
git rm -rf .
git clean -fdx

# Restore specific files from main
echo "📦 Copying ${FILES_TO_SYNC[*]} and $SOURCE_DIR from main..."
git checkout main -- $SOURCE_DIR "${FILES_TO_SYNC[@]}"

# Move src contents to root for GitHub Pages serving
echo "📂 Moving $SOURCE_DIR contents to root..."
if [ -d "$SOURCE_DIR" ]; then
    mv $SOURCE_DIR/* .
    rmdir $SOURCE_DIR
fi

# Add and Commit
git add .
git commit -m "deploy: Sync from main"

# Push
echo "⬆️ Pushing to origin/$BRANCH..."
git push -f origin $BRANCH

# Return to main
echo "🔙 Returning to main..."
git checkout main

echo "✅ Synchronization complete! Clean gh-pages branch deployed."
