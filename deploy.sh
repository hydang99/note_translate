#!/bin/bash

echo "🚀 Note Translate Deployment Script"
echo "=================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

echo "📋 Pre-deployment checklist:"
echo "1. ✅ Code committed to Git"
echo "2. ✅ Environment variables configured"
echo "3. ✅ Firebase project set up"
echo "4. ✅ AI API key obtained"

echo ""
echo "🔧 Next steps:"
echo "1. Push your code to GitHub"
echo "2. Deploy backend to Railway:"
echo "   - Go to https://railway.app"
echo "   - Connect your GitHub repo"
echo "   - Add environment variables (see DEPLOYMENT.md)"
echo "   - Add PostgreSQL database"
echo ""
echo "3. Deploy frontend to Vercel:"
echo "   - Go to https://vercel.com"
echo "   - Connect your GitHub repo"
echo "   - Add REACT_APP_API_URL environment variable"
echo ""
echo "4. Update CORS settings in settings_production.py with your domains"
echo ""
echo "📖 For detailed instructions, see DEPLOYMENT.md"
echo ""
echo "🎉 Happy deploying!"
