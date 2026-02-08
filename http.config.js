import { imports } from '@shgysk8zer0/importmap';
import { useDefaultCSP, addScriptSrc, addStyleSrc, addConnectSrc, addImageSrc, addTrustedTypePolicy, lockCSP } from '@aegisjsproject/http-utils/csp.js';

addScriptSrc(
	imports['@shgysk8zer0/polyfills'],
	'https://unpkg.com/@aegisjsproject/',
	'https://unpkg.com/@lit/',
	imports.marked,
	imports['marked-highlight'],
	imports['@highlightjs/cdn-assets/'],
);
addConnectSrc('https://api.github.com/users/', 'https://baconipsum.com/api/');
addStyleSrc(imports['@shgysk8zer0/core-css/']);
addImageSrc('https://avatars.githubusercontent.com/u/', 'https://images.unsplash.com/', 'blob:');
addTrustedTypePolicy('aegis-router#html', 'aegis-sanitizer#html', 'aegis-escape#html', 'lit-html', 'default');
lockCSP();

const DEV_SERVER = '@aegisjsproject/dev-server';

export default {
	open: true,
	routes: {
		'/': DEV_SERVER,
		'/product/:productId': DEV_SERVER,
		'/favicon.svg': DEV_SERVER + '/favicon.js',
		'/page/markdown': DEV_SERVER,
		'/test/': DEV_SERVER,
		'/search?q=:query': DEV_SERVER,
		'/img/:fill([A-Fa-f\\d]{3,6})?/:size(\\d+)?/:radius(\\d+)?': DEV_SERVER,
		'/page/bacon/:lines(\\d+)': DEV_SERVER,
		'/github/:username(\\w+)': DEV_SERVER,
	},
	responsePostprocessors: [useDefaultCSP()],
};
