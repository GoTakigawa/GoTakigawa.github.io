"""
fix_mobile.py
全ページのハンバーガーメニューJSをタッチ操作対応に更新する。
また、drawer/CSS のスマホ対応も追加する。
"""
import os
import re

# ── 旧 JS（hover only）
OLD_JS = """// ── HAMBURGER MENU JS ──
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
})();"""

# ── 新 JS（hover + touch 対応）
NEW_JS = """// ── HAMBURGER MENU JS ──
(function(){
  const hamWrap=document.getElementById('hamWrap');
  const ham=document.getElementById('ham');
  const drawer=document.getElementById('drawer');
  const overlay=document.getElementById('overlay');
  if(!hamWrap || !ham || !drawer || !overlay) return;
  let closeTimer=null;
  let isTouch=false;
  function openDrawer(){
    clearTimeout(closeTimer);
    drawer.classList.add('open');
    overlay.classList.add('visible');
    ham.classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeDrawer(){
    clearTimeout(closeTimer);
    closeTimer=setTimeout(()=>{
      drawer.classList.remove('open');
      overlay.classList.remove('visible');
      ham.classList.remove('open');
      document.body.style.overflow='';
    },120);
  }
  function toggleDrawer(){
    drawer.classList.contains('open') ? closeDrawer() : openDrawer();
  }
  // Touch: tap to toggle
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
  window.addEventListener('mousemove',function(){ isTouch=false; },{passive:true});
})();"""

# ── 旧 CSS メディアクエリ（レスポンシブ不十分）
OLD_CSS_MEDIA = "@media(max-width:900px){ .gti-nav{padding:14px 28px; height: 60px;} }\n@media(max-width:600px){ .gti-nav{padding:12px 20px; height: 56px;} .drawer{width:100%;} }"
# ── 新 CSS メディアクエリ（スマホ対応強化）
NEW_CSS_MEDIA = """@media(max-width:900px){ .gti-nav{padding:0 28px; height:60px;} }
@media(max-width:600px){ .gti-nav{padding:0 16px; height:56px;} .drawer{width:100%;} }
@media(hover:none){
  /* タッチデバイスではhoverブリッジ不要 */
  .ham-wrap::after{display:none;}
}"""

# ── 対象ファイル（index.htmlはJSが異なる形なので別処理）
TARGET_FILES = [
    'about/index.html',
    'ax/index.html',
    'cases/index.html',
    'concept/index.html',
    'contact/index.html',
    'custom/index.html',
    'keyboards/index.html',
    'models/bass/index.html',
    'models/guitar/index.html',
    'pedal/index.html',
    'picks/krystal/index.html',
    'picks/vortex/index.html',
    'pricing/index.html',
    'gallery/index.html',
]

root = os.path.dirname(os.path.abspath(__file__))
updated = []
skipped = []

for rel_path in TARGET_FILES:
    full_path = os.path.join(root, rel_path)
    if not os.path.exists(full_path):
        print(f"[SKIP] not found: {rel_path}")
        skipped.append(rel_path)
        continue

    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()

    changed = False

    # JS 置換
    if OLD_JS in content:
        content = content.replace(OLD_JS, NEW_JS)
        changed = True
        print(f"[JS]  updated: {rel_path}")
    elif NEW_JS in content:
        print(f"[JS]  already new: {rel_path}")
    else:
        print(f"[JS]  pattern not found: {rel_path}")

    # CSS メディアクエリ置換
    if OLD_CSS_MEDIA in content:
        content = content.replace(OLD_CSS_MEDIA, NEW_CSS_MEDIA)
        changed = True
        print(f"[CSS] updated: {rel_path}")
    elif NEW_CSS_MEDIA in content:
        print(f"[CSS] already new: {rel_path}")
    else:
        print(f"[CSS] pattern not found: {rel_path}")

    if changed:
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        updated.append(rel_path)

print(f"\n✅ Updated: {len(updated)} files")
print(f"⏭  Skipped: {len(skipped)} files")
