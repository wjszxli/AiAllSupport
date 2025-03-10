/**
 * 从当前网页提取内容
 * @returns {Promise<string>} 从网页提取的内容
 */
export async function extractWebpageContent(): Promise<string> {
    try {
        // 获取页面标题
        const pageTitle = document.title;

        // 获取主要内容
        // 首先尝试查找主要内容区域
        const mainElements = document.querySelectorAll('main, article, [role="main"]');
        let contentText = '';

        if (mainElements.length > 0) {
            // 使用已识别的主要内容区域
            mainElements.forEach((element) => {
                // @ts-ignore
                contentText += `${element.innerText}\n\n`;
            });
        } else {
            // 备选方案：获取正文文本但排除脚本、样式等
            const bodyText = document.body.innerText;
            contentText = bodyText;
        }

        // 获取当前URL
        const currentUrl = window.location.href;

        // 格式化提取的内容
        const extractedContent = `
URL: ${currentUrl}
Title: ${pageTitle}
Content:${contentText.slice(0, 15000)}${
            contentText.length > 15000 ? '...(内容已截断)' : ''
        }`.trim();

        return extractedContent;
    } catch (error) {
        console.error('提取网页内容时出错:', error);
        return '由于错误，无法提取网页内容。';
    }
}
