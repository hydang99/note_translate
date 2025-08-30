#!/bin/bash

echo "🚀 Setting up Note Translate..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.8+ first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Create environment files
echo "⚙️  Setting up environment files..."

# Backend .env
if [ ! -f .env ]; then
    cp env.example .env
    echo "✅ Created .env file. Please edit it with your configuration."
else
    echo "ℹ️  .env file already exists."
fi

# Frontend .env.local
if [ ! -f .env.local ]; then
    cat > .env.local << EOF
REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-firebase-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
REACT_APP_FIREBASE_APP_ID=your-app-id
REACT_APP_API_URL=http://localhost:8000/api
EOF
    echo "✅ Created .env.local file. Please edit it with your Firebase configuration."
else
    echo "ℹ️  .env.local file already exists."
fi

# Create media directory
echo "📁 Creating media directory..."
mkdir -p backend/media/notes

# Run Django migrations
echo "🗄️  Running Django migrations..."
cd backend
python manage.py makemigrations
python manage.py migrate
cd ..

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your configuration (Firebase credentials, Gemini API key)"
echo "2. Edit .env.local with your Firebase configuration"
echo "3. Start the backend: cd backend && python manage.py runserver"
echo "4. Start the frontend: npm start"
echo ""
echo "For detailed setup instructions, see README.md"
