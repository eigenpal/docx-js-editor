# Ralph Agent Configuration

## Build Instructions

```bash
# Install dependencies
bun install

# Build the library
bun run build

# Or just build without CSS (faster for testing)
bunx tsup
```

## Test Instructions

```bash
# Run tests
bun test

# Run tests in watch mode
bun test --watch
```

## Run Instructions

```bash
# Start the dev server with demo app
bun run dev

# Or serve demo directly
bun --hot demo/main.tsx
```

## Verify Command

```bash
# Full verification (install, test, build)
bun install && bun test && bun run build
```

## Notes
- Package name: @eigenpal/docx-editor
- Build output: dist/
- Uses ProseMirror for editing
- Uses JSZip for DOCX handling
- Uses Tailwind CSS for styling
