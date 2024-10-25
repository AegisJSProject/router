import { getStateObj, diffState, notifyStateChange } from '@aegisjsproject/state';

const isModule = ! (document.currentScript instanceof HTMLScriptElement);
const supportsImportmap = HTMLScriptElement.supports('importmap');
const registry = new Map();
const NO_BODY_METHODS = ['GET', 'HEAD', 'DELETE', 'OPTIONS'];
const mutObserver = new MutationObserver(entries => entries.forEach(entry => interceptNav(entry.target)));
let rootEl = document.getElementById('root') ?? document.body;

async function _popstateHandler(event) {
	const diff = diffState(event.state);
	await notifyStateChange(diff);
	const content = await getModule(new URL(location.href));
	_updatePage(content);
};

function _isModuleURL(src) {
	switch(src[0]) {
		case '/':
		case '.':
			return true;

		case 'h':
			return src.substring(0, '4') === 'http' && URL.canParse(src);

		default:
			return false;
	}
}

function _resolveModule(src) {
	if (_isModuleURL(src)) {
		return URL.parse(src, document.baseURI);
	} else if (! supportsImportmap) {
		throw new TypeError('Importmaps and module specifiers are not supported');
	} else if (! isModule) {
		throw new TypeError('Cannot resolve a module specifier outside of a module script.');
	} else {
		return import.meta.resolve(src);
	}
}

function _interceptLinkClick(event) {
	if (event.isTrusted && event.currentTarget.href.startsWith(location.origin)) {
		event.preventDefault();
		navigate(event.currentTarget.href);
	}
};

async function _interceptFormSubmit(event) {
	if (event.isTrusted && event.target.action.startsWith(location.origin)) {
		event.preventDefault();
		const { method, action } = event.target;
		const formData = new FormData(event.target);

		if (NO_BODY_METHODS.includes(method.toUpperCase())) {
			const url = new URL(action);
			const params = new URLSearchParams(formData);

			for (const [key, val] of params.entries()) {
				url.searchParams.append(key, val);
			}

			await navigate(url, getStateObj(), { method });
		} else {
			await navigate(action, getStateObj(), { method, formData });
		}
	}
}

async function _getHTML(url, { signal, method = 'GET', body } = {}) {
	const resp = await fetch(url, {
		method,
		body: NO_BODY_METHODS.includes(method.toUpperCase()) ? null : body,
		headers: { 'Accept': 'text/html' },
		referrerPolicy: 'no-referrer',
		signal,
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
		rootEl.replaceChildren(new content({ state: getStateObj(), url: new URL(location.href), timestamp }));
	} else if (content instanceof HTMLElement) {
		// Cannot clone custom elements with non-clonable shadow roots (and cannot test on closed shadows)
		const isClonable = typeof customElements.getName(content.constructor) !== 'string'
			|| (content.shadowRoot instanceof ShadowRoot && content.shadowRoot.clonable);

		rootEl.replaceChildren(isClonable ? content.cloneNode(true) : content);
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
	const module = await Promise.try(() => _isModuleURL(moduleSrc)
		? import(URL.parse(moduleSrc, document.baseURI))
		: import(moduleSrc)).catch(err => err);

	const url = new URL(location.href);
	const state = getStateObj();
	const timestamp = performance.now();

	if (args.signal instanceof AbortSignal && args.signal.aborted) {
		return args.signal.reason.message;
	} else if (module instanceof Error) {
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

		return new module.default({
			url,
			state,
			timestamp,
			...args
		});
	} else if (module.default instanceof Function) {
		return await module.default({
			url,
			state,
			timestamp,
			...args
		});
	} else if (module.default instanceof Node || module.default instanceof Error) {
		_updatePage(module.default);
	} else {
		throw new TypeError(`${moduleSrc} has a missing or invalid default export.`);
	}
}

let view404 = ({ url = location, method = 'GET' }) => {
	const div = document.createElement('div');
	const p = document.createElement('p');
	const a = document.createElement('a');

	p.textContent = `${method.toUpperCase()} ${url.href} [404 Not Found]`;
	a.href = document.baseURI;
	a.textContent = 'Go Home';

	a.addEventListener('click', _interceptLinkClick);
	div.append(p, a);

	return div;
};

/**
 * Finds the matching URL pattern for a given input.
 *
 * @param {string|URL} input - The input URL or path.
 * @returns {URLPattern|undefined} - The matching URL pattern, or undefined if no match is found.
 */
export const findPath = input => registry.keys().find(pattern => pattern.test(input));

/**
 * Sets the 404 handler.
 *
 * @param {string} path - The path to the 404 handler module or the handler function itself.
 */
export const set404 = path => view404 = path;

/**
 * Intercepts navigation events within a target element.
 *
 * @param {HTMLElement|string} target - The element to intercept navigation events on. Defaults to document.body.
 * @param {Object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the interception.
 */
export function interceptNav(target = document.body, { signal } = {}) {
	if (target.tagName === 'A' && target.href.startsWith(location.origin)) {
		target.addEventListener('click', _interceptLinkClick, { signal, passive: false });
	} else if (target.tagName === 'FORM' && target.action.startsWith(location.origin)) {
		target.addEventListener('submit', _interceptFormSubmit, { signal, passive: false });

		target.querySelectorAll('a[href]:not([rel~="external"])').forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});
	} else {
		target.querySelectorAll('a[href]:not([rel~="external"])').forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});

		target.querySelectorAll('form').forEach(el => {
			el.addEventListener('submit', _interceptFormSubmit, { passive: false, signal });
		});
	}
}

