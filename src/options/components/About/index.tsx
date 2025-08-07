import { CommentOutlined, GithubOutlined, SettingOutlined } from '@ant-design/icons';
import { Typography } from 'antd';
import React from 'react';

import { t } from '@/locales/i18n';
import { GIT_URL } from '@/utils/constant';

interface AboutProps {
    onSetShortcuts: () => void;
    openFeedbackSurvey: () => void;
}

const About: React.FC<AboutProps> = ({ onSetShortcuts, openFeedbackSurvey }) => {
    return (
        <div className="about-section">
            <Typography.Title level={4}>{t('appTitle')}</Typography.Title>
            <Typography.Paragraph>{t('aboutDescription')}</Typography.Paragraph>
            <div className="app-links">
                <Typography.Link onClick={onSetShortcuts} className="link-item">
                    <SettingOutlined /> {t('setShortcuts')}
                </Typography.Link>
                <Typography.Link
                    href={GIT_URL}
                    target="_blank"
                    className="link-item"
                    id="tour-star-author"
                >
                    <GithubOutlined /> {t('starAuthor')}
                </Typography.Link>
                <Typography.Link onClick={openFeedbackSurvey} className="link-item">
                    <CommentOutlined /> {t('feedback')}
                </Typography.Link>
            </div>
        </div>
    );
};

export default About;
