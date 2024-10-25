import { init, navigate, back, forward, reload } from '@aegisjsproject/router';

globalThis.controller = new AbortController();

init('#routes', {
	preload: document.documentElement.classList.contains('preload'),
	notFound: '/test/views/404.js',
	rootNode: '#root',
	inteceptRoot: document.body,
	signal: controller.signal,
});

document.querySelectorAll('[data-link]').forEach(el => {
	el.addEventListener('click', ({ currentTarget }) => {
		const { link, ...state } = currentTarget.dataset;
		navigate(link, state);
	}, { signal: controller.signal });
});

document.querySelectorAll('[data-nav]').forEach(el => {
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
