@echo off
echo 🚀 开始部署到 43.166.161.176:/root/world-slice
echo.

REM 检查是否安装了 rsync
where rsync >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 未找到 rsync，请先安装
    echo 推荐使用 Git Bash 或 WSL 执行 deploy.sh
    pause
    exit /b 1
)

REM 使用 rsync 同步文件
rsync -avz --progress --exclude "node_modules" --exclude ".next" --exclude ".git" --exclude "coverage" --exclude ".env.local" . root@43.166.161.176:/root/world-slice/

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ 文件传输成功
    echo.
    echo 📝 下一步操作：
    echo 1. SSH 登录: ssh root@43.166.161.176
    echo 2. 进入目录: cd /root/world-slice
    echo 3. 安装依赖: npm install
    echo 4. 配置环境: cp .env.example .env.local ^&^& nano .env.local
    echo 5. 构建项目: npm run build
    echo 6. 启动服务: npm start
) else (
    echo ❌ 部署失败
)

pause
