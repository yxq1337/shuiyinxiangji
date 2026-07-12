# 半自动截图审核 端到端测试报告

日期：2026-07-13

## 已完成部分

✅ Task 1-7 全部完成
✅ 前端构建成功
✅ 代码已提交到 git

## 需要用户手动操作部分

### 1. 添加微信收款码图片

请把微信收款码图片保存为 PNG 格式，重命名为 `wechat-pay-qr.png`，然后放到 `public/` 目录下。

完成后运行：
```bash
git add public/wechat-pay-qr.png
git rm -f public/wechat-pay-qr.png.PLACEHOLDER.md
git commit -m "feat: 添加微信收款码图片"
```

### 2. 部署前端到 Cloudflare Pages

```bash
# 设置 API token（在当前 shell 会话中）
# 然后运行：
npm run build
npx wrangler pages deploy dist --project-name=shuiyinxiangji
```

### 3. （可选）配置 Resend 邮件通知

如需启用邮件通知：
1. 访问 https://resend.com 注册并获取 API Key
2. 设置到 wrangler secret：
   ```bash
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put ADMIN_EMAIL
   ```
3. 重新部署 Worker

## 测试用例（待完成）

- [ ] 用户下单
- [ ] 显示收款码 + 订单号
- [ ] 复制订单号
- [ ] 上传截图
- [ ] 状态变 pending_review
- [ ] 管理员收邮件通知（如果已配置）
- [ ] 管理后台红点显示
- [ ] 审核通过
- [ ] VIP 激活
- [ ] 用户端轮询到 success
