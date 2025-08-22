import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '@/contexts/LanguageContext';
import SidebarSummary from './SidebarSummary';

const SIDEBAR_SUMMARY_ID = 'sidebar-summary-root';

// 创建并管理 SidebarSummary 实例
export class SidebarSummaryManager {
    private static container: HTMLDivElement | null = null;
    private static isVisible = false;
    private static root: any = null;

    // 显示侧边栏总结
    public static show(): void {
        if (this.isVisible) return;

        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = SIDEBAR_SUMMARY_ID;
            document.body.appendChild(this.container);
            this.root = createRoot(this.container);
        }

        this.isVisible = true;

        this.root.render(
            <LanguageProvider>
                <SidebarSummary isVisible={true} onClose={this.hide.bind(this)} />
            </LanguageProvider>,
        );

        // 添加样式防止页面滚动影响侧边栏
        document.body.style.paddingRight = '0px';
    }

    // 隐藏侧边栏总结
    public static hide(): void {
        if (!this.isVisible || !this.container) return;

        this.isVisible = false;

        this.root.render(
            <LanguageProvider>
                <SidebarSummary isVisible={false} onClose={this.hide.bind(this)} />
            </LanguageProvider>,
        );

        // 延迟移除，等待动画完成
        setTimeout(() => {
            if (!this.isVisible && this.root) {
                this.root.render(null);
            }
        }, 300);

        // 恢复页面样式
        document.body.style.paddingRight = '';
    }

    // 切换侧边栏显示状态
    public static toggle(): void {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    // 检查是否可见
    public static getIsVisible(): boolean {
        return this.isVisible;
    }

    // 销毁实例
    public static destroy(): void {
        if (this.container && this.container.parentNode) {
            this.hide();
            setTimeout(() => {
                if (this.container && this.container.parentNode) {
                    this.container.parentNode.removeChild(this.container);
                    this.container = null;
                    this.root = null;
                    this.isVisible = false;
                }
            }, 300);
        }
    }
}

export default SidebarSummaryManager;
