export default ({ url, method }) => {
	const div = document.createElement('div');
	const h1 = document.createElement('h1');
	h1.textContent = `${method} ${url.href} [404 Not Found]`;
	const a = document.createElement('a');
	a.href = document.baseURI;
	a.textContent = 'Home';
	div.append(h1, a);
	return div;
}

export const title = () => `404 <${location.href}> Not Found`;
export const description = () => `404 <${location.href}> Not Found`;
