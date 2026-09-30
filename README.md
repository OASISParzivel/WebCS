# WEB-STRIKE 1.6 · 网页版反恐精英致敬

纯 Three.js + WebAudio 实现的 CS 1.6 风格第一人称射击网页游戏。**零依赖、零构建、零游戏原始资产**——所有音效由 WebAudio 实时合成，所有模型由代码搭建的几何体构成，开箱即玩。

![游戏截图](docs/screenshot.png)

## 玩法

- **5v5 团战**：你率 4 名 CT 队友突入沙漠据点，对抗 5 名 T，先赢 **5** 回合者胜
- 阵亡后进入队友观战视角，回合继续
- 经济系统：击杀 / 回合结算发放金钱（上限 $16000），回合开始 5 秒内可购买装备
- 爆头 4 倍伤害；AWP 右键开镜；战术刀背刺一刀秒杀

## 操作

| 按键 | 功能 |
|---|---|
| W A S D | 移动 |
| 鼠标 | 瞄准 · 左键射击 |
| 右键 | AWP 开镜 |
| Shift | 静步 |
| Ctrl / C | 蹲下 |
| 空格 | 跳跃 |
| R | 换弹 |
| B | 购买菜单（回合开始 5 秒内） |
| 1 / 2 / 3 | 步枪 / 手枪 / 战术刀 |
| Esc | 暂停（模拟冻结） |

## 运行

无需安装任何依赖，二选一：

- 直接双击打开 `cs16.html`
- 或起任意静态服务器后访问，例如：

  ```bash
  python -m http.server 8080
  # 打开 http://localhost:8080/cs16.html
  ```

需要支持 WebGL 的现代浏览器（Chrome / Edge / Firefox）。

## 在线游玩（不下载，直接开网页）

CNB 平台本身不提供 GitHub Pages 式的静态托管，有两种从仓库直接开玩的方式：

### 方式一：云开发预览（零配置，最快）

1. 打开仓库 [cnb.cool/OASIS-Art3mis/webcs](https://cnb.cool/OASIS-Art3mis/webcs)，点 **云开发** 进入 WebIDE
2. 在终端执行 `python3 -m http.server 8080`（默认监听 0.0.0.0，符合端口预览要求）
3. 在 WebIDE 的 **PORTS** 面板添加 `8080` 端口，打开生成的转发地址（形如 `https://xxxx-8080.cnb.run`）即可开玩

> 工作区停止后地址失效，下次进入重复第 2、3 步即可。

### 方式二：推送自动部署到 EdgeOne Pages（持久域名，推荐）

利用本仓库已带好的 `.cnb.yml` 流水线，每次 `git push` 自动把游戏部署到腾讯云 EdgeOne Pages（有免费套餐，分配默认域名）：

1. 注册并登录 **腾讯云 EdgeOne Pages**，在项目设置里创建 **API Token**
2. 在 CNB 新建一个**密钥仓库**（如 `OASIS-Art3mis/env`），在其中新建文件 `edgeone.yml`：

   ```yaml
   EO_SECRET: "你的 EdgeOne Pages Token"
   ```

3. 确认本仓库 `.cnb.yml` 中 `imports` 的 URL 与你的密钥仓库路径一致（当前为 `OASIS-Art3mis/env/-/blob/main/edgeone.yml`）
4. 推送到 `main`，流水线自动部署；完成后在 EdgeOne Pages 控制台获取默认域名（形如 `xxx.edgeone.app`），浏览器直接打开即玩

## 技术要点

- **Three.js** 渲染（本地 `three.min.js`，离线可玩）
- 自实现碰撞与射线：AABB 滑墙移动、slab 法射线检测、视线（LOS）判定
- **Bot AI**：路点巡逻、视线感知（分帧节流）、反应延迟、距离管理 + 横移、卡死脱困、枪声吸引
- **WebAudio 全合成音效**：枪声 / 脚步 / 换弹 / 挥刀 / 命中反馈，无任何音频文件
- 粒子血雾 / 枪口火光 / 曳光弹（共享材质，低 GC 压力）
- HUD 脏检查更新，避免每帧 DOM 写入
- 调试模式：URL 加 `#shot` 进入冻结 AI 的取景模式

## 目录结构

```
webcs/
├── cs16.html        # 页面、HUD 与样式
├── game.js          # 全部游戏逻辑（单文件）
├── three.min.js     # Three.js 本地副本
├── .cnb.yml         # CNB 流水线：推送自动部署到 EdgeOne Pages
└── docs/
    └── screenshot.png
```

## 说明

本项目为向经典致敬的同人原型，与 Valve 无关，不含任何游戏原始资产。
