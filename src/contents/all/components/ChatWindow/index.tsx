import { useEffect, useState, useRef } from 'react';
import { Bubble, BubbleProps, Sender, Suggestion, XProvider } from '@ant-design/x';
import {
    CloseCircleTwoTone,
    PushpinOutlined,
    PushpinTwoTone,
    UserOutlined,
} from '@ant-design/icons';
import { Alert, Flex, Tooltip, Typography, message } from 'antd';
import markdownit from 'markdown-it';
import { chatAIStream } from '@/service';
import storage from '@/utils/storage';
import { PROVIDERS_DATA, tags } from '@/utils/constant';
import { IMessage } from '@/typings';
import Think from '../Think';
import { isLocalhost, removeChatBox, removeChatButton } from '@/utils';

const md = markdownit({ html: true, breaks: true });
const renderMarkdown: BubbleProps['messageRender'] = (content: string) => (
    <Typography>
        <div dangerouslySetInnerHTML={{ __html: md.render(content) }} />
    </Typography>
);

const fooAvatar: React.CSSProperties = {
    color: '#f56a00',
    backgroundColor: '#fde3cf',
};

const barAvatar: React.CSSProperties = {
    color: '#fff',
    backgroundColor: '#87d068',
};

interface IBubbleListProps extends BubbleProps {
    key: number;
}

