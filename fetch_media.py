import urllib.request
import re
import json

url = 'https://www.gtinstruments.xyz/pages/6756043/static'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
        print('--- YOUTUBE LINKS ---')
        # Check for iframes or youtube links
        yts = re.findall(r'youtube\.com/embed/[^"\'\?&]+|youtu\.be/[^"\'\?&]+', html)
        for y in set(yts):
            print(y)
            
        print('--- IMAGE LINKS ---')
        # Ameba ownd / dynamically generated sites usually embed data in a JSON object in the script tag
        # e.g., window.__INITIAL_STATE__ = {...}
        imgs = re.findall(r'https://[^"\'\s]+\.(?:jpg|jpeg|png|webp)', html)
        # also check for data-src or src inside html
        imgs += re.findall(r'src=["\'](https://[^"\']+)["\']', html)
        # check for standard Ameba Ownd image patterns
        imgs += re.findall(r'https://stat\.ameba\.jp/user_images/[^"\'\s]+', html)
        
        valid_imgs = []
        for i in set(imgs):
            if 'youtube' not in i and 'js' not in i and 'css' not in i:
                # Unescape unicode sequences if any
                clean_i = i.encode('utf-8').decode('unicode_escape')
                valid_imgs.append(clean_i)
        
        for i in set(valid_imgs):
            print(i)
except Exception as e:
    print('Error:', e)
