# Note Translate

A full-stack web application for uploading, translating, and managing notes with AI-powered translation and vocabulary building features.

## Features

- **File Upload**: Support for PDFs, images, and text files
- **AI Translation**: Powered by Google Gemini for accurate translations
- **Side-by-Side View**: Compare original and translated content
- **Vocabulary Building**: Save unknown words with context and definitions
- **User Authentication**: Firebase authentication with Google OAuth
- **Notes Library**: Manage and organize your translated notes
- **Markdown Rendering**: Preserve formatting in translated content

## Tech Stack

### Backend
- Django 4.2.7
- Django REST Framework
- Firebase Admin SDK
- Google Gemini AI
- SQLite (development)

### Frontend
- React 18
- Tailwind CSS
- Firebase SDK
- React Router
- React Markdown

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Firebase project
- Google Gemini API key

### Backend Setup

1. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up environment variables**:
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=True
   FIREBASE_CREDENTIALS_PATH=path/to/your/firebase-credentials.json
   FIREBASE_PROJECT_ID=your-firebase-project-id
   GEMINI_API_KEY=your-gemini-api-key-here
   ```

4. **Run migrations**:
   ```bash
   cd backend
   python manage.py makemigrations
   python manage.py migrate
   ```

5. **Create superuser** (optional):
   ```bash
   python manage.py createsuperuser
   ```

6. **Start Django server**:
   ```bash
   python manage.py runserver
   ```

### Frontend Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create `.env.local` in the root directory:
   ```
   REACT_APP_FIREBASE_API_KEY=your-firebase-api-key
   REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   REACT_APP_FIREBASE_PROJECT_ID=your-firebase-project-id
   REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   REACT_APP_FIREBASE_APP_ID=your-app-id
   REACT_APP_API_URL=http://localhost:8000/api
   ```

3. **Start React development server**:
   ```bash
   npm start
   ```

## Firebase Setup

1. **Create a Firebase project** at [Firebase Console](https://console.firebase.google.com/)

2. **Enable Authentication**:
   - Go to Authentication > Sign-in method
   - Enable Email/Password and Google providers

3. **Download service account key**:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Save the JSON file and update `FIREBASE_CREDENTIALS_PATH` in `.env`

4. **Get Firebase config**:
   - Go to Project Settings > General
   - Copy the config object for your React app

## Google Gemini Setup

1. **Get API key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Add it to your `.env` file

## Usage

1. **Start both servers**:
   - Backend: `http://localhost:8000`
   - Frontend: `http://localhost:3000`

2. **Create an account** or sign in with Google

3. **Upload a note**:
   - Go to the home page
   - Upload a PDF, image, or paste text
   - Select source and target languages
   - Click "Upload & Translate"

4. **View translation**:
   - Navigate to your notes library
   - Click on a note to view side-by-side translation
   - Select text to save words to vocabulary

5. **Manage vocabulary**:
   - Go to the Vocabulary page
   - Review saved words with definitions and context
   - Filter by language or note

## API Endpoints

### Notes
- `GET /api/notes/` - List user notes
- `POST /api/notes/` - Create new note
- `GET /api/notes/{id}/` - Get note details
- `PATCH /api/notes/{id}/` - Update note
- `DELETE /api/notes/{id}/` - Delete note
- `POST /api/notes/{id}/translate/` - Translate note

### Vocabulary
- `GET /api/vocabulary/` - List vocabulary items
- `POST /api/vocabulary/save_word/` - Save word to vocabulary
- `DELETE /api/vocabulary/{id}/` - Delete vocabulary item

### Translation
- `POST /api/translation/translate/` - Translate text
- `GET /api/translation/languages/` - Get supported languages

## Development

### Backend Development
```bash
cd backend
python manage.py runserver
```

### Frontend Development
```bash
npm start
```

### Running Tests
```bash
# Backend tests
cd backend
python manage.py test

# Frontend tests
npm test
```

## Deployment

### Backend (Django)
- Use a production WSGI server like Gunicorn
- Set up a production database (PostgreSQL recommended)
- Configure environment variables for production
- Set up static file serving

### Frontend (React)
- Build the production bundle: `npm run build`
- Serve static files with a web server like Nginx
- Configure environment variables for production

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.
