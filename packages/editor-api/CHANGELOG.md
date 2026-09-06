# @docx-editor.dev/editor-api

## 2.16.0

### Minor Changes

- d0bac83: Use the engine's configurable element budget when opening XML parts and identify exceeded resource limits in the server API. Fixes #693.

### Patch Changes

- Updated dependencies [96d7e74]
- Updated dependencies [0a3b35d]
- Updated dependencies [7a18c15]
- Updated dependencies [863680d]
- Updated dependencies [62a6911]
- Updated dependencies [a4a9bbc]
- Updated dependencies [76a4c5d]
- Updated dependencies [b7c82fa]
- Updated dependencies [03b88ea]
- Updated dependencies [485bfd4]
- Updated dependencies [6fac0e1]
- Updated dependencies [85bfd9c]
- Updated dependencies [3641f1e]
- Updated dependencies [46c0de2]
- Updated dependencies [eb0e520]
- Updated dependencies [1de0f64]
- Updated dependencies [6f7da01]
  - @docx-editor.dev/core@2.16.0

## 2.15.1

## 2.15.0

### Patch changes

- Updated dependencies [5284df5]
- Updated dependencies [e9baf4d]
- Updated dependencies [087bb78]
- Updated dependencies [0d81033]
- Updated dependencies [a3819aa]
- Updated dependencies [a53f75c]
- Updated dependencies [36c1f04]
- Updated dependencies [8e6133f]
- Updated dependencies [678fe91]
- Updated dependencies [cfe3fe1]
- Updated dependencies [0e1360d]
- Updated dependencies [2a8e57e]
  - @docx-editor.dev/core@2.15.0

## 2.14.1

## 2.14.0

### Patch Changes

- Updated dependencies [7633b2c]
- Updated dependencies [1afc5f2]
- Updated dependencies [01022a4]
- Updated dependencies [6b5bb8d]
- Updated dependencies [f731c52]
  - @docx-editor.dev/core@2.14.0

## 2.13.0

### Patch Changes

- Updated dependencies [b360c3c]
- Updated dependencies [845e38f]
- Updated dependencies [fe26cd4]
- Updated dependencies [3c66a7c]
- Updated dependencies [16966b2]
- Updated dependencies [2d7dc10]
- Updated dependencies [346f7e6]
- Updated dependencies [5cf6f08]
- Updated dependencies [7ea84c3]
- Updated dependencies [2ea6a9d]
- Updated dependencies [e268614]
- Updated dependencies [8107826]
- Updated dependencies [0860dd2]
- Updated dependencies [b1fa0d6]
- Updated dependencies [f1d3940]
- Updated dependencies [0a6e44c]
- Updated dependencies [72ff41f]
- Updated dependencies [8506a62]
- Updated dependencies [0d782e3]
- Updated dependencies [7e85377]
- Updated dependencies [96cdbe2]
  - @docx-editor.dev/core@2.13.0

## 2.12.0

### Patch Changes

- Updated dependencies [531759c]
- Updated dependencies [40699c8]
- Updated dependencies [31780e5]
- Updated dependencies [4c2c119]
- Updated dependencies [3755b98]
- Updated dependencies [8fe5920]
- Updated dependencies [fe3b8a3]
  - @docx-editor.dev/core@2.12.0

## 2.11.0

### Minor Changes

- e4872fb: Allow browser runtimes to receive an explicit author identity so scripts can reply to comments when the live editor permits review writes.
- e4872fb: Add atomic `Comment.delete()` and `CommentReply.delete()` operations, including browser Undo support and root-versus-reply lifecycle semantics.
- e4872fb: Add `Body.bookmarks` to enumerate bookmarks in a body story without first searching for text.
- e4872fb: Add `ContentControl.isBound` for safely preflighting custom-XML-bound controls before writes.
- e4872fb: Add read-only `NoteItem.text` so footnote and endnote text can be loaded directly in one post-listing sync while preserving `NoteItem.body` for structured access.

### Patch Changes

