import re

with open('gallery/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the header CSS with the standard nav CSS
old_css_start = content.find('    /* Page Header Styles */')
old_css_end = content.find('    .header-center {')
if old_css_start != -1 and old_css_end != -1:
    standard_nav_css = """
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

"""
    content = content[:old_css_start] + standard_nav_css + content[old_css_end:]

# Replace the HTML header with standard nav
old_header_html = """  <header class="page-header">
    <div class="header-left">
      <a href="../index.html"><img src="../assets/images/logo.png" alt="GTI" class="nav-logo"></a>
    </div>
    <div class="header-center">
      <h1>Guitars / Basses</h1>
      <p>Explore our past creations and custom built instruments.</p>
    </div>
    <div class="header-right">
      <div class="ham-wrap" id="hamWrap">
        <button class="ham" id="ham" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>"""

standard_nav_html = """<nav id="nav" class="gti-nav">
  <a href="../index.html"><img src="../assets/images/logo.png" alt="GTI" class="nav-logo"></a>
  <div class="ham-wrap" id="hamWrap">
    <button class="ham" id="ham" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>
  </div>
</nav>"""

content = content.replace(old_header_html, standard_nav_html)

# Add padding to main
content = content.replace('<main class="gallery-layout">', '<main class="gallery-layout" style="padding-top: 64px;">')

# Add the page title sec to the top of gallery-main
gallery_main_start = """    <div class="gallery-main">
      <div class="gallery-grid" id="gallery">"""

page_title_html = """    <div class="gallery-main">
      <div class="page-title-sec" style="text-align:center; padding: 20px 0 60px;">
        <h1 style="font-family: 'Libre Baskerville', serif; font-size: 2.5rem; margin-bottom: 10px;">Guitars / Basses</h1>
        <p style="font-family: 'Roboto Condensed', sans-serif; font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.1em;">Explore our past creations and custom built instruments.</p>
      </div>
      <div class="gallery-grid" id="gallery">"""

content = content.replace(gallery_main_start, page_title_html)

with open('gallery/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Updated gallery/index.html")
