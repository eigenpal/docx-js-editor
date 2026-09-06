# @docx-editor.dev/pro

## 2.16.0

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
  - @docx-editor.dev/react@2.16.0
  - @docx-editor.dev/vue@2.16.0

## 2.15.1

## 2.15.0

### Patch changes

- 7dc8b22: Preserve concurrent text edits when another collaborator formats the same run. Fixes #590.
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
  - @docx-editor.dev/react@2.15.0
  - @docx-editor.dev/vue@2.15.0

## 2.14.1

## 2.14.0

### Patch Changes

- Updated dependencies [7633b2c]
- Updated dependencies [1afc5f2]
- Updated dependencies [01022a4]
- Updated dependencies [6b5bb8d]
- Updated dependencies [f731c52]
  - @docx-editor.dev/core@2.14.0
  - @docx-editor.dev/react@2.14.0
  - @docx-editor.dev/vue@2.14.0

## 2.13.0

### Patch Changes

- 66fcc36: Two people formatting the same paragraph at once no longer duplicate its text. A concurrent run-property edit now converges deterministically — one peer's formatting wins and the text stays intact — instead of silently doubling it on every replica. Fixes #581.
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
  - @docx-editor.dev/react@2.13.0
  - @docx-editor.dev/vue@2.13.0

## 2.12.0

### Minor Changes

- 9f1b924: Collaboration rooms report their replicated size: `session.resourceUsage()` and the server-side `readCollaborationResourceUsage(ydoc)` return node, tombstone, relationship, part, and media-byte counts next to the hard limits, so a host can archive and re-room before growth turns terminal.

### Patch Changes

- ce9c5cc: Harden the collaboration receive path against a hostile peer: a malformed shared node record no longer crashes `applyUpdate`, the derived-index rebuild, or the materializer on every replica. A crafted value now degrades to an absent node instead of throwing. Fixes #567.
- 71bc4e0: Collaboration rooms recover cleanly from failure: a failed seed no longer marks the room initialized, `readCollaborationDocument` and session teardown release their document observers, refusal recovery keeps a disconnected status instead of reporting ready, and undo obeys the same gate as every other edit. Fixes #541, #542, #544, #545.
- b779bb8: An edit committed by a change subscriber while the session installs a remote package now replicates instead of staying on one replica behind a healthy status. Fixes #553.
- Updated dependencies [531759c]
- Updated dependencies [40699c8]
- Updated dependencies [31780e5]
- Updated dependencies [4c2c119]
- Updated dependencies [3755b98]
- Updated dependencies [8fe5920]
- Updated dependencies [fe3b8a3]
  - @docx-editor.dev/core@2.12.0
  - @docx-editor.dev/react@2.12.0
  - @docx-editor.dev/vue@2.12.0

## 2.11.0

### Minor Changes

- e4872fb: Add `useDocumentCollaboration` and `useCollaborationParticipants` for React and Vue, expose `ydoc` and `provider` plus a `rejoin` recovery on the WebRTC hooks, and add `session.setIdentity` for live name and color changes. `leave` now requires the saved document bytes so nothing typed in the room is lost.
- e4872fb: Collaboration hooks now return a host-facing `CollaborationSession` and typed `CollaborationFailure` errors, and the shared room bootstrap type is `CollaborationBootstrap`.
- e4872fb: Add the `DocxEditorCollaboration` compound to the React and Vue entries: `CaretLabels` renders your own component inside each remote-caret label with full adapter context, and `Avatars`/`Avatar` ship a participant stack whose colors match the review author colors automatically.
- e4872fb: Add the `create-or-join` collaboration bootstrap: every peer opens a room with the same options, the first peer seeds it and later peers join it, so hosts no longer decide out-of-band which peer creates the room. A room that two partitioned peers seeded concurrently reports the new terminal failure code `concurrent-seed` on every replica; recover by creating a new room from saved bytes.
- e4872fb: Add an experimental API that replicates full-document canonical edits across Yjs peers. A typing run undoes as one step.
- e4872fb: Add `useHocuspocusCollaboration` (React and Vue) and `createHocuspocusCollaboration` on new `hocuspocus` subpaths, so a Hocuspocus server room works the same way a WebRTC room does. The `token` option accepts a renewal callback, and a rejected token fails fast instead of waiting out the sync timeout.
- e4872fb: Add an `offlineEditing` option to the collaboration factories and hooks: a disconnected replica keeps accepting local edits, and the buffered updates merge on reconnect.
- e4872fb: Realtime collaboration is available from `@docx-editor.dev/pro`. Register `collaborationModule({ session })` on the editor module list.
- e4872fb: Add `useWebrtcCollaboration` for React and Vue so a host can open a WebRTC room without owning its StrictMode lifecycle.

