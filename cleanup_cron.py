#!/usr/bin/env python3
"""
Cron job script for cleaning up abandoned notes.
Add this to your crontab to run every hour:
0 * * * * /path/to/python /path/to/cleanup_cron.py
"""
import os
import sys
import django

# Add the backend directory to the path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'note_translate.settings')
django.setup()

from django.core.management import call_command

if __name__ == '__main__':
    try:
        # Clean up abandoned notes older than 2 hours
        call_command('cleanup_abandoned_notes', hours=2)
        print("Cleanup completed successfully")
    except Exception as e:
        print(f"Cleanup failed: {e}")
        sys.exit(1)
