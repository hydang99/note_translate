#!/bin/bash
set -e

# Change to backend directory
cd /app/backend

# Run migrations
echo "Running database migrations..."
python manage.py migrate

# Start the server
echo "Starting Gunicorn server..."
exec gunicorn note_translate.wsgi:application --bind 0.0.0.0:$PORT
