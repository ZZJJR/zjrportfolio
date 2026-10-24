# 剪辑师个人作品集网站 — 源代码

一个深色影院风格的视频剪辑师求职作品集网站，包含前台展示与后台内容管理，无任何第三方依赖。

**在线预览**：https://zzjjr.github.io/zjrportfolio/
（GitHub Pages，由 main 分支根目录的 `index.html` 提供；内容变更需重新执行 `scripts/build_spa.py` 并更新该文件）

## 目录结构

```
├── portfolio/                 ★ 全栈版（主源码，本地运行 + 可部署到 Node 服务器）
│   ├── server.js              零依赖 Node.js 服务器（静态托管 + SSR 内容注入 + 后台 API）
│   ├── package.json           项目配置（无第三方依赖，Node ≥ 18）
│   ├── .env.example           环境变量模板（PORT / HOST / ADMIN_PASSWORD）
│   ├── data.json              网站全部内容数据（后台读写的数据源，写入自动生成 .bak）
│   ├── auth.json              [运行时生成·不入库] 管理员密码哈希
│   └── public/                前端静态资源（由服务器直接托管）
│       ├── index.html         首页（响应式：桌面 1440 / 移动 390 自动适配）
│       ├── case.html          作品案例详情页（/case?id=作品ID）
│       ├── admin.html         后台管理页（/admin）
│       ├── css/style.css      全部样式（设计令牌见文件头注释）
│       ├── js/main.js         前台渲染（内容注入 / 播放器 / 动效 / 路由）
│       ├── js/admin.js        后台逻辑（登录 / 表单绑定 / 上传 / 访问记录）
│       ├── images/            图片素材（封面、肖像）
│       └── videos/            上传的视频文件（运行时生成）
├── portfolio-spa/             线上静态托管版源码（单文件 SPA）
│   ├── index.template.html    SPA 模板（含占位符）
│   ├── index.html             构建产物（可直接部署到任意静态托管）
│   ├── js/app.js              SPA 应用脚本（hash 路由：#/ #case=ID）
│   └── images/                图片素材
├── scripts/                   构建 / 发布辅助脚本（Python 3，路径均相对脚本位置解析）
│   ├── build_spa.py           组装 SPA：内联 CSS + 内容数据 + JS → index.html
│   ├── build_static.py        生成纯静态多页版（portfolio-static/，不含后台）
│   └── manual_import.py       资料库导入脚本（需设置 WB_TOKEN）
├── DEPLOY.md                  ★ 上线清单：环境要求 / 构建命令 / 部署步骤 / 回滚方案
├── GITHUB.md                  ★ 上传 GitHub 清单：文件取舍 / .gitignore / git 操作步骤 / 脱敏项
├── robots.txt                抓取规则（禁止 /admin 与 /api）
├── sitemap.xml               站点地图
├── 404.html                  GitHub Pages 404 页
├── og-cover.jpg              社交分享图（1200×630）
├── LICENSE                    MIT 许可证
├── .gitattributes             换行符与二进制声明
└── .gitignore
```

## 本地运行（全栈版）

```bash
cd portfolio
node server.js
# 前台  http://127.0.0.1:3000
# 后台  http://127.0.0.1:3000/admin
```

- 无需 `npm install`（零第三方依赖），要求 Node ≥ 18
- 默认只监听本机；局域网或服务器部署请设置 `HOST=0.0.0.0`
- 初始密码：`admin123`（或用 `ADMIN_PASSWORD` 指定），**登录后请立即修改**；部署到公网前务必通过 `ADMIN_PASSWORD` 设置强密码
- 密码以 scrypt 哈希存于 `portfolio/auth.json`（**该文件不入库**）；`data.json` 只放内容数据
- 若从旧版本升级，启动时会自动把 `data.json` 里的密码字段迁移到 `auth.json`

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 监听端口 |
| `HOST` | `127.0.0.1` | 监听地址，对外服务才改 `0.0.0.0` |
| `ADMIN_PASSWORD` | `admin123` | 首次启动写入的初始密码（仅在没有密码哈希时生效）；生产环境务必设置 |
| `SITE_URL` | 自动推断 | 对外访问地址，用于 canonical / Open Graph |
| `TRUST_PROXY` | `0` | 在 Nginx 等反向代理后才设为 `1`（否则不信任 `X-Forwarded-For`） |
| `PYTHON_BIN` | 自动查找 | 后台「发布上线」使用的 Python 路径；Python 不在 PATH 时设置 |

模板见 `portfolio/.env.example`。

## 后台功能

9 个选项卡：基本信息 / 擅长方向 / 作品管理（增删改）/ 案例详情（可切换作品）/ 技能与软件 / 联系方式 / **访问记录**（服务端日志，持久化于 access-log.json）/ **发布上线**（构建静态站 + 推送 GitHub main）/ 设置（改密码）。

「发布上线」会先保存当前修改，再运行 `scripts/build_spa.py --strict`，并通过 `scripts/deploy_api.ps1`（GitHub API）推送；需要本机已登录 GitHub CLI（`gh auth status`）。

- 登录态 2 小时有效，连续 5 次密码错误会锁定 15 分钟
- 「退出登录」会同时作废服务端会话
- 案例详情面板顶部可切换要编辑的作品，不再固定编辑第一部

## 媒体上传

| 类型 | 格式 | 大小限制 |
|---|---|---|
| 视频（作品 / Showreel） | MP4（H.264）、WebM | ≤ 200MB |
| 图片（封面 / 个人照片） | PNG / JPG / WebP | ≤ 10MB |

后台对应字段旁点「选择文件上传」，带进度显示，成功后自动填入地址。视频播放按原始宽高比完整显示（object-fit: contain），进度条可点击定位与拖动（服务端支持 Range 分段读取）。上传的文件可在后台删除。

## 线上版本

### 静态版（portfolio-spa，即 GitHub Pages 线上版）

静态托管无后端，公开发布的 SPA 版：

- 内容数据在构建时内联进 `index.html`，**没有任何后台管理入口**（旧版的纯前端假后台已移除——它只能改自己浏览器、还改不了线上，留着只会造成误导）
- 要改线上内容，请本地用全栈版 `node server.js` 改好 `data.json`，重新构建并发布（见上「本地运行」）
- 视频建议使用外链地址（对象存储直链）；若使用本地相对路径，请把文件一并上传

重新构建：

```bash
python scripts/build_spa.py            # 缺失媒体只告警
python scripts/build_spa.py --strict   # 缺失媒体直接失败（上线前推荐）
```

### 静态多页版（portfolio-static）

```bash
python scripts/build_static.py
```

输出纯前端页面（index / case + css / js / images），**不含后台**（后台依赖服务端 API）。

## 部署

完整流程见 **[DEPLOY.md](DEPLOY.md)**：环境要求、环境变量、构建命令、部署步骤、上线前检查清单与回滚方案。

## 设计规范速览

画布 #0A0A0A / 区块 #141414 / 卡片 #1A1A1A / 发丝线 #292929 / 信号色 #9EFF00（仅主 CTA、品牌符号、激活指示）/ 中文 Noto Sans SC + 西文 Inter（异步加载，失败时回退系统字体）/ 大区块 0 圆角、按钮 6px、胶囊 100px。
