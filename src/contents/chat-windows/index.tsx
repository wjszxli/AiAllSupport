import { ActionType, WindowState } from '@/contents/types';
import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import storage from '@/utils/storage';
import { t } from '@/locales/i18n';
import HeaderActions from './components/HeaderActions';

import { useThrottledCallback } from '@/utils/reactOptimizations';
import { Typography } from 'antd';
import { removeChatBox, removeChatButton } from '@/utils';

import './index.scss';
import ChatInterface from './components/ChatInterface';

const windowReducer = (state: WindowState, action: ActionType): WindowState => {
    switch (action.type) {
        case 'SET_POSITION':
            return { ...state, position: action.payload };
        case 'SET_SIZE':
            storage.setChatBoxSize(action.payload).catch((error) => {
                console.error('Failed to save chat box size:', error);
            });
            return { ...state, size: action.payload };
        case 'SET_VISIBILITY':
            return { ...state, isVisible: action.payload };
        case 'TOGGLE_PIN':
            return { ...state, isPinned: !state.isPinned };
        default:
            return state;
    }
};

const ChatWindow = ({ x, y, text }: { x: number; y: number; text?: string }) => {
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });

    const assistantLabel = useMemo(() => t('assistant'), [t]);

    const [state, dispatch] = useReducer(windowReducer, {
        position: { x, y },
        size: { width: 600, height: 800 },
        isVisible: false,
        isPinned: false,
        provider: null,
    });

    const initData = useCallback(async () => {
        try {
            await storage.remove('chatHistory');

            dispatch({ type: 'SET_VISIBILITY', payload: true });

            const savedSize = await storage.getChatBoxSize();
            dispatch({ type: 'SET_SIZE', payload: savedSize });
        } catch (error) {
            console.error('Error initializing chat window:', error);
        }
    }, []);

    useEffect(() => {
        initData();
        removeChatButton();
    }, [initData]);

    const { position, size, isVisible, isPinned } = state;

    const chatBoxStyle = useMemo(
        () => ({
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
        }),
        [position.x, position.y, size.width, size.height],
    );

    const togglePin = useCallback(() => {
        dispatch({ type: 'TOGGLE_PIN' });
    }, []);

    const onCancel = useCallback(async () => {
        await storage.remove('chatHistory');
        removeChatBox();
    }, []);

    const handleMouseMove = useThrottledCallback(
        (moveEvent: MouseEvent) => {
            moveEvent.preventDefault();

            const chatBoxWidth = chatBoxRef.current?.offsetWidth || 0;
            const chatBoxHeight = chatBoxRef.current?.offsetHeight || 0;

            const newX = Math.max(
                0,
                Math.min(
                    moveEvent.clientX - dragStartRef.current.x,
                    window.innerWidth - chatBoxWidth,
                ),
            );

            const newY = Math.max(
                0,
                Math.min(
                    moveEvent.clientY - dragStartRef.current.y,
                    window.innerHeight - chatBoxHeight,
                ),
            );

            dispatch({ type: 'SET_POSITION', payload: { x: newX, y: newY } });
        },
        16,
        [],
    );

    const handleMouseUp = useCallback(() => {
        if (chatBoxRef.current) {
            chatBoxRef.current.classList.remove('dragging');
        }

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);

    const dragHandleMouseDown = useCallback(
        (e: React.MouseEvent) => {
            if (isPinned) return;

            e.preventDefault();

            if (chatBoxRef.current) {
                chatBoxRef.current.classList.add('dragging');
            }

            dragStartRef.current = {
                x: e.clientX - position.x,
                y: e.clientY - position.y,
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        },
        [position, isPinned],
    );

    const handleResizeMouseDown = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            if (chatBoxRef.current) {
                chatBoxRef.current.classList.add('resizing');
            }

            const startWidth = size.width;
            const startHeight = size.height;
            const startX = e.clientX;
            const startY = e.clientY;

            const handleResizeMove = (moveEvent: MouseEvent) => {
                moveEvent.preventDefault();

                const newWidth = Math.max(350, startWidth + moveEvent.clientX - startX);
                const newHeight = Math.max(550, startHeight + moveEvent.clientY - startY);

                dispatch({ type: 'SET_SIZE', payload: { width: newWidth, height: newHeight } });
            };

            const handleResizeUp = () => {
                if (chatBoxRef.current) {
                    chatBoxRef.current.classList.remove('resizing');
                }
                document.removeEventListener('mousemove', handleResizeMove);
                document.removeEventListener('mouseup', handleResizeUp);
            };

            document.addEventListener('mousemove', handleResizeMove);
            document.addEventListener('mouseup', handleResizeUp);
        },
        [size],
    );

    return (
        <div
            ref={chatBoxRef}
            className={`ai-chat-box ${isVisible ? 'visible' : ''}`}
            style={chatBoxStyle}
            role="dialog"
            aria-label={assistantLabel}
        >
            <div
                className="chat-window-header"
                id="chatBoxHeader"
                onMouseDown={dragHandleMouseDown}
            >
                <Typography.Text strong style={{ fontSize: '14px', color: '#2c3e50' }}>
                    {assistantLabel}
                </Typography.Text>
                <HeaderActions
                    isPinned={isPinned}
                    togglePin={togglePin}
                    onCancel={() => {
                        onCancel();
                        dispatch({ type: 'SET_VISIBILITY', payload: false });
                    }}
                />
            </div>
            <div className="chat-content-container">
                <ChatInterface initialText={text} />
            </div>
            <div
                className="resize-handle"
                onMouseDown={handleResizeMouseDown}
                role="button"
                tabIndex={0}
                aria-label="Resize"
            />
        </div>
    );
};

export default ChatWindow;
