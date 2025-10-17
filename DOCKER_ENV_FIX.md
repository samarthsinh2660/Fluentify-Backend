# 🐳 Docker Environment Variables - Problem & Solution

## ❌ The Problem

**Error Message:**
```
❌ RETELL_API_KEY not configured in environment variables
```

**Why it happened:**
Docker containers **cache environment variables at creation time**. When you add new variables to `.env` file, existing containers don't automatically pick them up - even with `nodemon` auto-restart or `docker-compose restart`.

---

## 🔍 Root Cause Analysis

### **How Docker Handles .env Files:**

1. **At Container Creation:**
   - Docker reads `.env` file
   - Injects variables into container
   - **Variables are cached in container metadata**

2. **During Container Restart:**
   - ❌ `.env` file is **NOT re-read**
   - ✅ Cached variables are reused
   - ❌ New variables in `.env` are **ignored**

3. **During File Changes (nodemon):**
   - ✅ Code changes are detected (volume mount)
   - ❌ Environment variables are **NOT refreshed**

### **What We Changed in .env:**
```diff
# Before
VITE_RETELL_API_KEY=key_884d183b17465880616f9358abf5

# After (Added)
+RETELL_API_KEY=key_884d183b17465880616f9358abf5
+RETELL_AGENT_ID=agent_b95ee2eac2bbe44d93c180b999
```

**Container Status:**
- Container was created BEFORE we added `RETELL_API_KEY`
- Container cached: ❌ No `RETELL_API_KEY`
- Our code needed: ✅ `RETELL_API_KEY`
- Result: **Environment variable not found**

---

## ✅ The Solution

### **Step 1: Stop and Remove Containers**
```bash
docker-compose down
```

**What this does:**
- ✅ Stops all running containers
- ✅ **Removes containers** (clears cached env vars)
- ✅ Removes networks
- ❌ Does NOT remove volumes (data is safe)
- ❌ Does NOT remove images

### **Step 2: Recreate Containers**
```bash
docker-compose up -d
```

**What this does:**
- ✅ Reads `.env` file fresh
- ✅ Creates new containers with NEW env vars
- ✅ Starts containers in detached mode (-d)
- ✅ Applies all changes from `.env`

### **Verification:**
```bash
# Check if variable is loaded
docker exec fluentify-backend printenv RETELL_API_KEY

# Output:
key_884d183b17465880616f9358abf5  ✅
```

---

## 🎯 Quick Reference Commands

### **Method 1: Down + Up (Recommended)**
```bash
docker-compose down
docker-compose up -d
```
**Use when:** Adding/removing environment variables

### **Method 2: Force Recreate**
```bash
docker-compose up -d --force-recreate
```
**Use when:** Quick recreation without stopping first

### **Method 3: Rebuild (if Dockerfile changed)**
```bash
docker-compose down
docker-compose up -d --build
```
**Use when:** Changed Dockerfile, package.json dependencies

### **Method 4: Restart (NOT for env changes)**
```bash
docker-compose restart
```
**Use when:** Code changes only (volumes auto-sync)
**⚠️ Does NOT reload .env changes**

---

## 📋 When to Use Each Command

| Scenario | Command | Reloads .env? |
|----------|---------|---------------|
| Added new env variable | `docker-compose down && docker-compose up -d` | ✅ Yes |
| Changed existing env value | `docker-compose down && docker-compose up -d` | ✅ Yes |
| Code changes in `src/` | Auto-reload via nodemon | N/A |
| Changed Dockerfile | `docker-compose up -d --build` | ✅ Yes |
| Changed package.json | `docker-compose up -d --build` | ✅ Yes |
| Server crashed | `docker-compose restart` | ❌ No |

---

## 🔍 Debugging Environment Variables

### **Check if variable exists in container:**
```bash
docker exec fluentify-backend printenv RETELL_API_KEY
```

### **List all environment variables:**
```bash
# Windows PowerShell
docker exec fluentify-backend printenv | findstr RETELL

# Linux/Mac
docker exec fluentify-backend printenv | grep RETELL
```

### **Check .env file is being used:**
```bash
# View docker-compose config
docker-compose config
```

### **Check container environment:**
```bash
docker inspect fluentify-backend --format='{{json .Config.Env}}' | jq
```

---

## 🛠️ Common Issues & Solutions

### **Issue 1: Variable still not loading**

