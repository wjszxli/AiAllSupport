import { useCallback } from 'react';
import { Message } from '@/types/message';
import { MessageBlockType, MessageBlockStatus } from '@/types/messageBlock';
import rootStore from '@/store';
import robotStore from '@/store/robot';
import { MessageThunkService } from '@/store/messageThunk';
import { message as AntdMessage } from 'antd';
import { t } from '@/locales/i18n';

export const useMessageOperations = (streamingMessageId: string | null) => {
    // 获取消息内容（从 MessageBlock 中获取）
    const getMessageContent = useCallback((message: Message): string => {
        if (!message.blocks || message.blocks.length === 0) {
            console.log(`[getMessageContent] Message ${message.id} has no blocks`);
            return '';
        }

        const blocks = message.blocks
            .map((blockId) => {
                const block = rootStore.messageBlockStore.getBlockById(blockId);
                if (!block) {
                    console.warn(`[getMessageContent] Block ${blockId} not found in store`);
                }
                return block;
            })
            .filter(Boolean);

        if (blocks.length === 0) {
            console.warn(`[getMessageContent] No valid blocks found for message ${message.id}`);
            return '';
        }

        // 获取所有类型的块内容（暂时恢复原逻辑以确保内容显示）
        const content = blocks
            .filter((block): block is NonNullable<typeof block> => {
                if (!block) return false;

                // 包含所有有内容的块类型
                const hasContent =
                    block.type === MessageBlockType.MAIN_TEXT ||
                    // block.type === MessageBlockType.THINKING ||
                    block.type === MessageBlockType.CODE;

                const hasContentProperty = 'content' in block;

                return hasContent && hasContentProperty;
            })
            .map((block) => {
                const content = (block as any).content || '';
                return content;
            })
            .join('');

        console.log(`[getMessageContent] Message ${message.id} content (all blocks):`, {
            totalBlocks: blocks.length,
            thinkingBlocks: blocks.filter((b) => b?.type === MessageBlockType.THINKING).length,
            mainTextBlocks: blocks.filter((b) => b?.type === MessageBlockType.MAIN_TEXT).length,
            codeBlocks: blocks.filter((b) => b?.type === MessageBlockType.CODE).length,
            contentLength: content.length,
            preview: content.substring(0, 100),
        });

        return content;
    }, []);

    // 检查消息是否正在流式显示
    const isMessageStreaming = useCallback(
        (message: Message): boolean => {
            // 首先检查是否是当前流式消息
            if (streamingMessageId === message.id) {
                return true;
            }

            // 其次检查消息的块是否有流式状态
            if (message.blocks && message.blocks.length > 0) {
                return message.blocks.some((blockId) => {
                    const block = rootStore.messageBlockStore.getBlockById(blockId);
                    return block && block.status === MessageBlockStatus.STREAMING;
                });
            }

            return false;
        },
        [streamingMessageId],
    );

    // 复制消息内容
    const handleCopyMessage = useCallback((text: string) => {
        navigator.clipboard
            .writeText(text)
            .then(() => {
                AntdMessage.success(t('copied') || '已复制', 2);
            })
            .catch(() => {
                AntdMessage.error(t('failedCopy') || '复制失败');
            });
    }, []);

    // 重新生成响应
    const handleRegenerateResponse = useCallback((assistantMessage: Message) => {
        console.log('开始重新生成响应', assistantMessage);

        try {
            // 获取当前选中的话题ID
            const selectedTopicId = robotStore.selectedRobot.selectedTopicId;
            if (!selectedTopicId) {
                console.error('[handleRegenerateResponse] No selected topic');
                AntdMessage.error(t('errorRegenerating') || '重新生成失败：未选择话题');
                return;
            }

            // 获取当前机器人配置
            const robot = robotStore.selectedRobot;
            if (!robot) {
                console.error('[handleRegenerateResponse] No selected robot');
                AntdMessage.error(t('errorRegenerating') || '重新生成失败：未选择机器人');
                return;
            }

            // 检查是否是助手消息
            if (assistantMessage.role !== 'assistant') {
                console.error('[handleRegenerateResponse] Message is not from assistant');
                AntdMessage.error(t('errorRegenerating') || '重新生成失败：只能重新生成助手消息');
                return;
            }

            // 创建消息服务实例并调用重新生成
            const messageService = new MessageThunkService(rootStore);
            messageService.regenerateAssistantResponse(selectedTopicId, assistantMessage, robot);

            AntdMessage.info(t('regenerating') || '正在重新生成...', 2);
        } catch (error) {
            console.error('[handleRegenerateResponse] Error:', error);
            AntdMessage.error(t('errorRegenerating') || '重新生成失败');
        }
    }, []);

    return {
        getMessageContent,
        isMessageStreaming,
        handleCopyMessage,
        handleRegenerateResponse,
    };
};
