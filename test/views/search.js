import { url, navigate } from '@aegisjsproject/router/router.js';
import { manageSearch } from '@aegisjsproject/url/url.js';
import { EVENTS } from '@aegisjsproject/callback-registry/events.js';
import { FUNCS } from '@aegisjsproject/core/callbackRegistry.js';
import { registerCallback } from '@aegisjsproject/core/callbackRegistry.js';
import { trustedHTML } from '@aegisjsproject/escape';

const [query, setQuery] = manageSearch('q', 'Toasters');
const inputHandler = registerCallback('search:input:' + crypto.randomUUID(), event => setQuery(event.target.value, { cause: event.target }));

const submitHandler = registerCallback('search:submit', async event => {
	event.preventDefault();
	const bytes = new TextEncoder().encode(query);
	const hash = await crypto.subtle.digest('SHA-256', bytes);
	await navigate(url`${location.origin}/product/${hash}`, { name: query.toString() });
});

export default (params) => {
	console.log(params);
	params.signal.addEventListener('abort', console.log, { once: true });

	return trustedHTML`
		<form action="/search" id="search" ${EVENTS.onSubmit}="${submitHandler}" method="GET">
			<label for="query">Query</label>
			<input type="search" id="query" name="q" placeholder="Search for..." value="${query}" ${EVENTS.onChange}="${FUNCS.debug.info}" ${EVENTS.onInput}="${inputHandler}" autofocus="" required="" />
			<button type="submit" class="btn btn-primary">Search</button>
		</form>
		<pre><code>${JSON.stringify(params, null, 4)}</code></pre>
	`;
};

export const title = () => `Search results for "${query}"`;
export const description = () => `Search results for "${query}"`;
