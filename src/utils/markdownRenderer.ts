import hljs from 'highlight.js';
import MarkdownIt from 'markdown-it';
import mathjax3 from 'markdown-it-mathjax3';

// 使用 WeakMap 来缓存已处理过的数学公式
const processedTexts = new Map();

// 使用 Memoization 优化预处理数学公式
const memoizedPreprocessMath = (() => {
    const cache = new Map();
    return (text: string) => {
        if (cache.has(text)) {
            return cache.get(text);
        }

        const result = preprocessMath(text);
        cache.set(text, result);
        return result;
    };
})();

// 预处理数学公式
function preprocessMath(text: string) {
    // 使用正则表达式优化：减少重复处理
    const patterns = {
        brackets: /[()[\]{}]/g,
        blockFormula: /\\\[([\S\s]*?)\\]/g,
        inlineFormula: /\\\(([\S\s]*?)\\\)/g,
        subscripts: /(\d+|[A-Za-z])([^_])(\d+)(?!})/g,
        specialSymbols: /\\(pm|mp|times|div|gamma|ln|int|infty|leq|geq|neq|approx)\b/g,
    };

    // 批量处理文本替换
    let processed = text.replace(/\n{3,}/g, '\n\n').replace(/[\t ]+$/gm, '');

    // 优化块级公式处理
    processed = processed.replace(
        patterns.blockFormula,
        (_, p1) => `\n$$${p1.trim().replace(/\n\s+/g, '\n')}$$\n`,
    );

    // 优化行内公式处理
    processed = processed.replace(patterns.inlineFormula, (_, p1) => `$${p1.trim()}$`);

    // 优化上下标处理
    processed = processed.replace(patterns.subscripts, '$1$2{$3}');

    // 使用 Map 优化特殊字符替换
    const specialChars = new Map([
        ['∫', '\\int '],
        ['±', '\\pm '],
        ['∓', '\\mp '],
        ['×', '\\times '],
        ['÷', '\\div '],
        ['∞', '\\infty '],
        ['≤', '\\leq '],
        ['≥', '\\geq '],
        ['≠', '\\neq '],
        ['≈', '\\approx '],
    ]);

    // 批量处理特殊字符
    for (const [char, replacement] of specialChars) {
        processed = processed.replaceAll(char, replacement);
    }

    return processed;
}

// 创建 MarkdownIt 实例并优化配置
// @ts-expect-error
const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    // @ts-expect-error
    highlight: (str, lang) => {
        if (!lang || !hljs.getLanguage(lang)) {
            return `<div class="code-wrap">${md.utils.escapeHtml(str)}</div>`;
        }
        try {
            return `<div class="code-wrap">${hljs.highlight(str, { language: lang }).value}</div>`;
        } catch {
            return `<div class="code-wrap">${md.utils.escapeHtml(str)}</div>`;
        }
    },
});

// 优化 mathjax 配置
const mathjaxOptions = {
    tex: {
        inlineMath: [['$', '$']],
        displayMath: [['$$', '$$']],
        processEscapes: true,
        processEnvironments: true,
        packages: ['base', 'ams', 'noerrors', 'noundefined'],
    },
    options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoreHtmlClass: 'tex2jax_ignore',
        processHtmlClass: 'tex2jax_process',
    },
    chtml: {
        scale: 1,
        minScale: 0.5,
        mtextInheritFont: true,
        merrorInheritFont: true,
    },
};

md.use(mathjax3, mathjaxOptions);

// 优化渲染方法
const originalRender = md.render.bind(md);
md.render = function (text: string) {
    try {
        // 使用缓存的预处理结果
        const preprocessedText = memoizedPreprocessMath(text);

        if (processedTexts.has(preprocessedText)) {
            return processedTexts.get(preprocessedText);
        }

        const result = originalRender(preprocessedText)
            // @ts-expect-error
            .replace(/\$\$([\S\s]+?)\$\$/g, (_, p1) => `<div class="math-block">$$${p1}$$</div>`)
            // @ts-expect-error
            .replace(/\$([^$]+?)\$/g, (_, p1) => `<span class="math-inline">$${p1}$</span>`);

        processedTexts.set(preprocessedText, result);
        return result;
    } catch (error) {
        console.error('渲染错误:', error);
        return originalRender(text);
    }
};

// 优化代码块渲染器
md.renderer.rules.fence = (() => {
    const defaultFence = md.renderer.rules.fence;

    // @ts-expect-error
    return function (tokens, idx, options, env, self) {
        const token = tokens[idx];
        const code = token.content.trim();

        const rawHtml = defaultFence(tokens, idx, options, env, self);

        return `
      <div>
        <pre class="code-wrap">${rawHtml}</pre>
        <button class="copy-button" data-code="${encodeURIComponent(code)}">
          复制代码
        </button>
      </div>
    `.trim();
    };
})();

// 使用事件委托处理复制按钮点击
document.addEventListener(
    'click',
    async (event) => {
        const target = event.target as HTMLElement;
        const copyButton = target.closest('.copy-button');
        if (!copyButton) return;

        event.preventDefault();
        event.stopPropagation();

        // @ts-expect-error
        const code = decodeURIComponent(copyButton?.dataset?.code);
        if (code) {
            try {
                await navigator.clipboard.writeText(code);
            } catch (error) {
                console.error('Failed to copy:', error);
            }
        } else {
            console.warn('No code text found to copy');
        }
    },
    true,
);
export { md };
