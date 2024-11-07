import { getStateObj, diffState, notifyStateChange } from '@aegisjsproject/state';
export { url } from '@aegisjsproject/url/url.js';
import { EVENTS } from '@aegisjsproject/core/events.js';

const isModule = ! (document.currentScript instanceof HTMLScriptElement);
const SUPPORTS_IMPORTMAP = HTMLScriptElement.supports('importmap');
const registry = new Map();
const NO_BODY_METHODS = ['GET', 'HEAD', 'DELETE', 'OPTIONS'];
const DESC_SELECTOR = 'meta[name="description"], meta[itemprop="description"], meta[property="og:description"], meta[name="twitter:description"]';
const mutObserver = new MutationObserver(entries => entries.forEach(entry => interceptNav(entry.target)));
const ROOT_ID = 'root';
const EVENT_TARGET = document;
let rootEl = document.getElementById(ROOT_ID) ?? document.body;
let rootSelector = '#' + ROOT_ID;

export const NAV_EVENT = 'aegis:navigate';

export const EVENT_TYPES = {
	navigate: 'aegis:router:navigate',
	back: 'aegis:router:back',
	forward: 'aegis:router:forward',
	reload: 'aegis:router:reload',
	pop: 'aegis:router:pop',
	go: 'aegis:router:go',
	load: 'aegis:router:load',
	submit: 'aegis:router:submit',
};

export class NavigationEvent extends CustomEvent {
	#reason;
	#url;

	constructor(name = NAV_EVENT, reason = 'unknown', { bubbles = false, cancelable = true, detail = {
		oldState: getStateObj(),
		oldURL: new URL(location.href),
	} } = {}) {
		super(name, { bubbles, cancelable, detail });
		this.#reason = reason;
		this.#url = location.href;
	}

	get reason() {
		return this.#reason;
	}

	get url() {
		return this.#url;
	}

	async cancel({ signal } = {}) {
		return navigate(this.detail.oldURL, this.detail.oldState, { signal });
	}

	[Symbol.toStringTag]() {
		return 'NavigationEvent';
	}
}

// Need this to be "unsafe" to not be restrictive on what modifications can be made to a page
const policy = 'trustedTypes' in globalThis
	? trustedTypes.createPolicy('aegis-router#html', { createHTML: input => input })
	: Object.freeze({ createPolicy: input => input });

async function _popstateHandler(event) {
	const diff = diffState(event.state ?? {});
	await notifyStateChange(diff);
	const content = await getModule(new URL(location.href));
	const navigate = new NavigationEvent(NAV_EVENT, EVENT_TYPES.pop, {
		detail: { newState: event.state, oldState: null, oldURL: new URL(location.href), method: 'GET', formData: null },
	});

	EVENT_TARGET.dispatchEvent(navigate);

	if (! navigate.defaultPrevented) {
		_updatePage(content);
	}
};

function _createMeta(props = {}) {
	const meta = document.createElement('meta');

	Object.entries(props).forEach(([key, val]) => meta.setAttribute(key, val));
	return meta;
}

function _loadLink(href, {
	relList = [],
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'auto',
	signal: passedSignal = AbortSignal.timeout(5000),
	as,
	integrity,
	media,
	type,
} = {}) {
	const { promise, resolve, reject } = Promise.withResolvers();
	const link = document.createElement('link');

	if (passedSignal instanceof AbortSignal && passedSignal.aborted) {
		reject(passedSignal.reason);
	} else {
		link.relList.add(...relList);

		if (typeof fetchPriority === 'string') {
			link.fetchPriority = fetchPriority;
		}

		if (typeof crossOrigin === 'string') {
			link.crossOrigin = crossOrigin;
		}

		if (typeof type === 'string') {
			link.type = type;
		}

		if (typeof media === 'string') {
			link.media = media;
		} else if (media instanceof MediaQueryList) {
			link.media = media.media;
		}

		if (typeof as === 'string') {
			link.as = as;
		}

		if (typeof integrity === 'string') {
			link.integrity = integrity;
		}

		if (link.relList.contains('preload') || link.relList.contains('modulepreload')) {
			const controller = new AbortController();
			const signal = AbortSignal.any([controller.signal, passedSignal]);

			passedSignal.addEventListener('abort', ({ target }) => {
				reject(target.reason);
			}, { signal: controller.signal });

			link.referrerPolicy = referrerPolicy;

			link.addEventListener('load', () => {
				resolve();
				controller.abort();
			}, { signal });

			link.addEventListener('error', () => {
				reject(new DOMException(`Error loading ${href}`, 'NotFoundError'));
				controller.abort();
			}, { signal });

			link.href = _resolveModule(href);

			document.head.append(link);

			return promise.then(() => link.remove()).catch(err => {
				if (link.isConnected) {
					link.remove();
				}

				reportError(err);
			});
		} else {
			link.href = href;
			document.head.append(link);
			resolve();
			return promise;
		}
	}
}

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
	} else if (! SUPPORTS_IMPORTMAP) {
		throw new TypeError('Importmaps and module specifiers are not supported');
	} else if (! isModule) {
		throw new TypeError('Cannot resolve a module specifier outside of a module script.');
	} else {
		return import.meta.resolve(src);
	}
}