**Check docker-compose.yml has:**
```yaml
backend:
  env_file:
    - .env  # ✅ This must be present
```

**Solution:**
```bash
docker-compose down
docker-compose up -d --force-recreate
```

---

### **Issue 2: .env file ignored**

**Possible causes:**
- File not in same directory as `docker-compose.yml`
- File named incorrectly (must be exactly `.env`)
- File has wrong encoding (use UTF-8)

**Solution:**
```bash
# Windows - Check file location
dir .env

# Verify content
type .env

# Recreate containers
docker-compose down
docker-compose up -d
```

---

### **Issue 3: Variable works locally but not in Docker**

**Cause:** `.env` is gitignored, different values on server

**Solution:**
1. Ensure `.env` exists on server
2. Copy from `.env.example` if available
3. Recreate containers:
```bash
docker-compose down
docker-compose up -d
```

---

### **Issue 4: VITE_ prefix confusion**

**Understanding:**
- `VITE_*` variables: For Vite frontend (client-side)
- Plain variables: For Node.js backend (server-side)

**Example:**
```env
# Backend uses this
RETELL_API_KEY=key_xxx

# Frontend uses this
VITE_RETELL_API_KEY=key_xxx
```

**Both can coexist** - they serve different purposes!

---

## 📊 What Happened in Our Case

### **Timeline:**

1. **Initial Setup:**
   ```bash
   docker-compose up -d
   ```
   - Container created with: `VITE_RETELL_API_KEY`
   - Container did NOT have: `RETELL_API_KEY`

2. **We Added to .env:**
   ```env
   RETELL_API_KEY=key_xxx  # NEW
   ```

3. **We Tried:**
   ```bash
   # ❌ This did NOT work
   docker-compose restart
   ```
   - Container still had old environment
   - New variable not loaded

4. **We Fixed It:**
   ```bash
   # ✅ This WORKED
   docker-compose down
   docker-compose up -d
   ```
   - Container recreated from scratch
   - New variable loaded successfully

---

## ✅ Verification Results

**Before Fix:**
```bash
$ docker exec fluentify-backend printenv RETELL_API_KEY
(empty output - variable not found)
```

**After Fix:**
```bash
$ docker exec fluentify-backend printenv RETELL_API_KEY
key_884d183b17465880616f9358abf5  ✅

$ docker exec fluentify-backend printenv RETELL_AGENT_ID
agent_b95ee2eac2bbe44d93c180b999  ✅
```

**Server Logs:**
```bash
✅ PostgreSQL connected successfully in development
🚀 Server running at http://localhost:5000
🌍 Environment: development
```

**No more errors!** 🎉

---

## 📝 Best Practices

### **1. When Adding Environment Variables:**
```bash
# Always recreate containers
docker-compose down && docker-compose up -d
```

### **2. Use .env.example for Documentation:**
```env
# .env.example (commit to git)
DATABASE_URL=postgresql://user:pass@host:5432/db
RETELL_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
```

### **3. Never Commit .env:**
```gitignore
# .gitignore
.env
.env.local
.env.*.local
```

### **4. Validate Environment Variables:**
```javascript
// src/config/env.js
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'RETELL_API_KEY',
  'GEMINI_API_KEY'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});
```

---

## 🎓 Key Takeaways

1. **Docker restart ≠ Environment reload**
   - Restart reuses cached environment
   - Need to recreate container for new env vars

2. **Volume mounts work differently**
   - Code changes sync automatically
   - Environment variables do NOT

3. **Always use down + up for .env changes**
   - Safest way to reload environment
   - Clears all cached state

4. **Verify after changes**
   - Check with `docker exec ... printenv`
   - Don't assume it worked

---

## 🚀 Summary

**Problem:** RETELL_API_KEY not found in container
**Cause:** Container created before variable was added to .env
**Solution:** Recreate container with `docker-compose down && docker-compose up -d`
**Result:** ✅ Variable loaded successfully, API working!

---

## 📞 Your Retell AI is Now Ready!

Test the endpoint:
```bash
curl -X POST http://localhost:5000/api/retell/create-call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agentId": "agent_b95ee2eac2bbe44d93c180b999"}'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "callId": "call_abc123",
    "agentId": "agent_b95ee2eac2bbe44d93c180b999"
  },
  "message": "Call session created successfully!"
}
```

**No more "RETELL_API_KEY not configured" errors!** 🎉✅
