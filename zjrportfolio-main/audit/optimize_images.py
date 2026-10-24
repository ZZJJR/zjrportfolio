from PIL import Image
import os

src = r'D:\zjrportfolio-main\zjrportfolio-main\portfolio\public\images'
targets = {
    'showreel.png': 1280,
    'portrait.png': 800,
    'work-city.png': 960,
    'work-tech.png': 960,
    'work-boundary.png': 960,
    'work-coffee.png': 960,
    'work-interview.png': 960,
    'work-road.png': 960,
}
total_before = 0
total_after = 0
for name, width in targets.items():
    p = os.path.join(src, name)
    im = Image.open(p).convert('RGB')
    if im.width > width:
        h = round(im.height * width / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    out = os.path.join(src, name[:-4] + '.webp')
    im.save(out, 'WEBP', quality=82, method=6)
    before = os.path.getsize(p)
    after = os.path.getsize(out)
    total_before += before
    total_after += after
    print(f'{name:20s} {im.size[0]}x{im.size[1]}  {before/1024:7.0f} KB -> {after/1024:6.0f} KB')

# Social sharing image: 1200x630 crop from showreel, JPEG for maximum compatibility.
im = Image.open(os.path.join(src, 'showreel.png')).convert('RGB')
scale = max(1200 / im.width, 630 / im.height)
im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
left = (im.width - 1200) // 2
top = (im.height - 630) // 2
im = im.crop((left, top, left + 1200, top + 630))
og = os.path.join(src, 'og-cover.jpg')
im.save(og, 'JPEG', quality=85, optimize=True, progressive=True)
print(f'og-cover.jpg        1200x630  {os.path.getsize(og)/1024:6.0f} KB')

print(f'TOTAL {total_before/1024/1024:.2f} MiB -> {total_after/1024/1024:.2f} MiB ({100-total_after/total_before*100:.1f}% smaller)')
