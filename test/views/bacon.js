import { html } from '@aegisjsproject/core/parsers/html.js';

export default async ({ url: { matches} }) => {
	const url = new URL('https://baconipsum.com/api/');
	url.searchParams.set('paras', matches?.pathname?.groups?.lines ?? 5);
	url.searchParams.set('format', 'json');
	url.searchParams.set('start-with-lorem', 1);
	url.searchParams.set('type', 'all-meat');

	const resp = await fetch(url, { referrerPolicy: 'no-referrer' });
	const lines = await resp.json();

	return html`${lines.map(line => `<p>${line}</p>`).join('\n')}`;
}
