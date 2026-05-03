import urllib.request
import re
import codecs

url = 'https://www.gtinstruments.xyz/pages/6756043/static'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as response:
        html = response.read().decode('utf-8')
        
        with codecs.open('pedal_content.txt', 'w', 'utf-8') as out:
            # Extract images
            images = re.findall(r'<img[^>]+src=[\'"]([^\'"]+)[\'"][^>]*>', html)
            out.write('IMAGES:\n')
            for img in images:
                if 'http' in img or img.startswith('/'):
                    out.write(img + '\n')
            
            # Extract text elements
            out.write('\nTEXTS:\n')
            texts = re.findall(r'<p[^>]*>(.*?)</p>', html, re.DOTALL | re.IGNORECASE)
            for t in texts:
                clean = re.sub(r'<[^>]+>', '', t).strip()
                if clean: out.write(clean + '\n')
                
            out.write('\nDIV TEXTS:\n')
            divs = re.findall(r'<div[^>]*>(.*?)</div>', html, re.DOTALL | re.IGNORECASE)
            for d in divs:
                clean = re.sub(r'<[^>]+>', '', d).strip()
                # Only print short texts to avoid huge blobs
                if clean and len(clean) < 500: 
                    out.write(clean + '\n')
except Exception as e:
    print('Error:', e)
