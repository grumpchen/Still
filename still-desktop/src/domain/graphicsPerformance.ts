const SOFTWARE_RENDERER_PATTERN=/swiftshader|llvmpipe|softpipe|software rasterizer/i;

export function isSoftwareGraphicsRenderer(rendererName:unknown):boolean{
 return typeof rendererName==='string'&&SOFTWARE_RENDERER_PATTERN.test(rendererName);
}
