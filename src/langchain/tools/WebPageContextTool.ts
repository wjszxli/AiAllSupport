import { Tool } from '@langchain/core/tools';
import { extractWebsiteMetadata } from '@/utils';
import { Logger } from '@/utils/logger';

const logger = new Logger('WebPageContextTool');

export class WebPageContextTool extends Tool {
    name = 'webpage_context';
    description = `Get the content of the current webpage that the user is browsing. Use this when the user asks questions about the current page, wants to analyze the page content, or when their question seems to relate to what they're currently viewing.

This tool requires no input parameters - it automatically extracts content from the active browser tab.

Examples of when to use:
- "Summarize this page"
- "What is this article about?"
- "Explain the content on this page"
- "Based on what I'm reading..."`;

    protected async _call(_input: string): Promise<string> {
        try {
            logger.info('Extracting webpage context from current tab');

            const metadata = await extractWebsiteMetadata();

            if (!metadata.website || !metadata.website.content) {
                return 'No webpage content available. The user may not be on a webpage or the content could not be extracted.';
            }

            const { website } = metadata;

            let contextInfo = `Current Webpage Information:\n\n`;
            contextInfo += `Title: ${website.title}\n`;
            contextInfo += `URL: ${website.url}\n`;

            if (website.content && website.content.trim()) {
                // Limit content length to avoid token limits
                const maxContentLength = 8000;
                const content =
                    website.content.length > maxContentLength
                        ? website.content.substring(0, maxContentLength) + '...'
                        : website.content;

                contextInfo += `\nPage Content:\n${content}`;
            }

            if (website.selection && website.selection.trim()) {
                contextInfo += `\n\nUser Selected Text:\n${website.selection}`;
            }

            logger.info(`Successfully extracted webpage context from: ${website.url}`);
            return contextInfo;
        } catch (error) {
            logger.error('Failed to extract webpage context:', error);
            return 'Failed to extract webpage content. This might be due to permissions or the page not being accessible.';
        }
    }
}

export default WebPageContextTool;
