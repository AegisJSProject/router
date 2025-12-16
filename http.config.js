import { imports } from '@shgysk8zer0/importmap';
import { useDefaultCSP, addScriptSrc, addConnectSrc, addTrustedTypePolicy, lockCSP } from '@aegisjsproject/http-utils/csp.js';

addScriptSrc(
	// imports['@shgysk8zer0/polyfills'],
	'https://unpkg.com/@shgysk8zer0/polyfills@0.5.3/browser.min.js',
	'https://unpkg.com/@aegisjsproject/',
	imports.marked,
	imports['marked-highlight'],
	imports['@highlightjs/cdn-assets/'],
);
addConnectSrc('https://api.github.com/users/', 'https://baconipsum.com/api/');
addTrustedTypePolicy('aegis-router#html', 'aegis-sanitizer#html', 'default');
lockCSP();

export default {
	open: true,
	routes: {
		'/': '@aegisjsproject/dev-server',
		'/product/:productId': '@aegisjsproject/dev-server',
		'/favicon.svg': '@aegisjsproject/dev-server/favicon.js',
		'/page/markdown': '@aegisjsproject/dev-server',
		'/test/': '@aegisjsproject/dev-server',
		'/search?q=:query': '@aegisjsproject/dev-server',
		'/img/:fill([A-Fa-f\\d]{3,6})?/:size(\\d+)?/:radius(\\d+)?': '@aegisjsproject/dev-server',
		'/page/bacon/:lines(\\d+)': '@aegisjsproject/dev-server',
		'/github/:username(\\w+)': '@aegisjsproject/dev-server',
	},
	responsePostprocessors: [useDefaultCSP()],
};
