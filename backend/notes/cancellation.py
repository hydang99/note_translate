"""
Global cancellation registry for note processing
This allows us to cancel ongoing processes from different parts of the application
"""

import threading
from typing import Dict, Set

class CancellationRegistry:
    """Global registry for tracking and cancelling note processing"""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._cancelled_notes: Set[str] = set()
        self._active_processes: Dict[str, bool] = {}
    
    def register_note(self, note_id: str):
        """Register a note as being processed"""
        with self._lock:
            self._active_processes[note_id] = True
            # Remove from cancelled set if it was there
            self._cancelled_notes.discard(note_id)
            print(f"📝 Registered note {note_id} for processing")
    
    def unregister_note(self, note_id: str):
        """Unregister a note when processing is complete"""
        with self._lock:
            self._active_processes.pop(note_id, None)
            self._cancelled_notes.discard(note_id)
            print(f"📝 Unregistered note {note_id} from processing")
    
    def cancel_note(self, note_id: str):
        """Cancel processing for a specific note"""
        with self._lock:
            if note_id in self._active_processes:
                self._cancelled_notes.add(note_id)
                print(f"🛑 Cancelled processing for note {note_id}")
                return True
            else:
                print(f"⚠️  Note {note_id} not found in active processes")
                return False
    
    def is_cancelled(self, note_id: str) -> bool:
        """Check if a note's processing has been cancelled"""
        with self._lock:
            return note_id in self._cancelled_notes
    
    def get_active_notes(self) -> Set[str]:
        """Get all currently active note IDs"""
        with self._lock:
            return set(self._active_processes.keys())
    
    def get_cancelled_notes(self) -> Set[str]:
        """Get all cancelled note IDs"""
        with self._lock:
            return set(self._cancelled_notes)

# Global instance
cancellation_registry = CancellationRegistry()
