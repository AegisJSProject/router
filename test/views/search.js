import { html } from '@aegisjsproject/core/parsers/html.js';

export default (params) => {
	const frag = html`
		<form action="/search" id="search" action="/search" method="GET">
			<label for="query">Query</label>
			<input type="search" name="q" placehoder="Search for..." required="" />
			<button type="submit" class="btn btn-primary">Search</button>
		</form>
		<pre><code>${JSON.stringify(params, null, 4)}</code></pre>
	`;

	// Cannot set `action` in parsing HTML because of sanitizer
	frag.getElementById('search').action = '/search';
	return frag;
};
