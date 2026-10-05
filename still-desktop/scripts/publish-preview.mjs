import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=path.resolve(root,'../../outputs');
await mkdir(destination,{recursive:true});
await cp(path.join(root,'dist/design-preview.html'),path.join(destination,'design-preview.html'));
await cp(path.join(root,'dist/assets'),path.join(destination,'assets'),{recursive:true});
console.log('Published React preview to '+destination);
