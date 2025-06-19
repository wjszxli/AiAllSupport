/**
 * 思考内容提取器
 * 用于从模型响应中提取思考内容
 */

import { Logger } from '@/utils/logger';

// Create a logger for this module
const logger = new Logger('thinkingExtractor');

interface ThinkingTag {
    openingTag: string;
    closingTag: string;
}

const THINKING_TAGS: ThinkingTag[] = [
    { openingTag: '<think>', closingTag: '</think>' },
    { openingTag: '###Thinking', closingTag: '###Response' },
    { openingTag: '##思考过程', closingTag: '##回答' },
    { openingTag: '<reasoning>', closingTag: '</reasoning>' },
];

/**
 * 检测字符串中是否包含思考标记
 * @param text 要检查的文本
 * @returns 是否包含思考标记
 */
export function hasThinkingTags(text: string): boolean {
    if (!text) return false;
    return THINKING_TAGS.some(
        (tag) => text.includes(tag.openingTag) || text.includes(tag.closingTag),
    );
}

/**
 * 检查robot.prompt中是否包含思考标记
 * @param prompt robot的提示词
 * @returns 是否需要思考模式
 */
export function shouldEnableThinkingMode(prompt?: string): boolean {
    if (!prompt) return false;

    // 检查是否包含任何思考标记
    const containsTag = hasThinkingTags(prompt);

    // 检查是否包含思考相关的关键词
    const containsKeywords =
        prompt.includes('思考过程') ||
        prompt.includes('thinking process') ||
        prompt.includes('reasoning') ||
        prompt.includes('think step by step');

    const result = containsTag || containsKeywords;

    logger.debug('Thinking mode check:', {
        prompt: prompt?.substring(0, 50) + '...',
        containsTag,
        containsKeywords,
        result,
        tags: THINKING_TAGS.map((tag) => ({
            openingTag: tag.openingTag,
            closingTag: tag.closingTag,
            promptHasOpeningTag: prompt.includes(tag.openingTag),
            promptHasClosingTag: prompt.includes(tag.closingTag),
        })),
    });

    return result;
}

/**
 * 检测是否是思考开始
 * @param text 要检查的文本
 * @returns 是否是思考开始
 */
export function isThinkingStart(text: string): boolean {
    return THINKING_TAGS.some((tag) => text.includes(tag.openingTag));
}

/**
 * 检测是否是思考结束
 * @param text 要检查的文本
 * @returns 是否是思考结束
 */
export function isThinkingEnd(text: string): boolean {
    return THINKING_TAGS.some((tag) => text.includes(tag.closingTag));
}

/**
 * 从完整响应中提取思考内容和回复内容
 * @param fullText 完整的响应文本
 * @returns 包含思考内容和回复内容的对象
 */
export function extractThinkingAndResponse(fullText: string): {
    thinking: string;
    response: string;
} {
    let thinking = '';
    let response = fullText;

    for (const tag of THINKING_TAGS) {
        const startIdx = fullText.indexOf(tag.openingTag);
        const endIdx = fullText.indexOf(tag.closingTag);

        if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            thinking = fullText.substring(startIdx + tag.openingTag.length, endIdx).trim();

            // 提取响应内容（思考标记后的内容）
            response = fullText.substring(endIdx + tag.closingTag.length).trim();
            break;
        }
    }

    return { thinking, response };
}

/**
 * 检测文本是否在思考标签内
 * 用于流式处理时判断当前文本是否应该作为思考内容处理
 * @param text 要检查的文本
 * @param currentState 当前是否在思考标签内
 * @returns 更新后的状态和提取的内容
 */
