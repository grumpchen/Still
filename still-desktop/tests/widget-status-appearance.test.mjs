import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const styles=readFileSync(new URL('../src/canvas.css',import.meta.url),'utf8');

test('Tag Color Status selects use readable light and dark Liquid Glass treatments',()=>{
 assert.match(styles,/\.liquid-glass \.tag-status-color-rule select[^}]*color-scheme:light/);
 assert.match(styles,/\.liquid-glass\.dark \.tag-status-color-rule select[^}]*color-scheme:dark/);
 assert.match(styles,/\.liquid-glass \.tag-status-color-rule select[^}]*background:rgb\(255 255 255 \/ [^)]*\)/);
 assert.match(styles,/\.liquid-glass\.dark \.tag-status-color-rule select[^}]*background:rgb\(9 22 13 \/ [^)]*\)/);
});
