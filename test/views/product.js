import { getState } from '@aegisjsproject/state';

const product = getState('name', 'Unknown');

class ProductView extends HTMLElement {
	#shadow;

	constructor(params) {
		super();

		if (this.shadowRoot === null) {
			this.#shadow = this.attachShadow({ mode: 'open', clonable: true, serializable: true });
			const h1 = document.createElement('h1');
			const pre = document.createElement('pre');
			const code = document.createElement('code');

			code.textContent = JSON.stringify(params, null, 4);
			const productName = product.toString();
			h1.textContent = `Product Search results for ${productName}`;
			pre.append(code);
			this.#shadow.append(h1, pre);
		} else {
			this.#shadow = this.shadowRoot;
		}
	}

	connectedCallback() {
		this.animate([
			{ opacity: 0, transform: 'scale(0)' },
			{ opacity: 1, transform: 'none'},
		], {
			duration: 600,
			easing: 'ease-out',
			fill: 'forwards',
		})
	}
}

customElements.define('product-view', ProductView);

export default ProductView;
