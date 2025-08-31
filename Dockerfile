# Force rebuild - test simple container startup
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

# Simple test command to see if container can start
CMD ["sh", "-c", "echo 'Container started successfully' && sleep 30"]