### Patch Changes

- e4872fb: A collaboration session that cannot accept the document no longer throws out of the editor's mount path, so the editor stays mounted and reports that it is out of sync instead of going blank.
- e4872fb: Verify shared media bytes against their content digest before use, so a peer cannot substitute the bytes behind an image that every replica already trusts.
- e4872fb: Report a collaboration status of `error` when shared state can only be materialized by leaving content out, instead of repairing the document silently while the session still reads `ready`.
- e4872fb: Hold remote collaboration updates to the same node, part, relationship, and blob limits as local writes, so one peer can no longer drive unbounded allocation on every replica in the room.
- e4872fb: Collaboration status now keeps a typed last-failure reason after the session recovers, so a host can learn why a replica failed. The session factory that always received `"document"` is removed; pass a ready session instead.
- e4872fb: Resolving, reopening, and deleting a comment now replicate to collaboration peers without dropping the anchored text.
- e4872fb: Keep both authors' work when two collaborators add the first footnote or endnote at the same
  time, instead of dropping one of them.
- e4872fb: Keep a collaborative room editable and converged when two people press Enter or paste in the
  same paragraph at the same time, instead of leaving each author on their own copy.
- e4872fb: A cross-paragraph type-over now replicates to peers. Joining no longer adopts the removed paragraph's properties onto the survivor.
- e4872fb: A character-format command no longer duplicates selected text. New text nodes fill by replacing their current value, so a replay cannot insert the same characters again.
- e4872fb: Inserting an image in a collaborative document now copies only that image's bytes into the room, instead of serializing the whole document.
- e4872fb: An incomplete WebRTC chunked message now times out and moves the replica to error instead of stalling later updates behind a silent gap.
- e4872fb: Fix silent data loss where a local edit that a remote update raced could overwrite text or delete a paragraph nobody touched, by replicating each edit on the commit that makes it.
- e4872fb: Keep a keystroke in a collaborative document proportional to the edit rather than to the document, so typing in a long file costs what typing in a short one does.
- e4872fb: Maintaining a node's child listing is now linear in its child count, which removes a slowdown when typing in a long document or a wide table.
- e4872fb: Keep both relationships when two people add the first one to the same part at the same time, so a concurrently inserted image or hyperlink no longer ends up permanently broken.
- e4872fb: A collaborative edit that replaces a run no longer sends the text it replaced to the other replicas, so formatting, tracked deletion, and hyperlink edits over previously edited text converge.
- e4872fb: Undo no longer destroys text a collaborator typed into the same node while the undone edit was being made.
- e4872fb: WebRTC room encryption no longer uses the public room id as the password; pass a `#collab=` URL fragment secret or signaling stays unencrypted.
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
  - @docx-editor.dev/react@2.11.0
  - @docx-editor.dev/vue@2.11.0

## 2.10.0

### Patch Changes

- Updated dependencies [79170d8]
- Updated dependencies [99c7408]
- Updated dependencies [56848c8]
- Updated dependencies [2af5fea]
- Updated dependencies [df91189]
- Updated dependencies [ab81336]
- Updated dependencies [8ac2e88]
- Updated dependencies [6b1b045]
- Updated dependencies [0928951]
- Updated dependencies [0e3663d]
- Updated dependencies [b10d396]
- Updated dependencies [0e3663d]
  - @docx-editor.dev/core@2.10.0
  - @docx-editor.dev/react@2.10.0
  - @docx-editor.dev/vue@2.10.0

## 2.9.2

## 2.9.1

### Patch Changes

