/** Still's vector mark: brushed-metal rails around a clear glass pane. */
export default function BrandMark(){
 return <svg className="brand-mark-art" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
  <defs>
   <linearGradient id="still-metal" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stopColor="#dce4e8"/><stop offset=".2" stopColor="#66747d"/><stop offset=".44" stopColor="#f7fbfc"/><stop offset=".68" stopColor="#78878f"/><stop offset="1" stopColor="#e4eaed"/>
   </linearGradient>
   <linearGradient id="still-glass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stopColor="#fff" stopOpacity=".48"/><stop offset=".5" stopColor="#b9d6dc" stopOpacity=".12"/><stop offset="1" stopColor="#fff" stopOpacity=".24"/>
   </linearGradient>
   <pattern id="still-brush" width="2" height="4" patternUnits="userSpaceOnUse">
    <path d="M.25 0v4" stroke="#fff" strokeOpacity=".22" strokeWidth=".35"/>
    <path d="M1.25 0v4" stroke="#24343a" strokeOpacity=".14" strokeWidth=".3"/>
   </pattern>
   <clipPath id="still-rail-clip"><rect x="2" y="4" width="7" height="24" rx="3.5"/><rect x="23" y="8" width="7" height="20" rx="3.5"/></clipPath>
  </defs>
  <g fill="url(#still-metal)">
   <rect x="2" y="4" width="7" height="24" rx="3.5"/>
   <rect x="23" y="8" width="7" height="20" rx="3.5"/>
  </g>
  <g fill="url(#still-brush)" clipPath="url(#still-rail-clip)">
   <rect x="2" y="4" width="7" height="24" rx="3.5"/>
   <rect x="23" y="8" width="7" height="20" rx="3.5"/>
  </g>
  <rect x="11" y="7" width="10" height="21" rx="3.5" fill="url(#still-glass)" stroke="url(#still-metal)" strokeWidth="1.5"/>
  <path d="M13.2 10h5.6v15h-5.6z" fill="#d9f0f2" fillOpacity=".08" stroke="#fff" strokeOpacity=".32" strokeWidth=".55"/>
  <path d="M12 8.6h8" stroke="#fff" strokeOpacity=".7" strokeWidth=".65" strokeLinecap="round"/>
 </svg>;
}