- e4872fb: Fix browser runtimes reporting save support even though they do not expose a `save()` method.
- e4872fb: Correct font getter types to include `null` when a range has mixed or inherited formatting. Strict TypeScript consumers must now handle the existing nullable runtime result.
- e4872fb: Correct comment, reply, and revision date getter types to include `null` for missing or invalid OOXML dates. Strict TypeScript consumers must now guard these review dates before using `Date` methods.
- e4872fb: Reject non-empty `LoadQueryOptions.expand` requests instead of silently ignoring navigation-property expansion.
- e4872fb: Fix browser `Range.select()` calls so offscreen ranges are revealed as well as logically selected.
- e4872fb: Fix browser `Bookmark.select()` calls so they resolve and reveal the bookmark without requiring a prior `bookmark.range` sync.
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [2015f33]
- Updated dependencies [1542e73]
- Updated dependencies [40578c6]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [c4b4dab]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [e4872fb]
- Updated dependencies [af77c9b]
- Updated dependencies [d11816f]
- Updated dependencies [0d770d9]
- Updated dependencies [dfaafc0]
  - @docx-editor.dev/core@2.11.0

## 2.10.0

### Patch Changes

- Updated dependencies [79170d8]
- Updated dependencies [99c7408]
- Updated dependencies [56848c8]
- Updated dependencies [ab81336]
- Updated dependencies [8ac2e88]
- Updated dependencies [0928951]
- Updated dependencies [0e3663d]
- Updated dependencies [b10d396]
- Updated dependencies [0e3663d]
  - @docx-editor.dev/core@2.10.0

## 2.9.2

## 2.9.1

### Patch Changes

- Updated dependencies [36ea49a]
  - @docx-editor.dev/core@2.9.1

## 2.9.0

### Minor Changes

- 6573c9b: `@docx-editor.dev/core` is now a peer dependency of `@docx-editor.dev/editor-api` instead of a regular dependency, so your project resolves one copy of the engine, shared with any editor adapter. Hosts whose package manager does not auto-install peers (for example Yarn) must add `@docx-editor.dev/core` explicitly.
- 686a9d6: Add agent-safe document writing and revision APIs.
  - Add an explicit `original` text projection. Pending deletions remain visible, while pending
    insertions stay hidden. This matches Word's Original review view.
  - Add the atomic `replaceStoryBlocks` automation operation with stable paragraph identities.
  - Add the DocxEditor `revisionTextView` runtime option outside the Office.js object model.
  - Implement `proposeInsertion`, `proposeDeletion`, and `proposeReplacement` editor commands.

  Projected search ranges map back to editable model offsets and retain their projection for later
  range reads and searches.

## 2.8.0

### Patch Changes

- Updated dependencies [5ae7f4d]
- Updated dependencies [ac5ec3f]
- Updated dependencies [130ba52]
- Updated dependencies [5ae7f4d]
- Updated dependencies [7a58fb2]
- Updated dependencies [91fc4c8]
- Updated dependencies [91cb3e0]
- Updated dependencies [dab6700]
- Updated dependencies [dab6700]
- Updated dependencies [dab6700]
- Updated dependencies [dab6700]
  - @docx-editor.dev/core@2.8.0

## 2.7.0

### Patch Changes

- Updated dependencies [4c907ed]
- Updated dependencies [447d983]
- Updated dependencies [047b2c6]
- Updated dependencies [4c907ed]
- Updated dependencies [25235c1]
- Updated dependencies [25235c1]
- Updated dependencies [25235c1]
- Updated dependencies [010a327]
- Updated dependencies [4c907ed]
- Updated dependencies [4c907ed]
- Updated dependencies [4c907ed]
- Updated dependencies [25235c1]
- Updated dependencies [4c907ed]
  - @docx-editor.dev/core@2.7.0

## 2.6.1

### Patch Changes

- @docx-editor.dev/core@2.6.1

## 2.6.0

### Patch Changes

