export const AKO_URL = 'https://learn.canterbury.ac.nz/';
export const GOOGLE_URL = 'https://www.google.com/';
export const AKO_DASHBOARD = 'https://learn.canterbury.ac.nz/my/';
export function browserDestination(value: string): string {
  const input=value.trim();
  if(!input||input.length>4096)throw new Error('Enter a website address or search');
  if(/^[a-z][a-z0-9+.-]*:/i.test(input))return normalizeUrl(input);
  if(!/\s/.test(input)&&(input.includes('.')||input.includes('/')||input==='localhost'))return normalizeUrl(input);
  return 'https://www.google.com/search?q='+encodeURIComponent(input);
}
export function normalizeUrl(value: string): string {
  const input = value.trim();
  if (!input || input.length > 4096) throw new Error('Enter a website address');
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(input) ? input : 'https://' + input;
  let url: URL; try { url = new URL(candidate); } catch { throw new Error('Enter a valid website address'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Use an HTTPS address without embedded credentials');
  return url.href;
}
