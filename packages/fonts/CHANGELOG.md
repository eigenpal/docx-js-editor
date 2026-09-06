# @docx-editor.dev/fonts

## 2.16.0

## 2.15.1

### Patch changes

- 1acd366: Fix import crashes in webpack and Turbopack builds. Bundled `FONT_ASSET_ROOT` now
  returns a non-`file:` URL, including in Electron and pages opened from disk. Fix font loading
  when bundlers emit relative paths or install paths contain parentheses.

## 2.15.0

### Minor changes

- 0d81033: Export `FONT_ASSET_ROOT` to restrict font reads to the package directory.

### Patch changes

- 5284df5: Fix packaged font URLs in Turbopack, Vite, and webpack builds. The CommonJS build
  continues to use local font files in Node.js.

## 2.14.1

### Patch Changes

- 65e146c: Preserve one literal asset URL per packaged font face in the ESM browser build so Next.js with
  Turbopack, Vite, and webpack resolve every requested filename instead of collapsing dynamic URLs
  to one font. Keep the CommonJS build resolving the same packaged files in Node.

## 2.14.0

## 2.13.0

### Minor Changes

- 0860dd2: Match Word's widths and per-weight line box for documents that name Century Gothic, served on demand from the bundle by `googleFonts()`; `loadDefaultFonts()` and `defaultFonts()` now default to `WORD_DOCUMENT_DEFAULT_FAMILIES`, so `ALL_WORD_DEFAULT_FAMILIES` becomes an explicit opt-in that loads four more faces than before. Fixes #507.
- 48cc3f7: Add `packagedFonts()`, which serves the bundled Word substitutes on demand so a document loads the families it names plus its default face, rather than every face of Word's five document defaults, and give `useFonts` and `useDocxSource` one uniform origin list where order is precedence. `defaultFonts()` keeps working unchanged.

### Patch Changes

- 41952f2: Register a packaged face from the bytes already loaded, so it costs no second request and an injected `fetcher` sees every byte read for it. A face that fails to load still registers by URL. Fixes #596.

## 2.12.0

## 2.11.0

## 2.10.0

## 2.9.2

## 2.9.1

## 2.9.0

## 2.8.0

## 2.7.0

## 2.6.1

## 2.6.0

## 2.5.0

## 2.4.1

## 2.4.0

## 2.3.1

## 2.3.0

## 2.2.1

## 2.2.0

## 2.1.3

## 2.1.2

## 2.1.1

## 2.1.0

## 2.0.1

## 2.0.0
