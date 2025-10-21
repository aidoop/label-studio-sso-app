# Label Studio Integration Test App

A simple test application for Label Studio SSO integration using subdomain approach.

## Architecture

```
nubison.localhost:3000           → Frontend (Vue3 + Vite)
nubison.localhost:3001           → Backend (Node.js + Express)
labelstudio.localhost:8080       → Label Studio Backend (direct)
labelstudio.localhost:8010       → Label Studio HMR (direct)
```

### Cookie Sharing

Cookies are shared across all `*.localhost` subdomains using `domain: '.localhost'` setting.

## Prerequisites

- Node.js 18+
- Label Studio installed and configured
- Label Studio API Token

## Setup

### 1. Label Studio Configuration

Edit Label Studio's `.env` file:

```bash
# /Users/super/Library/Application Support/label-studio/.env

ALLOWED_HOSTS=labelstudio.localhost,*.localhost
CSRF_TRUSTED_ORIGINS=http://labelstudio.localhost:8080,http://labelstudio.localhost:8010,http://nubison.localhost:3000,http://nubison.localhost:3001

# JWT SSO Settings
JWT_SSO_SECRET=0xD58F835B69D207A76CC5F84a70a1D0d4C79dAC95
JWT_SSO_ALGORITHM=HS256
JWT_SSO_TOKEN_PARAM=token
JWT_SSO_EMAIL_CLAIM=email
JWT_SSO_USERNAME_CLAIM=username
JWT_SSO_FIRST_NAME_CLAIM=first_name
JWT_SSO_LAST_NAME_CLAIM=last_name
JWT_SSO_AUTO_CREATE_USERS=true
JWT_SSO_COOKIE_NAME=ls_auth_token

# HMR Settings (for development)
FRONTEND_HMR=true
FRONTEND_HOSTNAME=http://labelstudio.localhost:8010

# Session/Cookie Settings
SESSION_COOKIE_SAMESITE=Lax
SESSION_COOKIE_SECURE=0
SESSION_COOKIE_HTTPONLY=0
SESSION_COOKIE_PATH=/
CSRF_COOKIE_SAMESITE=Lax
CSRF_COOKIE_SECURE=0
CSRF_COOKIE_PATH=/
```

### 2. Get Label Studio API Token

1. Start Label Studio: `label-studio start`
2. Login to http://localhost:8080
3. Go to Account & Settings → Access Token
4. Copy the token

### 3. Configure Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your Label Studio API token
```

Edit `backend/server.js` and set:

```javascript
const LABEL_STUDIO_API_TOKEN = "your-actual-api-token";
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

## Running

Open **3 terminals**:

### Terminal 1: Label Studio

```bash
label-studio start
```

Access at: http://labelstudio.localhost:8080

### Terminal 2: Backend

```bash
cd backend
npm run dev
```

Backend runs at: http://nubison.localhost:3001

### Terminal 3: Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at: http://nubison.localhost:3000

## Usage

1. Open browser: http://nubison.localhost:3000
2. Click "Setup SSO" button
3. Label Studio iframe loads automatically with SSO authentication

## How It Works

### SSO Flow

```
1. User clicks "Setup SSO"
   ↓
2. Frontend → Backend (nubison.localhost:3001/api/sso/setup)
   ↓
3. Backend → Label Studio (localhost:8080/api/sso/token)
   ↓
4. Label Studio returns JWT token
   ↓
5. Backend sets cookie:
   - name: ls_auth_token
   - domain: .localhost (shared across all *.localhost)
   - path: /
   ↓
6. Frontend loads iframe (labelstudio.localhost:8080/projects/3)
   ↓
7. Browser automatically sends ls_auth_token cookie
   ↓
8. Label Studio authenticates user via JWT
```

### Key Points

- **No Proxy Required**: Direct access to Label Studio
- **No URL Rewriting**: Label Studio runs at root path `/`
- **Cookie Sharing**: `domain: '.localhost'` enables subdomain cookie sharing
- **No CORS Issues**: iframe operates in same-origin context

## Debugging

### Check Cookies

```bash
curl http://nubison.localhost:3001/api/cookies
```

### Backend Logs

Backend logs all requests and SSO operations to console.

### Browser DevTools

- Check Application → Cookies → `.localhost`
- Should see `ls_auth_token` cookie
- Check Network tab for API calls

## Troubleshooting

### "Failed to get SSO token"

- Check Label Studio API token is correct
- Verify Label Studio is running at http://localhost:8080
- Check backend console for detailed error

### Iframe not loading

- Check browser console for errors
- Verify Label Studio CSRF_TRUSTED_ORIGINS includes all origins
- Check Label Studio ALLOWED_HOSTS configuration

### Cookie not shared

- Verify cookie domain is set to `.localhost`
- Check browser Application → Cookies
- Ensure all services use `*.localhost` hostnames

## Production Deployment

For production, replace:

- `nubison.localhost` → `app.yourdomain.com`
- `labelstudio.localhost` → `labelstudio.yourdomain.com`
- Configure DNS A records
- Enable HTTPS
- Set secure cookies: `secure: true`

## License

MIT