function _getLinkStateData(a) {
	const entries = Object.entries(a.dataset)
		.filter(([name]) => name.startsWith('aegisState'))
		.map(([name, value]) => [name[10].toLowerCase() + name.substring(11), value]);

	return Object.fromEntries(entries);
}

function _interceptLinkClick(event) {
	if (event.target.classList.contains('no-router') || event.target.hasAttribute(EVENTS.onClick)) {
		event.target.removeEventListener(_interceptLinkClick);
	} else if (event.isTrusted && event.currentTarget.href.startsWith(location.origin)) {
		event.preventDefault();
		const state = _getLinkStateData(event.currentTarget);
		navigate(event.currentTarget.href, state, { integrity: event.currentTarget.dataset.integrity });
	}
};

async function _interceptFormSubmit(event) {
	if (event.target.classList.contains('no-router') || event.target.hasAttribute(EVENTS.onSubmit)) {
		event.target.removeEventListener('submit', _interceptFormSubmit);
	} else if (event.isTrusted && event.target.action.startsWith(location.origin)) {
		event.preventDefault();
		const { method, action } = event.target;
		const formData = new FormData(event.target);

		const submit = new NavigationEvent(NAV_EVENT, EVENT_TYPES.submit, {
			detail: { oldState: getStateObj(), oldURL: new URL(location.href), formData },
		});

		EVENT_TARGET.dispatchEvent(submit);

		if (submit.defaultPrevented) {
			return;
		} else if (NO_BODY_METHODS.includes(method.toUpperCase())) {
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

async function _getHTML(url, { signal, method = 'GET', body, integrity } = {}) {
	const resp = await fetch(url, {
		method,
		body: NO_BODY_METHODS.includes(method.toUpperCase()) ? null : body,
		headers: { 'Accept': 'text/html' },
		referrerPolicy: 'no-referrer',
		integrity,
		signal,
	}).catch(err => err);

	if (resp.ok) {
		const html = await resp.text();
		return Document.parseHTMLUnsafe(policy.createHTML(html));
	} else if (resp instanceof Error) {
		return resp;
	} else {
		return _get404(url, method, { signal });
	}
}

function _updatePage(content) {
	const timestamp = performance.now();

	if (content instanceof Document) {
		if (content.head.childElementCount !== 0) {
			setTitle(content.title);
			setDescription(content.querySelector(DESC_SELECTOR)?.content);
		}

		const contentEl = typeof rootSelector === 'string' ? content.body.querySelector(rootSelector) ?? content.body : content.body;

		rootEl.replaceChildren(...contentEl.childNodes);
	} else if (content instanceof HTMLTemplateElement) {
		rootEl.replaceChildren(content.content);
	} else if (content instanceof Function && content.prototype instanceof HTMLElement) {
		rootEl.replaceChildren(new content({ state: getStateObj(), url: new URL(location.href), timestamp }));
	} else if (content instanceof Node) {
		rootEl.replaceChildren(content);
	} else if (content instanceof Function) {
		_updatePage(content());
	} else if (typeof content === 'string') {
		rootEl.setHTMLUnsafe(policy.createHTML(content));
	} else if (content instanceof Error) {
		reportError(content);
		rootEl.textContent = content.message;
	} else if (! (content === null || typeof content === 'undefined')) {
		rootEl.textContent = content;
	}

	EVENT_TARGET.dispatchEvent(new NavigationEvent(NAV_EVENT, EVENT_TYPES.load, { cancelable: false }));
}

async function _handleModule(moduleSrc, { state = getStateObj(), ...args } = {}) {
	const module = await Promise.try(() => {
		if (moduleSrc instanceof Function) {
			return moduleSrc(args);
		} else if (typeof moduleSrc === 'string' || module instanceof URL) {
			return _isModuleURL(moduleSrc)
				? import(URL.parse(moduleSrc, document.baseURI))
				: import(moduleSrc);
		} else {
			return new TypeError('Invalid module src.');
		}
	}).catch(err => err);

	const url = new URL(location.href);
	const timestamp = performance.now();

	if (module instanceof URL) {
		await navigate(module, state, args);
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
			signal: getNavSignal(),
			...args
		});
	} else if (module.default instanceof Function) {
		return await module.default({
			url,
			state,
			timestamp,
			signal: getNavSignal(),
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

async function _get404(url = location, method = 'GET', { signal, formData, integrity } = {}) {
	const timestamp = performance.now();

	if (typeof view404 === 'string') {
		return await _handleModule(view404, { url, matches: null, signal, method, formData, timestamp, integrity });
	} else if (view404 instanceof Function) {
		_updatePage(view404({ timestamp, state: getStateObj(), url, matches: null, signal, method, formData, integrity }));
	}
}

/**
 * Class representing a URL search parameter accessor.
 * Extends `EventTarget` to support listening for updates on the parameter.
 */
export class SearchParam extends EventTarget {
	#name;
	#fallbackValue = '';

	/**
	 * Creates a search parameter accessor.
	 * @param {string} name - The name of the URL search parameter to manage.
	 * @param {string|number} fallbackValue - The default value if the search parameter is not set.
	 */
	constructor(name, fallbackValue) {
		super();
		this.#name = name;
		this.#fallbackValue = fallbackValue;
	}

	toString() {
		return this.#value;
	}

	get [Symbol.toStringTag]() {
		return 'SearchParam';
	}

	[Symbol.toPrimitive](hint = 'default') {
		return hint === 'number' ? parseFloat(this.#value) : this.#value;
	}

	get #value() {
		const params = new URLSearchParams(location.search);
		return params.get(this.#name) ?? this.#fallbackValue?.toString() ?? '';
	}
}

export function getSearch(key, fallbackValue, onChange, { signal, passive, once } = {}) {
	if (onChange instanceof Function) {
		const param = new SearchParam(key, fallbackValue);
		param.addEventListener('change', onChange, { signal, passive, once });
		return param;
	} else {
		return new SearchParam(key, fallbackValue);
	}
}

/**
 * Manages a specified URL search parameter as a live-updating stateful value.
 *
 * @param {string} key - The name of the URL search parameter to manage.
 * @param {string|number} [fallbackValue=''] - The initial/fallback value if the search parameter is not set.
 * @returns {[SearchParam, function(string|number): void]} - Returns a two-element array:
 * - Returns a two-element array:
 *   - The first element is an object with:
 *     - A `toString` method, returning the current value of the URL parameter as a string.
 *     - A `[Symbol.toPrimitive]` method, allowing automatic conversion of the value based on the context (e.g., string or number).
 *   - The second element is a setter function that updates the URL search parameter to a new value, reflected immediately in the URL without reloading the page.
 */
export function manageSearch(key, fallbackValue = '', onChange, { signal, passive, once } = {}) {
	const param = getSearch(key, fallbackValue, onChange, { once, passive, signal });

	return [
		param,
		(newValue, { method = 'replace', cause = null } = {}) => {
			const url = new URL(location.href);
			const oldValue = url.searchParams.get(key);
			url.searchParams.set(key, newValue);

			const event = new CustomEvent('change', {
				cancelable: true,
				detail: { name: key, newValue, oldValue, method, url, cause },
			});

			param.dispatchEvent(event);

			if (event.defaultPrevented) {
				return;
			} else if (method === 'replace') {
				history.replaceState(history.state, '', url.href);
			} else if (method === 'push') {
				history.pushState(history.state, '', url.href);
			} else {
				throw new TypeError(`Invalid update method: ${method}.`);
			}
		}
	];
}


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
	if (typeof target === 'string') {
		interceptNav(document.querySelector(target), { signal });
	} else if (! (target instanceof HTMLElement)) {
		throw new TypeError('Cannot intercept navigation on a non-Element. Element or selector is required.');
	} else if (target.tagName === 'A' && ! target.classList.contains('no-router') && ! target.hasAttribute(EVENTS.onClick) && target.href.startsWith(location.origin)) {
		target.addEventListener('click', _interceptLinkClick, { signal, passive: false });
	} else if (target.tagName === 'FORM' && ! target.classList.contains('no-router') && ! target.hasAttribute(EVENTS.onSubmit) && target.action.startsWith(location.origin)) {
		target.addEventListener('submit', _interceptFormSubmit, { signal, passive: false });

		target.querySelectorAll(`a[href]:not([rel~="external"], .no-router, [${EVENTS.onClick}])`).forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});
	} else {
		target.querySelectorAll(`a[href]:not([rel~="external"], .no-router, [${EVENTS.onClick}])`).forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});

		target.querySelectorAll(`form:not(.no-router, [${EVENTS.onSubmit}])`).forEach(el => {
			el.addEventListener('submit', _interceptFormSubmit, { passive: false, signal });
		});
	}
}

/**
 * Sets the root element for the navigation system.
 *
 * @param {HTMLElement|string} target - The element to set as the root.
 */
export function setRoot(target, selector) {
	if (target instanceof HTMLElement) {
		rootEl = target;
		rootSelector = typeof selector === 'string' ? selector : target.hasAttribute('id') ? `#${target.id}` : null;
	} else if (typeof target === 'string') {
		setRoot(document.querySelector(target), target);
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
	} else if (target instanceof HTMLElement) {
		interceptNav(target, { signal });
		mutObserver.observe(target, { childList: true, subtree: true });

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', () => mutObserver.disconnect(), { once: true });
		}
	} else {
		throw new TypeError('Cannot observe link on a non-Element. Requires an Element or selector.');
	}
}

