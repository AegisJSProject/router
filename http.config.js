import { readFile } from 'node:fs/promises';
const home = await readFile('./test/index.html');
const getHome = () => new Response(home, { headers: { 'Content-Type': 'text/html' }});
const cache = new Map();

export default {
	open: true,
	pathname: '/test/',
	routes: {
		'/favicon.svg': () => new Response(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 10 10">
	<rect x="0" y="0" rx="10" ry="10" width="10" height="10" fill="#${crypto.getRandomValues(new Uint8Array(3)).toHex()}"></rect>
</svg>`, { headers: { 'Content-Type': 'image/svg+xml' }}),
		'/product/:productId': getHome,
		'/page/markdown': getHome,
		'/test/': getHome,
		'/search?q=:query': getHome,
		'/img/:fill([A-Fa-f\\d]{3,6})?/:size(\\d+)?/:radius(\\d+)?': getHome,
		'/page/bacon/:lines(\\d+)': getHome,
		'/github/:username(\\w+)': getHome,
	},
	requestPreprocessors: [
		req => {
			if (cache.has(req.url)) {
				return cache.get(req.url);
			}
		}
	],
	responsePostprocessors: [
		(response, { request }) => {
			if (! cache.has(request.url)) {
				cache.set(request.url, response);
			} else if (request.destination === 'document') {
				response.headers.set('X-Content-Type-Options', 'nosniff');
				response.headers.set('X-Frame-Options', 'DENY');
				response.headers.set('Referrer-Policy', 'no-referrer');
				response.headers.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), usb=()');
				response.headers.set('Content-Security-Policy', [
					'default-src \'none\'',
					'script-src \'self\' https://unpkg.com/@aegisjsproject/ https://unpkg.com/@highlightjs/ https://unpkg.com/marked@14.1.2/ https://unpkg.com/marked-highlight@2.1.4/ https://unpkg.com/@shgysk8zer0/ \'sha384-6LUyawnxfH/YGnKoiCIaBZaD6mgxHEjqKG4fYiwyZ3BTUXk2jBQc6DOoO/PzUJTK\' \'sha384-1saT/U4nXVBbxQeMGiDxcWp3S9u8rT3rkBuRH7vV0DsGqV6jqGPp6ZNEEvsIWpWQ\'',
					'style-src \'self\' https://unpkg.com/@highlightjs/ blob:',
					'img-src \'self\' avatars.githubusercontent.com/u/ https://img.shields.io/ https://github.com/AegisJSProject/router/actions/workflows/ https://github.com/AegisJSProject/router/workflows/ blob:',
					'connect-src \'self\' https://baconipsum.com/api/ https://api.github.com/users/',
					'trusted-types aegis-sanitizer#html aegis-router#html home#html',
					'require-trusted-types-for \'script\'',
				].join('; '));
			}
		}
	]
};
