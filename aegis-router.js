import { init, back, forward, reload, observeLinksOn } from './router.js';
import { reset } from '@aegisjsproject/styles/reset.js';
import { componentBase, componentLightTheme, componentDarkTheme } from '@aegisjsproject/styles/theme.js';
import { btn, btnPrimary, btnSuccess, btnDanger, btnLink } from '@aegisjsproject/styles/button.js';

function handleBtnClick({ currentTarget }) {
	switch (currentTarget.dataset.nav) {
		case 'reload':
			reload();
			break;

		case 'back':
			back();
			break;

		case 'forward':
			forward();
			break;

		default:
			currentTarget.removeEventListener('click', handleBtnClick);
	}
}

class AegisRouterElement extends HTMLElement {
	#shadow;

	constructor() {
		super();
		this.#shadow = this.attachShadow({ mode: 'open' });
		const content = document.createElement('div');
		const nav = document.createElement('nav');
		const navSlot = document.createElement('slot');
		navSlot.name = 'nav';
		nav.part.add('nav');
		content.part.add('content');
		nav.append(navSlot);
		this.#shadow.append(nav, content);
		this.#shadow.adoptedStyleSheets = [reset, componentBase, componentLightTheme, componentDarkTheme, btn, btnPrimary, btnSuccess, btnDanger, btnLink];

		navSlot.addEventListener('slotchange', ({ target }) => {
			target.assignedElements().forEach(el => {
				if (typeof el.dataset.nav === 'string') {
					el.addEventListener('click', handleBtnClick, { passive: true });
				}
			});
		});
	}

	connectedCallback() {
		const { baseURL, crossOrigin, fetchPriority, observePreloads, preload, referrerPolicy, routes, scrollRestoration } = this;
		observeLinksOn(this);

		init(routes, {
			baseURL, crossOrigin, fetchPriority, observePreloads, preload, referrerPolicy, scrollRestoration,
			inteceptRoot: this.#shadow,
			rootEl: this.#shadow.querySelector('[part="content"]'),
		});
	}

	get baseURL() {
		return this.getAttribute('baseurl') ?? location.origin;
	}

	get crossOrigin() {
		return this.getAttribute('crossorigin') ?? 'anonymous';
	}

	get fetchPriority() {
		return this.getAttribute('fetchpriority') ?? 'low';
	}

	get observePreloads() {
		return this.hasAttribute('observepreloads');
	}

	get preload() {
		return this.hasAttribute('preload');
	}

	get referrerPolicy() {
		return this.getAttribute('referrerpolicy') ?? 'no-referrer';
	}

	get routes() {
		const script = this.querySelector('script[type="application/json"]');

		if (script instanceof HTMLScriptElement) {
			return JSON.parse(script.textContent);
		} else {
			return {};
		}
	}

	get scrollRestoration() {
		return this.getAttribute('scrollrestoration') ?? 'auto';
	}
}

customElements.define('aegis-router', AegisRouterElement);
