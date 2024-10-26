import { manageSearch } from '@aegisjsproject/router/router.js';
import { EVENTS } from '@aegisjsproject/core/events.js';
import { FUNCS } from '@aegisjsproject/core/callbackRegistry.js';
import { registerCallback } from '@aegisjsproject/core/callbackRegistry.js';


export default (params) => {
	const [query, setQuery] = manageSearch('q', 'Toasters', event => {
		event.preventDefault();
		console.log(event);
	}, {
		signal: params.signal,
	});

	const inputHandler = registerCallback('search:input:' + crypto.randomUUID(), event => setQuery(event.target.value, { cause: event.target }));
	params.signal.addEventListener('abort', console.log, { once: true });

	return `
		<form action="/search" id="search" method="GET">
			<label for="query">Query</label>
			<input type="search" id="query" name="q" placeholder="Search for..." value="${query}" ${EVENTS.onChange}="${FUNCS.debug.info}" ${EVENTS.onInput}="${inputHandler}" required="" />
			<button type="submit" class="btn btn-primary">Search</button>
		</form>
		<pre><code>${JSON.stringify(params, null, 4)}</code></pre>
	`;
};
