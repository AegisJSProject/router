import { init, back, forward, reload, registerPath } from '@aegisjsproject/router/router.js';
import { observeEvents } from '@aegisjsproject/core/events.js';
import { reset } from '@aegisjsproject/styles/reset.js';
import { baseTheme, lightTheme, darkTheme } from '@aegisjsproject/styles/theme.js';
import { btn, btnPrimary, btnSuccess, btnDanger, btnLink } from '@aegisjsproject/styles/button.js';
import { properties } from '@aegisjsproject/styles/properties.js';
import { positions, displays } from '@aegisjsproject/styles/misc.js';

const controller = new TaskController({ priority: 'background' });
const customStyle = new CSSStyleSheet();

trustedTypes.createPolicy('default', {
	createHTML(input, config) {
		return Document.parseHTML(input, config).body.innerHTML;
	}
});

customStyle.replace(`
	body {
		min-height: 100dvh;
	}

	#nav, dialog::backdrop {
		background-color: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
	}

	dialog {
		border: none;
		border-radius: 4px;
	}

	.flex.wrap {
		flex-wrap: wrap;
	}
`);

document.adoptedStyleSheets = [properties, reset, baseTheme, lightTheme, darkTheme, btn, btnPrimary, btnSuccess, btnDanger, btnLink, positions, displays, customStyle];

globalThis.controller = controller;

console.time('init');

init('#routes', {
	preload: document.documentElement.classList.contains('preload'),
	notFound: '/test/views/404.js',
	rootEl: '#root',
	inteceptRoot: document.body,
	observePreloads: true,
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

registerPath('/product/?id=:productId', ({ params: { productId } }) => URL.parse(`${location.origin}/product/${productId}`));

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
