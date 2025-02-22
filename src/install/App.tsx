import MarkdownIt from 'markdown-it';
import { useEffect, useState } from 'react';

import './App.scss';

function MarkdownRenderer() {
    const [markdownContent, setMarkdownContent] = useState('');
    const [collapsedSections, setCollapsedSections] = useState({});

    useEffect(() => {
        fetch('/doc/use.md')
            .then((response) => response.text())
            .then((data) => {
                setMarkdownContent(data);
            })
            .catch((error) => console.error('Error loading markdown:', error));
    }, []);

    const md = new MarkdownIt();
    const htmlContent = md.render(markdownContent);

    const toggleCollapse = (id: string) => {
        setCollapsedSections((prevState) => ({
            ...prevState,
            // @ts-ignore
            [id]: !prevState[id],
        }));
    };

    const renderMarkdownWithCollapse = () => {
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(htmlContent, 'text/html');

        const headings = htmlDoc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        headings.forEach((heading) => {
            const id = heading.textContent?.toLowerCase().replace(/\s+/g, '-') || '';
            heading.id = id;

            heading.addEventListener('click', () => toggleCollapse(id));

            // @ts-ignore
            if (collapsedSections[id]) {
                heading.classList.add('collapsed');
                let nextElement = heading.nextElementSibling;
                while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
                    // @ts-ignore
                    nextElement.style.display = 'none';
                    nextElement = nextElement.nextElementSibling;
                }
            } else {
                heading.classList.remove('collapsed');
                let nextElement = heading.nextElementSibling;
                while (nextElement && !nextElement.matches('h1, h2, h3, h4, h5, h6')) {
                    // @ts-ignore
                    nextElement.style.display = '';
                    nextElement = nextElement.nextElementSibling;
                }
            }
        });

        return htmlDoc.body.innerHTML;
    };

    const renderTableOfContents = () => {
        return markdownContent.split('\n').map((line, index) => {
            if (line.startsWith('#')) {
                // @ts-ignore
                const level = line.match(/^#*/)[0].length;
                const title = line.replace(/^#*/, '').trim();
                const id = title.toLowerCase().replace(/\s+/g, '-');

                return (
                    <li key={index} style={{ marginLeft: `${level * 10}px` }}>
                        <a href={`#${id}`} onClick={(e) => handleTocClick(e, id)}>
                            {title}
                        </a>
                    </li>
                );
            }
            return null;
        });
    };

    // @ts-ignore
    const handleTocClick = (e, id) => {
        e.preventDefault();
        const section = document.getElementById(id);
        if (section) {
            section.scrollIntoView({ behavior: 'smooth' });

            setCollapsedSections((prevState) => ({
                ...prevState,
                [id]: false,
            }));
        }
    };

    return (
        <div className="markdown-container">
            <div className="markdown-content">
                <div
                    className="markdown-body"
                    dangerouslySetInnerHTML={{ __html: renderMarkdownWithCollapse() }}
                />
            </div>

            <div className="table-of-contents">
                <h3>大纲内容</h3>
                <ul>{renderTableOfContents()}</ul>
            </div>
        </div>
    );
}

export default MarkdownRenderer;