/**
 * Creates a URLPattern object from the given path and base URL.
 *
 * @param {string|URL|URLPattern} path - The path to create the pattern from.
 * @param {string} [baseURL=location.origin] - The base URL to use for relative paths. Defaults to the current origin.
 * @returns {URLPattern|RegExp|null} - The created URLPattern object, or `null` if the input is invalid.
 */
export function getURLPattern(path, baseURL = location.origin) {
	if (path instanceof URLPattern) {
		return path;
	} else if (typeof path === 'string') {
		return new URLPattern(path, baseURL);
	} else if (path instanceof URL) {
		return new URLPattern(path.href);
	} else {
		return null;
	}
}

/**
 * Extracts a specific parameter value from a URL path.
 *
 * @param {string|URL|URLPattern} path - The path to extract the parameter from.
 * @param {string} param - The name of the parameter to extract.
 * @param {object} [options] - Optional options.
 *   - `fallbackValue` {string} - The default value to return if the parameter is not found.
 *   - `baseURL` {string} - The base URL to use for relative paths.
 * @returns {object} - An object with a `toString()` method to retrieve the parameter value as a string, and a `[Symbol.toPrimitive]()` method to convert it to a number or string.
 */
export function getURLPath(path, param, {
	fallbackValue = '',
	baseURL = location.origin,
} = {}) {
	const pattern = getURLPattern(path, baseURL);

	return Object.freeze({
		toString() {
			return pattern.exec(location.href)?.pathname.groups?.[param] ?? fallbackValue;
		},
		[Symbol.toPrimitive](hint = 'default') {
			return hint === 'number' ? parseFloat(this.toString()) : this.toString();
		}
	});
}