/**
 * Sets the root element for the navigation system.
 *
 * @param {HTMLElement|string} target - The element to set as the root.
 */
export function setRoot(target) {
	if (target instanceof HTMLElement) {
		rootEl = target;
	} else if (typeof target === 'string') {
		setRoot(document.querySelector(target));
	} else {
		throw new TypeError('Cannot set root to a non-html element.');
	}
}

/**
 * Observes links on an element for navigation.
 *
 * @param {HTMLElement|string} target - The element to observe links on. Defaults to document.body.
 * @param {object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the observation.
 */
export function observeLinksOn(target = document.body, { signal } = {}) {
	if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (typeof target === 'string') {
		observeLinksOn(document.querySelector(target), { signal });
	} else if (target instanceof Element) {
		interceptNav(target, { signal });
		mutObserver.observe(target, { childList: true, subtree: true });

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', () => mutObserver.disconnect(), { once: true });
		}
	}
}

/**
 * Registers a URL pattern with its corresponding module source.
 *
 * @param {URLPattern|string|URL} path - The URL pattern or URL to register.
 * @param {string} moduleSrc - The module source URL.
 */
export function registerPath(path, moduleSrc, { preload = false } = {}) {
	if (typeof path === 'string') {
		registerPath(new URLPattern(path, document.baseURI), moduleSrc, { preload });
	} else if (path instanceof URL) {
		registerPath(new URLPattern(path.href), moduleSrc, { preload });
	} else if (path instanceof URLPattern) {
		registry.set(path, moduleSrc);

		if (preload) {
			preloadModule(moduleSrc);
		}
	} else {
		throw new TypeError(`Could not convert ${path} to a URLPattern.`);
	}
}

/**
 * Fetches a module or retrieves its content based on a URL or path.
 *
 * @param {URL|string|null} input - The URL, path, or null to throw an error. Defaults to `location`.
 * @param {object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the fetch.
 * @param {string} [options.method] - The HTTP method to use for fetching the module. Defaults to 'GET'.
 * @param {FormData} [options.formData] - The form data to send with the request. Defaults to a new FormData object.
 * @returns {Promise<string|void>} - A promise that resolves with the module content or triggers navigation if a path match is found.
 * @throws {Error} - Throws an error if the input is null or cannot be parsed as a URL.
 */
export async function getModule(input = location, { signal, method = 'GET', formData = new FormData() } = {}) {
	const timestamp = performance.now();

	if (input === null) {
		throw new Error('Invalid path.');
	} else if (! (input instanceof URL)) {
		return await getModule(URL.parse(input, document.baseURI), { signal, method, formData });
	} else {
		const match = findPath(input);

		if (match instanceof URLPattern) {
			return await _handleModule(registry.get(match), { url: input, matches: match.exec(input), signal, method, formData });
		} else if (typeof view404 === 'string') {
			return await _handleModule(view404, { url: input, matches: null, signal, method, formData });
		} else if (view404 instanceof Function) {
			_updatePage(view404({ timestamp, state: getStateObj(), url: input, matches: null, signal, method, formData }));
		} else {
			return await _getHTML(input, { method, signal, body: formData });
		}
	}
}

/**
 * Navigates to a new URL.
 *
 * @param {string|URL} url - The URL to navigate to.
 * @param {object} [newState] - The new state object to push to the history.
 * @param {object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the navigation.
 * @param {string} [options.method="GET"] - The HTTP method to use for the navigation.
 * @param {FormData} [options.formData] - The form data to send with the request.
 * @returns {Promise<void>} - A promise that resolves when the navigation is complete.
 */
export async function navigate(url, newState = getStateObj(), {
	signal,
	method = 'GET',
	formData,
} = {}) {
	if (url === null) {
		throw new TypeError('URL cannot be null.');
	} else if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (! (url instanceof URL)) {
		return await navigate(URL.parse(url, document.baseURI), newState, { signal, method, formData });
	} else if (formData instanceof FormData && NO_BODY_METHODS.includes(method.toUpperCase())) {
		const params = new URLSearchParams(formData);

		for (const [key, val] of params) {
			url.searchParams.append(key, val);
		}

		return await navigate(url, newState, { signal, method });
	} else if (url.href !== location.href) {
		try {
			const oldState = getStateObj();
			const diff = diffState(newState, oldState);
			const navigate = new CustomEvent('navigate', {
				bubbles: true,
				cancelable: true,
				detail: { newState, oldState, destination: url.href, method, formData },
			});

			rootEl.dispatchEvent(navigate);

			if (! navigate.defaultPrevented) {
				history.pushState(newState, '', url);
				await notifyStateChange(diff);
				const content = await getModule(url, { signal, method, formData });

				_updatePage(content);

				return content;
			} else {
				return null;
			}
		} catch(err) {
			back();
			reportError(err);
		}
	}
}

