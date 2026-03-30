# Windows Setup Guide

## Step 1: Install Redis

### Option A: WSL (Recommended - Most Compatible)

1. **Install WSL** (if not already installed):
```powershell
# Run in PowerShell as Administrator
wsl --install
```

2. **Restart your computer**

3. **Open WSL and install Redis**:
```bash
# In WSL terminal
sudo apt-get update
sudo apt-get install redis-server -y
```

4. **Start Redis in WSL**:
```bash
# In WSL terminal
redis-server
```

Keep this WSL terminal open - Redis needs to stay running.

### Option B: Memurai (Native Windows Redis)

1. **Download Memurai** from: https://www.memurai.com/get-memurai
2. **Install** - it will run as a Windows service
3. **Verify** it's running:
```cmd
memurai-cli ping
```
Should return: `PONG`

### Option C: Docker Desktop

1. **Install Docker Desktop** from: https://www.docker.com/products/docker-desktop
2. **Start Redis container**:
```powershell
docker run -d -p 6379:6379 --name redis redis:latest
```

3. **Verify**:
```powershell
docker ps
```

## Step 2: Verify Redis Connection

Test that your application can connect to Redis:

**If using WSL/Memurai/Docker:**
```powershell
# From Windows PowerShell/CMD in backend directory
redis-cli ping
```

**If redis-cli is not in PATH:**
```powershell
# For Memurai
"C:\Program Files\Memurai\memurai-cli.exe" ping

# For WSL
wsl redis-cli ping

# For Docker
docker exec -it redis redis-cli ping
```

Should return: `PONG`

## Step 3: Start the Backend (Windows)

I've created batch files for you to make this easier!

### Using Batch Files (Easiest Method)

**Terminal 1** - Orchestrator:
```cmd
start-orchestrator.bat
```

**Terminal 2** - Robot 1:
```cmd
start-robot-1.bat
```

**Terminal 3** - Robot 2:
```cmd
start-robot-2.bat
```

**Terminal 4** - Robot 3:
```cmd
start-robot-3.bat
```

**Terminal 5** - Robot 4:
```cmd
start-robot-4.bat
```

**Terminal 6** - Robot 5:
```cmd
start-robot-5.bat
```

### Alternative: PowerShell Commands

**Terminal 1** - Orchestrator:
```powershell
npm run orchestrator
```

**Terminal 2** - Robot 1:
```powershell
$env:ROBOT_ID="scout-1"; tsx src/robot/index.ts
```

**Terminal 3** - Robot 2:
```powershell
$env:ROBOT_ID="lifter-2"; tsx src/robot/index.ts
```

**Terminal 4** - Robot 3:
```powershell
$env:ROBOT_ID="scout-3"; tsx src/robot/index.ts
```

**Terminal 5** - Robot 4:
```powershell
$env:ROBOT_ID="carrier-4"; tsx src/robot/index.ts
```

**Terminal 6** - Robot 5:
```powershell
$env:ROBOT_ID="lifter-5"; tsx src/robot/index.ts
```

### Alternative: Command Prompt (CMD)

**Terminal 2** - Robot 1:
```cmd
set ROBOT_ID=scout-1 && tsx src\robot\index.ts
```

**Terminal 3** - Robot 2:
```cmd
set ROBOT_ID=lifter-2 && tsx src\robot\index.ts
```

**Terminal 4** - Robot 3:
```cmd
set ROBOT_ID=scout-3 && tsx src\robot\index.ts
```

**Terminal 5** - Robot 4:
```cmd
set ROBOT_ID=carrier-4 && tsx src\robot\index.ts
```

**Terminal 6** - Robot 5:
```cmd
set ROBOT_ID=lifter-5 && tsx src\robot\index.ts
```

## Step 4: Verify Everything is Running

### Check Orchestrator
```powershell
curl http://localhost:3000/health
```

Should see orchestrator health status.

### Check Redis
```powershell
redis-cli KEYS robot:*
```

Should show 5 robot state keys after robots start.

### Check WebSocket (Optional)
Install wscat:
```powershell
npm install -g wscat
```

Then test:
```powershell
wscat -c ws://localhost:8080
```

You should see real-time events streaming in.

## Troubleshooting

### Port Already in Use

**Error**: `EADDRINUSE :::3000` or `:::8080`

**Solution**:
```powershell
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :8080

# Kill process (replace <PID> with actual PID from above)
taskkill /PID <PID> /F
```

### Redis Connection Refused

**Error**: `connect ECONNREFUSED 127.0.0.1:6379`

**Solutions**:

1. **Check if Redis is running**:
```powershell
# For WSL
wsl ps aux | grep redis

# For Memurai
Get-Service Memurai

# For Docker
docker ps | findstr redis
```

2. **Start Redis**:
```powershell
# For WSL
wsl redis-server

# For Memurai (if not running as service)
"C:\Program Files\Memurai\memurai-server.exe"

# For Docker
docker start redis
```

3. **Check firewall** - Ensure port 6379 is not blocked

### Environment Variable Not Set

**Error**: Robot starts but shows wrong ROBOT_ID

**Solution**: Use the batch files provided, or ensure you're using the correct syntax:
- PowerShell: `$env:ROBOT_ID="scout-1"`
- CMD: `set ROBOT_ID=scout-1 &&`

### Node Module Errors

**Error**: Cannot find module 'xyz'

**Solution**:
```powershell
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
npm install
```

### Permission Denied

**Error**: Access denied when running scripts

**Solution**:
```powershell
# Run PowerShell as Administrator, then:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

## Quick Reference: All Windows Commands

```powershell
# 1. Start Redis (WSL)
wsl redis-server

# 2. New terminal - Orchestrator
cd A:\swarmtrust-next\backend
start-orchestrator.bat

# 3-7. New terminals for each robot
start-robot-1.bat
start-robot-2.bat
start-robot-3.bat
start-robot-4.bat
start-robot-5.bat

# 8. Start frontend (new terminal)
cd A:\swarmtrust-next\frontend
npm run dev
```

## All-in-One PowerShell Script

Create `start-all.ps1`:
```powershell
# Start all robots in new windows
Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run orchestrator"
Start-Sleep -Seconds 5

Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:ROBOT_ID='scout-1'; tsx src/robot/index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:ROBOT_ID='lifter-2'; tsx src/robot/index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:ROBOT_ID='scout-3'; tsx src/robot/index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:ROBOT_ID='carrier-4'; tsx src/robot/index.ts"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:ROBOT_ID='lifter-5'; tsx src/robot/index.ts"
```

Then run:
```powershell
.\start-all.ps1
```

## Stopping Everything

Press `Ctrl+C` in each terminal window, or:

```powershell
# Kill all node processes (careful - kills ALL node processes)
taskkill /F /IM node.exe

# Kill Redis (WSL)
wsl killall redis-server

# Kill Redis (Docker)
docker stop redis
```