- Updated dependencies [56bb68f]
- Updated dependencies [622c4f9]
- Updated dependencies [c6529c8]
- Updated dependencies [7e59774]
- Updated dependencies [3c80f4f]
- Updated dependencies [3c80f4f]
- Updated dependencies [0452f9c]
- Updated dependencies [bc614bd]
- Updated dependencies [0652ae4]
- Updated dependencies [1ce2f55]
- Updated dependencies [9a64477]
- Updated dependencies [008243e]
- Updated dependencies [887f67f]
  - @docx-editor.dev/core@2.6.0

## 2.5.0

### Patch Changes

- Updated dependencies [f3e5d58]
- Updated dependencies [d905af3]
- Updated dependencies [192c644]
- Updated dependencies [5c65a88]
- Updated dependencies [d905af3]
- Updated dependencies [d905af3]
- Updated dependencies [f811b44]
- Updated dependencies [346cc78]
- Updated dependencies [4a57eed]
- Updated dependencies [289a7a1]
- Updated dependencies [5a2f3ed]
- Updated dependencies [5a2f3ed]
- Updated dependencies [266a086]
- Updated dependencies [d905af3]
  - @docx-editor.dev/core@2.5.0

## 2.4.1

### Patch Changes

- 32018ce: Document and test explicit byte ownership for detached server runtimes: `createServer` completes consumption of input bytes and each `save` returns fresh caller-owned bytes.
  - @docx-editor.dev/core@2.4.1

## 2.4.0

### Minor Changes

- c2ac694: Fix story-scoped revision collections so they resolve every store-resolvable change in that story, including complete tracked rows, and refuse atomically when any unsupported revision remains.

### Patch Changes

- @docx-editor.dev/core@2.4.0

## 2.3.1

### Patch Changes

- Updated dependencies [1c9b6a2]
- Updated dependencies [1c9b6a2]
  - @docx-editor.dev/core@2.3.1

## 2.3.0

### Minor Changes

- aaf9f43: Allow browser runtimes to receive an explicit author identity so scripts can reply to comments when the live editor permits review writes.
- c8c148f: Correct font getter types to include `null` when a range has mixed or inherited formatting. Strict TypeScript consumers must now handle the existing nullable runtime result.
- aaf9f43: Create top-level comments from ranges with the runtime author on server and browser hosts.
- aaf9f43: Add atomic `Comment.delete()` and `CommentReply.delete()` operations, including browser Undo support and root-versus-reply lifecycle semantics.
- 120b912: Add `Body.bookmarks` to enumerate bookmarks in a body story without first searching for text.
- c8c148f: Correct comment, reply, and revision date getter types to include `null` for missing or invalid OOXML dates. Strict TypeScript consumers must now guard these review dates before using `Date` methods.
- 120b912: Add `ContentControl.isBound` for safely preflighting custom-XML-bound controls before writes.
- 120b912: Add read-only `NoteItem.text` so footnote and endnote text can be loaded directly in one post-listing sync while preserving `NoteItem.body` for structured access.

### Patch Changes

- c8c148f: Fix browser runtimes reporting save support even though they do not expose a `save()` method.
- c8c148f: Reject non-empty `LoadQueryOptions.expand` requests instead of silently ignoring navigation-property expansion.
- 120b912: Fix browser `Range.select()` calls so offscreen ranges are revealed as well as logically selected.
- 120b912: Fix browser `Bookmark.select()` calls so they resolve and reveal the bookmark without requiring a prior `bookmark.range` sync.
  - @docx-editor.dev/core@2.3.0

## 2.2.1

### Patch Changes

- Updated dependencies [35f6d04]
  - @docx-editor.dev/core@2.2.1

## 2.2.0

### Patch Changes

- Updated dependencies [3096225]
- Updated dependencies [9c25492]
- Updated dependencies [04c2379]
- Updated dependencies [f0e4ab9]
  - @docx-editor.dev/core@2.2.0

## 2.1.3

### Patch Changes

- b96f21b: `InvalidObjectPath` now says which of the two states it means: an object an item accessor answered becomes usable after the next `await context.sync()`, while a released object needs `context.trackedObjects.add(...)`. The message previously described only the released case.
  - @docx-editor.dev/core@2.1.3

## 2.1.2

### Patch Changes

