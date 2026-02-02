# WordprocessingML Quick Reference

Extracted from ECMA-376 5th Edition - Part 1

## Document Structure

```
document.xml
└── w:document
    └── w:body
        ├── w:p (paragraph)
        │   ├── w:pPr (paragraph properties)
        │   └── w:r (run)
        │       ├── w:rPr (run properties)
        │       └── w:t (text)
        ├── w:tbl (table)
        └── w:sectPr (section properties)
```

---

## Run Properties (w:rPr) - Character Formatting

| Element                             | Description              | Example                                |
| ----------------------------------- | ------------------------ | -------------------------------------- |
| `<w:b/>`                            | Bold                     | `<w:b/>` or `<w:b w:val="true"/>`      |
| `<w:i/>`                            | Italic                   | `<w:i/>`                               |
| `<w:u w:val="single"/>`             | Underline                | See underline types below              |
| `<w:strike/>`                       | Strikethrough            |                                        |
| `<w:dstrike/>`                      | Double strikethrough     |                                        |
| `<w:caps/>`                         | All caps                 |                                        |
| `<w:smallCaps/>`                    | Small caps               |                                        |
| `<w:sz w:val="24"/>`                | Font size                | Value in half-points (24 = 12pt)       |
| `<w:szCs w:val="24"/>`              | Complex script font size |                                        |
| `<w:color w:val="FF0000"/>`         | Text color               | Hex RGB                                |
| `<w:color w:themeColor="accent1"/>` | Theme color              | See theme colors                       |
| `<w:highlight w:val="yellow"/>`     | Highlight color          | See highlight colors                   |
| `<w:rFonts w:ascii="Arial"/>`       | Font family              | See fonts section                      |
| `<w:vertAlign w:val="subscript"/>`  | Subscript/superscript    | `subscript`, `superscript`, `baseline` |
| `<w:vanish/>`                       | Hidden text              |                                        |
| `<w:shd w:fill="FFFF00"/>`          | Shading/background       |                                        |

### Underline Types (ST_Underline)

```
single, words, double, thick, dotted, dottedHeavy, dash, dashedHeavy,
dashLong, dashLongHeavy, dotDash, dashDotHeavy, dotDotDash,
dashDotDotHeavy, wave, wavyHeavy, wavyDouble, none
```

### Highlight Colors (ST_HighlightColor)

```
black, blue, cyan, green, magenta, red, yellow, white,
darkBlue, darkCyan, darkGreen, darkMagenta, darkRed, darkYellow,
darkGray, lightGray, none
```

---

## Paragraph Properties (w:pPr)

| Element                        | Description              | Values                                     |
| ------------------------------ | ------------------------ | ------------------------------------------ |
| `<w:jc w:val="center"/>`       | Alignment                | `start`, `center`, `end`, `both` (justify) |
| `<w:pStyle w:val="Heading1"/>` | Paragraph style          | Style ID from styles.xml                   |
| `<w:spacing/>`                 | Line/paragraph spacing   | See spacing details                        |
| `<w:ind/>`                     | Indentation              | See indentation details                    |
| `<w:numPr/>`                   | Numbering (lists)        | Links to numbering.xml                     |
| `<w:pBdr/>`                    | Paragraph borders        |                                            |
| `<w:shd/>`                     | Paragraph shading        |                                            |
| `<w:keepNext/>`                | Keep with next paragraph |                                            |
| `<w:keepLines/>`               | Keep lines together      |                                            |
| `<w:pageBreakBefore/>`         | Page break before        |                                            |
| `<w:outlineLvl w:val="0"/>`    | Outline level            | 0-8 (for headings)                         |

### Justification/Alignment (ST_Jc)

```
start    - Left aligned (LTR) / Right aligned (RTL)
center   - Center aligned
end      - Right aligned (LTR) / Left aligned (RTL)
both     - Justified
distribute - Distributed (East Asian)
```

### Spacing (w:spacing)

```xml
<w:spacing
    w:before="240"      <!-- Space before (twips, 240 = 12pt) -->
    w:after="200"       <!-- Space after (twips) -->
    w:line="276"        <!-- Line height -->
    w:lineRule="auto"   <!-- auto, exact, atLeast -->
/>
```

**Line spacing values:**

- `lineRule="auto"`: line value is in 240ths of a line (240 = single, 360 = 1.5, 480 = double)
- `lineRule="exact"`: line value is exact height in twips
- `lineRule="atLeast"`: line value is minimum height in twips

### Indentation (w:ind)

```xml
<w:ind
    w:left="720"        <!-- Left indent (twips, 720 = 0.5 inch) -->
    w:right="720"       <!-- Right indent -->
    w:firstLine="720"   <!-- First line indent -->
    w:hanging="360"     <!-- Hanging indent (mutually exclusive with firstLine) -->
/>
```

---

## Font Properties (w:rFonts)

