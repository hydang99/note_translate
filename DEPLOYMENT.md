# Note Translate - Deployment Guide

This guide will help you deploy your Note Translate app to production.

## Architecture

- **Frontend**: React app deployed to Vercel
- **Backend**: Django API deployed to Railway
- **Database**: PostgreSQL (provided by Railway)
- **Authentication**: Firebase (already configured)

## Prerequisites

1. GitHub account
2. Vercel account
3. Railway account
4. Firebase project (already set up)

## Step 1: Deploy Backend to Railway

### 1.1 Prepare your repository
1. Push your code to GitHub
2. Make sure all files are committed

### 1.2 Deploy to Railway
1. Go to [Railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Railway will automatically detect it's a Django app

### 1.3 Configure Environment Variables
In Railway dashboard, go to your project → Variables tab and add:

```
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=your-railway-domain.railway.app,localhost,127.0.0.1

# Database (Railway provides these automatically)
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=your-db-password
DB_HOST=your-db-host
DB_PORT=5432

# AI API
GEMINI_API_KEY=your-gemini-api-key

# Firebase
FIREBASE_CREDENTIALS_PATH=path/to/firebase-credentials.json
FIREBASE_PROJECT_ID=your-firebase-project-id
```

### 1.4 Add PostgreSQL Database
1. In Railway dashboard, click "New" → "Database" → "PostgreSQL"
2. Railway will automatically set the database environment variables

## Step 2: Deploy Frontend to Vercel

### 2.1 Deploy to Vercel
1. Go to [Vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "New Project"
4. Import your repository
5. Vercel will auto-detect it's a React app

### 2.2 Configure Environment Variables
In Vercel dashboard, go to your project → Settings → Environment Variables and add:

```
REACT_APP_API_URL=https://your-railway-domain.railway.app
```

### 2.3 Update CORS Settings
After getting your Railway domain, update `backend/note_translate/settings_production.py`:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-vercel-domain.vercel.app",  # Your actual Vercel domain
    "http://localhost:3000",  # For local development
]
```

## Step 3: Firebase Configuration

### 3.1 Update Firebase Auth Domain
In Firebase Console → Authentication → Settings → Authorized domains, add:
- Your Vercel domain
- Your Railway domain (if needed)

### 3.2 Update Firebase Config
Make sure your Firebase config in `src/contexts/AuthContext.js` is correct for production.

## Step 4: Final Configuration

### 4.1 Update API URLs
After deployment, update any hardcoded localhost URLs in your code.

### 4.2 Test the Deployment
1. Visit your Vercel URL
2. Try uploading a file
3. Test translation functionality
4. Test user authentication

## Environment Variables Summary

### Backend (Railway)
```
SECRET_KEY=your-secret-key
DEBUG=False
ALLOWED_HOSTS=your-domain.railway.app
DB_NAME=railway
DB_USER=postgres
DB_PASSWORD=auto-generated
DB_HOST=auto-generated
DB_PORT=5432
GEMINI_API_KEY=your-key
FIREBASE_CREDENTIALS_PATH=path/to/credentials
FIREBASE_PROJECT_ID=your-project-id
```

### Frontend (Vercel)
```
REACT_APP_API_URL=https://your-railway-domain.railway.app
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Make sure CORS_ALLOWED_ORIGINS includes your Vercel domain
2. **Database Connection**: Check that all DB environment variables are set
3. **Static Files**: Make sure STATIC_ROOT is set correctly
4. **Firebase Auth**: Verify Firebase project ID and credentials

### Logs
- Railway: Check logs in Railway dashboard
- Vercel: Check function logs in Vercel dashboard

## Cost Estimation

- **Vercel**: Free tier (hobby plan)
- **Railway**: $5/month for hobby plan
- **Firebase**: Free tier for most usage
- **Total**: ~$5/month

## Security Notes

1. Never commit `.env` files
2. Use strong SECRET_KEY
3. Set DEBUG=False in production
4. Configure proper CORS origins
5. Use HTTPS in production

## Monitoring

1. Set up error tracking (Sentry)
2. Monitor API usage
3. Set up uptime monitoring
4. Monitor database performance