- Updated dependencies [efd3d76]
- Updated dependencies [69a97f3]
- Updated dependencies [ede69f6]
- Updated dependencies [802ab3e]
- Updated dependencies [4fa91bd]
- Updated dependencies [4fa91bd]
  - @docx-editor.dev/core@2.1.2

## 2.1.1

### Patch Changes

- Updated dependencies [d74c5d6]
  - @docx-editor.dev/core@2.1.1

## 2.1.0

### Patch Changes

- Updated dependencies [a9fd363]
- Updated dependencies [d793994]
- Updated dependencies [6dee1e3]
- Updated dependencies [3310029]
- Updated dependencies [d116599]
- Updated dependencies [f4eac0c]
- Updated dependencies [b3e3457]
- Updated dependencies [dbf5501]
- Updated dependencies [7dce3ba]
- Updated dependencies [a758db1]
- Updated dependencies [42406bc]
- Updated dependencies [d793994]
- Updated dependencies [d89ef55]
- Updated dependencies [d56b1a5]
- Updated dependencies [34be525]
- Updated dependencies [765e617]
- Updated dependencies [113ed44]
- Updated dependencies [8b4830e]
- Updated dependencies [3f70246]
- Updated dependencies [7a72c42]
- Updated dependencies [8b4830e]
- Updated dependencies [43c3e6a]
- Updated dependencies [585413d]
- Updated dependencies [cc82d50]
- Updated dependencies [ec538fa]
- Updated dependencies [45c9b93]
- Updated dependencies [d793994]
- Updated dependencies [0a62c6d]
- Updated dependencies [e215962]
- Updated dependencies [434454d]
  - @docx-editor.dev/core@2.1.0

## 2.0.1

### Patch Changes

- Updated dependencies [51f14f5]
  - @docx-editor.dev/core@2.0.1

## 2.0.0

### Patch Changes

- 26095c6: Published packages now ship a `THIRD_PARTY_NOTICES.md` reproducing the license of every third-party package bundled into their release artifacts.
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
  - @docx-editor.dev/core@2.0.0

## 1.10.0

## 1.9.0

## 1.8.3

## 1.8.2

## 1.8.1

## 1.8.0

### Patch Changes

- 274e45f: `applyReview` now reports when a batch accept/reject id is note-resident. An id that lives only inside a footnote or endnote previously surfaced as a bare "Tracked change not found", giving no hint the id exists but isn't body-mutable here. It now returns a message saying the change is inside a footnote/endnote and must be resolved through the note-targeting accept/reject API. Batch ids stay document-body-scoped — this sharpens the error only and is fully backward-compatible (the new note stores are passed internally and optional).

## 1.7.0

### Patch Changes

- 2dedf30: The agent bridge now re-exports the paragraph-flash option types (`ParagraphHighlightOptions`, `ScrollToParaIdOptions`) from `@docx-editor.dev/core` instead of redeclaring them, so the two definitions can't drift. No change to the public API surface.
- 6b1897a: Fix `DocxReviewer.getChanges()` dropping a tracked change when two changes in different paragraphs share a revision id (Word reuses `w:id` across paragraphs), which made the enumerated change list disagree with the count from `acceptAll`/`rejectAll`.

## 1.6.2

## 1.6.1

### Patch Changes

- 7c1d1ff: Reach paragraphs inside table cells from the headless review tools. `find_text`, `suggest_change`, and `add_comment` now locate and edit paragraphs in `w:tbl > w:tr > w:tc > w:p`, addressed by the same paraId / ordinal index as body paragraphs, so a tracked change can be authored inside a table cell.

## 1.6.0

### Minor Changes

- a6a2dd0: Add an `insert_break` agent/MCP tool (and `bridge.insertBreak` / editor `insertBreak` ref method) so agents can insert a page break or a section break (next page / continuous) after a paragraph.

## 1.5.0

### Minor Changes

- c4fd221: `DocxReviewer` can now accept/reject tracked changes inside footnote and endnote bodies. Pass a `ReviewChange` from `getChanges` (it carries `noteId`/`noteType`) to `acceptChange`/`rejectChange` to resolve a change wherever it lives, or use `acceptAll`/`rejectAll` with `{ includeFootnotes, includeEndnotes }` to resolve note changes in bulk. The result persists through `toBuffer()`. Previously these methods operated on the document body only; the numeric `acceptChange(id)` form is unchanged.

