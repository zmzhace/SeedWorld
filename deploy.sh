#!/bin/bash

# 部署配置
SERVER="43.166.161.176"
REMOTE_PATH="/root/world-slice"
LOCAL_PATH="."

echo "🚀 开始部署到 $SERVER:$REMOTE_PATH"

# 使用 rsync 同步文件（排除不需要的文件）
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'coverage' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude '.env.local' \
  --exclude '.DS_Store' \
  $LOCAL_PATH/ root@$SERVER:$REMOTE_PATH/

if [ $? -eq 0 ]; then
  echo "✅ 文件传输成功"
  echo ""
  echo "📝 下一步操作："
  echo "1. SSH 登录服务器: ssh root@$SERVER"
  echo "2. 进入项目目录: cd $REMOTE_PATH"
  echo "3. 安装依赖: npm install"
  echo "4. 配置环境变量: cp .env.example .env.local && nano .env.local"
  echo "5. 构建项目: npm run build"
  echo "6. 启动服务: npm start"
else
  echo "❌ 部署失败"
  exit 1
fi
