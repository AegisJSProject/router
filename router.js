import { getStateObj, diffState, notifyStateChange } from '@aegisjsproject/state';
export { url } from '@aegisjsproject/url/url.js';
import { onClick, onSubmit } from '@aegisjsproject/callback-registry/events.js';

const isModule = ! (document.currentScript instanceof HTMLScriptElement);
const SUPPORTS_IMPORTMAP = HTMLScriptElement.supports('importmap');
const ROUTES_REGISTRY = new Map();
const NO_BODY_METHODS = ['GET', 'HEAD', 'DELETE', 'OPTIONS'];
const DESC_SELECTOR = 'meta[name="description"], meta[itemprop="description"], meta[property="og:description"], meta[name="twitter:description"]';
const navObserver = new MutationObserver(entries => entries.forEach(entry => interceptNav(entry.target)));
const preloadObserver = new MutationObserver(entries => entries.forEach(_handlePreloadMutations));
const ROOT_ID = 'root';
const EVENT_TARGET = document;
const NAV_CLOSE_SYMBOL = Symbol.for('aegis:navigate:event:close');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let rootEl = document.getElementById(ROOT_ID) ?? document.body;
let rootSelector = '#' + ROOT_ID;
const SUPPORTS_TRUSTED_TYPES = 'trustedTypes' in globalThis;
const _isTrustedHTML = input => SUPPORTS_TRUSTED_TYPES && trustedTypes.isHTML(input);

function _handlePreloadMutations(target) {
	if (target instanceof MutationRecord) {
		_handlePreloadMutations(target.target);
	} else if (target.tagName === 'A' && ! target.classList.contains('no-router') && ! target.hasAttribute(onClick)) {
		preloadOnHover(target, target.dataset);
	} else {
		target.querySelectorAll(`a:not(.no-router, [${onClick}])`).forEach(a => preloadOnHover(a, a.dataset));
	}
}

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

const DEFAULT_REASONS = [EVENT_TYPES.back, EVENT_TYPES.forward, EVENT_TYPES.navigate, EVENT_TYPES.submit, EVENT_TYPES.reload, EVENT_TYPES.go];

export class AegisNavigationEvent extends CustomEvent {
	#reason;
	#url;
	#controller = new AbortController();
	#promises = [];
	#errors = [];

	constructor(name = NAV_EVENT, reason = 'unknown', { bubbles = false, cancelable = true, detail = {
		oldState: getStateObj(),
		oldURL: new URL(location.href),
	} } = {}) {
		super(name, { bubbles, cancelable, detail });
		this.#reason = reason;
		this.#url = location.href;
	}

	get aborted() {
		return this.#controller.signal.aborted;
	}

	get error() {
		switch(this.#errors.length) {
			case 0:
				return null;

			case 1:
				return this.#errors[0];

			default:
				return new AggregateError(this.#errors);
		}
	}

	get reason() {
		return this.#reason;
	}

	get signal() {
		return this.#controller.signal;
	}

	get url() {
		return this.#url;
	}

	async [NAV_CLOSE_SYMBOL]() {
		const result = await Promise.allSettled(this.#promises).then(results => {
			this.#errors.push(...results.filter(result => result.status === 'rejected').map(result => result.reason));

			return this.cancelable && this.defaultPrevented;
		});

		this.#controller.abort();
		return result;
	}

	abort(reason) {
		this.#controller.abort(reason);
	}

