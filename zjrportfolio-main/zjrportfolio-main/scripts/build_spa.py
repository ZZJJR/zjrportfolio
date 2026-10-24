#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""组装 SPA 单文件：内联 CSS + 内容数据 + 应用 JS

用法：
    python scripts/build_spa.py                # 构建，缺失媒体只告警；默认裁掉后台入口
    python scripts/build_spa.py --strict       # 缺失媒体直接失败（用于 CI / 上线前校验）
    python scripts/build_spa.py --keep-admin   # 保留后台入口（仅供本地预览后台）

公开发布的静态版默认不含后台：后台改动只存浏览器 localStorage，无法影响线上页面，
留着只会让人误以为能在网上改内容，且它没有真正的鉴权。
本地想看后台时用 --keep-admin 单独构建一份。

媒体与发布（已自动化，无需手工操作）：
- 媒体只需在 portfolio/public/ 维护一份（全栈后台上传也落在这里）。
  脚本会扫描 data.json 引用的图片/视频，自动镜像到 portfolio-spa/ 下，
  因此不再需要手工把文件复制进 portfolio-spa/ 双份目录。
- 构建同时产出两份：
    * portfolio-spa/index.html   —— 相对路径，可在本地多场景使用
    * index.html（仓库根）        —— 媒体路径已改写为 portfolio-spa/ 下，直接供 GitHub Pages 根目录托管
  发布时只需提交这两个文件（以及新增的媒体），无需再手跑 sed。

