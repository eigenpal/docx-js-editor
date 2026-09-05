// Shared style/numbering assembly for browser layout and headless exporters.

import type { HeadlessDocumentView, OoxmlElement } from '@docx-editor.dev/core/store';
import { buildNumberingIndex, type NumberingIndex } from './numbering-index.ts';
import { defaultTabIntervalFromSettings } from './paragraph-tabs.ts';
import { compatibilityModeFromSettings } from './document-compatibility-mode.ts';
import { buildStyleCascadeTable, type StyleCascadeTable } from './style-cascade.ts';

/** Memoized style inputs shared by every story in one document view. @public */
export interface DocumentStyleDependencies {
  readonly styleCascade: () => StyleCascadeTable | undefined;
  readonly defaultTabStopPt: () => number;
  readonly compatibilityMode: () => number | undefined;
  readonly numberingIndex: () => NumberingIndex;
}

/** Build the cascade and numbering projections layout consumes. @public */
export function createDocumentStyleDependencies(
  view: HeadlessDocumentView
): DocumentStyleDependencies {
  let numberingRoot: OoxmlElement | null | undefined;
  let numbering: NumberingIndex | undefined;
  let stylesRoot: OoxmlElement | null | undefined;
  let styleThemeMajor: string | null | undefined;
  let styleThemeMinor: string | null | undefined;
  let styleThemeMajorEastAsia: string | null | undefined;
  let styleThemeMinorEastAsia: string | null | undefined;
  let styles: StyleCascadeTable | undefined;
  let settingsRoot: OoxmlElement | null | undefined;
  let defaultTabStopPt: number | undefined;
  let compatibilityRoot: OoxmlElement | null | undefined;
  let compatibilityMode: number | undefined;
  return {
    styleCascade() {
      const current = view.stylesRoot();
      const theme = view.documentThemeFonts();
      if (
        styles === undefined ||
        current !== stylesRoot ||
        theme.major !== styleThemeMajor ||
        theme.minor !== styleThemeMinor ||
        theme.majorEastAsia !== styleThemeMajorEastAsia ||
        theme.minorEastAsia !== styleThemeMinorEastAsia
      ) {
        stylesRoot = current;
        styleThemeMajor = theme.major;
        styleThemeMinor = theme.minor;
        styleThemeMajorEastAsia = theme.majorEastAsia;
        styleThemeMinorEastAsia = theme.minorEastAsia;
        styles = buildStyleCascadeTable(current, theme);
      }
      return styles;
    },
    defaultTabStopPt() {
      const current = view.settingsRoot();
      if (defaultTabStopPt === undefined || current !== settingsRoot) {
        settingsRoot = current;
        defaultTabStopPt = defaultTabIntervalFromSettings(current);
      }
      return defaultTabStopPt;
    },
    compatibilityMode() {
      const current = view.settingsRoot();
      if (current !== compatibilityRoot) {
        compatibilityRoot = current;
        compatibilityMode = compatibilityModeFromSettings(current);
      }
      return compatibilityMode;
    },
    numberingIndex() {
      const current = view.numberingRoot();
      if (numbering === undefined || current !== numberingRoot) {
        numberingRoot = current;
        numbering = buildNumberingIndex(current);
      }
      return numbering;
    },
  };
}