/**
 * Navigates back in the history.
 */
export function back() {
	history.back();
}

/**
 * Navigates forward in the history.
 */
export function forward() {
	history.forward();
}

/**
 * Navigates to a specific history entry.
 *
 * @param {number} delta - The number of entries to go back or forward.
 */
export function go(delta = 0) {
	history.go(delta);
}

/**
 * Reloads the current page.
 */
export function reload() {
	go(0);
}

/**
 * Adds a popstate listener to the window.
 *
 * @param {object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the listener.
 */
export function addPopstateListener({ signal } = {}) {
	globalThis.addEventListener('popstate', _popstateHandler, { signal });
}

/**
 * Removes a popstate listener to the window.
 */
export function removeListener() {
	globalThis.removeEventListener('popstate', _popstateHandler);
}

/**
 * Initializes the navigation system.
 *
 * @param {object|string|HTMLScriptElement} routes - An object mapping URL patterns to module source URLs or specifiers, or a script/id to script
 * @param {object} [options] - Optional options.
 * @param {boolean} [options.preload=false] - Whether to preload all modules.
 * @param {HTMLElement|string} [options.inteceptRoot] - The element to intercept link clicks on.
 * @param {string} [options.baseURL] - The base URL for URL patterns.
 * @param {string} [options.notFound] - The 404 handler.
 * @param {HTMLElement|string} [options.rootNode] - The root element for the navigation system.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the initialization.
 * @returns {Promise<void>} - A promise that resolves when the initialization is complete.
 */
export async function init(routes, {
	preload = false,
	inteceptRoot = document.body,
	baseURL = location.origin,
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	notFound,
	rootNode,
	signal,
} = {}) {
	if (typeof routes === 'string') {
		await init(document.querySelector(routes), { preload, inteceptRoot, baseURL, notFound, rootNode, signal });
	} else if (routes instanceof HTMLScriptElement && routes.type === 'application/json') {
		await init(JSON.parse(routes.textContent), { preload, inteceptRoot, baseURL, notFound, rootNode, signal });
	} else if (typeof routes !== 'object' || routes === null || Object.getPrototypeOf(routes) !== Object.prototype) {
		throw new TypeError('Routes must be a plain object, a script with JSON, or the selector to such a script.');
	} else {
		const opts = { preload, signal, crossOrigin, referrerPolicy, fetchPriority, as };
		Object.entries(routes).forEach(([pattern, moduleSrc]) => registerPath(new URLPattern(pattern, baseURL), moduleSrc, opts));

		if (typeof notFound === 'string') {
			set404(notFound);

			if (preload) {
				preloadModule(notFound);
			}
		}

		if (rootNode instanceof HTMLElement || typeof rootNode === 'string') {
			setRoot(rootNode);
		}

		if (inteceptRoot instanceof HTMLElement || typeof inteceptRoot === 'string') {
			observeLinksOn(inteceptRoot, { signal });
		}

		const content = await getModule(new URL(location.href));
		_updatePage(content);
		addPopstateListener({ signal });
	}
}

/**
 * Preloads a module asynchronously.
 *
 * @param {string} src - The URL or specifier to the module to preload.
 * @param {object} [options] - Optional options for the preload element.
 * @param {string} [options.crossOrigin="anonymous"] - The CORS mode to use when fetching the module. Defaults to 'anonymous'.
 * @param {string} [options.referrerPolicy="no-referrer"] - The referrer policy to use when fetching the module. Defaults to 'no-referrer'.
 * @param {string} [options.fetchPriority="low"] - The fetch priority for the preload request. Defaults to 'auto'.
 * @param {string} [options.as="script"] - The type of resource to preload. Defaults to 'script'.
 * @returns {Promise<void>} A promise that resolves when the module is preloaded or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function preloadModule(src, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	signal: passedSignal = AbortSignal.timeout(5000),
} = {}) {

	const { promise, resolve, reject } = Promise.withResolvers();
	const link = document.createElement('link');

	if (passedSignal.aborted) {
		reject(passedSignal.reason);
	} else {
		const controller = new AbortController();
		const signal = AbortSignal.any([controller.signal, passedSignal]);

		link.addEventListener('load', () => {
			resolve();
			controller.abort();
		}, { signal });

		link.addEventListener('error', () => {
			reject(new DOMException(`Error loading ${src}`, 'NotFoundError'));
			controller.abort();
		}, { signal });

		passedSignal.addEventListener('abort', ({ target }) => {
			reject(target.reason);
		}, { signal: controller.signal });

		link.rel = 'modulepreload';
		link.fetchPriority = fetchPriority;
		link.crossOrigin = crossOrigin;
		link.referrerPolicy = referrerPolicy;
		link.as = as;
		link.href = _resolveModule(src);

		document.head.append(link);
	}

	await promise.then(() => link.remove()).catch(err => {
		if (link.isConnected) {
			link.remove();
		}

		reportError(err);
	});
}
