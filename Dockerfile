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
ENV DJANGO_SETTINGS_MODULE=note_translate.settings_production

# Expose port
EXPOSE 8000

# Create a startup script with detailed logging
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "=== STARTING CONTAINER ==="' >> /app/start.sh && \
    echo 'echo "Current directory: $(pwd)"' >> /app/start.sh && \
    echo 'echo "Python version: $(python --version)"' >> /app/start.sh && \
    echo 'echo "Django settings: $DJANGO_SETTINGS_MODULE"' >> /app/start.sh && \
    echo 'echo "=== RUNNING MIGRATIONS ==="' >> /app/start.sh && \
    echo 'python manage.py migrate' >> /app/start.sh && \
    echo 'echo "=== MIGRATIONS COMPLETED ==="' >> /app/start.sh && \
    echo 'echo "=== TESTING DJANGO ==="' >> /app/start.sh && \
    echo 'python manage.py check --deploy' >> /app/start.sh && \
    echo 'echo "=== DJANGO CHECK PASSED ==="' >> /app/start.sh && \
    echo 'echo "=== STARTING GUNICORN ==="' >> /app/start.sh && \
    echo 'exec gunicorn note_translate.wsgi:application --bind 0.0.0.0:$PORT --log-level debug' >> /app/start.sh && \
    chmod +x /app/start.sh

# Run the startup script
CMD ["/app/start.sh"]