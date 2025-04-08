import { btn, btnOutlineDanger, btnOutlineInfo } from '@aegisjsproject/styles/button.js';
import { positions } from '@aegisjsproject/styles/misc.js';

const policy = trustedTypes.createPolicy('home#html', {
	createHTML(input) {
		return input;
	}
});

const styles = await new CSSStyleSheet().replace(`:popover-open {
	display: block;
	max-height: 90dvh;
	max-width: 90vw;
	min-width: 60vw;
	overflow: auto;
	border-radius: 6px;
	border-style: none;
	font-family: system-ui;
}

:popover-open::backdrop {
	background-color: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(4px);
}

.header {
	background-color: rgba(0, 0, 0, 0.6);
	backdrop-filter: blur(5px);
	padding: 0.3em;
}`);

export default ({ url, state, timestamp, matches, params, signal }) => {
	const el = document.createElement('div');

	el.setHTMLUnsafe(policy.createHTML(`<div>
		<template shadowrootmode="open" shadowrootserializable="">
			<div part="popover" popover="manual" id="popover">
				<div part="header" class="header sticky top z-4">
					<button type="button" class="btn btn-outline-danger" popovertarget="popover" popovertargetaction="hide">Close</button>
				</div>
				<pre part="content"><slot name="content">No Content</slot></pre>
			</div>
			<button type="button" popovertarget="popover" popovertargetaction="show" class="btn btn-outline-info">Show Popover</button>
		</template>
		<code slot="content">${JSON.stringify({ url, state, timestamp, matches, params, signal: { aborted: signal.aborted, reason: signal.reason }}, null, 4)}</code>
	</div>`));

	signal.addEventListener('abort', () => {
		if (el.isConnected) {
			el.firstElementChild.shadowRoot.getElementById('popover').hidePopover();
		}
	}, { once: true });

	el.firstElementChild.shadowRoot.adoptedStyleSheets = [btn, btnOutlineDanger, btnOutlineInfo, positions, styles];

	return el;
};

export const title = 'AegisJSProject Home';
export const description = 'Testing AegisJSProject Router library';
