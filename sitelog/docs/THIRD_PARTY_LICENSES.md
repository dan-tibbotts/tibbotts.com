# Third-party software and assets

The application and test suite have **zero direct or transitive npm dependencies**. The committed lockfile records the empty dependency set. `npm run check` rejects added dependencies pending review. There are no external fonts, stock photos, maps, icon packages, compression libraries, SDKs or frontend frameworks.

All icons, the SiteLog mark and site illustrations are authored as SVG/code for this implementation. PNG application icons are rasterisations of the authored SVG. Seed people, addresses and jobs are fictional examples.

Browser/Node APIs provide storage, cryptography, photo processing, tests and the local HTTP server. Video codecs are supplied by the user's browser/OS; the application does not redistribute codec software or guarantee codec availability.

Prettier 3.6.2 (MIT, no package dependencies) was used as an optional development-only formatter through npm exec. It is not required to run, build or test the app and is not bundled or added to the project's dependency graph. Source: https://github.com/prettier/prettier/tree/3.6.2

Chrome is an optional separately installed test/browser application and is not distributed by this project. The browser smoke suite uses its standard DevTools protocol through Node's WebSocket API.

Future additions must review direct/transitive licences, vulnerabilities and asset provenance; allowed defaults are MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause and ISC. Unknown, restricted and copyleft licences need the specification's explicit review/approval process. Managed hosting/email agreements are separate from software licences.

The v3 expansion adds no direct/transitive packages, fonts, icon libraries, spreadsheet/PDF libraries or external assets. Print/PDF-compatible views use native HTML/browser printing; archives, SHA-256, IndexedDB, decimal arithmetic and tests use browser/Node APIs. The same already documented optional cached Prettier 3.6.2 (MIT) was used for formatting and remains outside the application dependency graph. XLSX is a reviewed staged follow-up, not a bundled unknown-licence implementation.
