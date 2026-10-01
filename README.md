# 战争雷霆科技树

基于 React、TypeScript 和 Vite 的战争雷霆载具科技树与研发资源规划工具。由原 C# 项目迁移而来，使用亮色毛玻璃界面，支持桌面及移动端。构建后为静态站点，无需数据库或后端服务。

## 功能

- 十国陆军、空军和直升机，共 30 棵科技树、2,660 辆载具。
- 中英文名称、搜索、等级筛选、特殊载具筛选，以及各战斗模式权重。
- 科技树左键选择载具，右键查看资料；载具组悬浮展开。
- 快速研发补齐前置载具和等级解锁条件，汇总 RP、SL，支持 JSON 导出。
- 改装件前置顺序和层级解锁规划：左键选择并汇总资源，右键查看详情；金币载具改装件已解锁。
- 挂载武器图标与悬浮详情，按照兵种显示适用的数据标签。
- 浏览器本地保存国家、兵种、语言与模式偏好。

快速研发以零进度为起点，使用 RP 贪心估算，**不保证全局最优**；不扣除已拥有载具，SL 仅统计载具购买费用。数据为固定快照，并非实时同步。图片按需从来源网站加载，失败时显示备用图标。

## 本地运行

需要 **Node.js 22.12 或更高版本**，推荐 Node.js 24。

```sh
git clone https://github.com/elainasamae/war-thunder-tech-tree.git
cd war-thunder-tech-tree
npm ci
npm run dev
```

打开终端输出的本地地址，默认 http://127.0.0.1:5173 。

## 构建与验证

```sh
npm test
npm run build
npm run preview
```

静态输出在 `dist/`，预览默认 http://127.0.0.1:4173 。将整个 `dist/` 部署到支持静态网站的托管平台。请通过 HTTP 服务访问，直接打开 HTML 文件无法正常加载数据。

页面交互测试需要 Playwright 浏览器：

```sh
npx playwright install chromium
npm run test:e2e
```

GitHub Actions 自动执行数据及规划逻辑测试和生产构建。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `src/web/` | 页面、载具资料、挂载、改装件及研发规划逻辑 |
| `Data/` | 各国科技树、中文名称、载具资料和解锁条件 JSON |
| `tests/` | 数据、规划逻辑与浏览器交互测试 |
| `tools/` | 从上游更新补充数据的维护脚本 |

支持 WebMCP 的浏览器可调用 `select_research_route`，按照与页面相同的逻辑选择当前科技树中的研发目标。普通浏览器无需此接口即可使用全部页面功能。

## Sites 托管

可使用 Sites 导入本项目。`.openai/hosting.example.json` 提供静态输出配置示例；创建自己的 Site 时使用它生成 `.openai/hosting.json`，并保存新 Site 返回的 `project_id`。公开源码不包含原私有 Site 的身份或访问凭据。

## 许可证与来源

原创源码采用 [MIT 许可证](LICENSE)。项目为非官方社区工具，与 Gaijin Entertainment 无隶属关系。

第三方数据、图片及商标的权利属于各自所有者，MIT 许可证不授予这些内容的使用权。数据保留上游来源信息，主要来源为 [War Thunder Wiki](https://wiki.warthunder.com/) 和 [War Thunder Datamine](https://github.com/gszabi99/War-Thunder-Datamine)。详情见 [第三方声明](THIRD_PARTY_NOTICES.md)。

欢迎通过 Issue 报告问题，或提交 Pull Request。变更前请运行测试及构建，涉及数据时保留来源信息。

## UID Guard 展示与申请

主域名首页保持科技树，短路径 `/u/` 为 UID Guard 公开名单查询页，可查看 UID、昵称、来源备注与原因。支持搜索、UID 复制和官方玩家查询。

申请人直接在网页提交 UID、昵称、原因及证据链接，无需自己的邮箱。FormSubmit 负责邮件转发，提交接口使用收件人提供的随机标识；失败或未激活时保留输入，不虚报提交成功。申请不会自动加入黑名单。桌面 UID Guard 软件保持不变。

公开名单来自 GitHub 公开源，源不可用时显示有日期的副本。其内容可能与桌面同步服务器的最新名单不同。细节见 [UID 页面说明](docs/UID-WEB.md)。
