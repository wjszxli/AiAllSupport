## 安装指南

## Chrome 商店

点击 [这里](https://chromewebstore.google.com/detail/AiAllSupport/llogfbeeebfjkbmajodnjpljpfnaaplm?authuser=0&hl=zh-CN) 直接安装或者在 [Chrome 扩展商店](https://chromewebstore.google.com/?hl=zh-CN&authuser=0)搜索 “AiAllSupport” 进行安装。

## 手动安装（zip 包）

1. **下载插件压缩包**

   - 访问 [GitHub Releases](https://github.com/wjszxli/AiAllSupport/releases)。
   - 下载最新版本的 AiAllSupport.v1.0.zip，解压至本地文件夹（如 D:\AiAllSupport）。
   - 请确保解压后的文件夹结构正确（参考下图）。

   ![目录结构](https://files.mdnice.com/user/14956/906ec0b4-93e9-4f91-a5c5-3c3851f30ac0.png)

2. **在 Chrome 浏览器中加载插件**
   - 访问 chrome://extensions/，启用**开发者模式**。
   - 点击 “**加载已解压的扩展程序**”，选择解压后的插件文件夹。
   - 安装完成后，即可在浏览器中启用插件。

## 源码安装

如果你希望自行编译插件，可以按照以下步骤进行：

```bash
# 克隆项目
git clone https://github.com/wjszxli/AiAllSupport.git

# 安装依赖
pnpm install

# 构建项目
pnpm run build
```

然后按照 ZIP 包安装方式，在浏览器中手动加载 extension 目录中的扩展程序。
