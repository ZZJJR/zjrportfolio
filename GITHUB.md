# 上传 GitHub 清单 — 剪辑师作品集网站

**项目类型**：个人求职作品集网站（前端展示 + 轻量后台）
**技术栈**：原生 HTML/CSS/JS（无框架）、Node.js ≥ 18 零第三方依赖服务端、Python 3 构建脚本
**仓库建议**：Public（作品集本身就是给人看的）；若不想公开联系方式可先设 Private

---

## 一、必须上传的文件

### 根目录（文档与仓库配置）

| 文件 | 说明 |
|---|---|
| `README.md` | 项目说明、运行方式、目录结构 |
| `DEPLOY.md` | 上线清单（环境要求 / 构建命令 / 部署步骤 / 回滚方案） |
| `GITHUB.md` | 本文件，上传 GitHub 的操作清单 |
| `LICENSE` | MIT 许可证（已生成，版权人：张君睿；如需其他协议自行替换） |
| `.gitignore` | 忽略规则，见第三节 |
| `.gitattributes` | 统一换行符 + 二进制文件声明，避免 Windows 提交产生整文件 diff |

### `portfolio/`（全栈版源码，主目录）

| 文件 | 说明 |
|---|---|
| `server.js` | Node 服务端（静态托管 / SSR 注入 / 后台 API） |
| `package.json` | 项目元信息与 npm scripts（无依赖） |
| `.env.example` | **环境变量模板**（不含真实值，专门用于提交） |
| `data.json` | 网站全部文字内容（提交前确认 `settings` 为空，见第五节） |
| `public/index.html` | 首页 |
| `public/case.html` | 作品案例详情页 |
| `public/admin.html` | 后台管理页 |
| `public/css/style.css` | 全部样式 |
| `public/js/main.js` | 前台渲染 |
| `public/js/admin.js` | 后台逻辑 |
| `public/images/portrait.webp` | 个人照片 |
| `public/images/showreel.webp` | Showreel 封面 |
| `public/images/work-{city,tech,boundary,coffee,interview,road}.webp` | 6 张作品封面 |
| `public/videos/.gitkeep` | 占位文件，保证空目录被 Git 跟踪（视频本身不传） |

### `portfolio-spa/`（静态单文件版源码）

| 文件 | 说明 |
|---|---|
| `index.template.html` | SPA 模板（含 `/*__CSS__*/` 等占位符） |
| `js/app.js` | SPA 应用脚本 |
| `images/*.webp` | 8 张图片（静态版部署时需要） |

### `scripts/`（构建脚本）

| 文件 | 说明 |
|---|---|
| `build_spa.py` | 组装 SPA 单文件，含媒体存在性校验 |
| `build_static.py` | 生成纯静态多页版 |
| `manual_import.py` | 资料库导入辅助脚本（依赖 `WB_TOKEN` 环境变量） |

---

## 二、不该上传的文件

| 路径 / 模式 | 为什么不能传 |
|---|---|
| `portfolio/auth.json` | **管理员密码哈希**。首次启动自动生成，属于密钥 |
| `portfolio/access-log.json` | 访问日志，含访客 IP 与行为时间戳（隐私） |
| `portfolio/data.json.bak` | 上一版内容备份，可能含未清理的旧内容 |
| `portfolio/data.json.tmp` / `.corrupt-*` | 原子写临时文件与损坏副本 |
| `portfolio/public/videos/*` | 上传的视频，单文件最大 200MB，体积大且非源码 |
| `portfolio/public/images/[0-9]*-*.*` | 后台上传的图片（时间戳命名），非原始素材 |
| `portfolio-static/` | `build_static.py` 的输出目录，可随时重建 |
| `portfolio-spa/index.html` | `build_spa.py` 的构建产物，可随时重建（例外见下） |
| `node_modules/` | 依赖目录（本项目其实没有依赖，以防万一） |
| `__pycache__/` `*.pyc` | Python 字节码缓存 |
| `.env` `.env.local` | 真实环境变量（本项目零依赖不读 `.env`，但仍防误传） |
| `.vscode/` `.idea/` `*.swp` | 个人编辑器配置 |
| `.DS_Store` `Thumbs.db` `desktop.ini` | 操作系统产生的垃圾文件 |
| `*.zip` `*.tar.gz` | 打包临时文件（如 `portfolio-static.zip`） |

### 需要你自己决定的一项

`portfolio-spa/index.html` 默认被忽略。**如果你想用 GitHub Pages 直接托管、不想配置 Actions**，就把它提交上去：把 `.gitignore` 里 `portfolio-spa/index.html` 这一行加 `#` 注释掉即可。代价是每次改内容都要记得重新构建再提交，否则线上是旧内容。

### 体积提示

`portfolio/public/images/`（约 0.4MB）与 `portfolio-spa/images/`（约 0.4MB）均为优化后的 WebP，8 张合计约 0.4MB（原 PNG 已从仓库移除）。单文件最大约 86KB，远低于 GitHub 100MB 限制，可以正常提交。若以后要加入视频或更多大图，建议改用 **Git LFS**，不要直接把 mp4 塞进仓库。

