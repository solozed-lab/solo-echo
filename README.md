# Solo & Echo · 犹如三生万物

> 人与 AI、AI 与 AI、人与人 —— 当三种关系同时成立，新的东西不需要被发明，它自己生长出来。
> 万物不是被造出来的，是被关系带出来的。

| | |
|---|---|
| 线上 | **https://solo-echo.pages.dev/** |
| 正式域名 | **https://solozed.com** / https://www.solozed.com |
| 仓库 | https://github.com/solozed-lab/solo-echo |
| 部署 | Cloudflare Pages（项目 `solo-echo`）——**已连接 GitHub**，推 `main` 即自动上线 |

**部署链路**：GitHub `solozed-lab/solo-echo` → Cloudflare Pages（Git 集成，
生产分支 `main`，开 PR 预览部署）→ 自定义域名 `solozed.com`。

Pages 项目的构建配置（API 建项目时必须显式给，否则会部署**仓库根**而不是 `site/`，
导致所有视频/图片 404、背景层静默消失）：

```json
{ "build_config": { "build_command": "", "root_dir": "", "destination_dir": "site" },
  "production_branch": "main",
  "source": { "type": "github", "config": { "owner": "solozed-lab", "repo_name": "solo-echo" } } }
```

**控制台里对应的四个字段应该是**：

| 字段 | 值 |
|---|---|
| Framework preset | None |
| Build command（构建命令） | **留空**（或 `exit 0`） |
| Build output directory（输出目录） | `site` |
| Root directory（根目录） | 留空 |

> ⚠️ 构建命令**不要填 `npx wrangler deploy`** —— 那是 **Workers** 的命令，
> 在 Pages 项目上会报 "Missing entry-point to Worker script or to assets directory"。
> Pages 要用 `npx wrangler pages deploy`，但 Git 集成场景根本不需要部署命令：
> 留空即可，Pages 会自己把输出目录当静态资源上传。
> 同理，不要在仓库里加 `package.json` 的 `build` 脚本 —— 框架自动探测可能
> 把它当成构建命令。

> 两个容易踩的字段名：输出目录是 **`destination_dir`**（写 `output_dir` 会被 API
> 静默丢弃）；仓库名是 **`repo_name`**（写 `repo` 会报
> "Missing project source configuration"）。

> 自定义域名的 DNS 记录（CNAME → `solo-echo.pages.dev`）需要在 Cloudflare 控制台
> 添加：DNS → Records。`wrangler` 的 OAuth token 只有 `zone(read)` / `pages(write)`，
> 没有 DNS 权限，API 改不了。

手动部署（不依赖 Git 集成时的备用路径）：

```bash
npx wrangler pages deploy site --project-name=solo-echo --branch=main
```

> 改完仓库内容后，除了看首页，**务必全量校验一遍资源**（45 个文件应全部 200）：
> Git 构建的产物目录配错时，首页往往还是好的（引擎会退回 poster），
> 但视频层已经死了 —— 只看首页会漏掉这种故障。

叙事骨架取自「**道生一，一生二，二生三，三生万物**」：

| 章节标记 | 章节 | 关系 | 粒子形态 | 强调色 |
|---|---|---|---|---|
| 万物 · 起点 | 起点 | 第一个节点是人 | 球云 | 青 `#4de3ff` |
| 一 · 人与 AI | 人与 AI | 人 ↔ AI | 双极（左右互吸） | 紫 `#a06bff` |
| 二 · AI 与 AI | AI 与 AI | AI ↔ AI | 双格栅（互发信号） | 品红 `#ff7bd5` |
| 三 · 人与人 | 人与人 | 人 ↔ 人 | 簇群 | 金 `#ffb765` |
| 三生万物 | 万物 | 三者合流 | 球壳 | 青蓝 `#6bd8ff` |
| 加入我们 | 加入 | CTA | 拱门收敛 | 白 `#eaf6ff` |

**关键论点**：万物不是并列的第四种关系，而是前三种关系同时成立之后**自己长出来**的。
所以第 5 章标题是「犹如三生万物」而不是"连接"，视觉上三种色调也在此合流。

