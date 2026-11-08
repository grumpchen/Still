import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {resolve} from 'node:path';

export default defineConfig({
 plugins:[react()],
 base:'./',
 build:{outDir:'node_modules/.cache/still-pdf-e2e',emptyOutDir:true,rollupOptions:{input:{'tests/e2e/fixtures/pdf-viewer':resolve('tests/e2e/fixtures/pdf-viewer.html')}}},
 preview:{host:'127.0.0.1',port:4174,strictPort:true},
});
