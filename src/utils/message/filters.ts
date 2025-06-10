import { Message } from '@/types/message';
import { MessageBlockType } from '@/types/messageBlock';
import { isEmpty, remove } from 'lodash';
import rootStore from '@/store';

export function filterContextMessages(messages: Message[]): Message[] {
    const clearIndex = messages.findIndex((message: Message) => message.type === 'clear');

    if (clearIndex === -1) {
        return messages;
    }

    return messages.slice(clearIndex + 1);
}

export function getGroupedMessages(messages: Message[]): {
    [key: string]: (Message & { index: number })[];
} {
    const groups: { [key: string]: (Message & { index: number })[] } = {};
    messages.forEach((message, index) => {
        // Use askId if available (should be on assistant messages), otherwise group user messages individually
        const key =
            message.role === 'assistant' && message.askId
                ? 'assistant' + message.askId
                : message.role + message.id;
        if (key && !groups[key]) {
            groups[key] = [];
        }
        groups[key].push({ ...message, index }); // Add message with its original index
        // Sort by index within group to maintain original order
        groups[key].sort((a, b) => b.index - a.index);
    });
    return groups;
}

export function filterUsefulMessages(messages: Message[]): Message[] {
    let _messages = [...messages];
    const groupedMessages = getGroupedMessages(messages);

    Object.entries(groupedMessages).forEach(([key, groupedMsgs]) => {
        if (key.startsWith('assistant')) {
            const usefulMessage = groupedMsgs.find((m) => m.useful === true);
            if (usefulMessage) {
                // Remove all messages in the group except the useful one
                groupedMsgs.forEach((m) => {
                    if (m.id !== usefulMessage.id) {
                        remove(_messages, (o) => o.id === m.id);
                    }
                });
            } else if (groupedMsgs.length > 0) {
                // Keep only the last message if none are marked useful
                const messagesToRemove = groupedMsgs.slice(0, -1);
                messagesToRemove.forEach((m) => {
                    remove(_messages, (o) => o.id === m.id);
                });
            }
        }
    });

    // Remove trailing assistant messages
    while (_messages.length > 0 && _messages[_messages.length - 1].role === 'assistant') {
        _messages.pop();
    }

    // Filter adjacent user messages, keeping only the last one
    _messages = _messages.filter((message, index, origin) => {
        return !(
            message.role === 'user' &&
            index + 1 < origin.length &&
            origin[index + 1].role === 'user'
        );
    });

    return _messages;
}

export function filterEmptyMessages(messages: Message[]): Message[] {
    return messages.filter((message) => {
        let hasContent = false;
        for (const blockId of message.blocks) {
            const block = rootStore.messageBlockStore.getBlockById(blockId);
            if (!block) continue;
            if (
                block.type === MessageBlockType.MAIN_TEXT &&
                !isEmpty((block as any).content?.trim())
            ) {
                // Type assertion needed
                hasContent = true;
                break;
            }
            if (
                [
                    MessageBlockType.CODE,
                    MessageBlockType.TOOL,
                    MessageBlockType.CITATION,
                    MessageBlockType.INTERRUPTED,
                ].includes(block.type)
            ) {
                hasContent = true;
                break;
            }
        }
        return hasContent;
    });
}
