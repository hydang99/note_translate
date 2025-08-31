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

# Run migrations and start server directly (no cd needed since WORKDIR is already /app/backend)
CMD ["sh", "-c", "python manage.py migrate && gunicorn note_translate.wsgi:application --bind 0.0.0.0:$PORT"]