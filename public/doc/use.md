## How to Use

### Ensure the Extension is Enabled

1. Chrome extensions have an on/off switch, and the plugin will not work if it is turned off.

   - Type `chrome://extensions/` in the Chrome address bar and search for **DeepSeekAllSupports**.
   - Make sure the extension is **enabled**; otherwise, enable it manually. See the image below for reference.

   ![image](https://files.mdnice.com/user/14956/8254890c-6115-4444-a09b-7759693d3ce3.png)

### Select an API Provider & Configure API Key

1. **Pin the Extension**: Click the Chrome **Extensions** button in the top right corner, find **DeepSeekAllSupports**, and pin it to the toolbar.

   ![image](https://files.mdnice.com/user/14956/38511b25-f47a-4d27-aac2-88b945f52a82.png)

2. **Select an API Provider**: Click the extension icon and choose an API provider from the pop-up interface.
3. **Obtain an API Key**:

   - For example, if you choose **Aliyun** as the provider, click "**Get API Key**," and it will redirect you to the API Key management page.

   ![image](https://files.mdnice.com/user/14956/54c3ee05-3a7c-42be-84c6-e7930468be4d.png)

   ![image](https://files.mdnice.com/user/14956/cc5bb0d6-9eba-4aad-b304-9afc25807fa6.png)

   - On the API Key page, click "**Create API Key**," fill in the required information, and generate the API Key.

   ![image](https://files.mdnice.com/user/14956/49bf383f-fcec-4a4a-ba38-d78b7c9a849b.png)

4. **Enter the API Key**: Copy the API Key and paste it into the extension’s **API Key input field**, then click "**Save Configuration**."

   ![image](https://files.mdnice.com/user/14956/09fe006a-e53b-4baf-b0e7-887a588aee18.png)

5. **Test API Connection**: After saving the API Key, the extension will automatically test the API connection. Once successful, you can start using it.

   ![image](https://files.mdnice.com/user/14956/0808b080-157b-4631-a888-1b5627b8bc66.png)

   ![image](https://files.mdnice.com/user/14956/0c313ca4-5dbd-4141-874c-19614d18403d.png)

### Experience AI Features

- **Select Webpage Text**: Highlight any text on a webpage and click the **DeepSeek** icon to bring up the AI chat window.

  ![image](https://files.mdnice.com/user/14956/4201fc0e-3541-43fa-87b6-5a88cd4ffb64.png)

  ![image](https://files.mdnice.com/user/14956/3d6ac9bc-5d60-405e-abe0-967374ff367b.png)

- **Multi-turn Conversations**: Engage in continuous dialogue with AI for a smooth experience.

- **Real-time AI Responses**: Supports streaming responses for better interaction efficiency.

  ![output](https://files.mdnice.com/user/14956/cbdf62b7-d3b2-4245-b801-49ccf267a946.gif)

### 🔍 Experience the R1 Model

Choose the **DeepSeek R1 model** to observe AI’s reasoning process and understand its thought logic intuitively.

![image](https://files.mdnice.com/user/14956/9219618d-ac17-4b86-8d83-54e1185c44f3.png)  
![2](https://files.mdnice.com/user/14956/ee7dbbba-8e32-482a-a84a-117e24d77366.gif)

### Local Model Support

#### Cross-Platform Installation Guide

Ollama, a powerful tool for running large models locally, supports the three major operating systems:

```bash
# macOS One-Click Installation
# Windows Users
Visit the official website: https://ollama.com/download and download the installer.

# Linux Installation (Ubuntu/Debian example)
curl -fsSL https://ollama.com/install.sh | sudo bash
sudo usermod -aG ollama $USER  # Add user permissions
sudo systemctl start ollama    # Start the service

```
#### Service Verification
```bash
Ollama -v
# Output: ollama version is 0.5.11
```

If the above output appears, the installation was successful. You can visit http://localhost:11434/ in your browser to verify.

#### Install a Model
```bash
# Install a model, e.g., deepseek-r1:7b. For more options, check: https://ollama.com/search
ollama run deepseek-r1:7b
```

#### Configure Local Model

Select **Ollama (Local)** as the provider and choose the model you installed.

### Keyboard Shortcuts & Custom Shortcuts

**Open Chat Window Globally**
- Mac: Command + Shift + Y
- Windows: Ctrl + Shift + Y

**Close Chat Window**
- Default shortcut: Press Esc (top-right of the keyboard).
- Alternatively, click the “X” button in the top right of the chat window.

### Customize Shortcuts

You can configure shortcuts by clicking on Settings → Shortcut Keys.

### Adjustable Chat Window
	1.	Hover the mouse over the bottom-right corner to resize the window.
	2.	Hover over the top of the window to drag and reposition it.
	3.	Click the 📍 (pin icon) in the top-left to pin/unpin the window.

### Summary

DeepSeekAllSupports is an efficient and user-friendly AI extension that supports multiple DeepSeek API providers, enabling users to integrate AI services effortlessly without complex configurations. Whether it’s web content analysis, multi-turn conversations, code highlighting, or Markdown rendering, this extension delivers an exceptional experience.

🚀 Try DeepSeek’s AI Now and Unlock More Possibilities!

