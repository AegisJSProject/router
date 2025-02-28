import { md, createStyleSheet, registerLanguages } from '@aegisjsproject/markdown/markdown.js';
import { preconnect } from '@aegisjsproject/router/router.js';
import javascript from 'highlight.js/languages/javascript.min.js';
import css from 'highlight.js/languages/css.min.js';
import xml from 'highlight.js/languages/xml.min.js';

document.head.append(
	createStyleSheet('github', { media: '(prefers-color-scheme: light)' }),
	createStyleSheet('github-dark', { media: '(prefers-color-scheme: dark)' }),
);

registerLanguages({ javascript, css, xml });
document.documentElement.classList.add('_md-ready');
preconnect('https://img.shields.io');

const resp = await fetch('/README.md');
const text = await resp.text();

export default () => md`
	# Here is the Project README

	${text.split('\n').map((line, n) => n === 0 ? line : '\t' + line).join('\n')}
`;

export const title = 'Markdown Test';
export const description = 'Testing a markdown page';
