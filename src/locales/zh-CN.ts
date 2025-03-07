export const zhCN = {
    // General
    ok: '确定',
    cancel: '取消',
    save: '保存',
    delete: '删除',
    copy: '复制',
    regenerate: '重新生成',
    settings: '设置',
    stop: '停止',

    // App settings
    appTitle: 'AI 工具',
    saveConfig: '保存配置',
    savingConfig: '保存配置中',
    serviceProvider: '服务商',
    selectProvider: '请选择服务商',
    apiKey: 'API Key',
    enterApiKey: '请输入您的 API Key',
    getApiKey: '获取 API Key',
    modelSelection: '模型选择',
    selectModel: '请选择您要使用的模型',
    showIcon: '是否选中文本出现图标',
    setShortcuts: '设置快捷键',
    starAuthor: '给作者点赞 ｜ 联系作者',
    configSaved: '配置已保存',
    validatingApi: '校验 api 是否正常',
    apiValidSuccess: 'Api Key 校验通过，可以正常使用本工具',
    savingConfigError: '保存配置失败，请重试。',
    aiAssistant: 'AI 助手',
    askAnything: '今天我能帮您做什么？',
    exampleSummarize: '总结这个网页',
    exampleMainPoints: '这篇文章的要点是什么？',
    exampleHowToUse: '如何使用这个信息？',
    typeMessage: '输入 / 可以获得建议或直接输入您的消息...',

    // Chat interface
    send: '发送',
    thinking: 'AI 正在思考...',
    think: '已深思熟虑',
    you: '你',
    assistant: 'AI 助手',
    askWebpage: '询问关于这个网页...',
    sendMessage: '发送消息...',
    interfaceSettings: '界面设置',

    // Messages
    errorProcessing: '抱歉，处理您的请求时出错。请重试。',
    errorRegenerating: '抱歉，重新生成回复时出错。请重试。',
    copied: '已复制到剪贴板',
    failedCopy: '复制文本失败',
    codeCopied: '代码已复制到剪贴板',
    failedCodeCopy: '复制代码失败',
    copyMessage: '复制成功',

    // Config component
    selectProviderFirst: '请先点击插件图标选择服务提供商',
    unpinWindow: '取消固定窗口',
    pinWindow: '固定窗口',

    // Language names
    language: '语言',
    languageEn: 'English',
    languageZhCN: '简体中文',
    languageZhTW: '繁體中文',
    languageJa: '日本語',
    languageKo: '한국어',
    languageChanged: '语言已成功更改',
    includeWebpage: '基于当前网页进行回答',
    includeWebpageTooltip: '启用后，AI 会基于当前网页内容进行回答',
    // Slash command prompts
    translate: '翻译',
    translatePrompt: '将以下文本翻译成中文：',
    summarize: '总结',
    summarizePrompt: '简洁地总结以下文本：',
    explain: '解释',
    explainPrompt: '用简单的术语解释以下概念：',
    codeReview: '代码审查',
    codeReviewPrompt: '审查以下代码并提出改进建议：',
    rewrite: '重写',
    rewritePrompt: '重写以下文本，使其更专业：',

    webSearch: '网络搜索',
    webSearchTooltip: '启用网络搜索获取最新信息',
    on: '开启',
    off: '关闭',
    searchingWeb: '正在搜索网络信息...',
    searchComplete: '搜索完成，正在用AI处理结果...',
    noSearchResults: '未找到搜索结果，仅使用AI知识回答...',
    exclusiveFeatureError: '网络搜索和当前网页回答不能同时启用。请只启用其中一个。',
    webSearchResultsTips1: '下面是一些来自网络的最新信息，可能有助于回答这个问题',
    webSearchResultsTips2: '根据这些信息和你的知识，请回答这个问题',
    Source: '来源',
    close: '关闭',
    webpageContent: '以下是当前网页的内容：',
    webpagePrompt: '根据这个网页，请回答我的问题',
    fetchWebpageContent: '正在获取当前网页内容...',
    fetchWebpageContentSuccess: '获取网页内容成功，正在用AI处理结果...',
    fetchWebpageContentFailed: '获取网页内容失败，仅使用AI知识回答...',
    pleaseInputApiKey: '请在配置页输入 API Key 哦',

    REFERENCE_PROMPT: `请根据参考资料回答问题

## 标注规则：
- 请在适当的情况下在句子末尾引用上下文。
- 请按照引用编号[number]的格式在答案中对应部分引用上下文。
- 如果一句话源自多个上下文，请列出所有相关的引用编号，例如[1][2]，切记不要将引用集中在最后返回引用编号，而是在答案对应部分列出。

## 我的问题是：

{question}

## 参考资料：

{references}

请使用同用户问题相同的语言进行回答。
`,
};
