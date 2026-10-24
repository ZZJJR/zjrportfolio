#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""构建纯静态托管版（无后端）作品集站点，输出目录：portfolio-static/

做的事：
1. 复制 portfolio/public 的前端资源（CSS / JS / 图片 / 视频）
2. 绝对路径 (/css/... /js/... /#anchor /case?id=) → 相对路径
3. 把 data.json 内容以 window.__CONTENT__ 内联进 index / case 两个页面

不做的事（重要）：
后台管理依赖服务端 API，纯静态托管下无法工作，因此本脚本**不输出 admin 页面**。
需要在线改内容请部署 portfolio/ 全栈版；只想本地预览改用 portfolio-spa/index.html。

用法：python scripts/build_static.py
"""
import json
import os
import re
import shutil
import sys
from html import escape as html_escape
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
PUBLIC = BASE / "portfolio" / "public"
DATA = BASE / "portfolio" / "data.json"
STATIC = BASE / "portfolio-static"
SITE_URL = (os.environ.get("SITE_URL") or "https://zzjjr.github.io/zjrportfolio/").rstrip("/") + "/"

content = json.loads(DATA.read_text(encoding="utf-8"))
settings = content.get("settings", {})
settings.pop("adminPassword", None)
settings.pop("adminPasswordHash", None)
for k in ("caseBgParas", "caseTools"):
    content.pop(k, None)

inject = (
    "<script>window.__CONTENT__="
    + json.dumps(content, ensure_ascii=False)
    .replace("<", "\\u003c")
    .replace("\u2028", "\\u2028")
    .replace("\u2029", "\\u2029")
    + "</script>"
)

profile = content.get("profile") or {}
contact = content.get("contact") or {}
name = profile.get("name") or "张君睿"
title = f"{name} · 视频剪辑师 — 求职作品集"
desc = " ".join((profile.get("sub") or "视频剪辑师求职作品集").split())
meta_tags = (
    f'<title>{html_escape(title)}</title>'
    f'<meta name="description" content="{html_escape(desc, quote=True)}" />'
    f'<meta name="robots" content="index,follow" />'
    f'<meta name="theme-color" content="#0A0A0A" />'
    f'<link rel="canonical" href="{html_escape(SITE_URL, quote=True)}" />'
)
cover = (profile.get("showreel") or {}).get("cover") or ""
preload_tag = (
    f'<link rel="preload" as="image" href="{html_escape(cover, quote=True)}" fetchpriority="high" />'
    if cover else ""
)
noscript_summary = (
    '<section class="noscript-summary">'
    f'<h1>{html_escape(name)} · {html_escape(profile.get("role") or "视频剪辑师")}</h1>'
    f'<p>{html_escape(profile.get("bio1") or "")}</p>'
    f'<p>{html_escape(profile.get("bio2") or "")}</p>'
    f'<h2>联系方式</h2><p>邮箱：{html_escape(contact.get("email") or "")}</p>'
    '</section>'
)

# ---------- 1. 复制前端资源 ----------
if STATIC.exists():
    shutil.rmtree(STATIC)
STATIC.mkdir(parents=True)
shutil.copytree(PUBLIC / "css", STATIC / "css")
shutil.copytree(PUBLIC / "js", STATIC / "js")
shutil.copytree(PUBLIC / "images", STATIC / "images")
if (PUBLIC / "videos").exists():
    shutil.copytree(PUBLIC / "videos", STATIC / "videos")
shutil.copy(PUBLIC / "index.html", STATIC / "index.html")
shutil.copy(PUBLIC / "case.html", STATIC / "case.html")
# 后台依赖服务端接口，静态版不下发
(STATIC / "js" / "admin.js").unlink(missing_ok=True)
print("copied: 前端资源（不含后台）")


# ---------- 2. HTML 路径补丁 ----------
def patch_html(name):
    p = STATIC / name
    html = p.read_text(encoding="utf-8")
    html = html.replace('href="/css/style.css"', 'href="css/style.css"')
    html = html.replace('src="/js/main.js"', 'src="js/main.js"')
    html = html.replace('href="/#', 'href="index.html#')
    html = html.replace('href="/case?id=', 'href="case.html?id=')
    html = html.replace('href="/"', 'href="index.html"')
    html = html.replace("<!--META_TAGS-->", meta_tags)
    html = html.replace("<!--PRELOAD_IMAGE-->", preload_tag)
    html = html.replace("<!--NOSCRIPT_SUMMARY-->", noscript_summary)
    if "<!--CONTENT_INJECT-->" in html:
        html = html.replace("<!--CONTENT_INJECT-->", inject)
    else:
        html = html.replace(
            '<script src="js/main.js"></script>',
            inject + '\n  <script src="js/main.js"></script>',
        )
    p.write_text(html, encoding="utf-8")
    print("patched:", name)


patch_html("index.html")
patch_html("case.html")

# ---------- 3. main.js 案例链接补丁 ----------
mp = STATIC / "js" / "main.js"
js = mp.read_text(encoding="utf-8")
js = js.replace('"/case?id=', '"case.html?id=')
mp.write_text(js, encoding="utf-8")
print("patched: main.js")

# ---------- 4. 自检：不应残留站内绝对路径，且内容已内联 ----------
issues = []
for name in ("index.html", "case.html"):
    h = (STATIC / name).read_text(encoding="utf-8")
    for m in re.finditer(r'(?:href|src)="/[^"]*"', h):
        issues.append(f"{name}: {m.group(0)}")
    if "window.__CONTENT__" not in h:
        issues.append(f"{name}: missing __CONTENT__")
    if "adminPassword" in h:
        issues.append(f"{name}: 残留密码字段")

if issues:
    print("ISSUES:")
    for i in issues:
        print(" -", i)
    sys.exit(1)
print("ALL CHECKS PASSED")
print("输出目录:", STATIC)
