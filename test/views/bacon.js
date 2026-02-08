import { manageState } from '@aegisjsproject/state';
import { preconnect } from '@aegisjsproject/router/router.js';

const [ipsum, setIpsum] = manageState('bacon:ipsum', []);

preconnect('https://baconipsum.com');

export default class BaconIpsum extends HTMLElement {
	#shadow;
	#lines = 0;
	#signal;
	#resolvers = Promise.withResolvers();

	constructor({ params: { lines = 5 }, stack, signal }) {
		super();
		stack.use(this);
		this.#signal = signal;
		this.#shadow = this.attachShadow({ mode: 'closed' });
		this.#lines = lines ?? 5;
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

	async [Symbol.asyncDispose]() {
		await this.#resolvers.promise;
		console.log(this.getHTML({ shadowRoots: [this.#shadow], serializableShadowRoots: true }));
	}

	async connectedCallback() {
		const len = ipsum.length;

		if (len === 0 || len !== this.#lines) {
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
		this.#resolvers.resolve();
	}
}

customElements.define('bacon-ipusm', BaconIpsum);

export const title = ({ params: { lines }}) => `Bacon Ipsum (${ lines ?? 5} lines)`;
export const description = 'Like Lorem Ipsum, but more meat!';
