// import { html } from '@aegisjsproject/core/parsers/html.js';
import { manageState } from '@aegisjsproject/state';
import { preconnect, getURLPath } from '@aegisjsproject/router/router.js';

const [ipsum, setIpsum] = manageState('bacon:ipsum', []);
const numLines = getURLPath('/page/bacon/:lines(\\d+)', 'lines', { fallbackValue: 5 });

preconnect('https://baconipsum.com');

export default class BaconIpsum extends HTMLElement {
	#shadow;
	#lines = 0;
	#signal;

	constructor({ matches, signal }) {
		super();
		this.#signal = signal;
		this.#shadow = this.attachShadow({ mode: 'closed' });
		this.#lines = matches?.pathname?.groups?.lines ?? 5;
		signal.addEventListener('abort', ( {target }) => console.info(target.reason));

		new CSSStyleSheet().replace(`
				:host {
					padding: 1.2rem;
					border-radius: 8px;
					border: 1px solid #dadada;
					font-family: system-ui;
					display: block;
				}
			`).then(sheet => this.#shadow.adoptedStyleSheets = [sheet]);
	}

	async connectedCallback() {
		if (ipsum.length === 0) {
			const url = new URL('https://baconipsum.com/api/');
			url.searchParams.set('paras', this.#lines);
			url.searchParams.set('format', 'json');
			url.searchParams.set('start-with-lorem', 1);
			url.searchParams.set('type', 'all-meat');

			const resp = await fetch(url, { referrerPolicy: 'no-referrer', signal: this.#signal });
			const lines = await resp.json();
			setIpsum(lines);
		}

		const frag = document.createDocumentFragment();

		ipsum.forEach(line => {
			const p = document.createElement('p');
			p.textContent = line;
			p.part.add('line');
			frag.append(p);
		});

		this.#shadow.replaceChildren(frag);
	}
}

customElements.define('bacon-ipusm', BaconIpsum);

// export default async ({ url: { matches} }) => {
// 	const url = new URL('https://baconipsum.com/api/');
// 	url.searchParams.set('paras', matches?.pathname?.groups?.lines ?? 5);
// 	url.searchParams.set('format', 'json');
// 	url.searchParams.set('start-with-lorem', 1);
// 	url.searchParams.set('type', 'all-meat');

// 	const resp = await fetch(url, { referrerPolicy: 'no-referrer' });
// 	const lines = await resp.json();

// 	return html`${lines.map(line => `<p>${line}</p>`).join('\n')}`;
// }
