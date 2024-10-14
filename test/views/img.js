import { svg } from '@aegisjsproject/core/parsers/svg.js';

export default () => svg`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 10 10">
	<rect x="0" y="0" rx="1" ry="1" width="10" height="10" fill="#${crypto.getRandomValues(new Uint8Array(3)).toHex()}"></rect>
</svg>`;
