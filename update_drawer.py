import os
import re

def get_depth(file_path):
    parts = file_path.replace('\\', '/').split('/')
    depth = len(parts) - 1
    return '../' * depth if depth > 0 else ''

def update_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # We need to replace the drawer contents.
    # The drawer contents are between <div class="drawer" id="drawer"> and </div>
    # It might be indented differently, so we use regex.
    drawer_pattern = re.compile(r'<div class="drawer" id="drawer">.*?</div>', re.DOTALL)
    
    depth_str = get_depth(file_path)
    
    new_drawer = f"""<div class="drawer" id="drawer">
  <a href="{depth_str}index.html"><span class="d-name">Top</span><span class="d-arr">→</span></a>
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
  <a href="{depth_str}generator/index.html"><span class="d-name">Generator</span><span class="d-arr">→</span></a>
</div>"""

    if drawer_pattern.search(content):
        content = drawer_pattern.sub(new_drawer, content)
    
    # Now update CSS
    # Top page CSS format: .drawer.open a:nth-child(12){transition-delay:.37s}
    # Other pages CSS format: .drawer.open a:nth-child(12) { transition-delay:.37s; }
    
    # Pattern to find the 12th child and add the 13th child if it doesn't exist
    if 'nth-child(13)' not in content:
        content = content.replace(
            '.drawer.open a:nth-child(12){transition-delay:.37s}', 
            '.drawer.open a:nth-child(12){transition-delay:.37s}\n.drawer.open a:nth-child(13){transition-delay:.40s}'
        )
        content = content.replace(
            '.drawer.open a:nth-child(12) { transition-delay:.37s; }', 
            '.drawer.open a:nth-child(12) { transition-delay:.37s; }\n.drawer.open a:nth-child(13) { transition-delay:.40s; }'
        )

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Updated {file_path}")

files_to_update = [
    'index.html',
    'about/index.html',
    'ax/index.html',
    'cases/index.html',
    'concept/index.html',
    'contact/index.html',
    'custom/index.html',
    'gallery/index.html',
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
