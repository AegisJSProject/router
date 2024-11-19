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
	transition: {
		keyframes: {
			opacity: [1, 0],
			transform: ['none', 'scale(0.8) translateX(-100%)']
		},
		options: {
			easing: 'ease-in',
			duration: 150,
		}
	},
	signal: controller.signal,
}).finally(() => console.timeEnd('init'));

observePreloadsOn('#nav');

registerPath('/product/?id=:productId', ({ matches }) => url`${location.origin}/product/${matches.search.groups.productId}`);

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
