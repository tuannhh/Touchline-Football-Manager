import { defineConfig } from 'vite';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 esbuild:{jsx:'automatic',jsxImportSource:'touchline-localized'},
 resolve:{alias:{
  'touchline-localized/jsx-runtime':fileURLToPath(new URL('./src/localized-jsx-runtime.mjs',import.meta.url)),
  'touchline-localized/jsx-dev-runtime':fileURLToPath(new URL('./src/localized-jsx-dev-runtime.mjs',import.meta.url)),
  'touchline-localized':fileURLToPath(new URL('./src/localized-react.mjs',import.meta.url)),
 }},
 server:{proxy:{'/api':'http://127.0.0.1:4179'}},
});