export function detectThinkingBoundaries(
    text: string,
    currentState: { isThinking: boolean; thinkingContent: string; responseContent: string },
): { isThinking: boolean; thinkingContent: string; responseContent: string } {
    const result = { ...currentState };

    // 调试日志
    logger.debug('Detecting thinking boundaries:', {
        textLength: text.length,
        textFirst50Chars: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        currentState: result.isThinking ? 'thinking' : 'not thinking',
    });

    // 如果当前不在思考模式，检查是否有开始标签
    if (!result.isThinking) {
        let foundStart = false;
        let startIdx = -1;
        let startTagEndIndex = -1;
        let startTagName = '';

        // 检查所有可能的开始标签
        for (const tag of THINKING_TAGS) {
            startIdx = text.indexOf(tag.openingTag);
            if (startIdx !== -1) {
                foundStart = true;
                startTagEndIndex = startIdx + tag.openingTag.length;
                startTagName = tag.openingTag;
                break;
            }
        }

        // 如果找到了开始标签
        if (foundStart) {
            logger.debug('Found thinking start tag:', {
                tag: startTagName,
                position: startIdx,
                contentAfterTag: text.substring(startTagEndIndex, startTagEndIndex + 20) + '...',
            });

            result.isThinking = true;

            // 提取思考内容（从标签后开始）
            const thinkingPart = text.substring(startTagEndIndex);

            // 检查思考部分是否包含结束标签
            let endIdx = -1;
            let endTagName = '';
            let endTagLength = 0;

            // 查找对应的结束标签
            for (const tag of THINKING_TAGS) {
                if (tag.openingTag === startTagName) {
                    endIdx = thinkingPart.indexOf(tag.closingTag);
                    if (endIdx !== -1) {
                        endTagName = tag.closingTag;
                        endTagLength = tag.closingTag.length;
                        break;
                    }
                }
            }

            // 如果在同一块中找到了结束标签
            if (endIdx !== -1) {
                logger.debug('Found end tag in the same block:', {
                    tag: endTagName,
                    position: endIdx,
                    thinkingContent: thinkingPart.substring(0, Math.min(endIdx, 20)) + '...',
                });

                // 提取思考内容（不包含结束标签）
                result.thinkingContent += thinkingPart.substring(0, endIdx);

                // 提取响应内容（结束标签之后的部分）
                result.responseContent += thinkingPart.substring(endIdx + endTagLength);

                // 设置状态为非思考模式
                result.isThinking = false;
            } else {
                // 没有找到结束标签，整个部分都是思考内容
                result.thinkingContent += thinkingPart;
            }

            // 如果有标签前的内容，添加到响应内容
            if (startIdx > 0) {
                result.responseContent += text.substring(0, startIdx);
            }
        } else {
            // 没有找到开始标签，整个文本都是响应内容
            result.responseContent += text;
        }
    } else {
        // 当前在思考模式，检查是否有结束标签
        let foundEnd = false;
        let endIdx = -1;
        let endTagName = '';
        let endTagLength = 0;

        // 查找任何可能的结束标签
        for (const tag of THINKING_TAGS) {
            endIdx = text.indexOf(tag.closingTag);
            if (endIdx !== -1) {
                foundEnd = true;
                endTagName = tag.closingTag;
                endTagLength = tag.closingTag.length;
                break;
            }
        }

        if (foundEnd) {
            logger.debug('Found thinking end tag:', {
                tag: endTagName,
                position: endIdx,
                thinkingContent: text.substring(0, Math.min(endIdx, 20)) + '...',
            });

            // 提取思考内容（结束标签之前的部分）
            result.thinkingContent += text.substring(0, endIdx);

            // 提取响应内容（结束标签之后的部分）
            result.responseContent += text.substring(endIdx + endTagLength);

            // 设置状态为非思考模式
            result.isThinking = false;
        } else {
            // 没有找到结束标签，整个文本都是思考内容
            result.thinkingContent += text;
        }
    }

    return result;
}

/**
 * 清理思考内容，移除多余的空白和标记
 * @param content 思考内容
 * @returns 清理后的内容
 */
export function cleanThinkingContent(content: string): string {
    if (!content) return '';

    let cleaned = content;

    // 移除可能残留的思考标记
    for (const tag of THINKING_TAGS) {
        cleaned = cleaned.replace(tag.openingTag, '').replace(tag.closingTag, '');
    }

    // 移除开头和结尾的空白
    cleaned = cleaned.trim();

    // 如果内容为空，返回空字符串
    if (!cleaned) return '';

    return cleaned;
}
