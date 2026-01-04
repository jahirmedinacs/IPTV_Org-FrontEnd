#!/bin/bash

# buildme.sh - Cross-platform build script for IPTV Explorer
# Designed to be run primarily in CI/CD environments (GitHub Actions)

set -e

echo "=========================================="
echo "   IPTV Explorer Build Script"
echo "=========================================="

# 1. Detect Operating System
OS="$(uname -s)"
case "${OS}" in
    Linux*)     machine=Linux;;
    Darwin*)    machine=Mac;;
    CYGWIN*)    machine=Cygwin;;
    MINGW*)     machine=MinGw;;
    *)          machine="UNKNOWN:${OS}"
esac

echo "[INFO] Detected OS: ${machine}"

# 2. Install Dependencies
echo "[INFO] Installing Node.js dependencies..."
if npm install; then
    echo "[INFO] Dependencies installed successfully."
else
    echo "[WARN] Standard npm install failed (likely due to symlinks). Retrying with --no-bin-links..."
    npm install --no-bin-links
fi

# 3. Build Application
echo "[INFO] Starting Tauri build..."

if [ "$machine" == "MinGw" ] || [ "$machine" == "Cygwin" ]; then
    # Windows specific commands if needed, usually npm run tauri build works fine if env is set up
    # Ensure Rust is available
    if ! command -v cargo &> /dev/null; then
        echo "[ERROR] Rust/Cargo not found. Please install Rust."
        exit 1
    fi
    npm run tauri build
elif [ "$machine" == "Mac" ]; then
    # macOS
    npm run tauri build
else
    # Linux
    # Check for build dependencies (simple check)
    if ! command -v cargo &> /dev/null; then
        echo "[ERROR] Rust/Cargo not found. Please install Rust."
        exit 1
    fi
    
    # Run build
    # We use a custom target dir logic if defined, otherwise default
    if [ -n "$CARGO_TARGET_DIR" ]; then 
        echo "[INFO] Using defined CARGO_TARGET_DIR: $CARGO_TARGET_DIR"
    fi
    
    # Try standard npm run, fallback to direct node execution if bin links failed
    if ! npm run tauri build; then
        echo "[WARN] 'npm run tauri build' failed. Trying direct node execution..."
        node node_modules/@tauri-apps/cli/tauri.js build
    fi
fi

echo "=========================================="
echo "   Build Successful!"
echo "=========================================="
echo "[INFO] Artifacts can be found in src-tauri/target/release/bundle/"
