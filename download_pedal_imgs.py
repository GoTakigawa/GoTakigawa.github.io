import urllib.request
import os

os.makedirs('assets/images/pedal', exist_ok=True)

images = {
    'hero_package.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/3fb869908f6500bd9db067202a146011_7c8b8cf7344cd210257905c91f98480a.jpg?width=800',
    'photo_1.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/476cfa492e734f0f88984f3d53fea40e_72fce494ffc1a1f43b0052377930e911.jpg?width=800',
    'photo_2.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/ccf23bb9e6e2544b728242fd9f279bd8_cfa29eb648686c7db169c0b24fe822e9.jpg?width=800',
    'photo_3.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/b448acde69876bd0d314365657b4a964_8372c14d20d4bb4c30dbb55959e79993.jpg?width=800',
    'photo_4.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/e9802b9c4127524d3fef8f4a8afb9497_0424806aa66fbe82709632226eb6d266.jpg?width=800',
    'hero_side.jpg': 'https://cdn.amebaowndme.com/madrid-prd/madrid-web/images/sites/629021/f0201cc38014b0d2a912cebc40c9ecfc_3998fed3515f18825f81ad041c288375.jpg?width=800',
}

headers = {'User-Agent': 'Mozilla/5.0'}
for fname, url in images.items():
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            data = r.read()
        with open(f'assets/images/pedal/{fname}', 'wb') as f:
            f.write(data)
        print(f'Downloaded: {fname} ({len(data)} bytes)')
    except Exception as e:
        print(f'Failed {fname}: {e}')