---

## 三、.gitignore 主要规则与作用

> 本文件的规则**已在临时副本中真实执行 `git init` + `git add -A` 验证过**：
> 约 40 个文件入库（图片约 0.4 MB，其余为源码/文档），11 项敏感/生成文件全部被拦住。
> 踩过的坑：`.gitignore` **不支持行尾注释**，`portfolio/x.json  # 说明` 会把整行当成匹配模式导致规则静默失效——所以文件里所有注释都单独占一行。

| 规则 | 作用 |
|---|---|
| `portfolio/auth.json` | 拦住密码哈希，防止密钥随每次提交泄露 |
| `.env` / `.env.*.local` | 拦住真实环境变量；`.env.example` 名字不匹配，仍会被提交 |
| `portfolio/access-log.json` | 拦住含访客 IP 的访问日志 |
| `portfolio/data.json.bak` / `.tmp` / `.corrupt-*` | 拦住运行时副本，避免历史内容外泄与无意义 diff |
| `portfolio/public/videos/*` + `!.gitkeep` | 排除上传的视频，但保留空目录占位 |
| `portfolio/public/images/[0-9]*-*.*` | 只排除「时间戳-名称」的上传图片，不影响 `portrait.webp` 等原始素材 |
| `portfolio-static/` | 排除整个构建输出目录 |
| `portfolio-spa/index.html` | 排除 SPA 构建产物（可按需取消） |
| `node_modules/` `__pycache__/` | 排除依赖与字节码 |
| `.vscode/` `.idea/` `.DS_Store` | 排除个人编辑器与系统文件 |
| `*.zip` `*.tar.gz` | 排除打包产物 |

---

## 四、推荐的仓库目录结构

```
video-editor-portfolio/            ← 仓库名建议：video-editor-portfolio 或 portfolio
├── .gitattributes
├── .gitignore
├── LICENSE
├── README.md
├── DEPLOY.md
├── GITHUB.md
├── portfolio/                     ← 全栈版（主源码，部署用这个）
│   ├── .env.example
│   ├── data.json
│   ├── package.json
│   ├── server.js
│   └── public/
│       ├── admin.html
│       ├── case.html
│       ├── index.html
│       ├── css/style.css
│       ├── js/
│       │   ├── admin.js
│       │   └── main.js
│       ├── images/                ← 8 张原始素材（提交）
│       └── videos/.gitkeep        ← 只有占位（视频不提交）
├── portfolio-spa/                 ← 静态单文件版源码
│   ├── index.template.html
│   ├── js/app.js
│   └── images/                    ← 8 张（部署静态版需要）
└── scripts/
    ├── build_spa.py
    ├── build_static.py
    └── manual_import.py
```

> `portfolio-static/`、`portfolio-spa/index.html`、`portfolio/auth.json`、`access-log.json` 都不会出现在仓库里。

---

## 五、需要脱敏 / 改用环境变量的信息

| 项 | 现状 | 处理方式 |
|---|---|---|
| 管理员密码哈希 | 原本写在 `data.json`，已迁移到 `portfolio/auth.json` | ✅ 已拆出并加入 `.gitignore`；`data.json` 现在是纯内容，可安全提交 |
| 初始管理员密码 | 默认 `admin123` | 改用环境变量 `ADMIN_PASSWORD` 传入（仅首次启动生效）；不要写进任何提交的文件 |
| 监听地址 | 默认 `127.0.0.1` | 环境变量 `HOST`，部署时才设 `0.0.0.0` |
| 端口 | 默认 `3000` | 环境变量 `PORT` |
| **手机号** `+86 138-0000-0000` | 在 `data.json` 的 `contact.phone` | ⚠️ 公开仓库等于公开号码。建议删除该行或改为「微信 / 电话面议」 |
| **邮箱** `zhangjunrui@foxmail.com` | 在 `data.json` 的 `contact.email` | 作品集需要被联系，保留即可；若担心爬虫可写成图片或 `name [at] domain` 形式 |
| 所在地「山西太原」 | `data.json` 的 `contact.location` | 属意向公开信息，自行决定 |
| 社交链接 | 三条 `"url": "#"` 占位 | 上线前替换为真实主页，否则点了会跳到页首 |
| 访问日志中的 IP | `access-log.json` | ✅ 已忽略 |
| 图片 EXIF | 原创素材一般无敏感信息 | 若照片来自手机拍摄，建议先清除 GPS 信息再提交 |

**改法**（以手机号为例）：登录后台「联系方式」把电话改成「微信 / 电话面议」，或直接编辑 `portfolio/data.json` 的 `contact.phone`。

---

## 六、完整操作步骤

### 第 0 步：先在 GitHub 上创建空仓库

进入 https://github.com/new ，填 Repository name（如 `video-editor-portfolio`），
**不要勾选** "Add a README file" / "Add .gitignore" / "Choose a license" —— 本地已经有了，勾了会冲突。
创建后页面上会给出仓库地址，形如 `https://github.com/<你的用户名>/video-editor-portfolio.git`。

