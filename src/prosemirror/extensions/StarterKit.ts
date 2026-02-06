/**
 * StarterKit — bundles all extensions into a ready-to-use set
 *
 * Usage:
 *   const extensions = createStarterKit();
 *   const manager = new ExtensionManager(extensions);
 *   manager.buildSchema();
 *   manager.initializeRuntime();
 */

import type { AnyExtension } from './types';
import type { SelectionChangeCallback } from '../plugins/selectionTracker';

// Core
import { DocExtension } from './core/DocExtension';
import { TextExtension } from './core/TextExtension';
import { ParagraphExtension } from './core/ParagraphExtension';
import { HistoryExtension } from './core/HistoryExtension';

// Marks
import { BoldExtension } from './marks/BoldExtension';
import { ItalicExtension } from './marks/ItalicExtension';
import { UnderlineExtension } from './marks/UnderlineExtension';
import { StrikeExtension } from './marks/StrikeExtension';
import { TextColorExtension } from './marks/TextColorExtension';
import { HighlightExtension } from './marks/HighlightExtension';
import { FontSizeExtension } from './marks/FontSizeExtension';
import { FontFamilyExtension } from './marks/FontFamilyExtension';
import { SuperscriptExtension } from './marks/SuperscriptExtension';
import { SubscriptExtension } from './marks/SubscriptExtension';
import { HyperlinkExtension } from './marks/HyperlinkExtension';
import { AllCapsExtension } from './marks/AllCapsExtension';
import { SmallCapsExtension } from './marks/SmallCapsExtension';
import { FootnoteRefExtension } from './marks/FootnoteRefExtension';

// Nodes
import { HardBreakExtension } from './nodes/HardBreakExtension';
import { TabExtension } from './nodes/TabExtension';
import { ImageExtension } from './nodes/ImageExtension';
import { HorizontalRuleExtension } from './nodes/HorizontalRuleExtension';
import { createTableExtensions } from './nodes/TableExtension';

// Features
import { ListExtension } from './features/ListExtension';
import { BaseKeymapExtension } from './features/BaseKeymapExtension';
import { SelectionTrackerExtension } from './features/SelectionTrackerExtension';

export interface StarterKitOptions {
  /** Extensions to disable by name */
  disable?: string[];
  /** History depth (default: 100) */
  historyDepth?: number;
  /** History new group delay (default: 500) */
  historyNewGroupDelay?: number;
  /** Selection change callback */
  onSelectionChange?: SelectionChangeCallback;
}

/**
 * Create the full set of extensions for the DOCX editor
 */
export function createStarterKit(options: StarterKitOptions = {}): AnyExtension[] {
  const disabled = new Set(options.disable || []);

  const extensions: AnyExtension[] = [];

  function add(name: string, ext: AnyExtension): void {
    if (!disabled.has(name)) {
      extensions.push(ext);
    }
  }

  // Core (always included unless explicitly disabled)
  add('doc', DocExtension());
  add('text', TextExtension());
  add('paragraph', ParagraphExtension());
  add(
    'history',
    HistoryExtension({
      depth: options.historyDepth,
      newGroupDelay: options.historyNewGroupDelay,
    })
  );

  // Marks
  add('bold', BoldExtension());
  add('italic', ItalicExtension());
  add('underline', UnderlineExtension());
  add('strike', StrikeExtension());
  add('textColor', TextColorExtension());
  add('highlight', HighlightExtension());
  add('fontSize', FontSizeExtension());
  add('fontFamily', FontFamilyExtension());
  add('superscript', SuperscriptExtension());
  add('subscript', SubscriptExtension());
  add('hyperlink', HyperlinkExtension());
  add('allCaps', AllCapsExtension());
  add('smallCaps', SmallCapsExtension());
  add('footnoteRef', FootnoteRefExtension());

  // Nodes
  add('hardBreak', HardBreakExtension());
  add('tab', TabExtension());
  add('image', ImageExtension());
  add('horizontalRule', HorizontalRuleExtension());

  // Table (5 extensions grouped)
  if (!disabled.has('table')) {
    extensions.push(...createTableExtensions());
  }

  // Features
  add('list', ListExtension());
  add('baseKeymap', BaseKeymapExtension());
  add(
    'selectionTracker',
    SelectionTrackerExtension({
      onSelectionChange: options.onSelectionChange,
    })
  );

  return extensions;
}