## 1.4.0

## 1.3.3

## 1.3.2

## 1.3.1

## 1.3.0

### Minor Changes

- 1be9cf5: Edit and track-change footnote and endnote bodies.

  Note bodies are now serialized on save, so edits and tracked changes (`w:ins` /
  `w:del`) inside footnotes and endnotes persist instead of being dropped — the
  run model preserves the separator markers and the in-body auto-number marks, and
  `repackDocx` writes `word/footnotes.xml` / `word/endnotes.xml` from the model.
  `DocxReviewer.getChanges()` gains `includeFootnotes` / `includeEndnotes` options;
  when set, tracked changes inside note bodies are reported with `noteId` /
  `noteType`.

## 1.2.1

### Patch Changes

- a0adf60: Headless agent bridge: paragraphs with no `w14:paraId` are now addressable. `read_document` already labels such paragraphs by their ordinal index, but the bridge only registered paragraphs that carried a paraId — so every paraId-anchored op (comments, tracked changes, and formatting/style) rejected the id the agent was given, and `find_text` skipped those paragraphs entirely. Documents without paraIds (common in Word output) were effectively read-only through the bridge. The bridge now keys those paragraphs by the same ordinal index it reports, and `find_text` surfaces them with that ordinal id — so a phrase it returns is anchorable by the mutate tools.

## 1.2.0

## 1.1.0

### Minor Changes

- 7a91813: Add headless reviewer formatting and paragraph style edits
- 42ea72d: Track structural edits as OOXML revisions in suggesting mode. Paragraph-break insert/delete, paragraph-property changes, and table row/cell insert/delete/merge are now recorded, round-tripped through DOCX, and shown in the tracked-changes sidebar (React and Vue, localized). Adds `acceptChangeById(id)` / `rejectChangeById(id)`, and `acceptAllChanges` / `rejectAllChanges` now resolve every revision type rather than inline marks only. Fixes #614.

## 1.0.3

## 1.0.2

## 1.0.1

## 1.0.0

### Major Changes

