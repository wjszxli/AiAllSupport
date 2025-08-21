## 如何使用

### 确保插件已启用

1. Chrome 插件有个开关，如何关闭会无法使用插件

   - 在 Chrome 地址栏输入 chrome://extensions/，查找 AiAllSupport。
   - 确保插件处于 启用 状态，否则请手动开启， 参考下图。

   ![image](https://files.mdnice.com/user/14956/8254890c-6115-4444-a09b-7759693d3ce3.png)

### 选择 API 提供商 & 配置 API Key

1. **固定插件**：点击 Chrome 右上角 扩展程序按钮，找到 AiAllSupport 并固定到工具栏。

   ![image](https://files.mdnice.com/user/14956/38511b25-f47a-4d27-aac2-88b945f52a82.png)

2. **选择服务商**：点击插件图标，在弹出的界面选择 API 提供商。
3. **获取 API Key**：

   - 例如，服务商选择了“阿里云”，点击 “获取 API Key”，会跳转至 API Key 管理页面。

   ![image](https://files.mdnice.com/user/14956/54c3ee05-3a7c-42be-84c6-e7930468be4d.png)

   ![image](https://files.mdnice.com/user/14956/cc5bb0d6-9eba-4aad-b304-9afc25807fa6.png)

   - 在 API Key 页面点击 “创建 API Key”，填写必要信息后生成 API Key

   ![image](https://files.mdnice.com/user/14956/49bf383f-fcec-4a4a-ba38-d78b7c9a849b.png)

4. **填入 API Key**：复制 API Key 并粘贴到插件的 API Key 输入框 中，点击 “保存配置”。
   ![image](https://files.mdnice.com/user/14956/09fe006a-e53b-4baf-b0e7-887a588aee18.png)
5. 测试 API 连接：保存 API Key 后，插件会自动进行 API 连接测试，成功后即可使用。

   ![image](https://files.mdnice.com/user/14956/0808b080-157b-4631-a888-1b5627b8bc66.png)

   ![image](https://files.mdnice.com/user/14956/0c313ca4-5dbd-4141-874c-19614d18403d.png)

### 体验 AI 功能

- **网页选中文本**：选中任意网页文本，点击 DeepSeek 图标，即可调起 AI 对话窗口。

![image](https://files.mdnice.com/user/14956/4201fc0e-3541-43fa-87b6-5a88cd4ffb64.png)

![image](https://files.mdnice.com/user/14956/3d6ac9bc-5d60-405e-abe0-967374ff367b.png)

- **连续对话**：在对话窗口与 AI 进行多轮交流，获得流畅体验

- **浮动聊天按钮**：在页面右下角会显示一个浮动的聊天按钮，点击即可快速开始 AI 对话。如果不需要此功能，可在插件设置的"界面"选项卡中关闭"显示浮动聊天按钮"。

- **实时 AI 回复**：支持流式加载 AI 响应，提高交互效率。

![output](https://files.mdnice.com/user/14956/cbdf62b7-d3b2-4245-b801-49ccf267a946.gif)

### 🔍 体验 R1 模型

选择 DeepSeek R1 模型，可观察 AI 的推理过程，直观感受其思维逻辑。

![image](https://files.mdnice.com/user/14956/9219618d-ac17-4b86-8d83-54e1185c44f3.png)
![2](https://files.mdnice.com/user/14956/ee7dbbba-8e32-482a-a84a-117e24d77366.gif)

### 本地模型支持

#### 跨平台安装指南

跨平台安装指南 Ollama 作为本地运行大模型的利器，支持三大主流操作系统：

```
# macOS一键安装
# Windows用户
访问官网 https://ollama.com/download 下载安装包

# Linux安装（Ubuntu/Debian为例）
curl -fsSL https://ollama.com/install.sh | sudo bash
sudo usermod -aG ollama $USER  # 添加用户权限
sudo systemctl start ollama    # 启动服务
```

#### 服务验证

```
Ollama -v
# 输出 ollama version is 0.5.11
```

出现上述则表示安装成功，可浏览器访问 http://localhost:11434/验证

#### 安装模型

```
# 安装模型，如 deepseek-r1:7b，具体可以参考：https://ollama.com/search
ollama run deepseek-r1:7b
```

#### 配置本地模型

服务商选择本地 Ollama，模型选择你安装的模型，如下图所示

![image](https://files.mdnice.com/user/14956/aa56949a-ac4f-40c3-991d-6174e43b902a.png)

### 快捷键操作和自定义快捷键

#### 全局打开聊天窗口

默认快捷 mac 上为 `Command+Shift+Y`, windows 为 `Ctrl+Shift+Y`

#### 关闭聊天窗口

默认的快捷键为键盘右上角的 `Esc`，也可以点击聊天窗口右上角的 x 来关闭

#### 自定义快捷键

可以点击设置的设置快捷，进入快捷键自定义设置
![image](https://files.mdnice.com/user/14956/3d87a401-7999-4cfb-9c90-ac50a005302b.png)

### 窗口可以自由调整

1. 鼠标浮到右下角，可以调整高度和宽度
2. 鼠标浮到顶部，可以拖拽窗口
3. 点击左上角 📍，可以固定窗口或者取消固定窗口
   ![2](https://files.mdnice.com/user/14956/b9fbcf60-9c91-4528-b292-c57252be62d1.gif)

## 总结

AiAllSupport 是一款高效、便捷的 AI 插件，支持多个 DeepSeek API 提供商，让用户无需复杂的技术操作即可快速接入 AI 服务。无论是网页内容分析、多轮对话，还是代码高亮、Markdown 渲染，该插件都能提供一流的体验。

**🚀 立即体验 DeepSeek 极速 AI，探索更多可能性！**
