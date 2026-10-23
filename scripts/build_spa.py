#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""组装 SPA 单文件：内联 CSS + 内容数据 + 应用 JS

用法：
    python scripts/build_spa.py            # 构建，缺失媒体只告警
    python scripts/build_spa.py --strict   # 缺失媒体直接失败（用于 CI / 上线前校验）

路径全部相对脚本位置解析，不再依赖固定的机器目录。
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]          # 项目根目录
SPA = BASE / "portfolio-spa"
PUBLIC = BASE / "portfolio" / "public"
DATA = BASE / "portfolio" / "data.json"
STRICT = "--strict" in sys.argv

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

# ---------- 媒体资源存在性校验 ----------
missing = []


def check_media(rel, where):
    """rel 为空表示未配置；外链（http/https）跳过本地校验"""
    if not rel:
        return
    if rel.startswith(("http://", "https://", "//")):
        return
    if not (PUBLIC / rel).exists():
        missing.append(f"{where} -> {rel}")


check_media(content.get("profile", {}).get("portrait", ""), "profile.portrait")
showreel = content.get("profile", {}).get("showreel", {})
check_media(showreel.get("cover", ""), "profile.showreel.cover")
check_media(showreel.get("video", ""), "profile.showreel.video")
for w in content.get("works") or []:
    wid = w.get("id", "?")
    check_media(w.get("cover", ""), f"works[{wid}].cover")
    check_media(w.get("video", ""), f"works[{wid}].video")

if missing:
    print("缺失媒体资源：")
    for m in missing:
        print("  -", m)
    if STRICT:
        print("STRICT 模式：构建中止。请补齐文件或改用外链。")
        sys.exit(1)
    print("（非 STRICT 模式，继续构建；上线前请务必补齐）")

inject_content = (
    "window.__CONTENT__="
    + json.dumps(content, ensure_ascii=False)
    .replace("<", "\\u003c")
    .replace("\u2028", "\\u2028")
    .replace("\u2029", "\\u2029")
    + ";"
)

html = (SPA / "index.template.html").read_text(encoding="utf-8")
html = html.replace("/*__CSS__*/", css)
html = html.replace("/*__CONTENT__*/", inject_content)
html = html.replace("/*__APP__*/", app)

out = SPA / "index.html"
out.write_text(html, encoding="utf-8")

# ---------- 自检（不用 assert，python -O 会跳过） ----------
errors = []
if "/*__CSS__*/" in html or "/*__APP__*/" in html or "/*__CONTENT__*/" in html:
    errors.append("模板占位符未全部替换")
if "window.__CONTENT__=" not in html:
    errors.append("内容数据未注入")
if html.count("<style>") < 2:
    errors.append("<style> 数量异常，CSS 可能未内联")
if "adminPassword" in html:
    errors.append("产物中残留密码字段")
for k in DROP_KEYS:
    if f'"{k}"' in html:
        errors.append(f"产物中残留孤儿字段 {k}")

imgs = re.findall(r"<img[^>]+>", html)
bad = [
    t for t in imgs
    if ("http://" in t or "https://" in t or "//" in t)
    and "workbuddy" not in t and "codebuddy" not in t and "fonts.g" not in t
]

print("SPA built:", out)
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
