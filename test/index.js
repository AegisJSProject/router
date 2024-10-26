import { init, navigate, back, forward, reload, preload, dnsPrefetch } from '@aegisjsproject/router/router.js';
import { observeEvents } from '@aegisjsproject/core/events.js';

const controller = new AbortController();
globalThis.controller = controller;

new CSSStyleSheet().replace(`
	#nav {
		position: sticky;
		top: 0;
	}
`).then(styles => document.adoptedStyleSheets = [styles]);

console.time('init');
console.time('preload');

const initialized = init('#routes', {
	preload: document.documentElement.classList.contains('preload'),
	notFound: '/test/views/404.js',
	rootEl: '#root',
	inteceptRoot: document.body,
	signal: controller.signal,
}).finally(() => console.timeEnd('init'));

Promise.all([
	initialized,
	preload('https://api.github.com/users/shgysk8zer0', {
		as: 'fetch',
		type: 'application/json',
		referrerPolicy: 'no-referrer',
		fetchPriority: 'low',
	}),
	preload('https://api.github.com/users/kernvalley', {
		as: 'fetch',
		type: 'application/json',
		referrerPolicy: 'no-referrer',
		fetchPriority: 'low',
	}),
	preload('https://avatars.githubusercontent.com/u/1627459?v=4', {
		as: 'image',
		type: 'image/png',
		referrerPolicy: 'no-referrer',
		fetchPriority: 'low',
	}),
	preload('https://avatars.githubusercontent.com/u/39509442?v=4', {
		as: 'image',
		type: 'image/png',
		referrerPolicy: 'no-referrer',
		fetchPriority: 'low',
	}),
	dnsPrefetch('https://baconipsum.com'),
	dnsPrefetch('https://api.github.com'),
	dnsPrefetch('https://avatars.githubusercontent.com'),
	dnsPrefetch('https://img.shields.io')
]).finally(() => console.timeEnd('preload'));

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
				break;

			default:
				throw new TypeError(`Invalid nav button type: ${currentTarget.dataset.nav}.`);
		}
	}, { signal: controller.signal });
});

observeEvents();
