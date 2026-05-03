import os
import re

def get_depth(file_path):
    parts = file_path.replace('\\', '/').split('/')
    depth = len(parts) - 1
    return '../' * depth if depth > 0 else ''

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'id="hamWrap"' in content and file_path != 'generator/index.html':
        print(f"Skipping {file_path}, already has hamWrap")
        return

    depth_str = get_depth(file_path)
    
    # Common HTML to inject
    overlay_html = f"""
<!-- ── HAMBURGER MENU ── -->
<div class="overlay" id="overlay"></div>
<div class="drawer" id="drawer">
  <a href="{depth_str}generator/index.html"><span class="d-name">Generator</span><span class="d-arr">→</span></a>
  <a href="{depth_str}gallery/index.html"><span class="d-name">Gallery</span><span class="d-arr">→</span></a>
  <a href="{depth_str}models/guitar/index.html"><span class="d-name">Catalog</span><span class="d-arr">→</span></a>
  <a href="{depth_str}custom/index.html"><span class="d-name">Custom Order</span><span class="d-arr">→</span></a>
  <a href="{depth_str}pricing/index.html"><span class="d-name">Pricing</span><span class="d-arr">→</span></a>
  <a href="{depth_str}picks/krystal/index.html"><span class="d-name">Krystal Plectrum</span><span class="d-arr">→</span></a>
  <a href="{depth_str}picks/vortex/index.html"><span class="d-name">Vortex Plectrum</span><span class="d-arr">→</span></a>
  <a href="{depth_str}cases/index.html"><span class="d-name">Fretboard Cases</span><span class="d-arr">→</span></a>
  <a href="{depth_str}keyboards/index.html"><span class="d-name">Keyboards</span><span class="d-arr">→</span></a>
  <a href="{depth_str}pedal/index.html"><span class="d-name">Effects Pedals</span><span class="d-arr">→</span></a>
  <a href="{depth_str}about/index.html"><span class="d-name">About GTI</span><span class="d-arr">→</span></a>
  <a href="{depth_str}contact/index.html"><span class="d-name">Contact</span><span class="d-arr">→</span></a>
</div>
"""
    nav_html = f"""
<nav id="nav" class="gti-nav">
  <a href="{depth_str}index.html"><img src="{depth_str}assets/images/logo.png" alt="GTI" class="nav-logo"></a>
  <div class="ham-wrap" id="hamWrap">
    <button class="ham" id="ham" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>
"""
    js_html = """
<script>
// ── HAMBURGER MENU JS ──
(function(){
  const hamWrap=document.getElementById('hamWrap');
  const ham=document.getElementById('ham');
  const drawer=document.getElementById('drawer');
  const overlay=document.getElementById('overlay');
  if(!hamWrap || !ham || !drawer || !overlay) return;
  let closeTimer=null;
  function openDrawer(){
    clearTimeout(closeTimer);
    drawer.classList.add('open');
    overlay.classList.add('visible');
    ham.classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    closeTimer=setTimeout(()=>{
      drawer.classList.remove('open');
      overlay.classList.remove('visible');
      ham.classList.remove('open');
      document.body.style.overflow='';
    },120);
  }
  hamWrap.addEventListener('mouseenter', openDrawer);
  hamWrap.addEventListener('mouseleave', closeDrawer);
  drawer.addEventListener('mouseenter', ()=>clearTimeout(closeTimer));
  drawer.addEventListener('mouseleave', closeDrawer);
  overlay.addEventListener('click', closeDrawer);
})();
</script>
"""
    css_html = """
<style>
/* ── HAMBURGER MENU CSS ── */
.gti-nav {
  position:fixed;top:0;left:0;right:0;z-index:200;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 40px;
  height:64px;
  background:rgba(10,10,8,.96);
  backdrop-filter:blur(12px);
  border-bottom:1px solid #1e1d1b;
  box-sizing: border-box;
}
.nav-logo { height:32px; mix-blend-mode:screen; }

.ham-wrap { position:relative; width:52px; height:52px; z-index:300; }
.ham-wrap::after { content:''; position:fixed; top:0; right:0; width:372px; height:100vh; pointer-events:none; }
.ham-wrap:hover::after, .ham-wrap.active::after { pointer-events:all; }
.ham { display:flex; flex-direction:column; justify-content:center; align-items:flex-end; gap:8px; width:52px; height:52px; cursor:pointer; background:none; border:none; padding:12px; }
.ham span { display:block; width:100%; height:1px; background:#f0ede6; transition:transform .35s cubic-bezier(.16,1,.3,1),opacity .25s; transform-origin:center; }
.ham.open span:nth-child(1) { transform:translateY(8px) rotate(45deg); }
.ham.open span:nth-child(2) { opacity:0; transform:scaleX(0); }
.ham.open span:nth-child(3) { transform:translateY(-8px) rotate(-45deg); }

.overlay { position:fixed; inset:0; z-index:240; background:rgba(0,0,0,.55); opacity:0; pointer-events:none; transition:opacity .4s; }
.overlay.visible { opacity:1; pointer-events:all; }

.drawer { position:fixed; top:0; right:0; width:320px; height:100vh; background:#0d0d0b; border-left:1px solid #1e1d1b; z-index:250; display:flex; flex-direction:column; justify-content:center; padding:80px 0; transform:translateX(100%); transition:transform .5s cubic-bezier(.16,1,.3,1); box-sizing: border-box; }
.drawer.open { transform:translateX(0); }
.drawer a { position:relative; display:flex; align-items:center; justify-content:space-between; padding:15px 40px; border-bottom:1px solid #1e1d1b; text-decoration:none; overflow:hidden; opacity:0; transform:translateX(16px); transition:background .25s,opacity .4s cubic-bezier(.16,1,.3,1),transform .4s cubic-bezier(.16,1,.3,1); }
.drawer a:first-child { border-top:1px solid #1e1d1b; }
.drawer a::after { content:''; position:absolute; bottom:0; left:0; right:0; height:1px; background:#6b21d6; transform:scaleX(0); transform-origin:left; transition:transform .4s cubic-bezier(.16,1,.3,1); }
.drawer a:hover { background:rgba(107,33,214,.07); }
.drawer a:hover::after { transform:scaleX(1); }
.drawer.open a { opacity:1; transform:translateX(0); }
.drawer.open a:nth-child(1) { transition-delay:.04s; }
.drawer.open a:nth-child(2) { transition-delay:.07s; }
.drawer.open a:nth-child(3) { transition-delay:.10s; }
.drawer.open a:nth-child(4) { transition-delay:.13s; }
.drawer.open a:nth-child(5) { transition-delay:.16s; }
.drawer.open a:nth-child(6) { transition-delay:.19s; }
.drawer.open a:nth-child(7) { transition-delay:.22s; }
.drawer.open a:nth-child(8) { transition-delay:.25s; }
.drawer.open a:nth-child(9) { transition-delay:.28s; }
.drawer.open a:nth-child(10) { transition-delay:.31s; }
.drawer.open a:nth-child(11) { transition-delay:.34s; }
.drawer.open a:nth-child(12) { transition-delay:.37s; }
.d-name { font-family:'Libre Baskerville',serif; font-size:1rem; color:rgba(240,237,230,.45); transition:color .25s; }
.drawer a:hover .d-name { color:#f0ede6; }
.d-arr { font-family:'Teko',sans-serif; font-size:.8rem; font-weight:300; color:#2e2d2a; opacity:0; transform:translateX(-6px); transition:color .25s,opacity .25s,transform .3s cubic-bezier(.16,1,.3,1); }
.drawer a:hover .d-arr { opacity:1; transform:translateX(0); color:#6b21d6; }
@media(max-width:900px){ .gti-nav{padding:14px 28px; height: 60px;} }
@media(max-width:600px){ .gti-nav{padding:12px 20px; height: 56px;} .drawer{width:100%;} }
</style>
"""

    if file_path == 'index.html':
        return # Skip top page, already has it natively.
    if file_path == 'gallery/index.html':
        return # Gallery already has it.

    if file_path == 'generator/index.html':
        # Custom logic for generator
        if 'id="hamWrap"' in content:
            # Already injected maybe
            pass
        else:
            # Replace CSS
            content = content.replace('.app{display:grid;grid-template-columns:360px minmax(0, 1fr);min-height:100vh;}',
                                      '.app{display:grid;grid-template-columns:360px minmax(0, 1fr);min-height:100vh;padding-top:64px;}')
            content = content.replace('.sidebar{background:var(--bg2);border-right:1px solid var(--border);padding:20px 16px;overflow-y:auto;overflow-x:hidden;max-height:100vh;position:sticky;top:0;width:360px;min-width:360px;max-width:360px;box-sizing:border-box;}',
                                      '.sidebar{background:var(--bg2);border-right:1px solid var(--border);padding:20px 16px;overflow-y:auto;overflow-x:hidden;max-height:calc(100vh - 64px);position:sticky;top:64px;width:360px;min-width:360px;max-width:360px;box-sizing:border-box;}')
            # Add CSS HTML and JS
            content = content.replace('</head>', css_html + '</head>')
            content = content.replace('<body>', '<body>\n' + overlay_html + nav_html)
            content = content.replace('</body>', js_html + '\n</body>')

    else:
        # Standard replacement for other pages (about, models, etc.)
        # Remove old header if exists
        old_header = r'<header>.*?<a href="\.\./index\.html" class="logo">GTI</a>.*?</header>'
        content = re.sub(old_header, '', content, flags=re.DOTALL)
        
        # Add CSS to head
        content = content.replace('</head>', css_html + '</head>')
        
        # Add Overlay + Nav right after <body>
        content = content.replace('<body>', '<body>\n' + overlay_html + nav_html)
        
        # Add JS right before </body>
        content = content.replace('</body>', js_html + '\n</body>')

        # Since we added a 64px fixed nav, we should add some top padding to main
        content = content.replace('<main>', '<main style="padding-top: 64px;">')
        content = content.replace('<main class="about-container">', '<main class="about-container" style="padding-top: 64px;">')
        content = content.replace('<main class="container">', '<main class="container" style="padding-top: 64px;">')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")

files_to_update = [
    'about/index.html',
    'ax/index.html',
    'cases/index.html',
    'concept/index.html',
    'contact/index.html',
    'custom/index.html',
    'generator/index.html',
    'keyboards/index.html',
    'models/bass/index.html',
    'models/guitar/index.html',
    'pedal/index.html',
    'picks/krystal/index.html',
    'picks/vortex/index.html',
    'pricing/index.html'
]

for f in files_to_update:
    if os.path.exists(f):
        update_file(f)
