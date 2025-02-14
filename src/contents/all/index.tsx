import ChatWindow from './components/ChatWindow';
import { createRoot } from 'react-dom/client';
import { CHAT_BOX_ID, CHAT_BUTTON_ID } from '@/utils/constant';
import { removeChatBox, removeChatButton } from '@/utils';
import storage from '@/utils/storage';

// 监听选中文字
document.addEventListener(
    'mouseup',
    (event) => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
            removeChatButton();
            return;
        }

        const text = selection.toString();
        const { clientX, clientY } = event;

        injectChatButton(clientX, clientY, text);
    },
    { passive: true },
);

document.addEventListener('mousedown', async (event) => {
    const pinned = await storage.get('pinned');
    // 如果用户选择固定，就不关闭
    if (pinned) return;

    const target = event.target as HTMLElement;
    const isClickInside =
        target?.closest(`#${CHAT_BOX_ID}`) || target?.closest(`#${CHAT_BUTTON_ID}`);

    // 如果点击在弹窗内部或相关元素上，不关闭
    if (isClickInside) return;

    removeChatBox();
    removeChatButton();
});

// 在选中文字后插入按钮
const injectChatButton = (x: number, y: number, text: string) => {
    let chatButton = document.getElementById(CHAT_BUTTON_ID) as HTMLImageElement;
    if (!chatButton) {
        chatButton = document.createElement('img');
        chatButton.id = CHAT_BUTTON_ID;
        chatButton.src = chrome.runtime.getURL('icons/icon48.png');
        chatButton.style.position = 'absolute';
        chatButton.style.width = '40px';
        chatButton.style.height = '40px';
        chatButton.style.cursor = 'pointer';
        chatButton.style.zIndex = '9999';
        chatButton.style.borderRadius = '50%';
        chatButton.style.background = 'white';
        chatButton.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        chatButton.style.padding = '5px';

        document.body.appendChild(chatButton);
    }

    chatButton.style.top = `${y + 5}px`;
    chatButton.style.left = `${x + 5}px`;

    chatButton.onclick = () => {
        injectChatBox(x, y, text);
    };
};

// 在 DOM 中插入聊天框
const injectChatBox = (x: number, y: number, text: string) => {
    // 移除按钮
    removeChatButton();

    let chatContainer = document.getElementById(CHAT_BOX_ID);
    if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = CHAT_BOX_ID;
        document.body.appendChild(chatContainer);
    }

    // 渲染 Chat 组件
    const root = createRoot(chatContainer);
    root.render(<ChatWindow x={x} y={y} text={text} />);
};

// 监听 ESC 关闭聊天窗口
document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
        removeChatBox();
        removeChatButton();
    }
});
