# UID Guard 公开展示页

`/` 保持科技树，`/u/` 显示 UID Guard 公开名单和申请表。桌面软件及其同步、管理员上传、签名验证流程不变。这里没有移植桌面监控功能，也不会自动把申请加入黑名单。

## 名单来源

页面读取 `https://raw.githubusercontent.com/elainasamae/WarThunderUIDGuard/main/data/blacklist.json`。公开源不可用时显示 `Data/uid-blacklist.json` 的已注明日期的副本。副本仅从已公开的 GitHub 数据取得，不包含本地软件的私人记录或凭据。

原同步服务器在本次检查中不可连接，且为 HTTP 服务，HTTPS 页面不直接读取它。GitHub 公开源可能与桌面软件的最新服务器数据不同；显示记录更新时间、来源备注及离线副本状态，不宣称名单已经审核或实时与软件一致。原始原因为空时显示“公开记录未填写原因”。

## 申请邮件

表单通过 FormSubmit 的 HTTPS AJAX 接口，把 UID、昵称、原因和可选证据链接转发到 `elainasamae@outlook.com`。申请人无需邮箱，也无需自行打开邮件客户端。申请内容不写入本站数据库；由第三方服务转发并遵循其隐私政策。

首次启用需要收件邮箱点击 FormSubmit 的 **Activate Form** 确认邮件。未激活或服务失败时，页面显示明确错误并保留输入，不会显示“申请已提交”。服务确认接收申请后，页面才显示提交完成；这不等同于维护者已审核或邮箱已投递。

接口配置位于 `src/uid/core.ts`。浏览器提交地址使用 FormSubmit 提供的随机标识，不暴露收件邮箱，也不包含邮件密码或 API Key。

## 本地开发与部署

与科技树共用 `npm ci`、`npm run dev`、`npm run build`，Vite 同时生成 `dist/index.html` 和 `dist/u/index.html`。静态托管需保留完整构建目录，支持目录索引。`npm test` 包含名单解析、UID 精度、表单校验和邮件服务响应状态测试。
