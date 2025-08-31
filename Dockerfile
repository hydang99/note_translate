FROM python:3.9-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Set working directory to backend from the start
WORKDIR /app/backend

# Copy requirements and install Python dependencies
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r /app/requirements.txt

# Copy the entire project
COPY . /app/

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Set Django settings module for production
ENV DJANGO_SETTINGS_MODULE=note_translate.settings_production

# Test Django startup first, then start server
CMD ["sh", "-c", "echo 'Starting migrations...' && python manage.py migrate && echo 'Migrations completed. Testing Django...' && python manage.py check --deploy && echo 'Django check passed. Starting Gunicorn...' && gunicorn note_translate.wsgi:application --bind 0.0.0.0:$PORT --log-level debug"]