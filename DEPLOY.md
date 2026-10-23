# 上线清单 — 剪辑师作品集网站

两种发布形态，按需要选一种：

| 形态 | 目录 | 适用场景 | 能否在线改内容 |
|---|---|---|---|
| **全栈版**（推荐） | `portfolio/` | 有 Node 环境的服务器 / VPS | 能，后台改完即时生效 |
| **静态版** | `portfolio-spa/index.html` 或 `portfolio-static/` | GitHub Pages、对象存储、资料库等纯静态托管 | 不能，内容变更需重新构建 |

---

## 一、环境要求

| 项 | 要求 | 说明 |
|---|---|---|
| Node.js | ≥ 18（仅全栈版需要） | 零第三方依赖，`node server.js` 直接跑，无需 `npm install` |
| Python | ≥ 3.8（仅构建静态版需要） | 构建脚本为纯标准库 |
| 磁盘 | ≥ 1 GB | 视频上限单文件 200MB，建议预留 10 倍余量 |
| 端口 | 默认 3000 | 用 `PORT` 覆盖 |

---

## 二、环境变量

| 变量 | 默认值 | 必填 | 说明 |
|---|---|---|---|
| `PORT` | `3000` | 否 | 监听端口 |
| `HOST` | `127.0.0.1` | 否 | **默认只监听本机**。要对外服务才设 `0.0.0.0`，并务必配反向代理 |
| `ADMIN_PASSWORD` | `admin123` | 否 | 首次启动时写入的初始密码。仅当 `portfolio/auth.json` 还不存在（即没有密码哈希）时生效 |

> 项目不依赖 `.env` 文件（保持零依赖），请以系统环境变量或进程管理器（systemd / pm2 / Docker）的方式注入。模板见 `portfolio/.env.example`。

反向代理建议：用 Nginx 终止 HTTPS，把 `/` 反代到 `127.0.0.1:3000`，并放宽上传体积限制：

```nginx
client_max_body_size 210m;      # 视频上限 200MB
proxy_read_timeout 300s;
```

---

## 三、构建命令

```bash
# 全栈版：无需构建，直接启动
cd portfolio && node server.js

# 静态单文件版（portfolio-spa/index.html，推荐用于静态托管）
python scripts/build_spa.py              # 缺失媒体只告警
python scripts/build_spa.py --strict     # 缺失媒体直接失败，用于上线前把关

# 静态多页版（portfolio-static/，含 css/js/images）
python scripts/build_static.py
```

构建脚本已改为相对脚本位置解析路径（原先写死 `D:\WB\...`），换机器可直接运行。
`build_spa.py` 会在构建时校验 `data.json` 里引用的图片/视频是否真实存在，避免上线后出现 404。

---

## 四、部署步骤（全栈版）

1. **上传代码**：把整个项目目录传到服务器（不含 `access-log.json`、`data.json.bak`、上传的视频）。
2. **放置内容**：确认 `portfolio/data.json` 是你最终要发布的内容；`portfolio/public/images/` 内封面图齐全。
3. **上传视频**：登录后台「作品管理」上传，或直接把 mp4 放进 `portfolio/public/videos/` 并在后台填路径。
4. **设置环境变量**：`PORT`、`HOST=0.0.0.0`、`ADMIN_PASSWORD=<强密码>`。
5. **启动**：`cd portfolio && node server.js`（生产建议用 pm2 / systemd 守护）。
6. **冒烟验证**（逐条确认）：
   - `curl http://127.0.0.1:3000/api/health` → 返回 `{"ok":true,...}`
   - 打开 `/` 首页渲染正常，无空白区块
   - 打开 `/case?id=city-morning` 案例页正常
   - 打开 `/admin` 用新密码登录 → 立刻在「设置」里确认初始密码已改
   - 点一个作品的播放按钮，视频能播且**能拖动进度条**（Range 生效）
7. **配置 HTTPS 与反代**，然后对外放行。

## 部署步骤（静态版）

```bash
python scripts/build_spa.py --strict     # 必须无缺失资源
# 上传 portfolio-spa/index.html 到任意静态托管即可
```

公开发布的静态版**不含任何后台入口**（旧版的纯前端假后台 `#admin` 已在构建时被裁掉，访问会直接回首页）。需要在线改内容请部署全栈版，或本地用 `node server.js` 改完再重新构建发布。

---

## 五、上线前检查清单

- [ ] `python scripts/build_spa.py --strict` 无输出告警（仅静态版需要）
- [ ] `data.json` 里没有遗留占位内容（如空标题、空封面、`"#"` 社交链接）
- [ ] 视频文件已就位，且首页/案例页播放正常、进度条可拖动
- [ ] 后台初始密码已修改，且不再是 `admin123`
- [ ] 密码哈希存放在 `portfolio/auth.json`，`data.json` 中没有任何 `adminPassword` 字段
- [ ] `HOST` 未误设为 `0.0.0.0`（除非确实要对外）
- [ ] 服务器已开放 3000 端口 / 反代配置正确
- [ ] 已确认 `data.json.bak` 备份机制可用（写入时自动生成）

---

## 六、回滚方案

**内容回滚（最常用，无需重启）**

`data.json` 每次写入前会自动把上一版复制为 `data.json.bak`。内容改坏了：

```bash
cd portfolio
cp data.json data.json.bad      # 先留存出错版本
cp data.json.bak data.json      # 回滚到上一版
```

刷新页面即生效。若 `data.json` 损坏到无法解析，服务会自动回退读取 `data.json.bak` 并在日志里告警，同时把损坏文件另存为 `data.json.corrupt-<时间戳>`。

**代码回滚**

```bash
git stash / git checkout <上一个 tag>     # 或还原备份目录
cd portfolio && node server.js
```

**进程回滚**：pm2 用 `pm2 restart portfolio --update-env`；systemd 用 `systemctl restart portfolio`。
保留上一版代码目录（如 `portfolio-prev/`）可在 30 秒内整体切回。

**静态版回滚**：静态托管一般自带版本历史，直接把上一版 `index.html` 重新上传即可；本地可用 git 检出旧产物。

---

## 七、数据备份建议

需要长期保留的只有三个东西，定期打包即可：

- `portfolio/data.json`（全部文字内容与配置）
- `portfolio/public/images/`（封面与个人照片）
- `portfolio/public/videos/`（上传的视频）

`access-log.json` 是访问日志，可随时清空，不影响站点。
