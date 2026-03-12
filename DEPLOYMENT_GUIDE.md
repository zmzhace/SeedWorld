# 部署指南 - www.testnewnew.top

## 准备工作

### 1. 构建生产版本

```bash
cd world-slice
npm run build
```

这会在 `.next` 目录生成优化后的生产版本。

### 2. 环境变量配置

在生产服务器上创建 `.env.production` 或 `.env.local` 文件：

```bash
ANTHROPIC_BASE_URL=http://www.testnewnew.top
ANTHROPIC_AUTH_TOKEN=sk-baa032942cb94f0eeb2f7e03c2cee8b762709a4d6d134ad3fd740f6e9f0de911
ANTHROPIC_MODEL=gpt-5.2-codex
```

## 部署选项

### 选项 1: 使用 Node.js 服务器

1. **上传文件到服务器**
   ```bash
   # 需要上传的文件/目录：
   - .next/          # 构建输出
   - public/         # 静态资源
   - node_modules/   # 依赖（或在服务器上运行 npm install）
   - package.json
   - next.config.mjs
   - .env.production # 环境变量
   ```

2. **在服务器上安装依赖**
   ```bash
   npm install --production
   ```

3. **启动应用**
   ```bash
   npm start
   # 或使用 PM2
   pm2 start npm --name "world-slice" -- start
   ```

4. **配置反向代理（Nginx）**
   ```nginx
   server {
       listen 80;
       server_name www.testnewnew.top;

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

### 选项 2: 使用 Docker

1. **创建 Dockerfile**（已在项目中）

2. **构建 Docker 镜像**
   ```bash
   docker build -t world-slice .
   ```

3. **运行容器**
   ```bash
   docker run -d \
     -p 3000:3000 \
     -e ANTHROPIC_BASE_URL=http://www.testnewnew.top \
     -e ANTHROPIC_AUTH_TOKEN=sk-baa032942cb94f0eeb2f7e03c2cee8b762709a4d6d134ad3fd740f6e9f0de911 \
     -e ANTHROPIC_MODEL=gpt-5.2-codex \
     --name world-slice \
     world-slice
   ```

### 选项 3: 使用 Vercel（推荐）

1. **安装 Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **登录 Vercel**
   ```bash
   vercel login
   ```

3. **部署**
   ```bash
   vercel --prod
   ```

4. **配置环境变量**
   在 Vercel Dashboard 中添加：
   - `ANTHROPIC_BASE_URL`
   - `ANTHROPIC_AUTH_TOKEN`
   - `ANTHROPIC_MODEL`

5. **配置自定义域名**
   在 Vercel Dashboard 中将 `www.testnewnew.top` 添加为自定义域名

## 部署检查清单

- [ ] 代码已提交到 Git
- [ ] 运行 `npm run build` 成功
- [ ] 环境变量已配置
- [ ] `.env.local` 已添加到 `.gitignore`
- [ ] 生产环境可以访问 API (http://www.testnewnew.top)
- [ ] 数据库/存储已配置（如需要）
- [ ] 域名 DNS 已配置
- [ ] SSL 证书已配置（HTTPS）

## 性能优化建议

### 1. 启用缓存
```javascript
// next.config.mjs
export default {
  // ... 其他配置
  headers: async () => [
    {
      source: '/:all*(svg|jpg|png)',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable',
        },
      ],
    },
  ],
}
```

### 2. 使用 CDN
- 将静态资源上传到 CDN
- 配置 Next.js 使用 CDN URL

### 3. 数据库优化
- 当前使用 localStorage，生产环境建议使用：
  - PostgreSQL
  - MongoDB
  - Redis（缓存）

## 监控和日志

### 1. 应用监控
```bash
# 使用 PM2
pm2 start npm --name "world-slice" -- start
pm2 logs world-slice
pm2 monit
```

### 2. 错误追踪
推荐使用：
- Sentry
- LogRocket
- Datadog

### 3. 性能监控
- Vercel Analytics
- Google Analytics
- New Relic

## 故障排查

### 问题 1: API 连接失败
```bash
# 检查环境变量
echo $ANTHROPIC_BASE_URL
echo $ANTHROPIC_AUTH_TOKEN

# 测试 API 连接
node test-api.js
```

### 问题 2: 构建失败
```bash
# 清理缓存
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### 问题 3: 端口被占用
```bash
# 查找占用端口的进程
lsof -i :3000
# 或
netstat -ano | findstr :3000

# 杀死进程
kill -9 <PID>
```

## 安全建议

1. **环境变量**
   - 不要将 `.env.local` 提交到 Git
   - 使用环境变量管理工具（如 Vault）

2. **API 密钥**
   - 定期轮换 API 密钥
   - 使用最小权限原则

3. **HTTPS**
   - 强制使用 HTTPS
   - 配置 SSL 证书

4. **CORS**
   - 配置正确的 CORS 策略
   - 限制允许的域名

5. **速率限制**
   - 实施 API 速率限制
   - 防止滥用

## 备份策略

1. **代码备份**
   - Git 仓库
   - 定期推送到远程

2. **数据备份**
   - 定期备份数据库
   - 使用自动备份工具

3. **配置备份**
   - 备份环境变量
   - 备份服务器配置

## 回滚计划

如果部署出现问题：

1. **使用 Git 回滚**
   ```bash
   git revert HEAD
   git push
   ```

2. **使用 Vercel 回滚**
   - 在 Dashboard 中选择之前的部署
   - 点击 "Promote to Production"

3. **使用 PM2 回滚**
   ```bash
   pm2 stop world-slice
   # 恢复之前的版本
   pm2 start world-slice
   ```

## 联系支持

如果遇到问题：
1. 检查日志文件
2. 查看错误消息
3. 参考文档
4. 联系技术支持

---

**部署状态**: 准备就绪
**最后更新**: 2026-03-12
**版本**: v1.0.0
