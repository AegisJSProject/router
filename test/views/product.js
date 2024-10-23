class ProductView extends HTMLElement {
	#shadow;

	constructor(params) {
		super();

		if (this.shadowRoot === null) {
			this.#shadow = this.attachShadow({ mode: 'open', clonable: true, serializable: true });
			const pre = document.createElement('pre');
			const code = document.createElement('code');
			code.textContent = JSON.stringify(params, null, 4);
			pre.append(code);
			this.#shadow.append(pre);
		} else {
			this.#shadow = this.shadowRoot;
		}

		console.log(this.shadowRoot);
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
