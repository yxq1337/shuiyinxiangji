# 部署到 Cloudflare（Workers + D1 + Pages）

本项目支持两种运行模式：
- **本地开发**：Express 后端（`npm run dev`）
- **生产环境**：Cloudflare Workers + D1 + Pages

---

## 一、首次部署完整流程

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

```bash
npx wrangler login
```

浏览器会打开授权页面，登录你的 Cloudflare 账号。

### 3. 创建 D1 数据库

```bash
npm run db:create
```

命令会输出类似：

```
✅ Successfully created DB 'shuiyinxiangji-db' in region APAC
Created your database using D1's new storage backend.
[[d1_databases]]
binding = "DB"
database_name = "shuiyinxiangji-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**复制上面输出的 `database_id`**，替换 `wrangler.toml` 中的 `REPLACE_WITH_YOUR_D1_ID`。

### 4. 初始化数据库表结构

```bash
# 初始化远程（生产）数据库
npm run db:init:remote

# 或初始化本地开发数据库
npm run db:init
```

### 5. （可选）用 Secret 保护管理员密码

默认密码在 `wrangler.toml` 是明文，更安全的做法：

```bash
# 删除 wrangler.toml 里的 ADMIN_PASSWORD 那一行，然后：
npx wrangler secret put ADMIN_PASSWORD
# 输入你的密码后回车
```

### 6. 部署 Worker

```bash
npm run deploy:worker
```

部署成功后会得到一个 Worker URL，比如：
`https://shuiyinxiangji-api.your-account.workers.dev`

### 7. 部署前端到 Pages

**方案 A：命令行部署（推荐首次）**

```bash
# 先设置前端环境变量，指向 Worker 域名
echo "VITE_API_BASE=https://shuiyinxiangji-api.your-account.workers.dev" > .env.production

# 构建并部署
npm run deploy:pages
```

**方案 B：Cloudflare 控制台绑定 GitHub 自动部署**

1. 打开 Cloudflare Dashboard → Pages
2. 找到你的 `shuiyinxiangji` 项目 → 设置
3. **环境变量** 添加：
   - `VITE_API_BASE` = `https://shuiyinxiangji-api.your-account.workers.dev`
4. 触发一次重新部署即可

---

## 二、日常开发

### 本地开发（保留 Express 模式）

```bash
npm run dev
```

访问 `http://localhost:3000`，后端用 Express（内存存储），适合快速开发调试。

### 本地开发（用 Workers 模拟）

```bash
# 需要先本地初始化 D1 数据库
npm run db:init

# 启动 Workers 本地模拟
npm run dev:worker
```

---

## 三、后续更新部署

### 只更新后端

```bash
npm run deploy:worker
```

### 只更新前端

```bash
npm run deploy:pages
```

### 修改数据库表结构

编辑 `worker/schema.sql`，然后：

```bash
npm run db:init:remote
```

**⚠️ 注意：`schema.sql` 使用 `CREATE TABLE IF NOT EXISTS`，重复执行不会覆盖数据，但也不会修改现有表结构。如需修改表，请手动编写 ALTER TABLE 语句。**

---

## 四、账号信息

- **管理员用户名**：`admin`
- **管理员密码**：`VIP1337`（可通过 `wrangler.toml` 的 `ADMIN_PASSWORD` 修改）
- **普通用户**：任意手机号一键登录

---

## 五、故障排查

### 前端登录报错、显示网络错误

检查前端环境变量 `VITE_API_BASE` 是否指向正确的 Worker 域名。

### Worker 报错 D1_ERROR

- 检查 `wrangler.toml` 的 `database_id` 是否正确
- 检查是否执行了 `npm run db:init:remote` 初始化表结构

### 管理员登录报错 401

- 检查 `wrangler.toml` 或 Secret 中的 `ADMIN_PASSWORD` 是否正确
- 大小写敏感

---

## 六、成本

Cloudflare 免费额度足够个人项目：

- **Workers**：每天 10 万次请求
- **D1**：每天 500 万次读、10 万次写、5 GB 存储
- **Pages**：每月 500 次构建，带宽无限

正常使用完全够用，**几乎为零成本**。
