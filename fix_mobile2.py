"""
fix_mobile2.py - pedal/index.html と gallery/index.html のハンバーガーJSをタッチ対応に修正
"""
import re, os

root = os.path.dirname(os.path.abspath(__file__))

NEW_JS_TOUCH = """// Touch: tap to toggle
  ham.addEventListener('touchstart',function(e){
    isTouch=true;
    e.preventDefault();
    toggleDrawer();
  },{passive:false});
  // Mouse: hover (desktop only)
  hamWrap.addEventListener('mouseenter',function(){ if(!isTouch) openDrawer(); });
  hamWrap.addEventListener('mouseleave',function(){ if(!isTouch) closeDrawer(); });
  drawer.addEventListener('mouseenter',function(){ if(!isTouch) clearTimeout(closeTimer); });
  drawer.addEventListener('mouseleave',function(){ if(!isTouch) closeDrawer(); });
  overlay.addEventListener('click', closeDrawer);
  overlay.addEventListener('touchstart',function(e){ e.preventDefault(); closeDrawer(); },{passive:false});
  window.addEventListener('mousemove',function(){ isTouch=false; },{passive:true});"""

# ────────────────────────────────────────────
# pedal/index.html  (minified JS)
# ────────────────────────────────────────────
pedal_path = os.path.join(root, 'pedal', 'index.html')
with open(pedal_path, 'r', encoding='utf-8') as f:
    pedal = f.read()

# 旧パターン（minified）
pedal_old = (
    "hamWrap.addEventListener('mouseenter',open);hamWrap.addEventListener('mouseleave',close);\n"
    "  drawer.addEventListener('mouseenter',()=>clearTimeout(t));drawer.addEventListener('mouseleave',close);\n"
    "  overlay.addEventListener('click',close);"
)
# 新パターン（touch対応）
pedal_new = (
    "let isTouch=false;\n"
    "  function toggleDrawer(){if(drawer.classList.contains('open')){close();}else{open();}}\n"
    "  ham.addEventListener('touchstart',function(e){isTouch=true;e.preventDefault();toggleDrawer();},{passive:false});\n"
    "  hamWrap.addEventListener('mouseenter',function(){if(!isTouch)open();});\n"
    "  hamWrap.addEventListener('mouseleave',function(){if(!isTouch)close();});\n"
    "  drawer.addEventListener('mouseenter',function(){if(!isTouch)clearTimeout(t);});\n"
    "  drawer.addEventListener('mouseleave',function(){if(!isTouch)close();});\n"
    "  overlay.addEventListener('click',close);\n"
    "  overlay.addEventListener('touchstart',function(e){e.preventDefault();close();},{passive:false});\n"
    "  window.addEventListener('mousemove',function(){isTouch=false;},{passive:true});"
)

# CSS メディアクエリの更新
pedal_css_old = "@media(max-width:640px){.drawer{width:100%}}"
pedal_css_new  = "@media(max-width:640px){.drawer{width:100%}}@media(hover:none){.ham-wrap::after{display:none;}}"

if pedal_old in pedal:
    pedal = pedal.replace(pedal_old, pedal_new)
    print("[pedal] JS updated")
else:
    print("[pedal] JS old pattern NOT FOUND - checking alternatives...")
    # より緩いパターンで検索
    m = re.search(r"hamWrap\.addEventListener\('mouseenter',[^;]+;.{0,200}overlay\.addEventListener\('click',[^;]+;", pedal, re.DOTALL)
    if m:
        print(f"  Found at {m.start()}: {m.group()[:100]}...")
    else:
        print("  No pattern found at all")

if pedal_css_old in pedal:
    pedal = pedal.replace(pedal_css_old, pedal_css_new)
    print("[pedal] CSS updated")

with open(pedal_path, 'w', encoding='utf-8') as f:
    f.write(pedal)
print(f"[pedal] Saved")

# ────────────────────────────────────────────
# gallery/index.html  (well-formatted JS)
# ────────────────────────────────────────────
gallery_path = os.path.join(root, 'gallery', 'index.html')
with open(gallery_path, 'r', encoding='utf-8') as f:
    gallery = f.read()

gallery_old = (
    "    hamWrap.addEventListener('mouseenter', openDrawer);\n"
    "    hamWrap.addEventListener('mouseleave', closeDrawer);\n"
    "    drawer.addEventListener('mouseenter', () => clearTimeout(closeTimer));\n"
    "    drawer.addEventListener('mouseleave', closeDrawer);\n"
    "    overlay.addEventListener('click', closeDrawer);"
)
gallery_new = (
    "    let isTouch=false;\n"
    "    function toggleDrawer(){drawer.classList.contains('open')?closeDrawer():openDrawer();}\n"
    "    ham.addEventListener('touchstart',function(e){isTouch=true;e.preventDefault();toggleDrawer();},{passive:false});\n"
    "    hamWrap.addEventListener('mouseenter',function(){if(!isTouch)openDrawer();});\n"
    "    hamWrap.addEventListener('mouseleave',function(){if(!isTouch)closeDrawer();});\n"
    "    drawer.addEventListener('mouseenter',function(){if(!isTouch)clearTimeout(closeTimer);});\n"
    "    drawer.addEventListener('mouseleave',function(){if(!isTouch)closeDrawer();});\n"
    "    overlay.addEventListener('click', closeDrawer);\n"
    "    overlay.addEventListener('touchstart',function(e){e.preventDefault();closeDrawer();},{passive:false});\n"
    "    window.addEventListener('mousemove',function(){isTouch=false;},{passive:true});"
)

if gallery_old in gallery:
    gallery = gallery.replace(gallery_old, gallery_new)
    print("[gallery] JS updated")
else:
    print("[gallery] JS old pattern NOT FOUND")
    # Try to find where the event listeners are
    m = re.search(r"hamWrap\.addEventListener\('mouseenter'", gallery)
    if m:
        print(f"  Found 'mouseenter' at char {m.start()}: {gallery[m.start():m.start()+200]}")

with open(gallery_path, 'w', encoding='utf-8') as f:
    f.write(gallery)
print("[gallery] Saved")

print("\nDone.")
