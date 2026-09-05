---
'@docx-editor.dev/core': patch
---

Preserve content-aligned geometry for a narrowly identified class of legacy full-width inline tables. Explicit Word compatibility modes 11, 12 and 14 now reach the shared browser/export layout input and invalidate cached geometry when changed. When the complete authored grid confirms the text-column width plus the outer cell margins, use that reference width for the existing cell-width reconciliation and position the grid at the content edge. Avoid counting supported thin horizontal cell borders twice inside those tables. Modern, unspecified, floating, nested and other unsupported table geometries retain their existing behavior; authored OOXML is unchanged.
