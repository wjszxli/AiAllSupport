import React, { useEffect, useRef, useCallback, useReducer, useMemo, memo } from 'react';
import { CloseOutlined, PushpinOutlined, PushpinFilled, CommentOutlined } from '@ant-design/icons';
import { Alert, Tooltip, Typography } from 'antd';
import storage from '@/utils/storage';
import { removeChatButton, removeChatBox } from '@/utils';

import Config from '../Config';
import ChatInterface from '../ChatInterface/index';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStableCallback, useThrottledCallback } from '@/utils/reactOptimizations';

import './index.scss';
import { FEEDBACK_SURVEY_URL } from '@/utils/constant';

type ActionType =
    | { type: 'SET_POSITION'; payload: { x: number; y: number } }
    | { type: 'SET_SIZE'; payload: { width: number; height: number } }
    | { type: 'SET_VISIBILITY'; payload: boolean }
    | { type: 'TOGGLE_PIN' }
    | { type: 'INITIALIZE'; payload: { provider: string | null } };

interface WindowState {
    position: { x: number; y: number };
    size: { width: number; height: number };
    isVisible: boolean;
    isPinned: boolean;
    provider: string | null;
}

const ProviderAlert = memo(({ message }: { message: string }) => (
    <div className="provider-alert-container">
        <Alert type="info" message={message} showIcon />
    </div>
));

const HighZIndexTooltip: React.FC<React.ComponentProps<typeof Tooltip>> = ({
    children,
    ...props
}) => (
    <Tooltip {...props} overlayStyle={{ zIndex: 10001 }}>
        {children}
    </Tooltip>
);

const HeaderActions = memo(
    ({
        isPinned,
        togglePin,
        onCancel,
        pinTooltip,
        closeTooltip,
        feedbackTooltip,
    }: {
        isPinned: boolean;
        togglePin: () => void;
        onCancel: () => void;
        pinTooltip: string;
        closeTooltip: string;
        feedbackTooltip: string;
    }) => (
        <div className="chat-window-actions">
            <HighZIndexTooltip title={feedbackTooltip} placement="bottom">
                <div
                    className="header-action-button feedback-button"
                    onClick={() => window.open(FEEDBACK_SURVEY_URL, '_blank')}
                    role="button"
                    tabIndex={0}
                    aria-label={feedbackTooltip}
                >
                    <CommentOutlined style={{ fontSize: 16 }} />
                </div>
            </HighZIndexTooltip>
            <HighZIndexTooltip title={pinTooltip} placement="bottom">
                <div
                    className="header-action-button pin-button"
                    onClick={togglePin}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isPinned}
                >
                    {isPinned ? (
                        <PushpinFilled style={{ fontSize: 16 }} />
                    ) : (
                        <PushpinOutlined style={{ fontSize: 16 }} />
                    )}
                </div>
            </HighZIndexTooltip>
            <HighZIndexTooltip title={closeTooltip} placement="bottom">
                <div
                    className="header-action-button close-button"
                    onClick={onCancel}
                    role="button"
                    tabIndex={0}
                    aria-label={closeTooltip}
                >
                    <CloseOutlined style={{ fontSize: 16 }} />
                </div>
            </HighZIndexTooltip>
        </div>
    ),
);

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
        case 'INITIALIZE':
            return { ...state, provider: action.payload.provider };
        default:
            return state;
    }
};

const ChatWindow = ({ x, y, text }: { x: number; y: number; text?: string }) => {
    const chatBoxRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const { t } = useLanguage();

    const [state, dispatch] = useReducer(windowReducer, {
        position: { x, y },
        size: { width: 600, height: 800 },
        isVisible: false,
        isPinned: false,
        provider: null,
    });

    useEffect(() => {
        const loadSavedSize = async () => {
            try {
                const savedSize = await storage.getChatBoxSize();
                dispatch({ type: 'SET_SIZE', payload: savedSize });
            } catch (error) {
                console.error('Error reading saved size:', error);
            }
        };

        loadSavedSize();
    }, []);

    const initData = useCallback(async () => {
        try {
            await storage.remove('chatHistory');

            setTimeout(() => {
                dispatch({ type: 'SET_VISIBILITY', payload: true });
            }, 50);

            const config = await storage.getConfig();
            dispatch({
                type: 'INITIALIZE',
                payload: { provider: config.selectedProvider || null },
            });
        } catch (error) {
            console.error('Error initializing chat window:', error);
        }
    }, []);

    useEffect(() => {
        initData();
        removeChatButton();
    }, [initData]);

    const { position, size, isVisible, isPinned, provider } = state;

    const pinTooltip = useMemo(() => (isPinned ? t('unpinWindow') : t('pinWindow')), [isPinned, t]);
    const closeTooltip = useMemo(() => t('close'), [t]);
    const feedbackTooltip = useMemo(() => t('feedback'), [t]);
    const assistantLabel = useMemo(() => t('assistant'), [t]);
    const selectProviderText = useMemo(() => t('selectProviderFirst'), [t]);

    const onCancel = useCallback(async () => {
        await storage.remove('chatHistory');
        removeChatBox();

        // @ts-ignore
        if (window.currentAbortController) {
            // @ts-ignore
            window.currentAbortController.abort();
            // @ts-expect-error
            window.currentAbortController = null;
        }
    }, []);

    const togglePin = useCallback(() => {
        dispatch({ type: 'TOGGLE_PIN' });
    }, []);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isPinned) {
                onCancel();
            }

            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                togglePin();
            }
        },
        [isPinned, onCancel, togglePin],
    );

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

    const handleMaintainPosition = useStableCallback(() => {
        if (!chatBoxRef.current) return;

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const boxWidth = chatBoxRef.current.offsetWidth;
        const boxHeight = chatBoxRef.current.offsetHeight;

        let newX = position.x;
        let newY = position.y;

        if (newX + boxWidth > viewportWidth) {
            newX = Math.max(0, viewportWidth - boxWidth);
        }

        if (newY + boxHeight > viewportHeight) {
            newY = Math.max(0, viewportHeight - boxHeight);
        }

        if (newX !== position.x || newY !== position.y) {
            dispatch({ type: 'SET_POSITION', payload: { x: newX, y: newY } });
        }
    });

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('resize', handleMaintainPosition);
        window.addEventListener('maintainChatPosition', handleMaintainPosition);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('resize', handleMaintainPosition);
            window.removeEventListener('maintainChatPosition', handleMaintainPosition);
        };
    }, [handleKeyDown, handleMaintainPosition]);

    const chatContent = useMemo(() => {
        if (!provider) {
            return <ProviderAlert message={selectProviderText} />;
        }
        return (
            <div className="chat-content-container">
                <ChatInterface initialText={text} />
            </div>
        );
    }, [provider, text, selectProviderText]);

    const chatBoxStyle = useMemo(
        () => ({
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: `${size.width}px`,
            height: `${size.height}px`,
        }),
        [position.x, position.y, size.width, size.height],
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
                    pinTooltip={pinTooltip}
                    closeTooltip={closeTooltip}
                    feedbackTooltip={feedbackTooltip}
                />
            </div>
            {chatContent}
            <Config
                width={size.width}
                height={size.height}
                parentInitData={initData}
                onCancel={onCancel}
            />
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

export default React.memo(ChatWindow);
