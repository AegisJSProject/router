import { sanitizer } from '@aegisjsproject/sanitizer/config/base.js';
import { init, registerPath } from '@aegisjsproject/router/router.js';
import { observeEvents } from '@aegisjsproject/core/events.js';
import reset from '@aegisjsproject/styles/css/reset.css' with { type: 'css' };
import { baseTheme, lightTheme, darkTheme } from '@aegisjsproject/styles/theme.js';
// import theme from '@aegisjsproject/styles/css/theme.css' with { type: 'css' };
import btn from '@aegisjsproject/styles/css/button.css' with { type: 'css' };
import properties from '@aegisjsproject/styles/css/properties.css' with { type: 'css' };
import misc from '@aegisjsproject/styles/css/misc.css' with { type: 'css' };
import { observeCommands, initRootCommands } from '@aegisjsproject/commands';

Attr.prototype.toString = function() {
	return `${this.name}=${this.value}`;
};

const controller = new TaskController({ priority: 'background' });
const customStyle = new CSSStyleSheet();

trustedTypes.createPolicy('default', {
	createHTML(input, config = { sanitizer }) {
		const el = document.createElement('div');
		el.setHTML(input, config);
		return el.innerHTML;
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

document.adoptedStyleSheets = [properties, reset, baseTheme, lightTheme, darkTheme, btn, misc, customStyle];

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
observeEvents();
observeCommands();
initRootCommands();
