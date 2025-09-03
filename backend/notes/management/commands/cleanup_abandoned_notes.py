from django.core.management.base import BaseCommand
from django.utils import timezone
from notes.models import Note
import os


class Command(BaseCommand):
    help = 'Clean up abandoned notes and their associated files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--hours',
            type=int,
            default=1,
            help='Delete abandoned notes older than this many hours (default: 1)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        hours = options['hours']
        dry_run = options['dry_run']
        
        cutoff_time = timezone.now() - timezone.timedelta(hours=hours)
        
        # Find abandoned notes older than the cutoff time
        abandoned_notes = Note.objects.filter(
            status='abandoned',
            created_at__lt=cutoff_time
        )
        
        count = abandoned_notes.count()
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'DRY RUN: Would delete {count} abandoned notes older than {hours} hour(s)'
                )
            )
            for note in abandoned_notes[:10]:  # Show first 10 as examples
                self.stdout.write(f'  - {note.title} (ID: {note.id}, Created: {note.created_at})')
            if count > 10:
                self.stdout.write(f'  ... and {count - 10} more')
            return
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('No abandoned notes found to clean up')
            )
            return
        
        # Delete associated files first
        files_deleted = 0
        for note in abandoned_notes:
            if note.file:
                try:
                    if os.path.exists(note.file.path):
                        os.remove(note.file.path)
                        files_deleted += 1
                        self.stdout.write(f'Deleted file: {note.file.path}')
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'Error deleting file {note.file.path}: {e}')
                    )
        
        # Delete the notes
        abandoned_notes.delete()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully deleted {count} abandoned notes and {files_deleted} associated files'
            )
        )
