import { defineConfig } from 'tsup';

export default defineConfig([
  // Main builds (without shebang)
  {
    entry: {
      index: 'src/index.ts',
      headless: 'src/headless.ts',
      'core-plugins': 'src/core-plugins/index.ts',
      mcp: 'src/mcp/index.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom'],
    injectStyle: false,
  },
  // CLI build (with shebang)
  {
    entry: {
      'mcp-cli': 'src/mcp/cli.ts',
    },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false, // Don't clean since main build already did
    external: ['react', 'react-dom'],
    injectStyle: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
