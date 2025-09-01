import gc
import psutil
import time
from django.utils.deprecation import MiddlewareMixin


class MemoryMonitoringMiddleware(MiddlewareMixin):
    """Middleware to monitor memory usage and help with debugging"""
    
    def process_request(self, request):
        """Log memory usage at the start of each request"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            print(f"🔄 Request started - Memory: {memory_mb:.1f} MB - {request.method} {request.path}")
        except Exception as e:
            print(f"Could not log memory usage: {e}")
        
        # Store start time for duration tracking
        request.start_time = time.time()
        return None
    
    def process_response(self, request, response):
        """Log memory usage at the end of each request"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            
            # Calculate request duration
            duration = time.time() - getattr(request, 'start_time', 0)
            
            print(f"✅ Request completed - Memory: {memory_mb:.1f} MB - Duration: {duration:.2f}s - {request.method} {request.path}")
            
            # Force garbage collection for long-running requests
            if duration > 5.0:  # If request took more than 5 seconds
                print(f"🧹 Long request detected, forcing garbage collection...")
                gc.collect()
                
                # Log memory after cleanup
                memory_info_after = process.memory_info()
                memory_mb_after = memory_info_after.rss / 1024 / 1024
                print(f"🧹 Memory after cleanup: {memory_mb_after:.1f} MB (freed: {memory_mb - memory_mb_after:.1f} MB)")
                
        except Exception as e:
            print(f"Could not log memory usage: {e}")
        
        return response
    
    def process_exception(self, request, exception):
        """Log memory usage when exceptions occur"""
        try:
            process = psutil.Process()
            memory_info = process.memory_info()
            memory_mb = memory_info.rss / 1024 / 1024
            print(f"❌ Exception occurred - Memory: {memory_mb:.1f} MB - {request.method} {request.path} - Error: {str(exception)}")
            
            # Force garbage collection on errors
            print(f"🧹 Forcing garbage collection due to exception...")
            gc.collect()
            
        except Exception as e:
            print(f"Could not log memory usage: {e}")
        
        return None
