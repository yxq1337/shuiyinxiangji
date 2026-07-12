# 水印相机部署脚本

Write-Host "开始部署水印相机项目..." -ForegroundColor Green

# 步骤 1: 部署 Worker 后端
Write-Host "`n步骤 1: 部署 Worker 后端..." -ForegroundColor Yellow
cd C:\Users\HUAWEI\shuiyinxiangji
npx wrangler deploy

# 步骤 2: 部署前端 Pages
Write-Host "`n步骤 2: 部署前端 Pages..." -ForegroundColor Yellow
npm run build
npx wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true

Write-Host "`n部署完成！" -ForegroundColor Green