/**
 * Registers a URL pattern with its corresponding module source.
 *
 * @param {URLPattern|string|URL} path - The URL pattern or URL to register.
 * @param {string|URL|Function} moduleSrc - The module source URL/specifier or a function.
 */
export async function registerPath(path, moduleSrc, {
	preload = false,
	signal,
	baseURL = location.origin,
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
} = {}) {
	if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (typeof path === 'string') {
		await registerPath(new URLPattern(path, baseURL), moduleSrc, { preload, signal, crossOrigin, referrerPolicy });
	} else if (path instanceof URL) {
		await registerPath(new URLPattern(path.href), moduleSrc, { preload, baseURL, signal, crossOrigin, referrerPolicy });
	} else if (! (typeof moduleSrc === 'string' || moduleSrc instanceof Function || moduleSrc instanceof URL)) {
		throw new TypeError('Module source/handler must be a module specifier/url or handler function.');
	} else if (path instanceof URLPattern) {
		registry.set(path, moduleSrc);

		if (preload && (typeof moduleSrc === 'string' || moduleSrc instanceof URL)) {
			await preloadModule(moduleSrc, { signal, crossOrigin, referrerPolicy });
		}

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', clearPaths, { once: true });
		}
	} else {
		throw new TypeError(`Could not convert ${path} to a URLPattern.`);
	}
}

