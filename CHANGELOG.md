<!-- markdownlint-disable -->
# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [v1.1.3] - 2024-12-25

### Changed
- Various dependency updates

## [v1.1.2] - 2024-12-04

### Added
- Add support for `referrerPolicy` and other request config in preloading links

### Fixed
- Fix throwing errors when adding links to preload observer
- Fix invalid attributes on `<link rel="prefetch">`
- Fix invalid default types on some functions (use `document.documentElement` instead of `document`)

## [v1.1.1] - 2024-11-25

### Removed
- Remove `url` tagged template and `SearchParam`, as are now in `@aegisjsproject/url`

## [v1.1.0] - 2024-11-19

### Added
- Add support for scrolling to top of page or anchor elements on navigation
- Add support for animations on navigation
- Add support for setting page title & description via exported `title`s and `description`s
- Add `timeNavigation()` function to time duration of navigation

### Changed
- Make `back()`, `forward()` and `go()` async and wait for actual navigation
- Extend navigation controllers/promises to work on only specified `event.reason`s

### Fixed
- Removed old JSDoc references to `RegEx` support

## [v1.0.7] - 2024-11-09

### Added
- Add `waitUntil()` method on navigation events
- Add an `AbortSignal` to navigation events (indicator of `preventDefault()` being called)
- Add support for working on `ShadowRoot`s
- Add `MutationObserver` to preload links/routes on hover

### Changed
- Rename `NagivationEvent` -> `AegisNavigationEvent`

## [v1.0.6] - 2024-11-07

### Added
- Add `preloadOnHover` to preload before click, upon hover indicator
- Add ability to prevent adding click/submit handlers
- Create functions to simplify working with `URLPattern`

### Changed
- Overhaul `aegis:navigate` events

### Fixed
- Fix navigation controller nav listener being aborted too early

## [v1.0.5] - 2024-10-26

### Fixed
- Fix setting `rootEl` from string in `init()`

## [v1.0.4] - 2024-10-26

### Added
- Add `SearchParam` and `manageSearch` and `getSearch` for utilizing URL search params as state
- Add `getNavController` and `getNavSignal` and `whenNavigated` for cleanup on navigation
- Add more preloading/prefetch/preconnect/dns-prefetch related functions
- Add functions for updating page title and description
- Add Trust Policy for setting/parsing HTML
- Add scroll restoration handling
- Add cancellable navigation events (`NavigationEvent`) which, if `event.preventDefault` is called on, cancel navigation
- Add support for clearing registered routes
- Add support for directly registering functions/constructor - Useful for dynamic routes and redirects

## [v1.0.3] - 2024-10-24

### Added
- Add direct support for preloading in `registerPath()`

### Changed
- Update handling of importing/preloading modules
- Make `preloadModule()` async, resolving or rejecting based on `load` and `error` events

### Fixed
- Fix consistency or args passed to constructors/functions

## [v1.0.2] - 2024-10-23

### Added
- Add JSDocs
- Add minified `.mjs` version

## [v1.0.1] - 2024-10-21

### Added
- Add support for `method` and `formData` in navigation and module handling
- Add form submit handler
- Add `navigate` event, which can have default prevented (`event.preventDefault()`) to cancel navigation

### Changed
- Update `@aegisjsproject/state`

### Fixed
- Fix typo

## [v1.0.0] - 2024-10-13

Initial Release
