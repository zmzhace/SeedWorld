# Windows 部署指南

## 前置要求

在 Windows 上部署到远程服务器，你需要以下工具之一：

### 选项 1: Git Bash（推荐）
- 安装 Git for Windows: https://git-scm.com/download/win
- Git Bash 自带 rsync 和 ssh

### 选项 2: WSL (Windows Subsystem for Linux)
- 安装 WSL: `wsl --install`
- 在 WSL 中使用 Linux 命令

### 选项 3: PowerShell + OpenSSH
- Windows 10/11 自带 OpenSSH
- 需要手动安装 rsync

## 快速部署

### 使用 Git Bash（最简单）

1. 打开 Git Bash
2. 进入项目目录：
   ```bash
   cd /e/world/world-slice
   ```

3. 执行部署脚本：
   ```bash
   ./deploy.sh
   ```

### 使用 WSL

1. 打开 WSL 终端
2. 进入项目目录：
   ```bash
   cd /mnt/e/world/world-slice
   ```

3. 执行部署脚本：
   ```bash
   bash deploy.sh
   ```

### 手动使用 SCP（无需 rsync）

在 PowerShell 或 CMD 中：

```powershell
# 打包项目
tar -czf world-slice.tar.gz --exclude=node_modules --exclude=.next --exclude=.git .

# 传输到服务器
scp world-slice.tar.gz root@43.166.161.176:/root/

# SSH 登录并解压
ssh root@43.166.161.176
cd /root
mkdir -p world-slice
tar -xzf world-slice.tar.gz -C world-slice
```

## 部署后配置

SSH 登录服务器：
```bash
ssh root@43.166.161.176
cd /root/world-slice
```

然后按照 DEPLOY_TO_SERVER.md 中的步骤配置和启动应用。

## 故障排查

### SSH 连接问题

如果 SSH 连接失败：
```powershell
# 测试连接
ssh -v root@43.166.161.176

# 检查 SSH 服务
Get-Service ssh-agent
```

### 文件传输慢

使用压缩传输：
```bash
tar -czf - . | ssh root@43.166.161.176 "cd /root/world-slice && tar -xzf -"
```

## 推荐工具

- **Git Bash**: 最简单，自带所有需要的工具
- **WSL**: 完整的 Linux 环境
- **MobaXterm**: 图形化 SSH 客户端，支持文件传输
- **WinSCP**: 图形化文件传输工具

---

**推荐方式**: 使用 Git Bash 执行 `./deploy.sh`