/**
 * Clears all registered paths
 */
export function clearPaths() {
	registry.clear();
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
export async function getModule(input = location, {
	method = 'GET',
	state = getStateObj(),
	formData = new FormData(),
	integrity,
	signal,
} = {}) {
	const timestamp = performance.now();

	if (input === null) {
		throw new Error('Invalid path.');
	} else if (! (input instanceof URL)) {
		return await getModule(URL.parse(input, document.baseURI), { signal, method, formData, state, integrity });
	} else {
		const match = findPath(input);

		if (! (match instanceof URLPattern)) {
			return await _getHTML(input, { method, signal: getNavSignal({ signal }), body: formData, state, integrity });
		} else {
			const handler = registry.get(match);
			return await _handleModule(handler, {
				url: input,
				matches: match.exec(input),
				state,
				// signal: getNavSignal({ signal }),
				method,
				formData,
				integrity,
				timestamp,
			});
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
 * @returns {Promise<any>} - A promise that resolves with the new content or `null` if navigation is cancelled.
 */
export async function navigate(url, newState = getStateObj(), {
	signal,
	method = 'GET',
	formData,
	integrity,
} = {}) {
	if (url === null) {
		throw new TypeError('URL cannot be null.');
	} else if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (! (url instanceof URL)) {
		return await navigate(URL.parse(url, document.baseURI), newState, { signal, method, formData, integrity });
	} else if (formData instanceof FormData && NO_BODY_METHODS.includes(method.toUpperCase())) {
		const params = new URLSearchParams(formData);

		for (const [key, val] of params) {
			url.searchParams.append(key, val);
		}

		return await navigate(url, newState, { signal, method, integrity });
	} else if (url.href !== location.href) {
		try {
			const oldState = getStateObj();
			const diff = diffState(newState, oldState);
			const navigate = new NavigationEvent(NAV_EVENT, EVENT_TYPES.navigate, {
				detail: { newState, oldState, oldURL: new URL(location.href), newURL: url, method, formData },
			});

			EVENT_TARGET.dispatchEvent(navigate);

			if (! navigate.defaultPrevented) {
				history.pushState(newState, '', url);
				const content = await getModule(url, { signal, method, formData, state: newState, integrity });
				await notifyStateChange(diff);
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
	const event = new NavigationEvent(NAV_EVENT, EVENT_TYPES.back);
	EVENT_TARGET.dispatchEvent(event);

	if (! event.defaultPrevented) {
		history.back();
	}
}

/**
 * Navigates forward in the history.
 */
export function forward() {
	const event = new NavigationEvent(NAV_EVENT, EVENT_TYPES.forward);
	EVENT_TARGET.dispatchEvent(event);

	if (! event.defaultPrevented) {
		history.forward();
	}
}

/**
 * Navigates to a specific history entry.
 *
 * @param {number} [delta=0] - The number of entries to go back or forward. 0 to reload.
 */
export function go(delta = 0) {
	const event = new NavigationEvent(NAV_EVENT, EVENT_TYPES.go);
	EVENT_TARGET.dispatchEvent(event);

	if (! event.defaultPrevented) {
		history.go(delta);
	}
}

/**
 * Reloads the current page.
 */
export function reload() {
	const event = new NavigationEvent(NAV_EVENT, EVENT_TYPES.reload);
	EVENT_TARGET.dispatchEvent(event);

	if (! event.defaultPrevented) {
		history.go(0);
	}
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
 * Set default scroll restoration behavior on history navigation.
 *
 * @param {string} value (auto or manual)
 */
export function setScrollRestoration(value = 'auto') {
	history.scrollRestoration = value;
}

/**
 * Get the current value of scroll restoration
 *
 * @returns string
 */
export function getScrollRestoration() {
	return history.scrollRestoration;
}

/**
 * Sets the page title
 *
 * @param {string} title New title for page
 */
export function setTitle(title) {
	if (typeof title === 'string') {
		document.title = title;
	}
}

/**
 * Setts the page description
 *
 * @param {string} description New description for page
 */
export function setDescription(description) {
	if (typeof description === 'string' && description.length !== 0) {
		const descs = document.head.querySelectorAll(DESC_SELECTOR);

		descs.forEach(meta => meta.remove());
		document.head.append(
			_createMeta({ name: 'description', content: description }),
			_createMeta({ itemprop: 'description', content: description }),
			_createMeta({ property: 'og:description', content: description }),
			_createMeta({ name: 'twitter:description', content: description }),
		);
	}
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
 * @returns {Promise<AbortSignal>} - A promise that resolves with an `AbortSignal` that aborts on first navigation.
 */
export async function init(routes, {
	preload = false,
	inteceptRoot = document.body,
	baseURL = location.origin,
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	scrollRestoration = 'auto',
	notFound,
	rootEl: root,
	signal,
} = {}) {
	if (typeof routes === 'string') {
		await init(document.querySelector(routes), { preload, inteceptRoot, baseURL, notFound, rootEl, signal });
	} else if (routes instanceof HTMLScriptElement && routes.type === 'application/json') {
		await init(JSON.parse(routes.textContent), { preload, inteceptRoot, baseURL, notFound, rootEl, signal });
	} else if (typeof routes !== 'object' || routes === null || Object.getPrototypeOf(routes) !== Object.prototype) {
		throw new TypeError('Routes must be a plain object, a script with JSON, or the selector to such a script.');
	} else {
		const opts = { preload, signal, crossOrigin, referrerPolicy, fetchPriority, as, baseURL };

		const reg = Object.entries(routes).map(([pattern, moduleSrc]) => registerPath(pattern, moduleSrc, opts));

		if (typeof notFound === 'string') {
			set404(notFound);

			if (preload) {
				preloadModule(notFound);
			}
		}

		if (root instanceof HTMLElement || typeof root === 'string') {
			setRoot(root);
		}

		if (inteceptRoot instanceof HTMLElement || typeof inteceptRoot === 'string') {
			observeLinksOn(inteceptRoot, { signal });
		}

		const content = await getModule(new URL(location.href));
		setScrollRestoration(scrollRestoration);
		_updatePage(content);
		addPopstateListener({ signal });

		await Promise.allSettled(reg).then(results => {
			const errs = results.filter(result => result.status === 'rejected');

			if (errs.length === 1) {
				throw errs[0].reason;
			} else if (errs.length !== 0) {
				throw new AggregateError(errs.map(err => err.reason), 'Error initializing module routes.');
			}
		});
	}

	return getNavSignal({ signal });
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
 * @param {AbortSignal} [options.signal=AbortSignal.timeout(5000)] - An AbortSignal to abort the preload request. Defaults to a 5-second timeout.
 * @param {string} [options.integrity] - A base64-encoded cryptographic hash of the resource
 * @returns {Promise<void>} A promise that resolves when the module is preloaded or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function preloadModule(src, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	signal = AbortSignal.timeout(5000),
	integrity,
} = {}) {

	await _loadLink(src, {
		relList: ['modulepreload'],
		crossOrigin, referrerPolicy, fetchPriority, as, signal, integrity,
	});
}

/**
 * Preloads a resource asynchronously.

 * @param {string|URL} href - The URL or specifier to the resource to preload.
 * @param {Object} [options] - Optional options for the preload element.
 * @param {string} [options.crossOrigin="anonymous"] - The CORS mode to use when fetching the resource. Defaults to 'anonymous'.
 * @param {string} [options.referrerPolicy="no-referrer"] - The referrer policy to use when fetching the resource. Defaults to 'no-referrer'.
 * @param {string} [options.fetchPriority="auto"] - The fetch priority for the preload request. Defaults to 'auto'.
 * @param {AbortSignal} [options.signal=AbortSignal.timeout(5000)] - An AbortSignal to abort the preload request. Defaults to a 5-second timeout.
 * @param {string} [options.integrity] - A base64-encoded cryptographic hash of the resource
 * @param {string} [options.as] - The type of resource to preload.
 * @param {string} [options.type] - The MIME type of the resource to preload.
 * @param {(string|MediaQueryList)} [options.media] - A media query string or a MediaQueryList object.
 * @returns {Promise<void>} A promise that resolves when the resource is preloaded or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function preload(href, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'auto',
	signal = AbortSignal.timeout(5000),
	as,
	integrity,
	media,
	type,
} = {}) {

	await _loadLink(href, {
		relList: ['preload'],
		crossOrigin, referrerPolicy, fetchPriority, as, signal, type, media, integrity,
	});
}

/**
 * Prefetch a resource asynchronously.

 * @param {string|URL} href - The URL or specifier to the resource to prefetch.
 * @param {Object} [options] - Optional options for the prefetch element.
 * @param {string} [options.crossOrigin="anonymous"] - The CORS mode to use when fetching the resource. Defaults to 'anonymous'.
 * @param {string} [options.referrerPolicy="no-referrer"] - The referrer policy to use when fetching the resource. Defaults to 'no-referrer'.
 * @param {string} [options.fetchPriority="auto"] - The fetch priority for the prefetch request. Defaults to 'auto'.
 * @param {string} [options.integrity] - A base64-encoded cryptographic hash of the resource
 * @param {string} [options.as] - The type of resource to prefetch.
 * @param {string} [options.type] - The MIME type of the resource to prefetch.
 * @param {(string|MediaQueryList)} [options.media] - A media query string or a MediaQueryList object.
 * @returns {Promise<void>} A promise that resolves when the resource is preloaded or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function prefetch(href, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'auto',
	as,
	integrity,
	media,
	type,
} = {}) {

	await _loadLink(href, {
		relList: ['prefetch'],
		crossOrigin, referrerPolicy, fetchPriority, as, signal: null, type, media, integrity,
	});
}

/**
 * Preconnect to an origin to speed up future requests

 * @param {string|URL} href - The origin to preconnect to.
 * @param {Object} [options] - Optional options for the preconnect element.
 * @param {string} [options.crossOrigin="anonymous"] - The CORS mode to use when preconnecting to the origin. Defaults to 'anonymous'.
 * @param {string} [options.referrerPolicy="no-referrer"] - The referrer policy to use when preconnecting to the origin. Defaults to 'no-referrer'.
 * @returns {Promise<void>} A promise that resolves when the origin is connected or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function preconnect(href, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
} = {}) {
	const url = href instanceof URL ? href : URL.parse(href);

	if (! (url instanceof URL)) {
		throw new TypeError(`Invalid origin: ${href}.`);
	} else if (url.href !== `${url.origin}/`) {
		throw new TypeError('Preconnect requires only the origin of a URL.');
	} else {
		await _loadLink(url.origin, {
			relList: ['preconnect'],
			crossOrigin, referrerPolicy, fetchPriority: null, signal: null,
		});
	}
}

/**
 * Hints to the browser to do a DNS look-up ahead of making a future connection
 *
 * @param {string|URL} href The origin to make DNS prefetching for
 * @returns {Promise<void>} A promise which resolves when the `<link>` is appended
 */
export async function dnsPrefetch(href) {
	const url = URL.parse(href);

	if (url instanceof URL && url.origin === `${url.origin}/`) {
		await _loadLink(href, {
			relList: ['dns-prefetch'],
			crossOrigin: null,
			referrerPolicy: null,
			fetchPriority: null,
			signal: null,
		});
	}
}

/**
 * Creates an `AbortController` that is aborted when the user navigates away from the current page.
 *
 * @param {object} options - Optional options object.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to tie the lifetime of the `AbortController` to.
 * @returns {AbortController} An `AbortController` that is aborted on navigation or when the provided signal is aborted.
 */
export function getNavController({ signal, passive } = {}) {
	const controller = new AbortController();
	const callback = event => {
		// load & pop events occur after navigation
		if (! event.defaultPrevented && event.reason !== EVENT_TYPES.load && event.reason !== EVENT_TYPES.pop) {
			controller.abort(`Navigated away from ${location.href}.`);
		}
	};

	EVENT_TARGET.addEventListener(NAV_EVENT, callback, { signal, passive });

	return controller;
}

/**
 * Creates an AbortSignal that is aborted when the user navigates away from the current page.
 *
 * If an `AbortSignal` is provided, it will be combined with the navigation signal using `AbortSignal.any`.
 * This means the signal will be aborted if either the user navigates away or the provided signal is aborted.
 *
 * @param {object} options - Optional options object.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to tie the lifetime of the returned signal to.
 * @returns {AbortSignal} An AbortSignal that is aborted on navigation or when the provided signal is aborted.
 */
export function getNavSignal({ signal, passive } = {}) {
	const controller = getNavController({ signal, passive });

	return signal instanceof AbortSignal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
}

/**
 * Waits for the user to navigate away from the current page.
 *
 * If an `AbortSignal` is provided, the operation will be aborted if the user navigates away or the provided signal is aborted.
 *
 * @param {object} options - Optional options object.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to tie the lifetime of the operation to.
 * @returns {Promise<URL>} A Promise that resolves to the URL of the new page or rejects with an AbortError.
 */
export async function whenNavigated({ signal, passive } = {}) {
	const { resolve, reject, promise } = Promise.withResolvers();

	if (signal instanceof AbortSignal && signal.aborted) {
		reject(signal.reason);
	} else {

		if (signal instanceof AbortSignal) {
			const navSignal = getNavSignal({ signal, passive });
			const controller = new AbortController();
			navSignal.addEventListener('abort', () => resolve(new URL(location.href)), { once: true, signal: AbortSignal.any([signal, controller.signal ]) });
			signal.addEventListener('abort', ({ target }) => reject(target.reason), { once: true });

			return promise.finally(() => {
				if (! controller.signal.aborted) {
					controller.abort();
				}
			});
		} else {
			const navSignal = getNavSignal({ passive });
			navSignal.addEventListener('abort', () => resolve(new URL(location.href)), { once: true });
			return promise;
		}
	}
}

/**
 * Preloads resources associated with an element or selector when hovered over, with optional configuration.
 *
 * @param {string|HTMLElement} target - A CSS selector string or an HTMLElement that triggers preloading.
 * @param {object} [options={}] - Configuration options for preloading.
 * @param {string} [options.crossOrigin='anonymous'] - The cross-origin attribute for the request, useful for fetching from other origins.
 * @param {string} [options.referrerPolicy='no-referrer'] - The referrer policy to apply to the request.
 * @param {string} [options.fetchPriority='high'] - The priority level of the fetch operation.
 * @param {AbortSignal} [options.signal] - Optional signal to abort the preload operation if needed.
 * @returns {Promise<void>} A promise that resolves once preloading completes.
 * @throws {TypeError} Throws if the target is not a valid selector or an HTMLElement with a valid `href` attribute.
 */
export async function preloadOnHover(target, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'high',
	signal,
} = {}) {
	const { resolve, reject, promise } = Promise.withResolvers();

	if (typeof target === 'string') {
		await Promise.all(Array.from(
			document.querySelectorAll(target),
			link => preloadOnHover(link)
		)).then(resolve, reject);
	} else if (
		target instanceof HTMLElement
		&& ! target.classList.contains('no-router')
		&& typeof target.href === 'string'
		&& target.origin === location.origin
		&& URL.canParse(target.href)
	) {
		target.addEventListener('mouseenter', async ({ target }) => {
			const pattern = findPath(target.href);

			if (pattern instanceof URLPattern) {
				await preloadModule(registry.get(pattern), {
					fetchPriority,
					referrerPolicy,
					crossOrigin,
					integrity: target.dataset.integrity,
					signal,
				});
				resolve();
			} else {
				await preload(target.href, {
					fetchPriority,
					crossOrigin,
					referrerPolicy,
					as: target.dataset.preloadAs ?? 'fetch',
					type: target.dataset.preloadType ?? 'text/html',
					integrity: target.dataset.integrity,
					signal,
				});
				resolve();
			}
		}, { once: true, passive: true, signal });
	} else if (! (target instanceof HTMLElement && target.classList.contains('no-router'))) {
		reject(new TypeError('Preload target must be a selector or an element with an `href` atttribute.'));
	} else {
		resolve();
	}

	await promise;
}
