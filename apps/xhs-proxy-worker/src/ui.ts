export const UI_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>XHS Research Console</title>
  <style>
    :root{color-scheme:dark;--bg:#090b10;--card:#141821;--line:#292f3c;--ink:#f5f7fb;--muted:#98a2b3;--red:#ff3158;--green:#4ade80}
    *{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 75% 0,#351522 0,transparent 30%),var(--bg);color:var(--ink);font:15px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}
    main{width:min(1080px,calc(100% - 32px));margin:0 auto;padding:56px 0 80px}
    header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:32px}
    h1{font-size:clamp(32px,6vw,58px);line-height:1;letter-spacing:-.045em;margin:0 0 14px}.lede{color:var(--muted);max-width:620px;margin:0}
    .pill{border:1px solid var(--line);background:#10141b;border-radius:99px;padding:8px 12px;white-space:nowrap}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--muted);margin-right:7px}.dot.on{background:var(--green);box-shadow:0 0 12px var(--green)}
    .grid{display:grid;grid-template-columns:330px 1fr;gap:18px}.card{background:color-mix(in srgb,var(--card) 92%,transparent);border:1px solid var(--line);border-radius:18px;padding:22px;box-shadow:0 22px 60px #0004}
    h2{font-size:17px;margin:0 0 8px}.muted{color:var(--muted);font-size:13px}.qr{width:100%;aspect-ratio:1;background:#fff;border-radius:12px;display:none;margin:18px 0;object-fit:contain}
    button,input{font:inherit;border-radius:11px;border:1px solid var(--line)}button{cursor:pointer;background:var(--red);color:#fff;font-weight:700;padding:11px 15px;border-color:transparent}button:disabled{opacity:.55;cursor:wait}
    .search{display:flex;gap:9px;margin:18px 0 22px}.search input{min-width:0;flex:1;background:#0d1016;color:var(--ink);padding:12px 14px;outline:none}.search input:focus{border-color:#667085}
    .results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.result{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#0e1219}.result img{width:100%;aspect-ratio:4/3;object-fit:cover;background:#202632}.result-body{padding:13px}.result h3{font-size:15px;line-height:1.35;margin:0 0 7px}.empty{color:var(--muted);padding:34px 0;text-align:center}
    pre{white-space:pre-wrap;word-break:break-word;color:#fda4af;background:#190e13;border-radius:10px;padding:12px;font-size:12px}
    @media(max-width:760px){header{display:block}.pill{display:inline-block;margin-top:20px}.grid{grid-template-columns:1fr}.results{grid-template-columns:1fr}}
  </style>
</head>
<body><main>
  <header><div><h1>Real conversations,<br>found faster.</h1><p class="lede">Search Xiaohongshu research from the dedicated Azure service. Authenticate once, then query live posts for Bay Area property signals and community discussion.</p></div><div class="pill"><span id="dot" class="dot"></span><span id="status">Checking session…</span></div></header>
  <div class="grid">
    <section class="card"><h2>Xiaohongshu session</h2><p class="muted">Open Xiaohongshu on your phone and scan this code. The session is stored only on the dedicated VM.</p><img id="qr" class="qr" alt="Xiaohongshu login QR code"><button id="login">Generate login code</button><p id="loginNote" class="muted"></p></section>
    <section class="card"><h2>Live search</h2><p class="muted">Try a neighborhood, address, school district, offer, or pending-price topic.</p><form id="form" class="search"><input id="query" value="湾区买房 offer pending price" aria-label="Search query"><button id="search">Search</button></form><div id="results" class="empty">Results will appear here.</div></section>
  </div>
</main>
<script>
const $=id=>document.getElementById(id);
let poll;
async function status(full=false){
  try{const r=await fetch('/api/v1/login/status'+(full?'?full=true':''));const j=await r.json();const on=!!j.data?.is_logged_in;$('status').textContent=on?'Session ready':'Login required';$('dot').classList.toggle('on',on);return on}catch(e){$('status').textContent='Service unavailable';return false}
}
$('login').onclick=async()=>{
  const started=Date.now();
  $('login').disabled=true;$('loginNote').textContent='Creating a fresh code…';
  try{const r=await fetch('/api/v1/login/qrcode');const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||'Could not create code');if(j.data.is_logged_in){$('loginNote').textContent='Already logged in.';await status();return}
    $('qr').src=j.data.img;$('qr').style.display='block';$('loginNote').textContent='Scan within '+j.data.timeout+'. The code will remain visible until this login is saved.';clearInterval(poll);poll=setInterval(async()=>{try{const r=await fetch('/api/v1/login/status?changed_since='+started);const s=await r.json();if(s.data?.is_logged_in){clearInterval(poll);$('status').textContent='Session ready';$('dot').classList.add('on');$('loginNote').textContent='Login saved. Search is ready.';$('qr').style.display='none'}}catch(e){}},3000);
  }catch(e){$('loginNote').textContent=e.message}finally{$('login').disabled=false}
};
$('form').onsubmit=async e=>{
  e.preventDefault();$('search').disabled=true;$('results').className='empty';$('results').textContent='Searching live XHS posts…';
  try{const r=await fetch('/api/v1/feeds/search',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({keyword:$('query').value.trim()})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.message||j.error||'Search failed');
    const feeds=j.data?.feeds||[];$('results').className='results';$('results').textContent='';
    if(!feeds.length){$('results').className='empty';$('results').textContent='No posts found for this query.';return}
    feeds.forEach(f=>{const n=f.noteCard||f.note_card||f;const el=document.createElement('article');el.className='result';const img=n.cover?.urlDefault||n.cover?.url_default||n.cover?.url||n.image_list?.[0]?.url_default;if(img){const im=document.createElement('img');im.src=img;im.loading='lazy';el.appendChild(im)}const body=document.createElement('div');body.className='result-body';const h=document.createElement('h3');h.textContent=n.displayTitle||n.display_title||n.title||'Untitled post';body.appendChild(h);const meta=document.createElement('div');meta.className='muted';meta.textContent=n.user?.nickname||n.user?.nick_name||'Xiaohongshu';body.appendChild(meta);el.appendChild(body);$('results').appendChild(el)})
  }catch(e){$('results').className='';$('results').innerHTML='<pre></pre>';$('results').firstChild.textContent=e.message}finally{$('search').disabled=false}
};
status();
</script></body></html>`;
