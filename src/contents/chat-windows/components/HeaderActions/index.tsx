import { t } from '@/locales/i18n';
import { FEEDBACK_SURVEY_URL } from '@/utils/constant';
import { CloseOutlined, CommentOutlined, PushpinFilled, PushpinOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import { memo, useMemo } from 'react';

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
    }: {
        isPinned: boolean;
        togglePin: () => void;
        onCancel: () => void;
    }) => {
        const pinTooltip = useMemo(
            () => (isPinned ? t('unpinWindow') : t('pinWindow')),
            [isPinned, t],
        );
        const closeTooltip = useMemo(() => t('close'), [t]);
        const feedbackTooltip = useMemo(() => t('feedback'), [t]);

        return (
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
                <div
                    className="header-action-button close-button"
                    onClick={onCancel}
                    role="button"
                    tabIndex={0}
                    aria-label={closeTooltip}
                >
                    <CloseOutlined style={{ fontSize: 16 }} />
                </div>
            </div>
        );
    },
);

export default HeaderActions;