- Updated dependencies [36ea49a]
  - @docx-editor.dev/core@2.9.1
  - @docx-editor.dev/react@2.9.1
  - @docx-editor.dev/vue@2.9.1

## 2.9.0

## 2.8.0

### Patch Changes

- 25b8714: Derive the third-party notice for `@docx-editor.dev/pro` from every bundle it ships, not only the Vue one.
- dab6700: Editing a custom node in a header, footer or note keeps its payload. Updating one and naming only its text used to drop the stored data, which then disappeared the next time the document opened.

## 2.7.0

## 2.6.1

## 2.6.0

### Minor Changes

- e9a35d0: Add `@docx-editor.dev/pro/vue` with the review rail, review composables, author styling, and custom-node chip and context-menu chrome.

## 2.5.0

### Patch Changes

- f993cf9: Markers in the collapsed review rail now stack below each other when their anchors are closer than a marker is tall, instead of overlapping.

## 2.4.1

## 2.4.0

### Minor Changes

- 525dca9: Add public review-hook and card actions for resolving and reopening comment threads, including viewing-mode refusal state.

### Patch Changes

- 525dca9: Disable review mutation controls while a document is open for viewing instead of presenting actions the engine will refuse.

## 2.3.1

## 2.3.0

## 2.2.1

### Patch Changes

- dd78558: Allow custom Add Comment controls, review lists, card templates, and empty states to compose without replacing one another.

## 2.2.0

## 2.1.3

## 2.1.2

## 2.1.1

## 2.1.0

### Minor Changes

- 3310029: Defining a custom node is an identity, a shape and what the document shows: `defineCustomNode({ name, tagPrefix, schema, text })`. `text` replaces the `toDocx` hook that returned an attrs-and-text pair, and `tagAttrs` covers the rarer case of putting identity in the `w:tag` as well. `defineCustomNode` returns a `CustomNode` carrying `dataOf`, which narrows a node to that definition and validates its payload against that definition's schema — so a host reads a typed value from the chip, the review rail or its own state without writing a parse at the call site.
- 3310029: `defineCustomNode` takes `schema`, declaring a node's payload shape as a zod (or any Standard Schema) schema, and `preserveOnExport`, declaring whether the node survives a document leaving the system that made it.
- 3310029: A custom node can now be written with a payload: `insertCustomNode` and `updateCustomNode` take `data`, typed by the definition's `schema` and stored in a customXml data part the control binds to, so a node is no longer limited to the 64 characters `w:tag` holds. Recognition hands that payload back typed, `prepareForExport` applies `preserveOnExport`, and `customNodeXml` answers the store parts a server-side splice has to add.
- 3310029: `customNodesOf(editor)` answers every recognized custom node in the document with its payload, so reading them no longer means reaching for three engine internals. Diagnostics are now scoped to the editor whose module registered them: two editors on one page hear only their own documents, and a listener goes when its editor does.
- 7a72c42: Custom-node writes now target the story the reader is in, so a chip inside a header can be removed and updated rather than reporting that no node has that id, and all of them refuse a document open for viewing instead of editing it. The context menu reports a refused Remove through the new `onRemoveRefused` prop instead of closing with the node still there. `useStackedReviewPositions` now places an entry whose anchor has not resolved yet, matching the packaged rail. Previously such an entry was dropped and took no room; cards after it now shift down by whatever the entry reserves (its measured height, or `defaultHeight`, plus the gap).
- 3310029: Custom node writes now return the id of the control they authored, so a host can follow a node across a rewrite. Clicking a chip also activates reliably: activation is driven by the press and release rather than `click`, which the browser does not fire at all when the press repaints the control.
- 3310029: `insertCustomNode` and `updateCustomNode` now take a single input object, and a definition can declare `toDocx` to derive its tag attrs and document text from its payload — so `insertCustomNode(editor, Citation, { data })` is the whole call and the three representations of a node cannot disagree. A payload the schema rejects returns `issues` carrying each failing field's path, and `prepareForExport` takes a `destination` so one call site covers both the copy you keep and the copy that leaves.
- dbf5501: Every remaining `ep-` prefixed CSS class and keyframe is renamed to `docx-editor-`, so the whole stylesheet shares one namespace with the `.docx-editor` root class. If your own CSS targets an `.ep-*` class or the `ep-caret-blink` keyframe, switch it to the same name under `docx-editor-` (`.ep-one-surface__caret` becomes `.docx-editor-one-surface__caret`).
- 8b4830e: `useReview().accept` and `.reject` now report whether the resolution landed, like `remove` and `reply` already did. `readOnly` is not the only way the engine refuses one — a document open for viewing refuses every one — and swallowing the result left hosts rendering live buttons that did nothing when clicked.
- 21e9b30: `saveForExport(editor)` produces the copy of a document that leaves your system, applying each definition's `preserveOnExport` to every node type registered on the editor; `editor.save()` is unchanged and still keeps every node. The bytes-level entry point, for a server with no editor, is now `prepareForExport`.

