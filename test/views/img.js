import { svg } from '@aegisjsproject/core/parsers/svg.js';
import { css } from '@aegisjsproject/core/parsers/css.js';

const color = crypto.getRandomValues(new Uint8Array(3)).toHex();
const svgClass = '_' + crypto.randomUUID();

export default ({
	params: { fill = color, size = '96', radius = 1 } = {},
}) => svg`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" class="${svgClass}" viewBox="0 0 10 10">
	<rect x="0" y="0" rx="${radius}" ry="${radius}" width="10" height="10" fill="#${fill}"></rect>
</svg>`;

export const title = 'Random Image';

export const description = ({
	params: { fill = color, size = '96', radius = 1 } = {},
} = {}) => `Random image (fill: #${fill}, size: ${size}, radius: ${radius})`;

export const styles = css`.${svgClass} {
	transform: none;
	transition: transform 800ms ease-in-out;

	&:hover {
		transform: scale(1.3) rotate(1turn);
	}
}`;
