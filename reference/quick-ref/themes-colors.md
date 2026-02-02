# DrawingML Themes & Colors Quick Reference

Extracted from ECMA-376 5th Edition - dml-main.xsd

## Theme Structure

Located in: `word/theme/theme1.xml`

```xml
<a:theme name="Office Theme">
    <a:themeElements>
        <a:clrScheme name="Office">...</a:clrScheme>
        <a:fontScheme name="Office">...</a:fontScheme>
        <a:fmtScheme name="Office">...</a:fmtScheme>
    </a:themeElements>
</a:theme>
```

---

## Color Scheme (a:clrScheme)

### Slots

| Slot        | Typical Use                        | Common Default |
| ----------- | ---------------------------------- | -------------- |
| `dk1`       | Dark text on light background      | Black (000000) |
| `lt1`       | Light background                   | White (FFFFFF) |
| `dk2`       | Secondary dark text                | Dark gray      |
| `lt2`       | Secondary light/accent background  | Light gray     |
| `accent1`   | Primary accent (links, highlights) | Blue           |
| `accent2`   | Secondary accent                   | Orange/Red     |
| `accent3`   | Tertiary accent                    | Green/Yellow   |
| `accent4-6` | Additional accents                 | Varies         |
| `hlink`     | Hyperlink color                    | Blue           |
| `folHlink`  | Followed hyperlink                 | Purple         |

### Color Definitions

```xml
<a:clrScheme name="Office">
    <!-- System colors (resolve at runtime) -->
    <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
    <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>

    <!-- Fixed RGB colors -->
    <a:dk2><a:srgbClr val="44546A"/></a:dk2>
    <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
    <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
    <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
    <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
    <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
    <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
    <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
    <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
    <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
</a:clrScheme>
```

---

## Color Types

### sRGB Color

```xml
<a:srgbClr val="FF0000"/>  <!-- Red -->
```

### System Color

```xml
<a:sysClr val="windowText" lastClr="000000"/>
```

System color values:

```
window, windowText, menuText, activeCaption, captionText,
highlight, highlightText, buttonFace, buttonText, etc.
```

### Scheme Color (reference to theme)

```xml
<a:schemeClr val="accent1"/>
```

With modifiers:

```xml
<a:schemeClr val="accent1">
    <a:tint val="50000"/>      <!-- 50% tint (lighter) -->
    <a:shade val="75000"/>     <!-- 75% shade (darker) -->
    <a:satMod val="120000"/>   <!-- 120% saturation -->
    <a:lumMod val="90000"/>    <!-- 90% luminance -->
</a:schemeClr>
```

### HSL Color

```xml
<a:hslClr hue="14400000" sat="100000" lum="50000"/>
<!-- Hue: 0-21600000 (0-360 degrees * 60000) -->
<!-- Sat/Lum: 0-100000 (0-100%) -->
```

---

## Tint and Shade Calculations

### In WordprocessingML

```xml
<w:color
    w:val="000000"
    w:themeColor="accent1"
    w:themeTint="99"    <!-- Hex 00-FF -->
    w:themeShade="80"   <!-- Hex 00-FF -->
/>
```

**themeTint calculation:**

```
finalColor = tintValue/255 * white + (1 - tintValue/255) * themeColor
```

**themeShade calculation:**

```
finalColor = shadeValue/255 * themeColor
```

### In DrawingML

Values are in 1/1000ths of a percent (0-100000):

```xml
<a:tint val="50000"/>   <!-- 50% tint -->
<a:shade val="75000"/>  <!-- 75% shade -->
```

---

## Font Scheme (a:fontScheme)

```xml
<a:fontScheme name="Office">
    <a:majorFont>  <!-- Headings -->
        <a:latin typeface="Calibri Light"/>
        <a:ea typeface=""/>      <!-- East Asian -->
        <a:cs typeface=""/>      <!-- Complex script -->
        <!-- Script-specific overrides -->
        <a:font script="Jpan" typeface="Yu Gothic Light"/>
        <a:font script="Hans" typeface="DengXian Light"/>
    </a:majorFont>
    <a:minorFont>  <!-- Body text -->
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
    </a:minorFont>
</a:fontScheme>
```

### Referencing Theme Fonts in WML

```xml
<w:rFonts
    w:asciiTheme="majorHAnsi"    <!-- Major (heading) Latin -->
    w:hAnsiTheme="majorHAnsi"
    w:eastAsiaTheme="majorEastAsia"
    w:cstheme="majorBidi"
/>
```

Theme font types:

```
majorHAnsi, majorEastAsia, majorBidi  - Heading fonts
minorHAnsi, minorEastAsia, minorBidi  - Body fonts
```

---

## Resolving Theme Colors

### Algorithm

1. Get `themeColor` attribute (e.g., "accent1")
2. Look up color in theme's `a:clrScheme`
3. If `a:sysClr`, use `lastClr` attribute
4. If `a:srgbClr`, use `val` attribute
5. Apply `themeTint` or `themeShade` if present
6. Result is final RGB color

### Example Resolution

Document has:

```xml
<w:color w:val="4472C4" w:themeColor="accent1" w:themeTint="99"/>
```

Theme has:

```xml
<a:accent1><a:srgbClr val="4472C4"/></a:accent1>
```

Resolution:

1. Base color: #4472C4 (from theme)
2. Tint: 0x99/0xFF = 60% toward white
3. Final: Lighter blue

---

## Common Office Theme Colors

| Slot     | Office 2016+   | Hex    |
| -------- | -------------- | ------ |
| dk1      | Black          | 000000 |
| lt1      | White          | FFFFFF |
| dk2      | Dark Blue-Gray | 44546A |
| lt2      | Light Gray     | E7E6E6 |
| accent1  | Blue           | 4472C4 |
| accent2  | Orange         | ED7D31 |
| accent3  | Gray           | A5A5A5 |
| accent4  | Gold           | FFC000 |
| accent5  | Light Blue     | 5B9BD5 |
| accent6  | Green          | 70AD47 |
| hlink    | Blue           | 0563C1 |
| folHlink | Purple         | 954F72 |

---

## Format Scheme (a:fmtScheme)

Contains fill, line, and effect styles:

```xml
<a:fmtScheme name="Office">
    <a:fillStyleLst>
        <a:solidFill>...</a:solidFill>
        <a:gradFill>...</a:gradFill>
    </a:fillStyleLst>
    <a:lnStyleLst>
        <a:ln>...</a:ln>
    </a:lnStyleLst>
    <a:effectStyleLst>
        <a:effectStyle>...</a:effectStyle>
    </a:effectStyleLst>
    <a:bgFillStyleLst>
        <a:solidFill>...</a:solidFill>
    </a:bgFillStyleLst>
</a:fmtScheme>
```

---

## References

- ECMA-376 Part 1, Section 20.1 (DrawingML - Main)
- dml-main.xsd: Color and theme schemas
- Microsoft [MS-OE376]: Theme implementation details
