import urllib.request
import re
import os

url = 'https://www.gtinstruments.xyz/pages/6756043/static'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})

with urllib.request.urlopen(req) as response:
    html = response.read().decode('utf-8')

# Find all amebaownd CDN image URLs
imgs = re.findall(r'https://cdn\.amebaowndme\.com/[^"\'\s<>]+', html)
print(f"Found {len(imgs)} images:")
for i, img in enumerate(imgs):
    print(f"  [{i}] {img}")