- 6272b32: # 1.0.0

  First multi-package, multi-framework release. The monolithic `@eigenpal/docx-js-editor` is split into a framework-agnostic core and per-framework adapters, Vue 3 ships as a first-class adapter alongside React, and the license moves to Apache 2.0 across all packages.

  ## Package restructure (breaking)

  | Old import                            | New import                           |
  | ------------------------------------- | ------------------------------------ |
  | `@eigenpal/docx-js-editor`            | `@docx-editor.dev/react`             |
  | `@eigenpal/docx-js-editor/react`      | `@docx-editor.dev/react`             |
  | `@docx-editor.dev/react/core`         | `@docx-editor.dev/core`              |
  | `@docx-editor.dev/react/headless`     | `@docx-editor.dev/core/headless`     |
  | `@docx-editor.dev/react/core-plugins` | `@docx-editor.dev/core/core-plugins` |
  | `@docx-editor.dev/react/mcp`          | `@docx-editor.dev/agents/mcp`        |
  | `@docx-editor.dev/react/i18n/*.json`  | `@docx-editor.dev/i18n/*.json`       |

  The old `@eigenpal/docx-js-editor` package stays on 0.x for legacy maintenance — no 1.x compatibility shim ships. Framework-agnostic utilities (e.g. `createEmptyDocument`) move to core:

  ```diff
  - import { DocxEditor, createEmptyDocument } from '@eigenpal/docx-js-editor';
  + import { DocxEditor } from '@docx-editor.dev/react';
  + import { createEmptyDocument } from '@docx-editor.dev/core';
  ```

  ## Vue 3 adapter (`@docx-editor.dev/vue`)

  The Vue package becomes a real adapter (previously a stub). Public API mirrors React:
  - `<DocxEditor>` with matching prop surface
  - `useDocxEditor` composable + `renderAsync` for the Node.js path
  - `/ui`, `/composables`, `/dialogs`, `/plugin-api`, `/styles` subpaths

  Parity gates cover insert-table, find/replace, page-setup, context menus, image overlay (resize/move/rotate/aspect-locked corners, dimension tooltip), advanced cell/row options (margins, height rule, text direction, no-wrap), menu-bar icons + shortcuts + carets, toolbar pickers, and the agent UI surface.

  ## Shared i18n package (`@docx-editor.dev/i18n`)

  Locale strings move out of `@docx-editor.dev/react` into a dedicated package consumed by both adapters from a single source.

  ```diff
  - import de from '@docx-editor.dev/react/i18n/de.json';
  + import de from '@docx-editor.dev/i18n/de.json';
  ```

  The `defaultLocale` value (English) is still re-exported from the adapter packages, unchanged.

  ## Agent UI relocation (breaking)

  `AgentPanel`, `AgentChatLog`, `AgentComposer`, `AgentSuggestionChip`, `AgentTimeline` no longer ship from `@docx-editor.dev/react`. They live at:
  - `@docx-editor.dev/agents/react` — React components + `useAgentChat`
  - `@docx-editor.dev/agents/vue` — Vue 3 twins, plus `AIContextMenu` and `AIResponsePreview`
  - `@docx-editor.dev/agents/ai-sdk/react` / `/ai-sdk/vue` — `@ai-sdk/*` adapters
  - `@docx-editor.dev/agents/bridge` — React-free `createEditorBridge`, `agentTools`, `executeToolCall`, `getToolSchemas`, `createReviewerBridge`. Safe for headless / Vue / Node.

  ```diff
  - import { AgentPanel, AgentChatLog } from '@docx-editor.dev/react';
  + import { AgentPanel, AgentChatLog } from '@docx-editor.dev/agents/react';
  ```

  The agent components no longer call `useTranslation` directly — pass localized `*Label` props instead. `<DocxEditor>`'s built-in agent panel slot still forwards localized strings automatically.

  Accessibility polish on the agent surface: keyboard-operable resize handle, Escape-dismissable context menu, live-region chat log, WCAG AA contrast on response previews.

  ## Toolbar naming unified (breaking)

  The standalone formatting bar is `Toolbar` on both adapters. The old "classic" single-row `Toolbar` (with File/Format/Insert menus baked in) is removed — compose `EditorToolbar.MenuBar` + `EditorToolbar.Toolbar` for that layout.

  | Old (React)                    | New (React + Vue)       |
  | ------------------------------ | ----------------------- |
  | `FormattingBar`                | `Toolbar`               |
  | Classic `Toolbar` (with menus) | `EditorToolbar`         |
  | `EditorToolbar.FormattingBar`  | `EditorToolbar.Toolbar` |

  Vue: `BasicToolbar` / `FormattingBar` aliases removed; `EditorToolbar`'s `formatting-bar` slot is now `toolbar`. Vue's table border-color and cell-fill pickers now use the advanced color picker matching React. Vue `MenuDropdown`'s `showChevron` default flips from `true` to `false` — pass `:show-chevron="true"` explicitly to keep the caret.

  ## `showPrintButton` prop removed (breaking)

  Removed from `<DocxEditor>` and `<Toolbar>` on both adapters; the Vue `<Toolbar>` `print` event is gone with it. `onPrint` callback stays.

  ```diff
  - <DocxEditor showPrintButton onPrint={handlePrint} />
  + <DocxEditor onPrint={handlePrint} />
  ```

  To hide File > Print, omit `onPrint`. Programmatic print still works via `ref.current.print()` / `editorRef.value.print()`.

  ## License moves to Apache 2.0

  All published packages relicense to Apache 2.0. Notably: `@docx-editor.dev/agents` was AGPL-3.0-or-later — the relicense lifts copyleft obligations on agent embedders.

### Patch Changes