**各章文案**

| 序 | 章节 | 标题 |
|---|---|---|
| 万物 · 起点 | 起点 | 一切从一个节点开始 |
| 一 · 人与 AI | 人与 AI | AI 不是工具，而是另一个数字的伙伴 |
| 二 · AI 与 AI | AI 与 AI | 当智能体开始彼此对话 |
| 三 · 人与人 | 人与人 | 人与人之间，重新回归连接 |
| 三生万物 | 万物 | 犹如三生万物 |
| 加入我们 | 加入我们 | 让你的回声，被更多节点听见 |

## 跑起来

```bash
python3 tools/serve.py 8899 site
# 打开 http://127.0.0.1:8899/
```

必须走 HTTP（视频层用 fetch 加载 blob，`file://` 会被 CORS 拦掉）。
摄像头需要安全上下文：`localhost` 或 `https` 均可。

> 用 `tools/serve.py`（多线程）而不是 `python3 -m http.server`（单线程）：
> 页面会并发拉 11 段视频，单线程服务器会排队，偶发 `ERR_CONNECTION_RESET`。

## 三层结构

| 层 | 内容 | 随滚动 scrub | 响应交互 |
|---|---|---|---|
| L0 背景视频 | 6 段章节片 + 5 段"连接"转场（`assets/vid/`，低透明度 screen 混合） | ✅ | ✗ |
| L1 实时粒子 | WebGL2 粒子 / 连线 / 扩散波（`assets/js/field.js`） | ✅（章节参数插值） | ✅ 鼠标·触摸·摄像头·陀螺仪 |
| L2 文字 | DOM 排版、章节文案、CTA（插件 `scrub-engine.js` 构建） | ✅ | ✅ |

视频是死的，粒子是活的 —— 所以所有互动都发生在 L1，视频只负责给背景做电影级纵深。
即使视频加载失败、reduced-motion 或没有 WebGL2，L1+L2 仍构成完整可读页面。

## 中英双语

顶栏右侧 `中 / EN` 开关，切换**不重挂载、不丢滚动位置**——插件在挂载时把文案写进 DOM，
之后不再碰文字，所以语言层 = 原地改写 DOM 文本（`world.js` 的 `applyLang()`）。

| 覆盖范围 | 说明 |
|---|---|
| 六章 eyebrow / 标题 / 正文 / 标签 | 中英各一套，结构一一对应（标签数量一致，无需重建 DOM） |
| 顶部导航胶囊、右侧章节圆点标签 | 同步切换 |
| 顶栏 CTA、终屏按钮、滚动提示 | 同步切换 |
| HUD 面板全部标签、隐私说明、实时读数 | `data-i18n` 驱动，运行时消息也走语言字典 |
| `<title>` / `meta description` / `<html lang>` | 同步切换，利于 SEO |

**优先级**：`?lang=en` / `?lang=zh` 参数 > localStorage 记忆 > 默认中文。
参数形式方便分享指定语言的链接，也便于验收。切换后写入 localStorage，下次访问沿用。

英文版的 eyebrow 会被插件的 `text-transform:uppercase` 渲染成全大写（`ALL THINGS · ORIGIN`），
正好落在"机器的声音"那一侧；中文版不受影响。英文标题用 `\n` 显式断行
（CSS `white-space: pre-line`），中文标题自然折行。

## 「加入」弹框

顶栏 CTA 和终屏主按钮点开一个玻璃弹框，告诉用户**社区即将开放**。

- 面板顶部一条三色细线 = 三种关系（青 → 紫 → 金）
- 状态胶囊「即将开放」带呼吸点
- 只给状态 + 说明 + 一个体面的关闭动作，**不做假表单**（没有后端的邮箱输入框是骗人的）
- 关闭方式：知道了按钮 / 右上 × / 点遮罩 / ESC
- 打开时不锁 body 滚动（引擎靠 `window.scrollY` 定位章节，锁了会把位置清零），
  改成在遮罩上拦截 wheel / touchmove
