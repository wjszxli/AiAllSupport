import { Input } from 'antd';
import { memo, useState } from 'react';

const ChatInterface = memo(({ initialText }: { initialText?: string }) => {
    const [inputMessage, setInputMessage] = useState(initialText || '');

    return (
        <div className="input-container">
            <div className="input-wrapper">
                <Input.TextArea
                    value={inputMessage}
                    // onChange={handleInputChange}
                    // onCompositionStart={handleCompositionStart}
                    // onCompositionEnd={handleCompositionEnd}
                    // onKeyDown={handleKeyDown}
                    // placeholder={t('typeMessage')}
                    autoSize={{ minRows: 1, maxRows: 6 }}
                    className="message-input"
                />
            </div>
            {/* <Button
                type="primary"
                icon={streamingMessageId ? <CloseOutlined /> : <SendOutlined />}
                onClick={handleSendMessage}
                loading={isLoading && !streamingMessageId}
                className={`send-button ${
                    shouldDisableButton && !streamingMessageId ? 'disabled' : 'enabled'
                }`}
                disabled={shouldDisableButton && !streamingMessageId}
            >
                {streamingMessageId ? t('stop') : t('send')}
            </Button> */}
        </div>
    );
});

export default ChatInterface;
