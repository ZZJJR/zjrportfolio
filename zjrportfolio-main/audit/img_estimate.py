from PIL import Image, features
import os, io

print('avif support:', features.check('avif'))
d = r'D:\zjrportfolio-main\zjrportfolio-main\portfolio\public\images'
specs = {
    'showreel.png': [640, 1280], 'portrait.png': [400, 800],
    'work-city.png': [480, 960], 'work-tech.png': [480, 960],
    'work-boundary.png': [480, 960], 'work-coffee.png': [480, 960],
    'work-interview.png': [480, 960], 'work-road.png': [480, 960],
}
total = 0
total_webp = 0
for f in sorted(os.listdir(d)):
    p = os.path.join(d, f)
    im = Image.open(p).convert('RGB')
    orig = os.path.getsize(p)
    total += orig
    out = []
    for w in specs.get(f, [800]):
        h = round(im.height * w / im.width)
        r = im.resize((w, h), Image.LANCZOS)
        b = io.BytesIO()
        r.save(b, 'WEBP', quality=80, method=6)
        webp = b.tell()
        if w == specs.get(f, [800])[-1]:
            total_webp += webp
        out.append(f'{w}w webp q80={webp/1024:.0f}KB')
    print(f'{f:20s} {orig/1024:7.0f}KB  ' + ' | '.join(out))
print(f'TOTAL originals: {total/1024/1024:.2f} MB')
print(f'TOTAL largest WebP variants: {total_webp/1024/1024:.2f} MB ({100-total_webp/total*100:.0f}% smaller)')
