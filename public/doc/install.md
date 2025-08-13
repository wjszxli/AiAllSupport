## Installation Guide

## Chrome Web Store

Click [here](https://chromewebstore.google.com/detail/AiAllSupport/llogfbeeebfjkbmajodnjpljpfnaaplm?authuser=0&hl=zh-CN) to install directly or search for **"AiAllSupport"** in the [Chrome Web Store](https://chromewebstore.google.com/?hl=zh-CN&authuser=0) to install.

## Manual Installation (ZIP Package)

1. **Download the Plugin ZIP Package**

   - Visit [GitHub Releases](https://github.com/wjszxli/AiAllSupport/releases).
   - Download the latest version **AiAllSupport.v1.0.zip**, and extract it to a local folder (e.g., `D:\AiAllSupport`).
   - Ensure that the extracted folder structure is correct (refer to the image below).

   ![Directory Structure](https://files.mdnice.com/user/14956/906ec0b4-93e9-4f91-a5c5-3c3851f30ac0.png)

2. **Load the Plugin in Chrome**
   - Go to `chrome://extensions/` and enable **Developer mode**.
   - Click "**Load unpacked**" and select the extracted plugin folder.
   - Once installed, you can enable the extension in your browser.

## Install from Source Code

If you want to compile the extension yourself, follow these steps:

```bash
# Clone the repository
git clone https://github.com/wjszxli/AiAllSupport.git

# Install dependencies
pnpm install

# Build the project
pnpm run build

```

Then, follow the **ZIP Package** Installation steps to manually load the extension from the extension directory in your browser.
