# OOXML Reference Documentation

Reference materials for implementing the DOCX editor.

## Folder Structure

```
reference/
├── superdoc/                     # ⚠️ LOCAL SYMLINK - Primary reference (AGPL-3.0)
├── quick-ref/                    # Human-readable quick references
│   ├── wordprocessingml.md       # Paragraphs, runs, formatting
│   └── themes-colors.md          # Theme colors, fonts
└── ecma-376/
    ├── overview.pdf              # High-level OOXML overview
    ├── part1/
    │   ├── *.pdf                 # Full spec (~5000 pages)
    │   └── schemas/
    │       ├── wml.xsd           # WordprocessingML schema
    │       └── dml-main.xsd      # DrawingML (colors, themes)
    └── part4/
        └── *.pdf                 # Transitional features
```

## Setup: SuperDoc Symlink (Local Only)

The `superdoc/` symlink is gitignored. Each developer must set it up locally:

```bash
ln -s /path/to/your/superdoc reference/superdoc
```

**⚠️ LEGAL WARNING:** SuperDoc is AGPL-3.0. Read → Close → Write Fresh. See CLAUDE.md.

## Key Files for DOCX Editing

| File           | Use For                                                             |
| -------------- | ------------------------------------------------------------------- |
| `wml.xsd`      | Document structure: `<w:p>`, `<w:r>`, `<w:t>`, `<w:rPr>`, `<w:pPr>` |
| `dml-main.xsd` | Colors, themes, fonts: `<a:clrScheme>`, `<a:fontScheme>`            |
| `overview.pdf` | Quick intro to OOXML concepts                                       |
| Part 1 PDF     | Definitive reference for all elements                               |

## Online Resources

- **ECMA-376 Official**: https://ecma-international.org/publications-and-standards/standards/ecma-376/
- **Microsoft Open Specs**: https://learn.microsoft.com/en-us/openspecs/office_standards/ms-oe376/
- **OfficeOpenXML.com**: http://officeopenxml.com/ (human-readable element docs)
- **Open XML SDK**: https://learn.microsoft.com/en-us/office/open-xml/open-xml-sdk

## Common Element Reference

### WordprocessingML (wml)

```xml
<w:document>           <!-- Root document -->
  <w:body>             <!-- Document body -->
    <w:p>              <!-- Paragraph -->
      <w:pPr>          <!-- Paragraph properties -->
        <w:jc w:val="center"/>     <!-- Alignment -->
        <w:spacing w:line="360"/>  <!-- Line spacing -->
      </w:pPr>
      <w:r>            <!-- Run (text with formatting) -->
        <w:rPr>        <!-- Run properties -->
          <w:b/>       <!-- Bold -->
          <w:i/>       <!-- Italic -->
          <w:sz w:val="24"/>       <!-- Font size (half-points) -->
          <w:color w:val="FF0000"/> <!-- Text color -->
        </w:rPr>
        <w:t>Text</w:t> <!-- Actual text content -->
      </w:r>
    </w:p>
  </w:body>
</w:document>
```

### Theme Colors (DrawingML)

```xml
<a:clrScheme name="Office">
  <a:dk1>...</a:dk1>      <!-- Dark 1 (usually black) -->
  <a:lt1>...</a:lt1>      <!-- Light 1 (usually white) -->
  <a:dk2>...</a:dk2>      <!-- Dark 2 -->
  <a:lt2>...</a:lt2>      <!-- Light 2 -->
  <a:accent1>...</a:accent1>  <!-- Accent colors 1-6 -->
  ...
</a:clrScheme>
```

### Styles (styles.xml)

```xml
<w:style w:type="paragraph" w:styleId="Heading1">
  <w:name w:val="heading 1"/>
  <w:basedOn w:val="Normal"/>
  <w:pPr>...</w:pPr>      <!-- Paragraph formatting -->
  <w:rPr>...</w:rPr>      <!-- Character formatting -->
</w:style>
```

## How to Use

1. **Quick lookup**: Check this README or `quick-ref/` markdown files
2. **Schema validation**: Use `.xsd` files to understand valid attributes
3. **Deep dive**: Search the Part 1 PDF for specific element documentation
4. **Real-world behavior**: Check Microsoft Open Specs for implementation details