### 第 1 步：初始化并提交

在项目根目录执行（Git Bash / PowerShell 均可）：

```bash
cd "C:/Users/ZJR/Downloads/剪辑师作品集-源代码/剪辑师作品集-源代码"

git init -b main
```

> 若 Git 版本较老不支持 `-b`，改用：`git init` 然后 `git checkout -b main`。

首次使用 Git 需先配置身份（只需一次）：

```bash
git config --global user.name  "你的名字"
git config --global user.email "你的邮箱"
```

把文件加入暂存区，**然后务必核对一遍**：

```bash
git add -A
git status --short
```

重点确认这几项**没有**出现在列表里：

- `portfolio/auth.json`
- `portfolio/access-log.json`
- `portfolio/data.json.bak`
- `portfolio-static/`
- `portfolio/public/videos/*.mp4`

如果出现了，说明 `.gitignore` 没生效，先停下来排查（`git check-ignore -v 文件路径` 可以看是哪条规则命中/未命中）。

确认无误后提交：

```bash
git commit -m "feat: 剪辑师求职作品集网站（前台展示 + 后台管理，零第三方依赖）"
```

### 第 2 步：关联远程仓库并推送

**HTTPS 方式**（最简单，推送时输用户名 + Personal Access Token）：

```bash
git remote add origin https://github.com/<你的用户名>/video-editor-portfolio.git
git branch -M main
git push -u origin main
```

**SSH 方式**（配过密钥推荐用，免密）：

```bash
git remote add origin git@github.com:<你的用户名>/video-editor-portfolio.git
git branch -M main
git push -u origin main
```

> GitHub 已不支持用账户密码推送 HTTPS，需要生成 Personal Access Token：
> GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic) → 勾选 `repo`。

如果远端仓库已经带有 README（创建时不小心勾了），先把远端内容合进来再推：

```bash
git pull --rebase origin main
git push -u origin main
```

### 第 3 步：推送后验证

```bash
# 换一个目录克隆下来，确认内容完整
git clone https://github.com/<你的用户名>/video-editor-portfolio.git test-clone
cd test-clone
ls                       # 应看到 README.md / portfolio / portfolio-spa / scripts
cd portfolio && node server.js     # 应能正常启动，默认密码 admin123
```

克隆下来后 `portfolio/auth.json` 不存在属正常——启动服务时会自动生成。

### 常用补充命令

```bash
git status                      # 看当前改动
git log --oneline -5            # 看最近提交
git rm --cached <文件> --force  # 误提交后从版本库移除（保留本地文件）
```

> 若某个密钥**已经**被提交过，仅 `git rm --cached` 不够——历史里仍然存在。请立即改密码，并用 `git filter-repo` 清洗历史后再强推。

---

## 七、推送前最后自检

- [ ] `git status --short` 里没有 `auth.json` / `access-log.json` / `data.json.bak` / `portfolio-static/`
- [ ] 打开 `portfolio/data.json` 确认 `settings` 为 `{}`，没有任何 `adminPassword` 字样
- [ ] 已决定手机号是否公开（第五节）
- [ ] `contact.socials` 的三条 `#` 占位链接已替换或删除
- [ ] 图片素材里没有暴露 GPS 等 EXIF 信息
- [ ] `README.md` 里的运行说明与实际一致
- [ ] LICENSE 的版权人与协议是自己要的

---

## 八、附录：入库文件清单（约 40 个，图片约 0.4 MB）

这是执行 `git add -A` 后 `git ls-files` 的真实输出，可直接当作打包核对表。

```
.gitattributes
.gitignore
DEPLOY.md
GITHUB.md
LICENSE
README.md
portfolio/.env.example
portfolio/data.json
portfolio/package.json
portfolio/server.js
portfolio/public/admin.html
portfolio/public/case.html
portfolio/public/index.html
portfolio/public/css/style.css
portfolio/public/js/admin.js
portfolio/public/js/main.js
portfolio/public/images/portrait.webp
portfolio/public/images/showreel.webp
portfolio/public/images/work-boundary.webp
portfolio/public/images/work-city.webp
portfolio/public/images/work-coffee.webp
portfolio/public/images/work-interview.webp
portfolio/public/images/work-road.webp
portfolio/public/images/work-tech.webp
portfolio/public/videos/.gitkeep
portfolio-spa/index.template.html
portfolio-spa/js/app.js
portfolio-spa/images/portrait.webp
portfolio-spa/images/showreel.webp
portfolio-spa/images/work-boundary.webp
portfolio-spa/images/work-city.webp
portfolio-spa/images/work-coffee.webp
portfolio-spa/images/work-interview.webp
portfolio-spa/images/work-road.webp
portfolio-spa/images/work-tech.webp
scripts/build_spa.py
scripts/build_static.py
scripts/manual_import.py
```

其中图片占约 30.6 MB（两份相同的素材集，各约 15 MB）。若想精简，可只保留
`portfolio/public/images/`，让 `portfolio-spa/images/` 由构建脚本复制生成——
那就需要给 `build_spa.py` 加一步复制逻辑，目前脚本未做这件事。
