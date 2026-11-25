import { createServer } from 'node:http';
import { loadEnvFile } from 'node:process';
import { mkdir } from 'node:fs/promises';
import { build } from 'esbuild';
try { loadEnvFile('.env'); } catch { console.error('Falta .env. Configura la conexión de Neon antes de iniciar el backend.'); process.exit(1); }
await mkdir('.local', { recursive: true });
await build({entryPoints:['netlify/functions/api.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:'.local/api.mjs',target:'node22'});
const { default: handler } = await import('../.local/api.mjs');
export const apiServer = createServer(async (req,res)=>{
  try {
    const chunks=[];let bytes=0;
    for await (const chunk of req){bytes+=chunk.length;if(bytes>100000){res.writeHead(413).end('Solicitud demasiado grande');return;}chunks.push(chunk);}
    const request=new Request(`http://127.0.0.1:5501${req.url}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)});
    const response=await handler(request);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch {res.writeHead(500,{'Content-Type':'application/json'}).end(JSON.stringify({error:'No se pudo procesar la solicitud.'}));}
}).listen(5501,'127.0.0.1',()=>console.log('Backend Moyo conectado a Neon en http://127.0.0.1:5501'));
