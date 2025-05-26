import { CommentOutlined, GithubOutlined, SettingOutlined } from '@ant-design/icons';
import { Divider, Space, Typography } from 'antd';

import { t } from '@/locales/i18n';
import { GIT_URL } from '@/utils/constant';

export default function Footer({
    onSetShortcuts,
    openFeedbackSurvey,
}: {
    onSetShortcuts: () => void;
    openFeedbackSurvey: () => void;
}) {
    return (
        <div className="app-footer">
            <Space split={<Divider type="vertical" />}>
                <Typography.Link onClick={onSetShortcuts} className="footer-link">
                    <SettingOutlined /> {t('setShortcuts')}
                </Typography.Link>
                <Typography.Link href={GIT_URL} target="_blank" className="footer-link">
                    <GithubOutlined /> {t('starAuthor')}
                </Typography.Link>
                <Typography.Link onClick={openFeedbackSurvey} className="footer-link">
                    <CommentOutlined /> {t('feedback')}
                </Typography.Link>
            </Space>
        </div>
    );
}
