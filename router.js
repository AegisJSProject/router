import { getStateObj, diffState, notifyStateChange } from '@aegisjsproject/state/state.js';

const registry = new Map();
const matchSymbol = Symbol('matchResult');
let rootEl = document.getElementById('root') ?? document.body;

const mutObserver = new MutationObserver(entries => entries.forEach(entry => interceptNav(entry.target)));

async function _popstateHandler(event) {
	const diff = diffState(event.state);
	await notifyStateChange(diff);
	const content = await getModule(new URL(location.href));
	_updatePage(content);
};

function _interceptLinkClick(event) {
	if (event.currentTarget.href.startsWith(location.origin)) {
		event.preventDefault();
		navigate(event.currentTarget.href);
	}
};

async function _getHTML(url) {
	const resp = await fetch(url, {
		headers: { 'Accept': 'text/html' },
		referrerPolicy: 'no-referrer',
	});

	const html = await resp.text();
	return Document.parseHTMLUnsafe(html);
}

function _updatePage(content) {
	const timestamp = performance.now();

	if (content instanceof Document) {
		if (content.head.childElementCount !== 0) {
			document.head.replaceChildren(...content.head.cloneNode(true).childNodes);
		}

		rootEl.replaceChildren(...content.body.cloneNode(true).childNodes);
	} else if (content instanceof HTMLTemplateElement) {
		rootEl.replaceChildren(content.cloneNode(true).content);
	} else if (content instanceof Function && content.prototype instanceof HTMLElement) {
		const match = content[matchSymbol] ?? {};
		rootEl.replaceChildren(new content({ state: getStateObj(), url: new URL(location.href), timestamp, ...match }));
	} else if (content instanceof Node) {
		rootEl.replaceChildren(content.cloneNode(true));
	} else if (content instanceof Function) {
		_updatePage(content());
	} else if (content instanceof Error) {
		reportError(content);
		rootEl.textContent = content.message;
	} else if (! (content === null || typeof content === 'undefined')) {
		rootEl.textContent = content;
	}
}

async function _handleModule(moduleSrc, args = {}) {
	const module = await Promise.try(() => import(moduleSrc)).catch(err => err);
	const url = new URL(location.href);
	const state = getStateObj();
	const timestamp = performance.now();

	if (module instanceof Error) {
		return module.message;
	} else if (! ('default' in module)) {
		return new Error(`${moduleSrc} has no default export.`);
	} else if (module.default instanceof Function && module.default.prototype instanceof HTMLElement) {
		if (typeof customElements.getName(module.default) !== 'string') {
			customElements.define(
				module.default[Symbol.for('tagName')] ?? `aegis-el-${crypto.randomUUID()}`,
				module.default
			);
		}

		module.default[matchSymbol] = args;
		return module.default;
	} else if (module.default instanceof Function) {
		return await module.default({
			state,
			url,
			timestamp,
			...args
		});
	} else if (module.default instanceof Node || module.default instanceof Error) {
		_updatePage(module.default);
	} else {
		throw new TypeError(`${moduleSrc} has a missing or invalid default export.`);
	}
}

let page404 = ({ url = location.href }) => {
	const div = document.createElement('div');
	const p = document.createElement('p');
	const a = document.createElement('a');

	p.textContent = `${url} [404 Not Found]`;
	a.href = document.baseURI;
	a.textContent = 'Go Home';

	a.addEventListener('click', event => {
		event.preventDefault();
		navigate(event.currentTarget.href);
	}, { once: true });

	div.append(p, a);

	return div;
};

export const findPath = input => registry.keys().find(pattern => pattern.test(input));

export const set404 = path => page404 = path;

export function interceptNav(target = document.body, { signal } = {}) {
	if (target.tagName === 'A') {
		entry.target.addEventListener('click', _interceptLinkClick, { signal, passive: false });
	} else {
		target.querySelectorAll('a[href]').forEach(el => {
			el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
		});
	}
}