- 焦点管理：打开时聚焦主按钮，关闭时归还焦点
- 中英双语，走同一套 `data-modal-i18n` 字典

> 踩过的坑：引擎的 section CTA 要的是 `{label, href}` **对象**，
> 传字符串时标签会被覆盖但 `href` 掉回 `#`（于是点了只会跳页首、进不了弹框）。
> 现在触发条件按**语义**匹配（`.sw-topcta` / `.sw-btn--primary`），不依赖 href。

## 交互面板：每一项做什么

面板在右下角「**交互面板**」（手机端从顶部展开，不压正文）。

| 控件 | 作用 | 细节 |
|---|---|---|
| **粒子密度** 滑杆 | 实时调整粒子数量（20–100） | 同时受自适应画质影响：帧耗时超标时系统会自动降档，滑杆是上限 |
| **摄像头** | 本机逐帧计算亮度 / 运动量 / 色温 → 驱动粒子"能量"与色温 | 只在内存里处理，**不录制、不上传**；画面越暗越静、运动越大越活跃。未授权会提示原因，不影响其他功能 |
| **陀螺仪** | 设备倾斜 → 重力向量 → 整个粒子场随倾斜偏移 | 手机体验最佳；iOS 需点按钮授权手势 |
| **摇一摇** | 加速度突变 → 从中心触发一次扩散冲击波 | 需要设备有加速度计 |
| **环境光** | `AmbientLightSensor` 调节整体曝光 | 极少设备支持，不支持时按钮自动置灰 |
| **涌现事件** 开关 | 开启/关闭"智能随机"事件调度 | 关闭后只剩噪声流场的自然运动 |
| **视频层** 开关 | 关闭/开启背景视频 | 省流量省性能，或只保留纯粒子效果 |
| **扩散脉冲** | 手动从屏幕中心打一发冲击波 | 约 3 秒扩散到全屏 |

面板底部实时读数：`粒子 N · 连线 N · 事件 N · FPS`。
「事件」是已触发的涌现事件次数，可以直接看到智能随机在工作。

### 涌现事件都有什么

不是白噪声抖动，而是：种子化 RNG + 梯度噪声流场 + 事件调度器。
调度器按章节能量调整频率（4–10 秒一次），且避免连续重复同类事件。

| 事件 | 表现 |
|---|---|
| chain | 沿邻近关系传播一次电荷链，光顺着网络跑一段 |
| burst | 随机位置簇爆，局部炸开并点亮 |
| swarm | 一群节点被同一个目标吸引，临时结成星座 |
| constellation | 随机 5 个节点拉出长程连线 |
| ripple | 一道大范围低强度涟漪扫过 |

## 其它交互

- **鼠标移动**：指针半径内粒子被推开并产生旋涡；**指针越快越转为拉拽**，连线随之拉伸
- **点击 / 点按**：从触点发射一次扩散冲击波
- **触摸拖拽**：多点触控各自成源

## 目录

```
site/
├── index.html
├── scrub-engine.js              # 插件的滚动 scrub 引擎（未改动）
└── assets/
    ├── css/theme.css            # 深空主题 + HUD
    ├── js/field.js              # 实时粒子场（WebGL2 + Canvas2D 降级）
    ├── js/sensors.js            # 摄像头 / 陀螺仪 / 加速度 / 环境光
    ├── js/world.js              # 章节配置、时间轴映射、HUD、接线
    ├── img/                     # 章节关键帧 + 每段视频首帧 poster
    └── vid/                     # 桌面 960x540 / 手机 960x540（-g 4）双版本
work/
├── storyboard.md                # 视觉规则 + 滚动分镜表
├── analysis/                    # 生成脚本与任务记录
├── raw/                         # 原始生成视频（git 忽略）
└── qa/                          # 浏览器验收截图（git 忽略）
```

## 已知取舍

- 视频层是 16:9 素材，竖屏手机上会被放大裁切（粒子层是主角，压暗后可接受）
- 摄像头在非安全上下文（http 公网域名）不可用，需 https
- iOS 的陀螺仪需要用户手势授权，点击按钮即触发
