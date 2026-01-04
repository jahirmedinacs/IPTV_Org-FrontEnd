# IPTV Explorer

**IPTV Explorer** is a fast, robust, and simple desktop application for browsing and playing IPTV channels from around the world. Built with [Tauri](https://tauri.app/) (v2) and Vanilla JavaScript, it offers a lightweight and secure way to explore global media.

![IPTV Explorer](https://ui-avatars.com/api/?name=IPTV+Explorer&background=0f172a&color=fff&size=512)

## Features

- 🌍 **Global Access**: Browse thousands of channels using the [IPTV-ORG](https://github.com/iptv-org/iptv) API.
- 🚀 **High Performance**: Built on Rust and native WebView for minimal resource usage.
- 🛡️ **Security**: Configured with a permissive but defined Content Security Policy (CSP) to allow legitimate media sources while maintaining app integrity.
- 🔍 **Search & Filter**: Filter by country, category, or search by name.
- 📺 **Wide Support**: Native support for HLS (.m3u8) streams via Hls.js.

## Prerequisites

- **Node.js** (v18 or newer recommended)
- **Rust** (latest stable)
- **System Dependencies**:
    - Linux: `libwebkit2gtk-4.0-dev` (or 4.1), `build-essential`, `curl`, `wget`, `file`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

## Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run in Development Mode** (with Hot Reload)
   ```bash
   npm run tauri dev
   ```

## Building

### automated Build (Cross-Platform)

We provide a `buildme.sh` script designed for CI/CD environments (like GitHub Actions) but usable locally. It detects your OS and runs the appropriate build commands.

```bash
./buildme.sh
```

### Manual Build

To build the optimized release binary for your current platform:

```bash
npm run tauri build
```

The output binaries will be located in:
`src-tauri/target/release/bundle/`

## Configuration

The application is configured in `src-tauri/tauri.conf.json`.

- **CSP**: The `content-security-policy` is set to allow `https://*` for images and media to support the wide variety of IPTV sources.
- **Window**: Defaults to 1200x800, Dark Theme.

## License

This project is licensed under the MIT License.
