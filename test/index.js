import { init, navigate, back, forward, reload } from '@aegisjsproject/router';

globalThis.controller = new AbortController();

init({
	'/product/:productId': '@aegisjsproject/router/test/views/product.js',
	'/page/markdown': '@aegisjsproject/router/test/views/markdown.js',
	'/test/': '@aegisjsproject/router/test/views/home.js',
	'/search?q=:query': '@aegisjsproject/router/test/views/search.js',
	'/img': '@aegisjsproject/router/test/views/img.js',
}, {
	preload: true,
	notFound: '@aegisjsproject/router/test/views/404.js',
	rootNode: '#root',
	intceptRoot: document.body,
	signal: controller.signal,
});

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