export function setRoot(target) {
	if (target instanceof HTMLElement) {
		rootEl = target;
	} else if (typeof target === 'string') {
		setRoot(document.querySelector(target));
	} else {
		throw new TypeError('Cannot set root to a non-html element.');
	}
}

export function observeLinksOn(target = document.body, { signal } = {}) {
	if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (typeof target === 'string') {
		observeLinksOn(document.querySelector(target), { signal });
	} else if (target instanceof Element) {
		interceptNav(target, { signal });
		mutObserver.observe(target, { childList: true, subtree: true });

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', () => mutObserver.disconnect());
		}
	}
}

export function registerPath(path, moduleSrc) {
	if (typeof path === 'string') {
		registerPath(new URLPattern(path, document.baseURI), moduleSrc);
	} else if (path instanceof URL) {
		registerPath(path.href, moduleSrc);
	} else if (path instanceof URLPattern) {
		registry.set(path, moduleSrc);
	} else {
		throw new TypeError(`Could not convert ${path} to a URLPattern.`);
	}
}

export async function getModule(input = location) {
	const timestamp = performance.now();

	if (input === null) {
		throw new Error('Invalid path.');
	} else if (! (input instanceof URL)) {
		return await getModule(URL.parse(input, document.baseURI));
	} else {
		const match = findPath(input);

		if (match instanceof URLPattern) {
			return await _handleModule(registry.get(match), match.exec(input));
		} else if (typeof page404 === 'string') {
			return await _handleModule(page404, {});
		} else if (page404 instanceof Function) {
			_updatePage(page404({ timestamp, state: getStateObj(), url: new URL(location.href) }))
		} else {
			return await _getHTML(input);
		}
	}
}

export async function navigate(url, state = getStateObj()) {
	if (url === null) {
		throw new TypeError('URL cannot be null.');
	} else if (! (url instanceof URL)) {
		await navigate(URL.parse(url, document.baseURI), state);
	} else if (url.href !== location.href) {
		try {
			rootEl.dispatchEvent(new Event('beforenavigate'));
			history.pushState(state, '', url);
			await notifyStateChange();
			const content = await getModule(url);

			_updatePage(content);
			rootEl.dispatchEvent(new Event('afternavigate'));

			return content;
		} catch(err) {
			back();
			reportError(err);
		}
	}
}

export function back() {
	history.back();
}

export function forward() {
	history.forward();
}

export function go(delta = 0) {
	history.go(delta);
}

export function reload() {
	go(0);
}

export function addPopstateListener({ signal } = {}) {
	globalThis.addEventListener('popstate', _popstateHandler, { signal });
}

export function removeListener() {
	globalThis.removeEventListener('popstate', _popstateHandler);
}

export async function init(paths, {
	preload = false,
	intceptRoot = document.body,
	baseURL = document.baseURI,
	notFound,
	rootNode,
	signal,
} = {}) {
	if (typeof paths === 'object') {
		Object.entries(paths).forEach(([pattern, moduleSrc]) => registerPath(new URLPattern(pattern, baseURL), moduleSrc));
	}

	if (preload) {
		Object.values(paths).forEach(src => preloadModule(src));
	}

	if (typeof notFound !== 'undefined') {
		set404(notFound);
	}

	if (rootNode instanceof HTMLElement || typeof rootNode === 'string') {
		setRoot(rootNode);
	}

	if (intceptRoot instanceof HTMLElement || typeof intceptRoot === 'string') {
		observeLinksOn(intceptRoot, { signal });
	}

	const content = await getModule(new URL(location.href));
	_updatePage(content);
	addPopstateListener({ signal });
}

export function preloadModule(src, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'auto',
	as = 'script',
} = {}) {
	const link = document.createElement('link');
	link.rel = 'modulepreload';
	link.fetchPriority = fetchPriority;
	link.crossOrigin = crossOrigin;
	link.referrerPolicy = referrerPolicy;
	link.as = as;

	if (import.meta.resolve instanceof Function) {
		link.href = import.meta.resolve(src);
	} else {
		link.href = src;
	}

	document.head.append(link);
}
