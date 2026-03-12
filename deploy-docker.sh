#!/bin/bash

# Docker 部署配置
SERVER="43.166.161.176"
REMOTE_PATH="/root/world-slice"
IMAGE_NAME="world-slice"
CONTAINER_NAME="world-slice-app"

echo "🐳 开始 Docker 部署到 $SERVER"

# 1. 同步文件到服务器
echo "📦 同步文件..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'coverage' \
  --exclude 'playwright-report' \
  --exclude 'test-results' \
  --exclude '.env.local' \
  --exclude '.DS_Store' \
  . root@$SERVER:$REMOTE_PATH/

if [ $? -ne 0 ]; then
  echo "❌ 文件传输失败"
  exit 1
fi

echo "✅ 文件传输成功"

# 2. 在服务器上构建和运行 Docker
echo ""
echo "🔨 在服务器上构建 Docker 镜像..."
ssh root@$SERVER << 'ENDSSH'
cd /root/world-slice

# 停止并删除旧容器
docker stop world-slice-app 2>/dev/null || true
docker rm world-slice-app 2>/dev/null || true

# 构建新镜像
docker build -t world-slice .

# 运行容器
docker run -d \
  --name world-slice-app \
  -p 3000:3000 \
  --restart unless-stopped \
  -v /root/world-slice/data:/app/data \
  --env-file .env.local \
  world-slice

# 检查容器状态
docker ps | grep world-slice-app

echo ""
echo "✅ Docker 容器已启动"
echo "🌐 访问地址: http://43.166.161.176:3000"
ENDSSH

if [ $? -eq 0 ]; then
  echo ""
  echo "🎉 部署成功！"
  echo ""
  echo "📝 查看日志: ssh root@$SERVER 'docker logs -f world-slice-app'"
  echo "🔄 重启服务: ssh root@$SERVER 'docker restart world-slice-app'"
  echo "🛑 停止服务: ssh root@$SERVER 'docker stop world-slice-app'"
else
  echo "❌ 部署失败"
  exit 1
fi
