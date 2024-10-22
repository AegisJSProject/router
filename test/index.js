import { init, navigate, back, forward, reload } from '@aegisjsproject/router';

globalThis.controller = new AbortController();

init({
	'/product/:productId': '@view/product.js',
	'/page/markdown': '@view/markdown.js',
	'/test/': '@view/home.js',
	'/search?q=:query': '@view/search.js',
	'/img': '@view/img.js',
}, {
	preload: true,
	notFound: '@view/404.js',
	rootNode: '#root',
	inteceptRoot: document.body,
	signal: controller.signal,
});

globalThis.base64ToBlob = function(input) {
	const pattern = new URLPattern({ protocol: 'data:', pathname: ':type;base64,:data' });
	const { type, data } = pattern.exec(input)?.pathname?.groups ?? {};

	if (typeof type === 'string' && typeof data === 'string') {
		const bytes = Uint8Array.fromBase64(data);
		return new Blob([bytes], { type });
	} else {
		return null;
	}
}

document.querySelectorAll('[data-link]').forEach(el => {
	el.addEventListener('click', ({ currentTarget }) => {
		const { link, ...state } = currentTarget.dataset;
		navigate(link, state);
	}, { signal: controller.signal });
});

document.querySelectorAll('[data-nav').forEach(el => {
	el.addEventListener('click', ({ currentTarget }) => {
		switch (currentTarget.dataset.nav) {
			case 'back':
				back();
				break;

			case 'forward':
				forward();
				break;

			case 'reload':
				reload();

			default:
				throw new TypeError(`Invalid nav button type: ${currentTarget.dataset.nav}.`);
		}
	}, { signal: controller.signal });
});
