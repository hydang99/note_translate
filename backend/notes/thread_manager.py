"""
Thread Manager for Note Processing
This provides actual thread termination and process cancellation capabilities
"""

import threading
import time
from concurrent.futures import ThreadPoolExecutor, Future
from typing import Dict, List, Optional
import signal
import os


class ThreadManager:
    """Manages thread execution and provides actual cancellation capabilities"""
    
    def __init__(self):
        self._active_executors: Dict[str, ThreadPoolExecutor] = {}
        self._active_futures: Dict[str, List[Future]] = {}
        self._cancellation_events: Dict[str, threading.Event] = {}
        self._lock = threading.Lock()
    
    def create_executor(self, note_id: str, max_workers: int = 2) -> ThreadPoolExecutor:
        """Create a new executor for a note"""
        with self._lock:
            # Cancel any existing executor for this note
            self.cancel_note(note_id)
            
            # Create new executor and tracking
            executor = ThreadPoolExecutor(max_workers=max_workers)
            self._active_executors[note_id] = executor
            self._active_futures[note_id] = []
            self._cancellation_events[note_id] = threading.Event()
            
            print(f"📝 Created executor for note {note_id} with {max_workers} workers")
            return executor
    
    def submit_task(self, note_id: str, fn, *args, **kwargs) -> Optional[Future]:
        """Submit a task to the executor for a note"""
        with self._lock:
            if note_id not in self._active_executors:
                print(f"⚠️  No executor found for note {note_id}")
                return None
            
            # Check if cancelled before submitting
            if self._cancellation_events[note_id].is_set():
                print(f"🛑 Note {note_id} is cancelled, not submitting task")
                return None
            
            executor = self._active_executors[note_id]
            future = executor.submit(fn, *args, **kwargs)
            self._active_futures[note_id].append(future)
            
            print(f"📝 Submitted task for note {note_id}")
            return future
    
    def cancel_note(self, note_id: str) -> bool:
        """Cancel all processing for a note"""
        with self._lock:
            if note_id not in self._active_executors:
                return False
            
            print(f"🛑 Cancelling all processing for note {note_id}")
            
            # Set cancellation event
            self._cancellation_events[note_id].set()
            
            # Cancel all pending futures
            cancelled_count = 0
            for future in self._active_futures.get(note_id, []):
                if not future.done():
                    future.cancel()
                    cancelled_count += 1
            
            print(f"🛑 Cancelled {cancelled_count} pending tasks for note {note_id}")
            
            # Shutdown executor
            executor = self._active_executors[note_id]
            executor.shutdown(wait=False, cancel_futures=True)
            
            # Clean up
            del self._active_executors[note_id]
            del self._active_futures[note_id]
            del self._cancellation_events[note_id]
            
            print(f"✅ Note {note_id} processing cancelled and cleaned up")
            return True
    
    def is_cancelled(self, note_id: str) -> bool:
        """Check if a note's processing has been cancelled"""
        with self._lock:
            if note_id not in self._cancellation_events:
                return False
            return self._cancellation_events[note_id].is_set()
    
    def wait_for_completion(self, note_id: str, timeout: Optional[float] = None) -> bool:
        """Wait for all tasks for a note to complete"""
        with self._lock:
            if note_id not in self._active_executors:
                return True
            
            executor = self._active_executors[note_id]
            futures = self._active_futures.get(note_id, [])
            
            if not futures:
                return True
            
            print(f"⏳ Waiting for {len(futures)} tasks to complete for note {note_id}")
            
            # Wait for all futures to complete
            for future in futures:
                try:
                    future.result(timeout=timeout)
                except Exception as e:
                    print(f"⚠️  Task for note {note_id} failed: {e}")
            
            # Clean up completed executor
            executor.shutdown(wait=True)
            del self._active_executors[note_id]
            del self._active_futures[note_id]
            del self._cancellation_events[note_id]
            
            print(f"✅ All tasks completed for note {note_id}")
            return True
    
    def get_active_notes(self) -> List[str]:
        """Get list of notes with active processing"""
        with self._lock:
            return list(self._active_executors.keys())
    
    def cleanup_all(self):
        """Clean up all active executors (emergency shutdown)"""
        with self._lock:
            note_ids = list(self._active_executors.keys())
            for note_id in note_ids:
                self.cancel_note(note_id)
            print(f"🧹 Cleaned up all {len(note_ids)} active executors")


# Global instance
thread_manager = ThreadManager()


def check_cancellation(note_id: str) -> bool:
    """Check if processing has been cancelled for a note"""
    if thread_manager.is_cancelled(note_id):
        print(f"🛑 Processing cancelled for note {note_id}")
        return True
    return False


def submit_task(note_id: str, fn, *args, **kwargs) -> Optional[Future]:
    """Submit a task to the thread manager"""
    return thread_manager.submit_task(note_id, fn, *args, **kwargs)


def create_executor(note_id: str, max_workers: int = 2) -> ThreadPoolExecutor:
    """Create an executor for a note"""
    return thread_manager.create_executor(note_id, max_workers)