路径全部相对脚本位置解析，不再依赖固定的机器目录。
"""
import json
import os
import re
import shutil
import sys
from html import escape as html_escape
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]          # 项目根目录
SPA = BASE / "portfolio-spa"
PUBLIC = BASE / "portfolio" / "public"
DATA = BASE / "portfolio" / "data.json"
STRICT = "--strict" in sys.argv
KEEP_ADMIN = "--keep-admin" in sys.argv
# 部署地址：默认线上 Pages；换自定义域名时用环境变量 SITE_URL 覆盖
SITE_URL = (os.environ.get("SITE_URL") or "https://zzjjr.github.io/zjrportfolio/").rstrip("/") + "/"

# 构建期不应随产物一起发布的字段
DROP_KEYS = ("caseBgParas", "caseTools")

css = (PUBLIC / "css" / "style.css").read_text(encoding="utf-8")
app = (SPA / "js" / "app.js").read_text(encoding="utf-8")
content = json.loads(DATA.read_text(encoding="utf-8"))

# 移除敏感设置与历史遗留的顶层孤儿字段
settings = content.get("settings", {})
settings.pop("adminPassword", None)
settings.pop("adminPasswordHash", None)
for k in DROP_KEYS:
    content.pop(k, None)


def build_meta(data):
    """首页 SEO / 社交分享标签。构建期生成，避免把内容留在空 HTML 里。"""
    p = data.get("profile") or {}
    c = data.get("contact") or {}
    name = p.get("name") or "张君睿"
    role = p.get("role") or "视频剪辑师"
    title = f"{name} · 视频剪辑师 — 求职作品集"
    desc = (p.get("sub") or "").strip() or "视频剪辑师求职作品集：口播、短片与广告剪辑。"
    desc = " ".join(desc.split())
    image = SITE_URL + "og-cover.jpg"
    socials = [s.get("url") for s in (c.get("socials") or []) if s.get("url") and s.get("url") != "#"]
    address = (c.get("location") or "山西太原").replace(" · 接受远程合作", "")
    jsonld = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": name,
        "jobTitle": "视频剪辑师",
        "description": desc,
        "url": SITE_URL,
        "image": image,
        "email": ("mailto:" + c["email"]) if c.get("email") else None,
        "address": {"@type": "PostalAddress", "addressLocality": address},
        "knowsAbout": p.get("tags") or [],
        "sameAs": socials,
    }
    jsonld = {k: v for k, v in jsonld.items() if v not in (None, "", [])}
    jsonld_text = json.dumps(jsonld, ensure_ascii=False).replace("<", "\\u003c")
    return f"""<title>{html_escape(title)}</title>
  <meta name="description" content="{html_escape(desc, quote=True)}" />
  <meta name="robots" content="index,follow" />
  <meta name="theme-color" content="#0A0A0A" />
  <link rel="canonical" href="{html_escape(SITE_URL, quote=True)}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="zh_CN" />
  <meta property="og:site_name" content="{html_escape(name, quote=True)} 作品集" />
  <meta property="og:title" content="{html_escape(title, quote=True)}" />
  <meta property="og:description" content="{html_escape(desc, quote=True)}" />
  <meta property="og:url" content="{html_escape(SITE_URL, quote=True)}" />
  <meta property="og:image" content="{html_escape(image, quote=True)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="{html_escape(name + ' · 视频剪辑师作品集', quote=True)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="{html_escape(title, quote=True)}" />
  <meta name="twitter:description" content="{html_escape(desc, quote=True)}" />
  <meta name="twitter:image" content="{html_escape(image, quote=True)}" />
  <script type="application/ld+json">{jsonld_text}</script>"""


def build_noscript(data):
    """无 JS / 不执行 JS 的抓取器看到的静态内容，避免整页只剩区块标题。"""
    p = data.get("profile") or {}
    c = data.get("contact") or {}
    name = p.get("name") or "张君睿"
    role = p.get("role") or "视频剪辑师"
    works = data.get("works") or []
    items = "".join(
        f"<li><strong>{html_escape(w.get('title') or '')}</strong>"
        f"（{html_escape(w.get('category') or '')}，{html_escape(str(w.get('year') or ''))}）"
        f" — {html_escape(w.get('desc') or '')}</li>"
        for w in works
    )
    contact = ""
    if c.get("email"):
        contact += f'<p>邮箱：<a href="mailto:{html_escape(c["email"], quote=True)}">{html_escape(c["email"])}</a></p>'
    if c.get("location"):
        contact += f"<p>所在地：{html_escape(c['location'])}</p>"
    return f"""<section class="noscript-summary">
      <h1>{html_escape(name)} · {html_escape(role)}</h1>
      <p>{html_escape(p.get('bio1') or '')}</p>
      <p>{html_escape(p.get('bio2') or '')}</p>
      <h2>精选作品</h2>
      <ul>{items}</ul>
      <h2>联系方式</h2>
      {contact}
    </section>"""


def build_preload(data):
    p = data.get("profile") or {}
    cover = (p.get("showreel") or {}).get("cover") or ""
    if not cover:
        return ""
    return f'<link rel="preload" as="image" href="{html_escape(cover, quote=True)}" fetchpriority="high" />'


# ---------- 媒体资源：收集引用 + 存在性校验 + 自动镜像 ----------
missing = []
media_refs = set()


def collect_media(rel, where):
    """rel 为空表示未配置；外链（http/https）跳过本地校验与镜像"""
    if not rel:
        return
    if rel.startswith(("http://", "https://", "//")):
        return
    media_refs.add(rel)
    if not (PUBLIC / rel).exists():
        missing.append(f"{where} -> {rel}")


collect_media(content.get("profile", {}).get("portrait", ""), "profile.portrait")
showreel = content.get("profile", {}).get("showreel", {})
collect_media(showreel.get("cover", ""), "profile.showreel.cover")
collect_media(showreel.get("video", ""), "profile.showreel.video")
for w in content.get("works") or []:
    wid = w.get("id", "?")
    collect_media(w.get("cover", ""), f"works[{wid}].cover")
    collect_media(w.get("video", ""), f"works[{wid}].video")

if missing:
    print("缺失媒体资源：")
    for m in missing:
        print("  -", m)
    if STRICT:
        print("STRICT 模式：构建中止。请补齐文件或改用外链。")
        sys.exit(1)
    print("（非 STRICT 模式，继续构建；上线前请务必补齐）")

# 自动把用到的媒体从 public/ 镜像到 portfolio-spa/（线上 Pages 从 portfolio-spa/ 读取，
# 而全栈后台上传落在 public/）。这样只需在 public/ 维护一份，无需手工双目录同步。
copied = 0
for rel in sorted(media_refs):
    src = PUBLIC / rel
    dst = SPA / rel
    if not src.exists():
        continue
    dst.parent.mkdir(parents=True, exist_ok=True)
    if (not dst.exists()) or src.stat().st_mtime > dst.stat().st_mtime:
        shutil.copy2(src, dst)
        copied += 1
if copied:
    print(f"已镜像 {copied} 个媒体文件 public/ -> portfolio-spa/")

inject_content = (
    "window.__CONTENT__="
    + json.dumps(content, ensure_ascii=False)
    .replace("<", "\\u003c")
    .replace("\u2028", "\\u2028")
    .replace("\u2029", "\\u2029")
    + ";"
)

html = (SPA / "index.template.html").read_text(encoding="utf-8")
app_js = app

# 裁掉后台：HTML 区块（ADMIN_START/END）与 JS 区块（/*ADMIN_START*//*ADMIN_END*/）
# 两者必须同时裁掉，否则 JS 会给不存在的 DOM 绑定事件而抛错
if not KEEP_ADMIN:
    html, n_html = re.subn(
        r"[ \t]*<!--ADMIN_START-->.*?<!--ADMIN_END-->[ \t]*\n?", "", html, flags=re.S
    )
    app_js, n_js = re.subn(
        r"/\*ADMIN_START\*/.*?/\*ADMIN_END\*/\n?", "", app_js, flags=re.S
    )
    if n_html == 0 or n_js == 0:
        print("警告：未找到后台区块标记，跳过裁切（html=%d, js=%d）" % (n_html, n_js))
    else:
        print("已裁掉后台入口（HTML 区块 %d 处、JS 区块 %d 处）" % (n_html, n_js))

html = html.replace("/*__CSS__*/", css)
html = html.replace("/*__CONTENT__*/", inject_content)
html = html.replace("/*__APP__*/", app_js)
html = html.replace("<!--META_TAGS-->", build_meta(content))
html = html.replace("<!--PRELOAD_IMAGE-->", build_preload(content))
html = html.replace("<!--NOSCRIPT_SUMMARY-->", build_noscript(content))

# 社交分享图：根目录与 public 各一份（Pages 取根目录，Node 版取 public/images）
og_src = PUBLIC / "images" / "og-cover.jpg"
if og_src.exists():
    shutil.copy2(og_src, BASE / "og-cover.jpg")

# 1) 仓库内 SPA 构建产物（相对路径，可在本地多场景使用）
(SPA / "index.html").write_text(html, encoding="utf-8")

# 2) Pages 根目录用的 index.html：媒体路径改写为 portfolio-spa/ 下，且保证是公开发布版（无后台）
publish_html = html
if KEEP_ADMIN:
    publish_html, _ = re.subn(
        r"/\*ADMIN_START\*/.*?/\*ADMIN_END\*/\n?", "", publish_html, flags=re.S
    )
    publish_html, _ = re.subn(
        r"[ \t]*<!--ADMIN_START-->.*?<!--ADMIN_END-->[ \t]*\n?", "", publish_html, flags=re.S
    )
root_html = (
    publish_html
    .replace('"images/', '"portfolio-spa/images/')
    .replace('"videos/', '"portfolio-spa/videos/')
)
(BASE / "index.html").write_text(root_html, encoding="utf-8")

# ---------- 自检（不用 assert，python -O 会跳过） ----------
errors = []
if "/*__CSS__*/" in html or "/*__APP__*/" in html or "/*__CONTENT__*/" in html:
    errors.append("模板占位符未全部替换")
for token in ("<!--META_TAGS-->", "<!--PRELOAD_IMAGE-->", "<!--NOSCRIPT_SUMMARY-->"):
    if token in html or token in root_html:
        errors.append(f"模板占位符未替换：{token}")
if '<meta property="og:title"' not in html or "application/ld+json" not in html:
    errors.append("SEO 标签未生成")
if not (BASE / "og-cover.jpg").exists():
    errors.append("缺少根目录 og-cover.jpg")
if "window.__CONTENT__=" not in html:
    errors.append("内容数据未注入")
if html.count("<style>") < 2:
    errors.append("<style> 数量异常，CSS 可能未内联")
if "adminPassword" in html:
    errors.append("产物中残留密码字段")
for k in DROP_KEYS:
    if f'"{k}"' in html:
        errors.append(f"产物中残留孤儿字段 {k}")
if not KEEP_ADMIN and ('id="loginBtn"' in html or "portfolio_admin_token" in html):
    errors.append("产物中仍残留后台入口（应为公开发布版裁掉）")
if 'id="loginBtn"' in root_html or "portfolio_admin_token" in root_html:
    errors.append("根 index.html 残留后台入口（Pages 版本必须无后台）")

imgs = re.findall(r"<img[^>]+>", html)
bad = [
    t for t in imgs
    if ("http://" in t or "https://" in t or "//" in t)
    and "workbuddy" not in t and "codebuddy" not in t and "fonts.g" not in t
]

print("SPA built:", SPA / "index.html")
print("Pages root built:", BASE / "index.html")
print("size:", len(html.encode("utf-8")), "bytes")
print("img tags:", len(imgs), "| third-party img links:", len(bad))
for b in bad:
    print(" -", b[:80])

if errors:
    print("构建自检未通过：")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print("OK" if not bad else "HAS THIRD-PARTY IMG")
