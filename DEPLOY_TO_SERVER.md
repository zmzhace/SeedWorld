# 部署到服务器指南

## 服务器信息
- IP: 43.166.161.176
- 路径: /root/world-slice
- 用户: root

## 快速部署

### 方式 1: 使用部署脚本（推荐）

```bash
# 给脚本添加执行权限
chmod +x deploy-docker.sh

# 执行部署
./deploy-docker.sh
```

### 方式 2: 手动使用 rsync

```bash
# 从 world-slice 目录执行
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.git' \
  --exclude 'coverage' \
  --exclude '.env.local' \
  . root@43.166.161.176:/root/world-slice/
```

### 方式 3: 使用 scp（简单但较慢）

```bash
# 打包项目（排除不需要的文件）
tar -czf world-slice.tar.gz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.git' \
  --exclude='coverage' \
  --exclude='.env.local' \
  .

# 传输到服务器
scp world-slice.tar.gz root@43.166.161.176:/root/

# SSH 登录服务器解压
ssh root@43.166.161.176
cd /root
tar -xzf world-slice.tar.gz -C world-slice
```

## 服务器端配置

SSH 登录服务器后：

```bash
ssh root@43.166.161.176
cd /root/world-slice
```

### 1. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑环境变量
nano .env.local
```

添加以下内容：
```
ANTHROPIC_BASE_URL=http://www.testnewnew.top
ANTHROPIC_AUTH_TOKEN=sk-baa032942cb94f0eeb2f7e03c2cee8b762709a4d6d134ad3fd740f6e9f0de911
ANTHROPIC_MODEL=gpt-5.2-codex
```

### 2. 使用 Docker 部署（推荐）

```bash
# 构建镜像
docker build -t world-slice .

# 运行容器
docker run -d \
  --name world-slice-app \
  -p 3000:3000 \
  --restart unless-stopped \
  -v /root/world-slice/data:/app/data \
  --env-file .env.local \
  world-slice

# 查看日志
docker logs -f world-slice-app

# 查看运行状态
docker ps | grep world-slice
```

### 3. 使用 Node.js 直接运行

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 启动服务
npm start

# 或使用 PM2（推荐用于生产环境）
npm install -g pm2
pm2 start npm --name "world-slice" -- start
pm2 save
pm2 startup
```

## 访问应用

部署成功后，访问：
```
http://43.166.161.176:3000
```

## 常用命令

### Docker 管理

```bash
# 查看日志
docker logs -f world-slice-app

# 重启容器
docker restart world-slice-app

# 停止容器
docker stop world-slice-app

# 删除容器
docker rm -f world-slice-app

# 查看容器状态
docker ps -a | grep world-slice
```

### PM2 管理

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs world-slice

# 重启应用
pm2 restart world-slice

# 停止应用
pm2 stop world-slice

# 删除应用
pm2 delete world-slice
```

## 更新部署

当代码有更新时：

```bash
# 本地执行部署脚本
./deploy-docker.sh

# 或手动更新
rsync -avz --exclude 'node_modules' --exclude '.next' --exclude '.git' . root@43.166.161.176:/root/world-slice/
ssh root@43.166.161.176 'cd /root/world-slice && docker restart world-slice-app'
```

## 故障排查

### 检查端口占用

```bash
# 检查 3000 端口
netstat -tlnp | grep 3000
# 或
lsof -i :3000
```

### 检查防火墙

```bash
# 开放 3000 端口
ufw allow 3000
# 或
iptables -A INPUT -p tcp --dport 3000 -j ACCEPT
```

### 查看应用日志

```bash
# Docker
docker logs world-slice-app

# PM2
pm2 logs world-slice

# 直接运行
journalctl -u world-slice -f
```

## 性能优化

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name 43.166.161.176;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 配置 HTTPS（可选）

```bash
# 安装 certbot
apt-get install certbot python3-certbot-nginx

# 获取证书（需要域名）
certbot --nginx -d yourdomain.com
```

## 备份数据

```bash
# 备份数据目录
tar -czf world-slice-data-$(date +%Y%m%d).tar.gz /root/world-slice/data

# 备份到本地
scp root@43.166.161.176:/root/world-slice-data-*.tar.gz ./backups/
```

## 安全建议

1. 修改 SSH 默认端口
2. 配置防火墙只开放必要端口
3. 使用 SSH 密钥认证而非密码
4. 定期更新系统和依赖包
5. 配置自动备份
6. 使用环境变量管理敏感信息
7. 考虑使用 HTTPS

---

**准备就绪**: ✅
**部署脚本**: deploy-docker.sh
**访问地址**: http://43.166.161.176:3000