const ChatBox = ({ x, y, text }: { x: number; y: number; text: string }) => {
    const [messages, setMessages] = useState<string | undefined>(text);
    const [loading, setLoading] = useState(false);
    const [bubbleList, setBubbleList] = useState<IBubbleListProps[]>([]);
    const [isSelectProvider, setIsSelectProvider] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [position, setPosition] = useState({ x, y });
    const [size, setSize] = useState({ width: 500, height: 500 });
    const chatBoxRef = useRef<HTMLDivElement | null>(null);

    const initData = async () => {
        try {
            await storage.remove('chatHistory');
            const config = await storage.getConfig();
            if (!config.selectedProvider) return;

            const provider = PROVIDERS_DATA[config.selectedProvider];
            if (!provider) return;

            setIsSelectProvider(true);

            const bubble: IBubbleListProps = {
                key: Date.now(),
                placement: 'start',
                messageRender: renderMarkdown,
                content: `我是大模型 ${provider.name} AI 助手，可以回答你的任何的问题`,
                loading: false,
                avatar: { icon: <UserOutlined />, style: fooAvatar },
            };

            setBubbleList((prevBubbleList) => [bubble, ...prevBubbleList]);
        } catch (error) {
            console.error('Failed to initialize data:', error);
        }
    };

    useEffect(() => {
        initData();
    }, []);

    const sendChat = async () => {
        if (!messages) {
            message.error('请输入你要问的问题！');
            return;
        }

        const userBubble: IBubbleListProps = {
            key: Date.now() + 1,
            placement: 'end',
            messageRender: renderMarkdown,
            content: messages,
            loading: false,
            avatar: { icon: <UserOutlined />, style: barAvatar },
        };

        const loadingBubble: IBubbleListProps = {
            key: Date.now() + 2,
            placement: 'start',
            messageRender: renderMarkdown,
            loading: true,
            content: '',
            avatar: { icon: <UserOutlined />, style: fooAvatar },
        };

        setBubbleList((prevBubbleList) => [...prevBubbleList, userBubble, loadingBubble]);

        try {
            setLoading(true);
            const previousMessages: IMessage[] = (await storage.get('chatHistory')) || [];

            const sendMessage = [...previousMessages, { role: 'user', content: messages }];
            let content = '';
            let reasoningContent = '';
            setMessages('AI 在思考中');

            let isReasoning = false;

            chatAIStream(sendMessage, async (chunk) => {
                const { data, done } = chunk;
                const { selectedProvider } = await storage.getConfig();
                if (isLocalhost(selectedProvider)) {
                    const tagPattern = new RegExp(`<(${tags.join('|')})>`, 'i');
                    const closeTagPattern = new RegExp(`</(${tags.join('|')})>`, 'i');

                    const openTagMatch = data.match(tagPattern);
                    const closeTagMatch = data.match(closeTagPattern);

                    if (!isReasoning && openTagMatch) {
                        isReasoning = true;
                    } else if (isReasoning && !closeTagMatch) {
                        reasoningContent += data;
                    } else if (isReasoning && closeTagMatch) {
                        isReasoning = false;
                    } else if (!isReasoning) {
                        content += data;
                    }
                } else if (!done) {
                    if (!data.startsWith('data: ')) return;

                    const chunkStringData = data.slice(6);
                    const chunkData = JSON.parse(chunkStringData);
                    const { choices } = chunkData;
                    if (choices?.[0]?.delta?.content) {
                        content += chunkData.choices[0].delta.content;
                    } else if (choices?.[0]?.delta?.reasoning_content) {
                        reasoningContent += chunkData.choices[0].delta.reasoning_content;
                    }
                }
                console.log('done', done)

                if (done) {
                    const updatedMessages = [
                        ...sendMessage,
                        { role: 'assistant', content: content },
                    ];
                    await storage.set('chatHistory', updatedMessages);

                    setMessages(undefined);
                    setLoading(false);
                    return;
                }

                setBubbleList((prevBubbleList) =>
                    prevBubbleList.map((bubble) =>
                        bubble.key === loadingBubble.key
                            ? {
                                  ...bubble,
                                  content: content,
                                  loading: content ? false : true,
                                  header: reasoningContent ? (
                                      <Think context={reasoningContent} />
                                  ) : null,
                              }
                            : bubble,
                    ),
                );
            });
        } catch (error) {
            message.error(error instanceof Error ? error.message : String(error));
            setLoading(false);
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (isPinned) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = { ...position };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newX = startPos.x + (moveEvent.clientX - startX);
            const newY = startPos.y + (moveEvent.clientY - startY);
            setPosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleResizeMouseDown = (e: React.MouseEvent) => {
        e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const startSize = { ...size };

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = startSize.width + (moveEvent.clientX - startX);
            const newHeight = startSize.height + (moveEvent.clientY - startY);
            setSize({ width: newWidth, height: newHeight });
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };
    return (
        <div
            ref={chatBoxRef}
            style={{
                position: 'absolute',
                top: position.y + 10 + 'px',
                left: position.x + 'px',
                zIndex: 99999,
                background: 'white',
                boxShadow: '0 0 10px rgba(0,0,0,0.1)',
                borderRadius: '8px',
                height: size.height,
                width: size.width,
                cursor: isPinned ? 'default' : 'move',
            }}
            onMouseDown={handleMouseDown}
        >
            {!isSelectProvider && (
                <Alert
                    type="error"
                    message="请先点击插件的图标选择一个服务商"
                    style={{
                        margin: 10,
                    }}
                />
            )}
            <div style={{ height: 30 }}>
                <div
                    style={{
                        position: 'absolute',
                        right: 0,
                        padding: 10,
                        cursor: 'pointer',
                    }}
                    onClick={() => {
                        setIsSelectProvider(false);
                        removeChatButton();
                        removeChatBox();
                    }}
                >
                    <CloseCircleTwoTone twoToneColor="#eb2f96" style={{ fontSize: 20 }} />
                </div>
                <div
                    style={{
                        position: 'absolute',
                        left: 0,
                        padding: 10,
                        cursor: 'pointer',
                    }}
                    onClick={async () => {
                        setIsPinned(!isPinned);
                    }}
                >
                    {isPinned ? (
                        <Tooltip title="点我可以进行拖拽">
                            <PushpinTwoTone style={{ fontSize: 20 }} />
                        </Tooltip>
                    ) : (
                        <Tooltip title="点我固定位置">
                            <PushpinOutlined style={{ fontSize: 20 }} />
                        </Tooltip>
                    )}
                </div>
            </div>
            <XProvider direction="ltr">
                <Flex style={{ margin: 30, height: size.height - 80 }} vertical>
                    <Bubble.List style={{ flex: 1 }} items={bubbleList} />
                    {isSelectProvider && (
                        <Suggestion style={{ marginTop: 20 }} items={[]}>
                            {({
                                onTrigger,
                                onKeyDown,
                            }: {
                                onTrigger: (state?: boolean) => void;
                                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
                            }) => {
                                return (
                                    <Sender
                                        loading={loading}
                                        disabled={loading}
                                        value={messages}
                                        onChange={(nextVal: string) => {
                                            if (nextVal === '/') {
                                                onTrigger();
                                            } else if (!nextVal) {
                                                onTrigger(false);
                                            }
                                            setMessages(nextVal);
                                        }}
                                        onKeyDown={onKeyDown}
                                        onSubmit={() => {
                                            sendChat();
                                        }}
                                        placeholder="请输入你想要问的问题"
                                    />
                                );
                            }}
                        </Suggestion>
                    )}
                </Flex>
            </XProvider>
            <div
                style={{
                    position: 'absolute',
                    bottom: 0,
                    right: 0,
                    width: 20,
                    height: 20,
                    cursor: 'nwse-resize',
                    backgroundColor: 'transparent',
                }}
                onMouseDown={handleResizeMouseDown}
            />
        </div>
    );
};

export default ChatBox;
