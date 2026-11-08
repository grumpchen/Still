import {build,preview} from 'vite';
import {fileURLToPath} from 'node:url';

const configFile=fileURLToPath(new URL('./vite.config.ts',import.meta.url));
await build({configFile});
const server=await preview({configFile});
const close=()=>server.httpServer.close();
process.once('SIGINT',close);
process.once('SIGTERM',close);
