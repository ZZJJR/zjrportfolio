# 内容更新与上线手册（SYNC.md）

> 仓库：`ZZJJR/zjrportfolio`（public，main 分支）
> 线上地址：<https://zzjjr.github.io/zjrportfolio/>
> 维护人：张君睿

## 0. 核心认知：两套系统

| | 全栈版（本地，能改内容） | 静态版（线上，GitHub Pages） |
|---|---|---|
| 怎么跑 | `cd portfolio && node server.js` | 自动托管，无需自己起服务 |
| 后台 | `http://127.0.0.1:3000/admin`（真后台，默认密码 `admin123`） | **无后台**（旧版 `#admin` 假后台已移除，访问会跳回首页） |
| 内容存哪 | `portfolio/data.json`（密码哈希在 `auth.json`，不入库） | 内容在**构建时**内联进 `index.html`，线上没有后台 |
| 改完能上线吗 | 不能直接上线，必须构建后发布 | — |

**结论**：线上内容 = 用 `portfolio/data.json` + `portfolio-spa/` 源码**构建**出的静态文件。后台的改动不会自动上线，中间必须走一次「构建 + 发布」。

## 1. 更新内容（二选一）

### 方法 A：用真后台（最直观）

```bash
cd portfolio
node server.js
```

浏览器打开 `http://127.0.0.1:3000/admin`，登录（默认 `admin123`；首次启动按环境变量 `ADMIN_PASSWORD` 生成，登录后请先去「设置」改密码）。

8 个选项卡对应 `data.json` 字段：基本信息 / 擅长方向 / 作品管理 / 案例详情 / 技能与软件 / 联系方式 / 访问记录（服务端只读）/ 设置。
改完点右上角「保存全部修改」→ 写回 `portfolio/data.json`（原子写，自动留 `data.json.bak` 备份）。
上传的图片/视频落到 `portfolio/public/images/` 或 `portfolio/public/videos/`。

### 方法 B：直接编辑 `portfolio/data.json`

跳过起服务，直接改 JSON。改完同样能被构建读取。
注意 JSON 语法别写错（写错会导致构建失败）；`readData` 有 `.bak` 兜底，不会清空内容。

## 2. 构建并发布（已自动化，无需手跑 sed / 双目录复制）

```bash
cd <项目根目录>                        # 含 portfolio/、portfolio-spa/、scripts/ 的那一层
python scripts/build_spa.py --strict   # 缺失媒体直接失败，别悄悄上线裂图
```

脚本自动完成三件事：

1. 检查 `data.json` 引用的图片/视频是否齐全（外链 `http/https` 跳过校验）；
2. 把用到的媒体从 `portfolio/public/` **自动镜像**到 `portfolio-spa/`（你只需在 `public/` 维护一份，不用手工复制两份）；
3. 产出两份文件：
   - `portfolio-spa/index.html` —— 相对路径版，本地多场景可用；
   - `index.html`（**仓库根**）—— 媒体路径已改写为 `portfolio-spa/` 下，直接供 Pages 根目录托管。

> 新增了媒体文件时，提交要连同新文件一起提交（`portfolio/public/...` 与 `portfolio-spa/...` 两份，脚本已自动同步，但仓库里两者都要在）。

### 推送到 GitHub（二选一）

**方式 1 — 在能联网的机器用 git（首选）**

```bash
git add index.html portfolio-spa/index.html portfolio/data.json \
        portfolio/public/images/<新图> portfolio-spa/images/<新图>
git commit -m "content: 更新作品集内容"
git push origin main
```

**方式 2 — 在本机（git 被代理拦截）用 API 提交**

本机 `git push` 连不通（代理只放行 `api.github.com`）。用仓库里的辅助脚本一次提交多个文件：

```bash
node commit-files.js "index.html,portfolio-spa/index.html,portfolio/data.json,portfolio/public/images/<新图>,portfolio-spa/images/<新图>" "content: 更新作品集内容"
```

提交后约 1 分钟，GitHub Pages 自动重建。刷新 <https://zzjjr.github.io/zjrportfolio/> 确认（必要时 `Ctrl/Cmd+Shift+R` 强刷）。

## 3. 发布前前置检查

- [ ] 本地 `node server.js` 能启动、后台能登录
- [ ] 内容已保存（`portfolio/data.json` 已更新）
- [ ] 新增媒体已落在 `portfolio/public/`（脚本会自动镜像到 `portfolio-spa/`）
- [ ] 构建用 `--strict`，无缺失媒体告警
- [ ] `contact.socials` 无 `"url": "#"` 占位（点了会跳页首）
- [ ] 视频：目前全为空，要么上传 mp4，要么改对象存储外链

## 4. 注意事项（踩坑记录）

1. **图片/视频只需放 `portfolio/public/` 一份**：脚本会镜像到 `portfolio-spa/`，线上从 `portfolio-spa/` 读取。不要再手工复制两份。
2. **视频路径已自动覆盖**：构建会把 `"videos/` 一并改写为 `"portfolio-spa/videos/`；加视频时把文件放 `portfolio/public/videos/` 即可。
3. **改 `data.json` ≠ 线上生效**：必须「构建 → 发布」两步。
4. **`--strict` 比默认安全**：默认构建对缺失媒体只告警，会悄悄上线裂图。
5. **隐私**：电话已留空（需要公开时再填真实号码）；`contact.socials` 为空数组，没有真实主页时不显示整块，避免 `#` 死链。
6. **密码**：`admin123` 是公开默认值，本地起服务后先去「设置」改掉；`auth.json` 已被 gitignore，不会进仓库。
7. **Pages 有缓存**：发布后没立刻变，等 1 分钟 + 强刷。
8. **本地 `.git` 与远端有分歧**：之前用 API 提交产生的 SHA 与本地对不上，**建议在能联网的机器重新 `git clone`**，别依赖本地那份 `.git`。
9. **别去线上找 `#admin`**：假后台已移除，那是设计如此，不是坏了。

## 5. 相关文件

- `portfolio/server.js` —— 全栈服务（前台 + `/admin` 真后台）
- `portfolio/data.json` —— 内容数据源（构建读取）
- `portfolio/.env.example` —— `PORT` / `HOST` / `ADMIN_PASSWORD` 环境变量说明
- `portfolio-spa/index.template.html` —— SPA 模板（后台视图包在 `<!--ADMIN_START-->…<!--ADMIN_END-->` 标记内，构建时裁掉）
- `portfolio-spa/js/app.js` —— SPA 逻辑（后台逻辑包在 `/*ADMIN_START*/…/*ADMIN_END*/` 标记内）
- `scripts/build_spa.py` —— 构建脚本（`--strict` / `--keep-admin`；自动镜像媒体 + 生成根 `index.html`）
- `commit-files.js` —— 本机绕过被拦截的 git、用 GitHub API 提交多个文件的辅助脚本
- `DEPLOY.md` —— 上线清单（环境/变量/部署/回滚）
- `GITHUB.md` —— 上传 GitHub 清单（文件取舍 / .gitignore / 脱敏项）
