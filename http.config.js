const cache = new Map();

export default {
	open: true,
	pathname: '/test/',
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
