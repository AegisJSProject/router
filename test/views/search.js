import { url, navigate } from '@aegisjsproject/router/router.js';
import { manageSearch } from '@aegisjsproject/url/url.js';
import { EVENTS, signal as signalAttr } from '@aegisjsproject/callback-registry/events.js';
import { FUNCS } from '@aegisjsproject/core/callbackRegistry.js';
import { registerCallback } from '@aegisjsproject/core/callbackRegistry.js';
import { html } from '@aegisjsproject/core/parsers/html.js';
import { createAttribute as attr } from '@aegisjsproject/core/dom.js';

const [query, setQuery] = manageSearch('q', 'Toasters');
const inputHandler = registerCallback('search:input:' + crypto.randomUUID(), event => setQuery(event.target.value, { cause: event.target }));

const getBlob = ({ fill = '#da1212', size = '96', radius = 1 } = {}) => new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 10 10">
	<rect x="0" y="0" rx="${radius}" ry="${radius}" width="10" height="10" fill="#${fill}"></rect>
</svg>`], { type: 'image/svg+xml' })

const submitHandler = registerCallback('search:submit', async event => {
	event.preventDefault();
	const bytes = new TextEncoder().encode(query);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	await navigate(url`${location.origin}/product/${hash}`, { name: query.toString() });
});

export default params => {
	params.signal.addEventListener('abort', console.log, { once: true });
	const size = 18;
	const radius = 2;
	const fill = '#' + crypto.getRandomValues(new Uint8Array(3)).toHex();
	const blob = getBlob({ size, radius, fill });
	const uri = params.stack.adopt(URL.createObjectURL(blob), URL.revokeObjectURL);

	return html`
		<form action="/search" method="GET" id="search" ${EVENTS.onSubmit}="${submitHandler}" ${signalAttr}="${params.signal}">
			<label for="query">Query</label>
			<input type="search" id="query" name="q" placeholder="Search for..." ${attr('value', query)} ${EVENTS.onChange}="${FUNCS.debug.info}" ${EVENTS.onInput}="${inputHandler}" ${signalAttr}="${params.signal}" autofocus="" required="" />
			<button type="submit" class="btn btn-primary">
				<img src="${uri}" width="${size}" height="${size}" decoding="lazy" alt="random image" />
				<span>Search</span>
			</button>
		</form>
		<details>
			<summary>Request Details</summary>
			<pre><code>${JSON.stringify(params, null, 2)}</code></pre>
		</details>
	`;
};

export const title = () => `Search results for "${query}"`;
export const description = () => `Search results for "${query}"`;
