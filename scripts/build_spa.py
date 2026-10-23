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
import re
import shutil
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]          # 项目根目录
SPA = BASE / "portfolio-spa"
PUBLIC = BASE / "portfolio" / "public"
DATA = BASE / "portfolio" / "data.json"
STRICT = "--strict" in sys.argv
KEEP_ADMIN = "--keep-admin" in sys.argv

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