```xml
<w:rFonts
    w:ascii="Arial"           <!-- Latin text -->
    w:hAnsi="Arial"           <!-- High ANSI (extended Latin) -->
    w:eastAsia="MS Gothic"    <!-- East Asian text -->
    w:cs="Arial"              <!-- Complex script (Arabic, Hebrew) -->
    w:asciiTheme="minorHAnsi" <!-- Theme font reference -->
/>
```

### Theme Font References

```
majorHAnsi, majorEastAsia, majorBidi  - Heading fonts
minorHAnsi, minorEastAsia, minorBidi  - Body fonts
```

---

## Colors

### Direct Color

```xml
<w:color w:val="FF0000"/>  <!-- Red in hex RGB -->
<w:color w:val="auto"/>    <!-- Automatic (usually black) -->
```

### Theme Color

```xml
<w:color
    w:val="000000"           <!-- Fallback color -->
    w:themeColor="accent1"   <!-- Theme color slot -->
    w:themeTint="99"         <!-- Lighter (00-FF) -->
    w:themeShade="80"        <!-- Darker (00-FF) -->
/>
```

### Theme Color Slots (ST_ThemeColor)

```
dk1, lt1           - Dark 1 (text), Light 1 (background)
dk2, lt2           - Dark 2, Light 2
accent1-accent6    - Accent colors
hlink, folHlink    - Hyperlink, followed hyperlink
```

---

## Lists/Numbering

### In paragraph (w:numPr)

```xml
<w:pPr>
    <w:numPr>
        <w:ilvl w:val="0"/>      <!-- Indentation level (0-8) -->
        <w:numId w:val="1"/>     <!-- Reference to numbering.xml -->
    </w:numPr>
</w:pPr>
```

### In numbering.xml

```xml
<w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0">
        <w:start w:val="1"/>
        <w:numFmt w:val="bullet"/>  <!-- bullet, decimal, lowerLetter, etc. -->
        <w:lvlText w:val=""/>      <!-- Bullet character or format string -->
        <w:lvlJc w:val="left"/>
        <w:pPr>...</w:pPr>          <!-- Paragraph formatting -->
        <w:rPr>...</w:rPr>          <!-- Run formatting for number/bullet -->
    </w:lvl>
</w:abstractNum>

<w:num w:numId="1">
    <w:abstractNumId w:val="0"/>
</w:num>
```

### Number Formats (ST_NumberFormat)

```
decimal, upperRoman, lowerRoman, upperLetter, lowerLetter,
bullet, none, ordinal, cardinalText, ordinalText
```

---

## Tables

### Basic Structure

```xml
<w:tbl>
    <w:tblPr>                    <!-- Table properties -->
        <w:tblW w:w="5000" w:type="pct"/>  <!-- Width: 50% -->
        <w:jc w:val="center"/>   <!-- Table alignment -->
        <w:tblBorders>...</w:tblBorders>
    </w:tblPr>
    <w:tblGrid>
        <w:gridCol w:w="2880"/>  <!-- Column width in twips -->
    </w:tblGrid>
    <w:tr>                       <!-- Table row -->
        <w:trPr>...</w:trPr>     <!-- Row properties -->
        <w:tc>                   <!-- Table cell -->
            <w:tcPr>             <!-- Cell properties -->
                <w:tcW w:w="2880" w:type="dxa"/>
                <w:shd w:fill="CCCCCC"/>  <!-- Cell shading -->
                <w:vMerge w:val="restart"/> <!-- Vertical merge -->
                <w:gridSpan w:val="2"/>     <!-- Column span -->
            </w:tcPr>
            <w:p>...</w:p>       <!-- Cell content (paragraphs) -->
        </w:tc>
    </w:tr>
</w:tbl>
```

---

## Units

| Unit        | Description            | Conversion          |
| ----------- | ---------------------- | ------------------- |
| Twips       | 1/20th of a point      | 1440 twips = 1 inch |
| Half-points | Font size unit         | 24 = 12pt           |
| EMUs        | English Metric Units   | 914400 = 1 inch     |
| 50ths of %  | Table width percentage | 5000 = 100%         |
| 240ths      | Line spacing (auto)    | 240 = single line   |

---

## Common Patterns

### Bold and Italic Text

```xml
<w:r>
    <w:rPr>
        <w:b/>
        <w:i/>
    </w:rPr>
    <w:t>Bold and italic</w:t>
</w:r>
```

### Colored Heading

```xml
<w:p>
    <w:pPr>
        <w:pStyle w:val="Heading1"/>
        <w:jc w:val="center"/>
    </w:pPr>
    <w:r>
        <w:rPr>
            <w:color w:themeColor="accent1"/>
        </w:rPr>
        <w:t>Chapter Title</w:t>
    </w:r>
</w:p>
```

### Bulleted List Item

```xml
<w:p>
    <w:pPr>
        <w:numPr>
            <w:ilvl w:val="0"/>
            <w:numId w:val="1"/>
        </w:numPr>
    </w:pPr>
    <w:r>
        <w:t>List item text</w:t>
    </w:r>
</w:p>
```

---

## References

- ECMA-376 Part 1: Full specification (5000+ pages)
- wml.xsd: XML Schema for validation
- Microsoft [MS-OE376]: Implementation notes
