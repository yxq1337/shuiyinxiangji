#!/bin/bash
# 水印相机部署脚本

echo "开始部署水印相机项目..."

# 步骤 1: 部署 Worker 后端
echo -e "\n步骤 1: 部署 Worker 后端..."
cd C:/Users/HUAWEI/shuiyinxiangji
npx wrangler deploy

# 步骤 2: 部署前端 Pages
echo -e "\n步骤 2: 部署前端 Pages..."
npm run build
npx wrangler pages deploy dist --project-name=shuiyinxiangji --commit-dirty=true

echo -e "\n部署完成！"