### Patch Changes

- 3310029: Fixes three ways a custom node's payload could be lost: exporting a node with `preserveOnExport: false` no longer leaves its payload in a store a surviving node keeps alive, the open-time orphan sweep no longer collects a payload a header or footer still binds, and `updateCustomNode` without `data` now carries the existing payload forward instead of dropping it (pass `data: null` to remove one). A definition no longer needs a `reviewCard` for its nodes to carry `data`, and a binding naming a payload the document does not hold is reported through `onDiagnostic` rather than arriving as silence.
- 3310029: `prepareForExport` now strips every payload store for a namespace rather than the first, so a document whose nodes were authored server-side with `customNodeXml` — which writes one store per call — no longer ships the payloads of nodes it removed.
- d116599: Custom nodes can be inserted, updated and removed inside a header, footer or note, including a node carrying a payload: the control lands in that story while its customXml store stays on the main document part, where Word looks for it. Which story a write targets now comes from the node or paragraph id rather than from wherever the reader happens to be, so a caller can address a node in a story it has left. Inserting, updating and removing all refuse a document open for viewing instead of editing it — these writes go through the store, below the editing-mode gate — and report the same `locked` code the engine's own refusal uses.
- 3310029: Fixes four ways a write could lose data. `text` and `tagAttrs` now derive from the schema's output rather than the caller's argument, so a `.default()` or `.transform()` no longer writes a document describing a value it does not hold; a hook that throws is a typed refusal instead of an exception; `updateCustomNode` carries the tag attrs, the alias and the lock forward when they are not mentioned, and refuses a node belonging to another definition rather than converting it; and `prepareForExport` unwraps every story before cleaning up stores, so a chip in a header no longer ships the payload it was asked to strip.
- 8b4830e: The review rail's `structural` and `formatting` filters now also govern which changes a click in the document can activate, so clicking tracked text always opens a card the rail actually shows.
- 03f57f3: Chrome that describes the document no longer renders before one is present. The review rail keeps its empty state and host furniture off screen until a document opens instead of floating them over the loading screen, the ruler parts render nothing rather than default Letter-size ticks for a page that does not exist, and the navigation pane and document outline no longer report "no headings" about an absent document. The same applies after a parse failure or a detach, not only while loading. `useReview().ready` reports false until a document is present and the hook now re-derives when a load fails.

## 2.0.1

### Patch Changes

- Updated dependencies [51f14f5]
  - @docx-editor.dev/core@2.0.1
  - @docx-editor.dev/react@2.0.1

## 2.0.0

### Minor Changes

- 26095c6: Deleting text that carried comments or tracked changes now clears them from the review rail instead of leaving empty cards behind, matching Word: the comment record goes with the words it covered, and an untracked delete drops the `w:ins`/`w:del` it emptied. A reply to a tracked change renders inside that change's card rather than as a separate card beside it, replies included. Every card carries a delete control on the open card — it removes a comment thread, a single reply, or discards a suggestion — through the new `Editor.deleteReviewItem`, `DocxEditor.Review.Delete` and `useReview().remove`. Also fixes a card dismissed from its reply box refusing to reopen.

### Patch Changes

- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
- Updated dependencies [26095c6]
  - @docx-editor.dev/react@2.0.0
  - @docx-editor.dev/core@2.0.0