- c5125ff: Wire API Extractor on `@docx-editor.dev/agents/server`. Tag the 11 public exports with `@public`. Commits the first `etc/agents-server.api.md` snapshot; CI now fails on undocumented public-surface drift via `bun run api:check`. No runtime change.
- f7b8dc7: Move the source folder from `packages/agent-use` to `packages/agents` so it matches the published npm name (`@docx-editor.dev/agents`). The npm package name, version, exports, and import paths are unchanged — no consumer action needed.

## 0.5.1

## 0.5.0

## 0.4.3

## 0.4.2

## 0.4.1

## 0.4.0

## 0.3.1

## 0.3.0

## 0.2.0

### Minor Changes

- c81fdd3: # Live agent chat + server-side MCP support

  A Word-API-style bridge that lets an AI agent read a DOCX, comment on it, suggest tracked changes, and scroll the view — live in a running editor, or server-side against a parsed file. Same tool catalog, same shape, two transports.

  ## The pattern

  Locate, then mutate. The agent calls a locate tool (`read_document`, `read_selection`, `find_text`) which returns paragraphs tagged with their stable Word `w14:paraId`. It passes those paraIds to mutate tools. paraIds survive concurrent edits and tool-loop iterations; ordinal indices don't.

  ## Ten agent tools

  OpenAI function-calling format (also accepted by Anthropic / Vercel AI SDK):
  - **Locate** — `read_document`, `read_selection`, `find_text`, `read_comments`, `read_changes`
  - **Mutate** — `add_comment`, `suggest_change` (one tool, three modes via empty-string semantics: replacement / deletion / insertion at paragraph end), `reply_comment`, `resolve_comment`
  - **Navigate** — `scroll`

  Exported from `@docx-editor.dev/agents` as `agentTools`, `getToolSchemas()`, `executeToolCall(name, args, bridge)`.

  ## Two bridges, same interface

  Everything wires into an `EditorBridge` interface. Two implementations ship:

  ```ts
  // Live editor in a browser
  import { useAgentChat } from '@docx-editor.dev/agents/bridge';
  const { executeToolCall, toolSchemas } = useAgentChat({ editorRef, author: 'AI' });

  // Server-side, against a parsed DOCX
  import { DocxReviewer, createReviewerBridge } from '@docx-editor.dev/agents';
  const reviewer = await DocxReviewer.fromBuffer(buffer, 'AI');
  const bridge = createReviewerBridge(reviewer);
  const result = executeToolCall('add_comment', { paraId, text }, bridge);
  ```

  Both expose the same 10 tools to the agent. The bridge layer abstracts the transport.

  ## MCP server (built-in, spec 2025-06-18)

  ```ts
  import { McpServer, createReviewerBridge, DocxReviewer } from '@docx-editor.dev/agents';
  import { McpServer as _ } from '@docx-editor.dev/agents/mcp';

  const server = new McpServer(bridge, { name: 'my-saas', version: '1.0.0' });
  const reply = server.handle(jsonRpcMessage); // sync, transport-free, never throws
  ```

  - **Transport-agnostic core**: wire `server.handle()` to HTTP-SSE, WebSocket, your queue worker, or a managed stdio process. The library does not pick a transport.
  - **stdio adapter** for customers who want to run the server inside a worker pool: `runStdioServer(bridge)` (Node-only).
  - **Spec compliance**: `initialize` / `tools/list` / `tools/call` / `ping`. Tool failures use the spec's `{isError: true, content: [...]}` envelope inside a successful JSON-RPC response; JSON-RPC errors are reserved for protocol-level problems. Includes UTF-8-safe chunk decoding (multi-byte codepoints don't break across stdio chunks) and a buffer cap to prevent memory DoS.

  A local-install stdio bin was prototyped and removed: one-document-per-config is the wrong shape for a contract-review product. The right deployment is a hosted MCP service the customer operates with their own auth + storage.

  ## Events

  `bridge.onContentChange(listener)` and `bridge.onSelectionChange(listener)` (both return unsubscribe functions) let host apps and MCP servers react to edits without owning the single React callback prop.
  - `ContentChangeEvent` ships `{ commentCount, changeCount, comments, changes }`.
  - `SelectionChangeEvent` ships the current `SelectionInfo` or `null`. (Reviewer bridge: never fires — no caret in headless mode.)

  ## New on `DocxEditorRef`

  ```ts
  addComment({ paraId, text, author, search? }) → number | null
  replyToComment(commentId, text, author)        → number | null
  resolveComment(commentId)                       → void
  proposeChange({ paraId, search, replaceWith, author }) → boolean
  findInDocument(query, { caseSensitive?, limit? }) → FoundMatch[]
  getSelectionInfo()                              → SelectionInfo | null
  getComments()                                   → Comment[]
  onContentChange(listener)                       → () => void
  onSelectionChange(listener)                     → () => void
  ```

  `scrollToParaId` was already public.

  ## New on `@eigenpal/docx-core`

  `findParagraphByParaId(doc, paraId)` returns the PM range for a paragraph by paraId.

  ## Word JS API parity contract

  `WordCompatBridge` (exported type from the package root) formally documents every Office.js Word API method we mirror. A compile-time static assertion enforces that `EditorBridge` satisfies it. If we drop or change a method that's part of the public Word-API mirror, typecheck breaks.

  ## Demos
  - **`examples/agent-use-demo` (roast-my-doc)** — server-side demo of the canonical "build your own MCP-shaped agent server" pattern: parse → `createReviewerBridge` → `agentTools` → tool-call loop with `executeToolCall` → `toBuffer()`. The route's preamble shows the one-line diff to convert it to a real MCP server.
  - **`examples/agent-chat-demo` (chat with your doc)** — live editor + chat panel. Demonstrates `useAgentChat` against a running `<DocxEditor>`.

  Both demos support `ALLOWED_ORIGINS` env var for production deployments (open by default for local dev), forward client `AbortSignal` to OpenAI calls, and cap upload size.

  ## Hardening
  - `proposeChange` refuses to layer onto an existing tracked-change run (would produce invalid OOXML).
  - Ambiguous `search` arguments return an error instead of silently mistargeting.
  - `scroll` does not steal the user's caret.
  - Comment IDs and tracked-change revisionIds use the shared monotonic counter to avoid collisions in OOXML.
  - Mark guards if a host StarterKit omits `comment` / `insertion` / `deletion` extensions.

  ## Spec

  `specs/live-agent-chat.md`.

