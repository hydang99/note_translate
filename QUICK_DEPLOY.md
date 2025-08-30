# 🚀 Quick Deployment Checklist

## Prerequisites
- [ ] GitHub repository created
- [ ] Firebase project set up
- [ ] AI API key obtained

## Step 1: Deploy Backend (Railway)
1. [ ] Go to [railway.app](https://railway.app) and sign in with GitHub
2. [ ] Click "New Project" → "Deploy from GitHub repo"
3. [ ] Select your repository
4. [ ] Add PostgreSQL database: "New" → "Database" → "PostgreSQL"
5. [ ] Add environment variables in Railway dashboard:
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=False
   ALLOWED_HOSTS=your-railway-domain.railway.app
   GEMINI_API_KEY=your-gemini-api-key
   FIREBASE_PROJECT_ID=your-firebase-project-id
   ```
6. [ ] Note your Railway domain (e.g., `your-app.railway.app`)

## Step 2: Deploy Frontend (Vercel)
1. [ ] Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. [ ] Click "New Project" and import your repository
3. [ ] Add environment variable:
   ```
   REACT_APP_API_URL=https://your-railway-domain.railway.app
   ```
4. [ ] Deploy and note your Vercel domain (e.g., `your-app.vercel.app`)

## Step 3: Update CORS Settings
1. [ ] Update `backend/note_translate/settings_production.py`:
   ```python
   CORS_ALLOWED_ORIGINS = [
       "https://your-vercel-domain.vercel.app",
       "http://localhost:3000",
   ]
   ```
2. [ ] Commit and push changes
3. [ ] Railway will auto-deploy

## Step 4: Test Deployment
- [ ] Visit your Vercel URL
- [ ] Test file upload
- [ ] Test translation
- [ ] Test user authentication

## Cost: ~$5/month
- Vercel: Free
- Railway: $5/month
- Firebase: Free tier

## Need Help?
See `DEPLOYMENT.md` for detailed instructions.
