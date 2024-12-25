import { url, navigate } from '@aegisjsproject/router/router.js';
import { manageSearch } from '@aegisjsproject/url/url.js';
import { EVENTS } from '@aegisjsproject/callback-registry/events.js';
import { FUNCS } from '@aegisjsproject/core/callbackRegistry.js';
import { registerCallback } from '@aegisjsproject/core/callbackRegistry.js';

const submitHandler = registerCallback('search:submit', async event => {
	event.preventDefault();
	const data = new FormData(event.target);
	const bytes = new TextEncoder().encode(data.get('q'));
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	await navigate(url`${location.origin}/product/${hash}`, { name: data.get('q') });
});

const [query, setQuery] = manageSearch('q', 'Toasters');
const inputHandler = registerCallback('search:input:' + crypto.randomUUID(), event => setQuery(event.target.value, { cause: event.target }));

export default (params) => {
	params.signal.addEventListener('abort', console.log, { once: true });
	console.log(params.signal);

	return `
		<form action="/search" id="search" ${EVENTS.onSubmit}="${submitHandler}" method="GET">
			<label for="query">Query</label>
			<input type="search" id="query" name="q" placeholder="Search for..." value="${query}" ${EVENTS.onChange}="${FUNCS.debug.info}" ${EVENTS.onInput}="${inputHandler}" required="" />
			<button type="submit" class="btn btn-primary">Search</button>
		</form>
		<pre><code>${JSON.stringify(params, null, 4)}</code></pre>
	`;
};

export const title = () => `Search results for "${query}"`;
export const description = () => `Search results for "${query}"`;
