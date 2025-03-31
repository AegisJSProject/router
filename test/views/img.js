import { svg } from '@aegisjsproject/core/parsers/svg.js';

const color = crypto.getRandomValues(new Uint8Array(3)).toHex();

export default ({
	params: { fill = color, size = '96', radius = 1 } = {},
}) => svg`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 10 10">
	<rect x="0" y="0" rx="${radius}" ry="${radius}" width="10" height="10" fill="#${fill}"></rect>
</svg>`;

export const title = 'Random Image';

export const description = ({
	params: { fill = color, size = '96', radius = 1 } = {},
} = {}) => `Random image (fill: #${fill}, size: ${size}, radius: ${radius})`;
