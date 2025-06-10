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
    validated: '已验证',
    edit: '修改',
    clear: '清空',
    create: '创建',

    // Add suggested prompts
    suggestedPrompt1: '解释一下深度学习和机器学习的区别',
    suggestedPrompt2: '帮我优化一段Python代码',
    suggestedPrompt3: '如何提高英语口语水平',
    suggestedPrompt4: '推荐几本经典科幻小说',

    // App and interface
    appTitle: 'AI 工具',
    assistants: '机器人',
    topics: '话题',
    expand: '展开',
    collapse: '折叠',

    // Topic management
    newTopic: '新建话题',
    searchTopics: '搜索话题...',
    noTopicsFound: '未找到相关话题',
    noTopics: '暂无话题',
    createTopic: '创建话题',
    editTopic: '编辑话题',
    enterTopicName: '请输入话题名称',
    topicNameRequired: '请输入话题名称',
    topicCreated: '话题创建成功',
    topicUpdated: '话题更新成功',
    topicDeleted: '话题删除成功',
    deleteTopicConfirm: '确认删除话题',
    deleteTopicContent: '确定要删除话题',
    question: '吗？',

    // App settings
    saveConfig: '保存配置',
    savingConfig: '保存配置中',
    serviceProvider: '服务商',
    selectProvider: '请选择服务商',
    apiKey: 'API Key',
    enterApiKey: '请输入您的 API Key',
    getApiKey: '获取 API Key',
    validate: '检测',
    apiHost: 'API 地址',
    enterApiHost: '请输入您的 API 地址',
    modelSelection: '模型选择',
    selectModel: '请选择您要使用的模型',
    showIcon: '划词工具栏',
    setShortcuts: '设置快捷键',
    starAuthor: '给作者点赞 ｜ 联系作者',
    configSaved: '配置已保存',
    validatingApi: '校验 api 是否正常',
    apiValidSuccess: 'Api Key 校验通过，可以正常使用本工具',
    apiValidFailed: 'API Key 验证失败',
    savingConfigError: '保存配置失败，请重试。',
    aiAssistant: 'AI 助手',
    askAnything: '今天我能帮您做什么？',
    exampleSummarize: '总结这个网页',
    exampleMainPoints: '这篇文章的要点是什么？',
    exampleHowToUse: '如何使用这个信息？',
    typeMessage: '输入 / 可以获得建议或直接输入您的消息...',
    defaultTopicName: '新对话',

    // Chat interface
    send: '发送',
    thinking: 'AI 正在思考...',
    think: '已深思熟虑',
    processing: '思考中...',
    interrupted: '已中断',
    you: '你',
    assistant: 'AI 助手',
    askWebpage: '询问关于这个网页...',
    sendMessage: '发送消息...',
    interfaceSettings: '界面设置',
    errorProcessing: '处理消息时出错，请重试',
    errorRegenerating: '重新生成回复时出错，请重试',
    regenerating: '正在重新生成...',
    copied: '已复制到剪贴板',
    failedCopy: '复制失败',
    codeCopied: '代码已复制',
    failedCodeCopy: '代码复制失败',
    copyMessage: '复制成功',
    selectProviderFirst: '请先点击插件图标选择服务商',
    unpinWindow: '取消固定窗口',
    pinWindow: '固定窗口',
    language: '语言',
    languageEn: 'English',
    languageZhCN: '简体中文',
    languageZhTW: '繁體中文',
    languageJa: '日本語',
    languageKo: '한국어',
    languageChanged: '语言切换成功',
    includeWebpage: '提问中包含网页上下文',
    includeWebpageTooltip: '开启此功能，允许 AI 使用当前网页内容辅助回答',
    translate: '翻译',
    translatePrompt: '将以下文本翻译成中文：',
    summarize: '总结',
    summarizePrompt: '请简明扼要地总结以下文本：',
    explain: '解释',
    explainPrompt: '用简单的术语解释以下概念：',
    codeReview: '代码审查',
    codeReviewPrompt: '审查以下代码并提出改进建议：',
    rewrite: '重写',
    rewritePrompt: '重写以下文本，使其更专业：',
    webSearch: '网络搜索',
    webSearchTooltip: '启用网络搜索以获取实时信息',
    on: '开启',
    off: '关闭',
    searchingWeb: '正在搜索网络信息...',
    searchComplete: '搜索完成。正在用AI处理结果...',
    noSearchResults: '未找到搜索结果。仅使用AI知识库...',
    exclusiveFeatureError: '网络搜索和网页上下文不能同时启用。请只启用其中一个。',
    exclusiveFeatureWarning: '网络搜索和网页上下文不能同时启用。请只启用其中一个。',
    webSearchResultsTips1: '以下是从网络上获取的一些最新信息，可能有助于回答这个问题：',
    webSearchResultsTips2: '基于这些信息和您的知识，请回答这个问题',
    Source: '来源',
    close: '关闭',
    webpageContent: '以下是我当前浏览的网页内容：',
    webpagePrompt: '根据这个网页内容，请回答我的问题',
    fetchWebpageContent: '正在获取当前网页内容...',
    fetchWebpageContentSuccess: '成功获取网页内容，正在使用AI处理...',
    fetchWebpageContentFailed: '获取网页内容失败。仅使用AI知识库...',
    pleaseInputApiKey: '请在配置页面输入您的API Key。',
    REFERENCE_PROMPT: `请根据参考材料回答问题。

## 标注规则：
- 在适当的时候，请在句子末尾引用上下文。
- 请使用[数字]格式引用答案中相应的部分。
- 如果一个句子源自多个上下文，请列出所有相关的引用编号，例如[1][2]。记住不要将引用集中在末尾，而是在答案的相应部分列出它们。

## 我的问题是：

{question}

## 参考材料：

{references}

请用与用户问题相同的语言回答。`,

    filteredDomains: '过滤的域名',
    searchEngines: '启用的搜索引擎',
    openSettings: '设置',
    openChat: '聊天',
    openSidebar: '总结当前页面',
    pressTip: '按回车键发送，Shift+回车创建新行',
    welcomeMessage: '欢迎使用AI助手！我能为您做什么？',
    tryAsking: '试试问我：',

    // 新增的翻译键值
    apiSettings: 'API 设置',
    interface: '界面',
    search: '搜索',
    about: '关于',
    tavilyApiKey: 'Tavily API 密钥',
    enterTavilyApiKey: '请输入 Tavily API 密钥',
    getTavilyApiKey: '获取 Tavily API 密钥',
    selectAtLeastOneSearchEngine: '启用网络搜索时请至少选择一个搜索引擎',
    noFilteredDomains: '没有过滤的域名',
    enterDomainToFilter: '输入要过滤的域名',
    add: '添加',
    enableWebSearchMessage: '启用网络搜索以配置搜索设置。',
    aboutDescription: '一个强大的浏览器扩展，将 AI 大模型模型集成到您的浏览体验中。',

    // 自动保存相关翻译
    autoSaving: '正在保存...',
    autoSaved: '已保存更改',
    autoSaveError: '保存更改时出错',

    // Tavily API 验证相关翻译
    validatingTavilyApi: '正在验证 Tavily API 密钥...',
    tavilyApiValidSuccess: 'Tavily API 密钥验证成功',
    tavilyApiValidError: 'Tavily API 密钥验证失败',

    // 反馈按钮翻译
    feedback: '提供反馈',

    // API Key 错误提示
    apiKeyNeeded: '您需要设置API Key才能使用此功能，是否现在前往设置页面？',
    enterQuestion: '请输入您的问题...',

    // 系统提示信息
    systemPrompt: '你是一个 AI 助手，请回答用户的问题',
    modelListNotSupported: '当前服务商不支持模型列表',

    // 错误信息
    pleaseSelectProvider: '请先选择服务商',
    pleaseEnterApiKey: '请输入 API Key',
    providerBaseUrlNotFound: '未找到 {provider} 的基础 URL',
    httpError: 'HTTP {status} {statusText}',
    invalidProviderData: '数据非法，没有服务商：{provider}',
    backgroundSearchFailed: '后台搜索失败',
    webContentFetchFailed: '后台网页内容获取失败',
    baiduSearchFailed: '百度搜索请求失败，状态码: {status}',
    googleSearchFailed: 'Google搜索请求失败，状态码: {status}',
    duckduckgoSearchFailed: 'DuckDuckGo搜索请求失败，状态码: {status}',
    sogouSearchFailed: '搜狗搜索请求失败，状态码: {status}',
    braveSearchFailed: 'Brave搜索请求失败，状态码: {status}',
    searxngSearchFailed: 'SearXNG搜索请求失败，状态码: {status}',
    clearConfirmTitle: '清除聊天记录',
    clearConfirmContent: '确定要清除聊天记录吗？',
    chatCleared: '聊天记录已清除',
    showIconTooltip: '开启此功能，允许 AI 工具在浏览器划词之后显示',
    chatWithAI: '与AI聊天',
    clearChat: '清除聊天',
    startChat: '开始聊天',
    ai: 'AI',
    summarizePage: `
请对以下网页进行结构化总结，包括以下三个部分：
1. 总结：用简明的语言总结网页的核心内容，突出主要信息或主题。
2. 摘要：详细介绍网页的主要内容，包括背景、关键点、流程、技术细节（如果适用）或相关信息。
3. 观点：概括网页的核心价值点，如主要结论、重要影响、创新点、启示或建议等。
请注意，您的回答应该清晰、具体，为读者提供有效的指导，同时考虑个人兴趣和目标。此外，请提供实用的例子和资源，帮助读者更好地理解和应用学习策略。
	网页内容：{content}
    `,

    // Logging related translations
    options_tab_logging: '日志系统',
    options_logging_settings: '日志设置',
    options_logging_enabled: '启用日志',
    options_logging_level: '日志级别',
    options_logging_level_debug: '调试',
    options_logging_level_info: '信息',
    options_logging_level_warn: '警告',
    options_logging_level_error: '错误',
    options_logging_include_timestamp: '包含时间戳',
    options_logging_to_console: '输出到控制台',
    options_logging_persist: '持久化日志',
    options_logging_max_persisted: '最大持久化日志数量',
    options_logging_clear: '清除日志',
    options_logging_settings_saved: '日志设置已保存',
    options_logging_settings_save_failed: '保存日志设置失败',
    options_logging_cleared: '日志已清除',
    options_logging_clear_failed: '清除日志失败',
};
