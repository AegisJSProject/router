class ProductView extends HTMLElement {
	#shadow;

	constructor(params) {
		super();
		console.log(params);
		this.#shadow = this.attachShadow({ mode: 'closed' });
		const pre = document.createElement('pre');
		const code = document.createElement('code');
		code.textContent = JSON.stringify(params, null, 4);
		pre.append(code);
		this.#shadow.append(pre);
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
