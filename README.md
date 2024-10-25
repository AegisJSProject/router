# `@aegisjsproject/router`

A simple but powerful router module

[![CodeQL](https://github.com/AegisJSProject/router/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/AegisJSProject/router/actions/workflows/codeql-analysis.yml)
![Node CI](https://github.com/AegisJSProject/router/workflows/Node%20CI/badge.svg)
![Lint Code Base](https://github.com/AegisJSProject/router/workflows/Lint%20Code%20Base/badge.svg)

[![GitHub license](https://img.shields.io/github/license/AegisJSProject/router.svg)](https://github.com/AegisJSProject/router/blob/master/LICENSE)
[![GitHub last commit](https://img.shields.io/github/last-commit/AegisJSProject/router.svg)](https://github.com/AegisJSProject/router/commits/master)
[![GitHub release](https://img.shields.io/github/release/AegisJSProject/router?logo=github)](https://github.com/AegisJSProject/router/releases)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/shgysk8zer0?logo=github)](https://github.com/sponsors/shgysk8zer0)

[![npm](https://img.shields.io/npm/v/@aegisjsproject/router)](https://www.npmjs.com/package/@aegisjsproject/router)
![node-current](https://img.shields.io/node/v/@aegisjsproject/router)
![npm bundle size gzipped](https://img.shields.io/bundlephobia/minzip/@aegisjsproject/router)
[![npm](https://img.shields.io/npm/dw/@aegisjsproject/router?logo=npm)](https://www.npmjs.com/package/@aegisjsproject/router)

[![GitHub followers](https://img.shields.io/github/followers/shgysk8zer0.svg?style=social)](https://github.com/shgysk8zer0)
![GitHub forks](https://img.shields.io/github/forks/AegisJSProject/router.svg?style=social)
![GitHub stars](https://img.shields.io/github/stars/AegisJSProject/router.svg?style=social)
[![Twitter Follow](https://img.shields.io/twitter/follow/shgysk8zer0.svg?style=social)](https://twitter.com/shgysk8zer0)

[![Donate using Liberapay](https://img.shields.io/liberapay/receives/shgysk8zer0.svg?logo=liberapay)](https://liberapay.com/shgysk8zer0/donate "Donate using Liberapay")
- - -

- [Code of Conduct](./.github/CODE_OF_CONDUCT.md)
- [Contributing](./.github/CONTRIBUTING.md)
<!-- - [Security Policy](./.github/SECURITY.md) -->

> [!CRITICAL]
> This package requires [`URLPattern`](https://developer.mozilla.org/en-US/docs/Web/API/URLPattern) to be polyfilled *before*
> any paths are registered. A common polyfill recommended by MDN can be [found here](https://github.com/kenchris/urlpattern-polyfill).

## Installation
```bash
npm install @aegisjsproject/router
```

## CDN and importmap
You do not even need to `npm install` this or use any build process. You may either import it directly from a CDN
or use an [importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap).

```html
<script type="importmap">
{
  "imports": {
    "@aegisjsproject/router": "https://unpkg.com/@aegisjsproject/router[@version]/router.mjs",
    "@aegisjsproject/state": "https://unpkg.com/@aegisjsproject/state[@version]/state.mjs"
  }
}
</script>
```

## Advantages of `@aegisjsproject/router`

* **Lightweight and Efficient:** The library is designed to be small and performant, with a focus on efficient URL matching and module loading.
* **Dynamic Loading:** Modules are loaded on-demand, improving initial page load performance and reducing resource usage.
* **Flexible Exports:** Supports a variety of module exports, including custom elements, functions, and HTML structures, making it adaptable to different UI architectures.
* **Component Injection:** Automatically injects relevant URL information and state into registered components, simplifying component development and data management.
* **History Integration:** Seamlessly manages browser history, allowing users to navigate back and forward without reloading the entire page.
* **Error Handling:** Provides built-in error handling mechanisms to gracefully handle unexpected situations during module loading or navigation.
* **Customizable:** Offers flexibility for customization, allowing you to tailor the router's behavior to your specific project requirements.
* **Easy to Use:** The library provides a simple and intuitive API, making it easy to learn and integrate into your projects.

## Fundamentals

At its core, this package matches URLs matching a `URLPattern` to modules to be dynamically
imported. This yields a powerful but minimal package size, dynamic loading of "View"s as-needed,
high reusability of code, and potentially nearly instant navigations, especially when used in
conjunction with service workers and caches. Just create a script that has a `default` export
that is a `Document`, `DocumentFragment`, `HTMLElement` and especially a custom element or
web component, and map the `URLPattern`s to their respective modules.

## Example

```js
import { init, navigate, back, forward, reload } from '@aegisjsproject/router';

init({
  '/product/:productId': '@scope/views/product.js',
  '/test/': '@scope/views/home.js',
  '/search?q=:query': '@scope/views/search.js',
  '/img': '/views/img.js',
}, {
  preload: true, // Preload all registered modules
  notFound: './views/404.js', // Set custom 404 module
  rootNode: '#root', // Declares element for base of content updates
  interceptRoot: document.body, // Use `MutationObserver` to observer `<a>` elements and intercept navigations
  signal: controller.signal, // An `AbortSignal`, should you want to disable routing funcitonality
});

document.querySelectorAll('[data-link]').forEach(el => {
  el.addEventListener('click', ({ currentTarget }) => {
    const { link, ...state } = currentTarget.dataset;
    navigate(link, state);
  });
});

document.querySelectorAll('[data-nav]').forEach(el => {
  el.addEventListener('click', ({ currentTarget }) => {
    switch (currentTarget.dataset.nav) {
      case 'back':
        back();
        break;

      case 'forward':
        forward();
        break;

      case 'reload':
        reload();

      default:
        throw new TypeError(`Invalid nav button type: ${currentTarget.dataset.nav}.`);
    }
  });
});
```

## Registering Paths
At the core, this router module just uses `URLPattern`s in a map, mapped to a source for a module. When a URL
is navigated to, it finds the pattern that the URL matches, dynamically imports that module, and passes the
current state and URL and the results of `urlPattern.exec(url)` to the function or constructor.

You may register paths via either `registerPath()` or through an object given to the `init()` function. `registerPath()`
allows for the use of `new URLPattern()` to be used, but as `init()` requires an object, its keys must be strings
to be converted into `URLPattern` through `new URLPattern(key, moduleSrc)`.

## Handling Navigation
If you call the `init()` function, the `popstate` listener will be added automatically and the module for the
current page will be loaded. Should you want more manual loading, you may also call `addListener()` on your own.

There is also a `MutationObserver` that adds `click` event handlers to intercept clicks on same-origin `<a>`s.
This observer watches for `<a>`s in the children of what it is set to observe and calls `event.preventDefault()`
to avoid the default navigation, then calls `navigate(a.href)`.

> [!NOTE]
> While the `MutationObserver` automatically adds the necessary click handlers on all `<a>` and `<form>` elements under its
> root, it cannot reach into Shadow DOM. For any web component with shadow, you should call `interceptNav(shadow)`
> in either the constructor or `connectedCallback`.



## 404 Pages
You can register a module for 404 pages using either `set404()` or by passing it via `{ notFound }` in `init()`.
This component or function will be given the current state and URL and can be dynamically generated.

## Preloading
You can preload modules for views by using `preloadModule()` or by passing `{ preload: true }` in `init()`.
Preloading modules will make navigation effectively instant and potentially without network traffic, however
it will increase initial load times (though it defaults to a low priority).

> [!IMPORTANT]
> Be advised that there may be a functional difference between using the router in the context of a `<script type="module">`
> vs as a non-module, namely in the availability of [`import.meta.resolve()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/import.meta/resolve)
> for preloading. Also, that importmaps are not quite univerally supported yet. For best compatibility,
> you **SHOULD** use either absolute or relative URLs when declaring modules for routes, though use of
> module specifiers (e.g. `@scope/package`) is supported in certain contexts, with decent browser support.

## State Management
This currently uses [`@aegisjsproject/state`](https://npmjs.com/package/@aegisjsproject/state) for state
mangement. It is a lightweight wrapper around `history.state` that uses `BroadcastChannel` to sync state
changes between tabs/windows. It should be noted that this is *global* state and not specific to some component,
so please avoid generic names and be aware of the global nature.