## 0.1.1

## 0.1.0

### Minor Changes

- 91a6f97: Add `fontFamilies` prop to `DocxEditor` to customize the toolbar's font dropdown.

  Pass either bare strings or full `FontOption` objects (or a mix). Strings render in the "Other" group; `FontOption[]` enables CSS fallback chains and category grouping. Omitting the prop preserves the existing 12-font default. Closes #278.

  ```tsx
  <DocxEditor
    fontFamilies={[
      'Arial',
      { name: 'Roboto', fontFamily: 'Roboto, sans-serif', category: 'sans-serif' },
    ]}
  />
  ```

### Patch Changes

- b10a517: Fix three toolbar tooltips/labels that ignored the `i18n` prop and rendered as English regardless of locale: the comments-sidebar toggle, the outline-toggle button, and the Editing / Suggesting / Viewing mode dropdown (including its descriptions). The translation keys already existed in `de.json` and `pl.json`; the components were just bypassing `useTranslation()`. Now wired through correctly.

## 0.0.35

### Patch Changes

- 4e20b77: Add `DocxReviewer.removeComment(id)` — removes a comment (and its replies when called on a top-level thread) along with its anchored range markers. Closes #252.

## 0.0.34

### Patch Changes

- ce89e70: Yjs collab

## 0.0.33

### Patch Changes

- Add i18n

## 0.0.32

### Patch Changes

- Fixes with comments and tracked changes

## 0.0.31

### Patch Changes

- [`d77716f`](https://github.com/eigenpal/docx-editor/commit/d77716f3abc8580ca48d9e2280f6564ce17df443) Thanks [@jedrazb](https://github.com/jedrazb)! - Bump

## 0.0.30

### Patch Changes

- Bump

## 0.0.29

### Patch Changes

- Bump to patch

## 0.0.28

### Patch Changes

- Bump packages