	waitUntil(promiseOrCallback, { signal } = {}) {
		const { promise, resolve, reject } = Promise.withResolvers();

		this.#promises.push(promise);

		if (signal instanceof AbortSignal && ! signal.aborted) {
			signal.addEventListener('abort', ({ target }) =>{
				reject(target.reason);

				if (this.cancelable && ! this.defaultPrevented) {
					super.preventDefault();
				}
			}, {
				once: true,
				signal: this.#controller.signal,
			});
		}

		if (this.#controller.signal.aborted) {
			reject(this.#controller.signal.reason);
		} else if (signal instanceof AbortSignal && signal.aborted) {
			reject(signal.reason);

			if (this.cancelable && ! this.defaultPrevented) {
				super.preventDefault();
			}
		} else if (! this.defaultPrevented && promiseOrCallback instanceof Function) {
			Promise.try(() => promiseOrCallback(this, {
				signal: signal instanceof AbortSignal ? AbortSignal.any([signal, this.#controller.signal]) : this.#controller.signal,
				timestamp: performance.now()
			})).then(resolve, reject);
		} else if (! this.defaultPrevented && promiseOrCallback instanceof Promise) {
			promiseOrCallback.then(resolve, reject);
		}
	}

	[Symbol.toStringTag]() {
		return 'NavigationEvent';
	}

	static get defaultType() {
		return NAV_EVENT;
	}

	static get reasons() {
		return EVENT_TYPES;
	}
}

// Need this to be "unsafe" to not be restrictive on what modifications can be made to a page
const policy = SUPPORTS_TRUSTED_TYPES
	? trustedTypes.createPolicy('aegis-router#html', { createHTML: input => input })
	: Object.freeze({ createPolicy: input => input });

async function _popstateHandler(event) {
	const diff = diffState(event.state ?? {});
	const navigate = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.pop, {
		detail: { newState: event.state, oldState: null, oldURL: new URL(location.href), method: 'GET', formData: null },
	});

	EVENT_TARGET.dispatchEvent(navigate);

	if (! await navigate[NAV_CLOSE_SYMBOL]()) {
		const old = history.scrollRestoration;
		const [content] = await Promise.all([
			getModule(new URL(location.href)),
			notifyStateChange(diff),
		]);

		history.scrollRestoration = 'auto';
		_updatePage(content);
		history.scrollRestoration = old;
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
	signal: passedSignal,
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
			const signal = passedSignal instanceof AbortSignal ? AbortSignal.any([controller.signal, passedSignal]) : controller.signal;

			if (passedSignal instanceof AbortSignal) {
				passedSignal.addEventListener('abort', ({ target }) => {
					reject(target.reason);
				}, { signal: controller.signal, once: true  });
			}

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
	if (event.target.classList.contains('no-router') || event.target.hasAttribute(onClick)) {
		event.target.removeEventListener(_interceptLinkClick);
	} else if (
		event.isTrusted
		&& event.currentTarget.href.startsWith(location.origin)
		&& ! (event.metaKey || event.ctrlKey || event.shiftKey)
	) {
		event.preventDefault();
		const state = _getLinkStateData(event.currentTarget);
		navigate(event.currentTarget.href, state, {
			integrity: event.currentTarget.dataset.integrity,
			cache: event.currentTarget.dataset.cache,
			referrerPolicy: event.currentTarget.dataset.referrerPolicy,
		});
	}
}

async function _interceptFormSubmit(event) {
	if (event.target.classList.contains('no-router') || event.target.hasAttribute(onSubmit)) {
		event.target.removeEventListener('submit', _interceptFormSubmit);
	} else if (event.isTrusted && event.target.action.startsWith(location.origin)) {
		event.preventDefault();
		const { method, action } = event.target;
		const formData = new FormData(event.target);

		const submit = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.submit, {
			detail: { oldState: getStateObj(), oldURL: new URL(location.href), formData },
		});

		EVENT_TARGET.dispatchEvent(submit);

		if (await submit[NAV_CLOSE_SYMBOL]()) {
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

async function _getHTML(url, { signal, method = 'GET', body, integrity, cache = 'default', referrerPolicy = 'no-referrer' } = {}) {
	const resp = await fetch(url, {
		method,
		body: NO_BODY_METHODS.includes(method.toUpperCase()) ? null : body,
		headers: { 'Accept': 'text/html' },
		cache,
		referrerPolicy,
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
	} else if (_isTrustedHTML(content)) {
		rootEl.setHTMLUnsafe(content);
	} else if (content instanceof Error) {
		reportError(content);
		rootEl.textContent = content.message;
	} else if (content instanceof URL) {
		navigate(content);
	} else if (! (content === null || typeof content === 'undefined')) {
		rootEl.textContent = content;
	}

	EVENT_TARGET.dispatchEvent(new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.load, { cancelable: false }));

	if (history.scrollRestoration === 'manual') {
		if (location.hash.length > 1) {
			const target = document.getElementById(location.hash.substring(1)) ?? document.body;
			target.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth' });
		} else {
			const autofocus = rootEl.querySelector('[autofocus]');

			if (autofocus instanceof Element) {
				autofocus.focus();
			} else {
				document.body.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'instant' : 'smooth' });
			}
		}
	}
}

async function _handleMetadata({ title, description } = {}, { state, matches, params, url, signal } = {}) {
	if (typeof title === 'string') {
		setTitle(title);
	} else if (typeof title === 'function') {
		setTitle(await title({ state, matches, params, url, signal }));
	}

	if (typeof description === 'string') {
		setDescription(description);
	} else if (typeof description === 'function') {
		setDescription(await description({ state, matches, params, url, signal }));
	}
}

async function _handleModule(moduleSrc, {
	state = getStateObj(),
	matches = {},
	params = {},
	stack,
	signal,
	...args
} = {}) {
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

		_handleMetadata(module, { state, matches, params, url, signal });

		return new module.default({
			url,
			matches,
			params,
			state,
			stack,
			timestamp,
			signal: getNavSignal({ signal }),
			...args
		});
	} else if (module.default instanceof Function) {
		_handleMetadata(module, { state, matches, params, url, signal });

		return await module.default({
			url,
			matches,
			params,
			state,
			stack,
			timestamp,
			signal: getNavSignal({ signal }),
			...args
		});
	} else if (module.default instanceof Node || module.default instanceof Error) {
		_handleMetadata(module, { state, matches, params, url, signal });
		_updatePage(module.default);
	} else if (module.default instanceof URL && module.default.origin === location.origin) {
		navigate(module.default);
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
	const stack = new AsyncDisposableStack();

	try {
		if (typeof view404 === 'string') {
			return await _handleModule(view404, { url, matches: null, signal, method, formData, timestamp, integrity });
		} else if (view404 instanceof Function) {
			_updatePage(view404({ timestamp, state: getStateObj(), url, matches: null, signal, method, formData, integrity }));
		}
	} finally {
		stack.disposeAsync();
	}
}

/**
 * Finds the matching URL pattern for a given input.
 *
 * @param {string|URL} input - The input URL or path.
 * @returns {URLPattern|undefined} - The matching URL pattern, or undefined if no match is found.
 */
export const findPath = input => ROUTES_REGISTRY.keys().find(pattern => pattern.test(input));

/**
 * Sets the 404 handler.
 *
 * @param {string} path - The path to the 404 handler module or the handler function itself.
 */
export const set404 = path => view404 = path;

/**
 * Intercepts navigation events within a target element.
 *
 * @param {HTMLElement|ShadowRoot|string} target - The element to intercept navigation events on. Defaults to document.body.
 * @param {Object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the interception.
 */
export function interceptNav(target = document.body, { signal } = {}) {
	if (typeof target === 'string') {
		interceptNav(document.querySelector(target), { signal });
	} else if (! (target instanceof HTMLElement || target instanceof ShadowRoot)) {
		throw new TypeError('Cannot intercept navigation on a non-Element. Element or selector is required.');
	} else if (target instanceof HTMLAnchorElement && ! target.classList.contains('no-router') && ! target.hasAttribute(onClick) && target.href.startsWith(location.origin)) {
		target.addEventListener('click', _interceptLinkClick, { signal, passive: false });
	} else if (target instanceof HTMLFormElement && ! target.classList.contains('no-router') && ! target.hasAttribute(onSubmit) && target.action.startsWith(location.origin)) {
		target.addEventListener('submit', _interceptFormSubmit, { signal, passive: false });

		target.querySelectorAll(`a[href]:not([rel~="external"], [download], .no-router, [${onClick}])`).forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});
	} else {
		target.querySelectorAll(`a[href]:not([rel~="external"], [download], .no-router, [${onClick}])`).forEach(el => {
			if (el.href.startsWith(location.origin)) {
				el.addEventListener('click', _interceptLinkClick, { passive: false, signal });
			}
		});

		target.querySelectorAll(`form:not(.no-router, [${onSubmit}])`).forEach(el => {
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

		if (typeof rootEl.ariaLive !== 'string') {
			rootEl.ariaLive = 'assertive';;
		}
	} else if (typeof target === 'string') {
		setRoot(document.querySelector(target), target);
	} else {
		throw new TypeError('Cannot set root to a non-html element.');
	}
}

/**
 * Observes links on an element for navigation.
 *
 * @param {HTMLElement|ShadowRoot|string} target - The element to observe links on. Defaults to document.body.
 * @param {object} [options] - Optional options.
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the observation.
 */
export function observeLinksOn(target = document.body, { signal } = {}) {
	if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (typeof target === 'string') {
		observeLinksOn(document.querySelector(target), { signal });
	} else if (target instanceof HTMLElement || target instanceof ShadowRoot) {
		interceptNav(target, { signal });
		navObserver.observe(target, { childList: true, subtree: true });

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', () => navObserver.disconnect(), { once: true });
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
 * @returns {URLPattern|null} - The created URLPattern object, or `null` if the input is invalid.
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
		ROUTES_REGISTRY.set(path, moduleSrc);

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
	ROUTES_REGISTRY.clear();
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
	cache = 'default',
	referrerPolicy = 'no-referrer',
	integrity,
	signal,
} = {}) {
	const timestamp = performance.now();
	const stack = new AsyncDisposableStack();

	try {
		if (input === null) {
			throw new Error('Invalid path.');
		} else if (! (input instanceof URL)) {
			return await getModule(URL.parse(input, document.baseURI), { signal, method, formData, state, stack, integrity, cache, referrerPolicy });
		} else {
			const match = findPath(input);

			if (! (match instanceof URLPattern)) {
				return await _getHTML(input, { method, signal: getNavSignal({ signal }), body: formData, state, stack, integrity, cache, referrerPolicy });
			} else {
				const handler = ROUTES_REGISTRY.get(match);
				const matches = match.exec(input);
				const params = typeof matches === 'object'
					? {
						...matches.protocol.groups, ...matches.username.groups, ...matches.password.groups, ...matches.hostname.groups,
						...matches.port.groups, ...matches.pathname.groups, ...matches.search.groups, ...matches.hash.groups,
					} : {};

				delete params['0'];

				return await _handleModule(handler, {
					url: input,
					matches,
					params,
					state,
					stack,
					method,
					formData,
					integrity,
					timestamp,
				});
			}
		}
	} finally {
		requestAnimationFrame(stack.disposeAsync.bind(stack));
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
	cache = 'default',
	referrerPolicy = 'no-referrer',
	formData,
	integrity,
	scrollRestoration = null,
} = {}) {
	if (url === null) {
		throw new TypeError('URL cannot be null.');
	} else if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else if (! (url instanceof URL)) {
		return await navigate(URL.parse(url, document.baseURI), newState, { signal, method, cache, referrerPolicy, formData, integrity });
	} else if (formData instanceof FormData && NO_BODY_METHODS.includes(method.toUpperCase())) {
		const params = new URLSearchParams(formData);

		for (const [key, val] of params) {
			url.searchParams.append(key, val);
		}

		return await navigate(url, newState, { signal, method, cache, referrerPolicy, integrity });
	} else if (url.href !== location.href) {
		try {
			const oldState = getStateObj();
			const diff = diffState(newState, oldState);
			const navigate = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.navigate, {
				detail: { newState, oldState, oldURL: new URL(location.href), newURL: url, method, formData },
			});

			EVENT_TARGET.dispatchEvent(navigate);

			if (! await navigate[NAV_CLOSE_SYMBOL]()) {
				if (typeof scrollRestoration === 'string') {
					history.scrollRestoration = scrollRestoration;
				}

				history.pushState(newState, '', url);
				const content = await getModule(url, { signal, method, cache, referrerPolicy, formData, state: newState, integrity });
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
export async function back({ signal } = {}) {
	const event = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.back);
	EVENT_TARGET.dispatchEvent(event);

	await event[NAV_CLOSE_SYMBOL]().then(async prevented => {
		if (! prevented) {
			history.back();
			await whenNavigated({ signal, reasons: [EVENT_TYPES.load] });
		}
	});
}

/**
 * Navigates forward in the history.
 */
export async function forward({ signal } = {}) {
	const event = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.forward);
	EVENT_TARGET.dispatchEvent(event);

	await event[NAV_CLOSE_SYMBOL]().then(async prevented => {
		if (! prevented) {
			history.forward();
			await whenNavigated({ signal, reasons: [EVENT_TYPES.load] });
		}
	});
}

/**
 * Navigates to a specific history entry.
 *
 * @param {number} [delta=0] - The number of entries to go back or forward. 0 to reload.
 */
export async function go(delta = 0, { signal } = {}) {
	const event = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.go);
	EVENT_TARGET.dispatchEvent(event);

	await event[NAV_CLOSE_SYMBOL]().then(async prevented => {
		if (! prevented) {
			history.go(delta);
			await whenNavigated({ signal, reasons: [EVENT_TYPES.load] });
		}
	});
}

/**
 * Reloads the current page.
 */
export function reload() {
	const event = new AegisNavigationEvent(NAV_EVENT, EVENT_TYPES.reload);
	EVENT_TARGET.dispatchEvent(event);

	event[NAV_CLOSE_SYMBOL]().then(prevented => {
		if (! prevented) {
			history.go(0);
		}
	});
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
 * Initializes the navigation system/router.
 *
 * @param {object|string|HTMLScriptElement} routes - An object mapping URL patterns to module source URLs or specifiers, or a script/id to script
 * @param {object} [options] - Optional options.
 * @param {boolean} [options.preload=false] - Whether to preload all modules.
 * @param {boolean} [options.observePreloads=false] - If true, modules will be preloaded on link hover
 * @param {HTMLElement|ShadowRoot|string} [options.inteceptRoot] - The element to intercept link clicks on.
 * @param {string} [options.baseURL] - The base URL for URL patterns.
 * @param {string} [options.notFound] - The 404 handler.
 * @param {HTMLElement|ShadowRoot|string} [options.rootNode] - The root element for the navigation system.
 * @param {object} [options.transition] - Config for optional animations on navigation events
 * @param {Keyframe} [options.transition.keyframes] - Keyframes for an animation during transitions/navigation
 * @param {KeyframeAnimationOptions} [options.transition.options] - Options such as duration and easing for navigation animations
 * @param {AbortSignal} [options.signal] - An AbortSignal to cancel the initialization.
 * @returns {Promise<AbortSignal>} - A promise that resolves with an `AbortSignal` that aborts on first navigation.
 */
export async function init(routes, {
	preload = false,
	observePreloads = false,
	inteceptRoot = document.body,
	baseURL = location.origin,
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	scrollRestoration = 'manual',
	notFound,
	rootEl: root,
	transition: {
		keyframes,
		options: {
			duration = 150,
			easing = 'ease-out',
			delay = 0,
			composite = 'replace',
			fill = 'both',
		} = {}
	} = {},
	signal,
} = {}) {
	if (typeof routes === 'string') {
		await init(document.querySelector(routes), {
			preload, observePreloads, inteceptRoot, baseURL, notFound, rootEl: root,
			transition: { keyframes, options: { duration, easing, delay, composite, fill }},
			signal,
		},
		);
	} else if (routes instanceof HTMLScriptElement && routes.type === 'application/json') {
		await init(JSON.parse(routes.textContent), {
			preload, observePreloads, inteceptRoot, baseURL, notFound, rootEl: root,
			transition: { keyframes, options: { duration, easing, delay, composite, fill }},
			signal,
		});
	} else if (typeof routes !== 'object' || routes === null || Object.getPrototypeOf(routes) !== Object.prototype) {
		throw new TypeError('Routes must be a plain object, a script with JSON, or the selector to such a script.');
	} else if (typeof inteceptRoot === 'string') {
		init(routes, { preload, observePreloads, inteceptRoot: document.querySelector(inteceptRoot), baseURL, notFound, rootEl, signal });
	} else if (typeof root === 'string') {
		init(routes, {
			preload, observePreloads, inteceptRoot, baseURL, notFound, rootEl: document.querySelector(root),
			transition: { keyframes, options: { duration, easing, delay, composite, fill }},
			signal,
		});
	} else if (! (inteceptRoot instanceof HTMLElement || inteceptRoot instanceof ShadowRoot)) {
		throw new TypeError('`interceptRoot` must be a selector, HTMLElement, or ShadowRoot.');
	} else if (! (root instanceof HTMLElement || root instanceof ShadowRoot)) {
		throw new TypeError('`rootEl` must be a selector, HTMLElement, or ShadowRoot.');
	} else {
		const opts = { preload, signal, crossOrigin, referrerPolicy, fetchPriority, as, baseURL };

		const reg = Object.entries(routes).map(([pattern, moduleSrc]) => registerPath(pattern, moduleSrc, opts));

		if (observePreloads) {
			observePreloadsOn(inteceptRoot);
		}

		if (typeof notFound === 'string') {
			set404(notFound);

			if (preload) {
				preloadModule(notFound);
			}
		}

		if (root instanceof HTMLElement || root instanceof ShadowRoot || typeof root === 'string') {
			setRoot(root);
		} else if (rootEl instanceof HTMLElement && typeof rootEl.ariaLive !== 'string') {
			rootEl.ariaLive = 'assertive';
		}

		if (inteceptRoot instanceof HTMLElement || inteceptRoot instanceof ShadowRoot || typeof inteceptRoot === 'string') {
			observeLinksOn(inteceptRoot, { signal });
		}

		const content = await getModule(new URL(location.href));
		setScrollRestoration(scrollRestoration);
		_updatePage(content);
		addPopstateListener({ signal });

		if (typeof keyframes === 'object' && keyframes !== null) {
			const navEvents = [EVENT_TYPES.navigate, EVENT_TYPES.go, EVENT_TYPES.back, EVENT_TYPES.forward];

			EVENT_TARGET.addEventListener(NAV_EVENT, event => {
				if (! event.defaultPrevented && navEvents.includes(event.reason)) {
					event.waitUntil(() => rootEl.animate(keyframes, { duration, easing, fill, delay, composite, direction: 'normal' }).finished, { signal });
				} else if (event.reason === EVENT_TYPES.load) {
					event.waitUntil(() => rootEl.animate(keyframes, { duration, easing, fill, delay, composite, direction: 'reverse' }).finished, { signal });
				}
			}, { signal });
		}

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
 * @param {AbortSignal} [options.signal] - An AbortSignal to abort the preload request. Defaults to a 5-second timeout.
 * @param {string} [options.integrity] - A base64-encoded cryptographic hash of the resource
 * @returns {Promise<void>} A promise that resolves when the module is preloaded or rejects on error or signal is aborted.
 * @throws {Error} Throws if the signal is aborted or if an `error` event is fired on the preload.
 */
export async function preloadModule(src, {
	crossOrigin = 'anonymous',
	referrerPolicy = 'no-referrer',
	fetchPriority = 'low',
	as = 'script',
	signal,
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
 * @param {AbortSignal} [options.signal] - An AbortSignal to abort the preload request. Defaults to a 5-second timeout.
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
	signal,
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
 */
export function prefetch(href, { referrerPolicy = 'no-referrer' } = {}) {
	const link = document.createElement('link');
	link.referrerPolicy = referrerPolicy;
	link.relList.add('prefetch');
	link.href = href;
	document.head.append(link);
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
 * @param {string|string[]} [options.reasons] - An array of event type/reasons to abort on.
 * @returns {AbortController} An `AbortController` that is aborted on navigation or when the provided signal is aborted.
 */
export function getNavController({ signal, reasons = DEFAULT_REASONS } = {}) {
	if (typeof reasons === 'string') {
		return getNavController({ signal, reasons: [reasons] });
	} else if (! Array.isArray(reasons) || reasons.length === 0) {
		throw new TypeError('`reasosn` must be an array of reasons for the naviation event.');
	} else if (signal instanceof AbortSignal && signal.aborted) {
		throw signal.reason;
	} else {
		const controller = new AbortController();

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', ({ target }) => {
				controller.abort(target.reason);
			}, { once: true, signal: controller.signal });
		}

		EVENT_TARGET.addEventListener(NAV_EVENT, event => {
			if (reasons.includes(event.reason)) {
				setTimeout(controller.abort.bind(controller), 50, `Navigated away from ${location.href}.`);
			}
		}, { passive: true, signal: controller.signal });

		return controller;
	}
}

/**
 * Creates an AbortSignal that is aborted when the user navigates away from the current page.
 *
 * If an `AbortSignal` is provided, it will be combined with the navigation signal using `AbortSignal.any`.
 * This means the signal will be aborted if either the user navigates away or the provided signal is aborted.
 *
 * @param {object} options - Optional options object.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to tie the lifetime of the returned signal to.
 * @param {string|string[]} [options.reasons] - An array of event type/reasons to abort on.
 * @returns {AbortSignal} An AbortSignal that is aborted on navigation or when the provided signal is aborted.
 */
export function getNavSignal({ signal, reasons = DEFAULT_REASONS } = {}) {
	const controller = getNavController({ signal, reasons });

	return controller.signal;
}

/**
 * Waits for the user to navigate away from the current page.
 *
 * If an `AbortSignal` is provided, the operation will be aborted if the user navigates away or the provided signal is aborted.
 *
 * @param {object} options - Optional options object.
 * @param {AbortSignal} [options.signal] - An optional AbortSignal to tie the lifetime of the operation to.
 * @param {string[]} [options.reasons] - An array of event type/reasons to abort on.
 * @returns {Promise<URL>} A Promise that resolves to the URL of the new page or rejects with an AbortError.
 */
export async function whenNavigated({ signal, reasons = DEFAULT_REASONS } = {}) {
	const { resolve, reject, promise } = Promise.withResolvers();

	if (typeof reasons === 'string') {
		return whenNavigated({ signal, reasons: [reasons] });
	} else if (signal instanceof AbortSignal && signal.aborted) {
		reject(signal.reason);
	} else if (! Array.isArray(reasons) || reasons.length === 0) {
		reject(new TypeError('`reasosn` must be an array of reasons for the naviation event.'));
	} else {
		const controller = new AbortController();

		document.addEventListener(NAV_EVENT, event => {
			if (reasons.includes(event.reason)) {
				resolve(new URL(location.href));
				controller.abort();
			}
		}, { signal: controller.signal });

		if (signal instanceof AbortSignal) {
			signal.addEventListener('abort', ({ target }) => {
				reject(target.reason);
				controller.abort(target.reason);
			}, { once: true, signal: controller.signal });
		}
	}

	return promise;
}

export const whenLoaded = async ({ signal }) => await whenNavigated({ signal, reasons: [EVENT_TYPES.load]});

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
		&& target.download.length === 0
		&& URL.canParse(target.href)
	) {
		target.addEventListener('mouseover', async ({ currentTarget }) => {
			const pattern = findPath(currentTarget.href);

			if (pattern instanceof URLPattern) {
				await preloadModule(ROUTES_REGISTRY.get(pattern), {
					fetchPriority,
					referrerPolicy,
					crossOrigin,
					integrity: currentTarget.dataset.integrity,
					signal,
				});
				resolve();
			} else {
				await preload(currentTarget.href, {
					fetchPriority,
					crossOrigin,
					referrerPolicy,
					as: currentTarget.dataset.preloadAs ?? 'fetch',
					type: currentTarget.dataset.preloadType ?? 'text/html',
					integrity: currentTarget.dataset.integrity,
					signal,
				});
				resolve();
			}
		}, { once: true, passive: true, signal });
	} else {
		resolve();
	}

	await promise;
}

/**
 * Adds `mouseenter` listeners to preload links/handlers via a `MutationObserver`
 *
 * @param {HTMLElement|ShadowRoot|string} target Target for the mutation observer or its selector
 * @param {HTMLElement|ShadowRoot} [base=document] The element to query from if `target` is a selector
 */
export function observePreloadsOn(target, base = document.documentElement) {
	if (typeof target === 'string') {
		observePreloadsOn(base.querySelector(target));
	} else if (target instanceof HTMLElement || target instanceof ShadowRoot) {
		preloadObserver.observe(target, { childList : true, subtree: true });
		_handlePreloadMutations(target);
	} else {
		throw new TypeError('`observePreloadsOn` requires a selector or HTMLElement or ShadowRoot.');
	}
}

/**
 * Combines `observeLinksOn` and `observePreloadsOn`
 *
 * @param {HTMLElement|ShadowRoot|string} target Target for the mutation observers or its selector
 * @param {HTMLElement|ShadowRoot} [base=document] The element to query from if `target` is a selector
 */
export function observe(target, base = document.documentElement) {
	if (typeof target === 'string') {
		observe(base.querySelector(target));
	} else if (target instanceof HTMLElement || target instanceof ShadowRoot) {
		observeLinksOn(target);
		observePreloadsOn(target);
	}else {
		throw new TypeError('`observe` requires a selector or HTMLElement or ShadowRoot.');
	}
}

/**
 * Measures navigation time between initial nav event and load event
 *
 * @param {object} options
 * @param {AbortSignal} [options.signal] Optional signal to cancel and reject
 * @returns {number} Total duration between nav start and load in ms
 */
export async function timeNavigation({ signal } = {}) {
	const { resolve, promise, reject } = Promise.withResolvers();
	const navController = new AbortController();
	const loadController = new AbortController();

	if (signal instanceof AbortSignal) {
		if (signal.aborted) {
			reject(signal.reason);
		} else {
			signal.addEventListener('abort', ({ target }) => {
				reject(target.reason);
				navController.abort(target.reason);
				loadController.abort(target.reason);
			}, { signal: loadController.signal });
		}
	}

	EVENT_TARGET.addEventListener(NAV_EVENT, event => {
		if ([EVENT_TYPES.navigate, EVENT_TYPES.back, EVENT_TYPES.forward, EVENT_TYPES.go].includes(event.reason)) {
			navController.abort();
			const start = performance.now();

			EVENT_TARGET.addEventListener(NAV_EVENT, event => {
				if (event.reason === EVENT_TYPES.load) {
					resolve(performance.now() - start);
					loadController.abort();
				}
			}, { signal: loadController.signal });
		}
	}, { signal: navController.signal });

	return promise;
}
