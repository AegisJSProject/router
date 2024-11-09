import { init, back, forward, reload, registerPath, url, observePreloadsOn } from '@aegisjsproject/router/router.js';
import { observeEvents } from '@aegisjsproject/core/events.js';
import { reset } from '@aegisjsproject/styles/reset.js';
import { baseTheme, lightTheme, darkTheme } from '@aegisjsproject/styles/theme.js';
import { btn, btnPrimary, btnSuccess, btnDanger, btnLink } from '@aegisjsproject/styles/button.js';
import { properties } from '@aegisjsproject/styles/properties.js';
import { positions, displays } from '@aegisjsproject/styles/misc.js';

const customStyle = new CSSStyleSheet();
customStyle.replace(`#nav, dialog::backdrop {
	background-color: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(4px);
}

dialog {
	border: none;
	border-radius: 4px;
}

.flex.wrap {
	flex-wrap: wrap;
}`);

document.adoptedStyleSheets = [properties, reset, baseTheme, lightTheme, darkTheme, btn, btnPrimary, btnSuccess, btnDanger, btnLink, positions, displays, customStyle];

const controller = new AbortController();
globalThis.controller = controller;

console.time('init');

init('#routes', {
	preload: document.documentElement.classList.contains('preload'),
	notFound: '/test/views/404.js',
	rootEl: '#root',
	inteceptRoot: document.body,
	signal: controller.signal,
}).finally(() => console.timeEnd('init'));

observePreloadsOn('#nav');

registerPath('/product/?id=:productId', ({ matches }) => url`${location.origin}/product/${matches.search.groups.productId}`);

document.addEventListener('aegis:navigate', event => {
	event.waitUntil(async () => {
		const root = document.getElementById('root');
		const opts = { duration: 200, fill: 'both', easing: 'ease-out' };

		await Promise.all(root.getAnimations().map(anim => anim.finished));

		switch(event.reason) {
			case 'aegis:router:back':
			case 'aegis:router:forward':
			case 'aegis:router:navigate':
			case 'aegis:router:go':
				await root.animate([
					{ opacity: 1 },
					{ opacity: 0 },
				], opts).finished;
				break;

			case 'aegis:router:load':
				await root.animate([
					{ opacity: 0 },
					{ opacity: 1 },
				], opts).finished;
				break;
		}
	});
}, {
	passive: true,
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
