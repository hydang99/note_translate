# Process Management System

This system handles process interruption and management for long-running operations like file uploads, translations, and text extraction.

## Features

### 🚀 Process Control
- **Start Process**: Begin a new operation with automatic cleanup of existing processes
- **Stop Process**: Interrupt ongoing operations using AbortController
- **Finish Process**: Mark process as completed successfully
- **Process Status**: Real-time tracking of current operations

### 🛡️ Resource Management
- **AbortController**: Automatically cancels HTTP requests and operations
- **Memory Cleanup**: Frees resources when processes are stopped
- **State Reset**: Cleans up UI state when switching processes

### 🎯 Use Cases
- **File Uploads**: Stop large file processing
- **Translations**: Interrupt long translation operations
- **Text Extraction**: Cancel PDF processing
- **API Calls**: Abort ongoing requests

## Usage

### 1. Import the Hook
```javascript
import { useProcessManager } from '../hooks/useProcessManager';

const MyComponent = () => {
  const {
    isProcessing,
    currentProcess,
    startProcess,
    stopProcess,
    finishProcess,
    getAbortSignal
  } = useProcessManager();
  
  // ... component logic
};
```

### 2. Start a Process
```javascript
const handleFileUpload = async (file) => {
  const controller = startProcess('File Upload');
  
  try {
    const response = await uploadFile(file, {
      signal: getAbortSignal() // Pass abort signal to API calls
    });
    
    finishProcess(); // Mark as completed
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('Upload was cancelled');
    } else {
      console.error('Upload failed:', error);
    }
    finishProcess(); // Clean up state
  }
};
```

### 3. Stop a Process
```javascript
const handleCancel = () => {
  stopProcess(); // This will abort the current operation
};
```

### 4. Check Process Status
```javascript
if (isProcessing) {
  console.log(`Currently processing: ${currentProcess}`);
}

// Check specific process
if (isProcessActive('File Upload')) {
  console.log('File upload is in progress');
}
```

## Integration with API Calls

### Fetch with Abort Signal
```javascript
const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
  signal: getAbortSignal() // Will abort if process is stopped
});
```

### Axios with Abort Signal
```javascript
const response = await axios.post('/api/upload', formData, {
  signal: getAbortSignal()
});
```

## UI Components

### Process Status Bar
Shows current process with stop button (appears after 2 seconds):
```javascript
<ProcessManager
  isProcessing={isProcessing}
  currentProcess={currentProcess}
  onStopProcess={stopProcess}
  onStartProcess={() => startProcess('New Process')}
>
  {/* Your app content */}
</ProcessManager>
```

### Process Control Panel
Fixed panel in bottom-right corner for process control.

## Best Practices

### 1. Always Use Abort Signal
```javascript
// ✅ Good
const response = await apiCall(data, { signal: getAbortSignal() });

// ❌ Bad
const response = await apiCall(data);
```

### 2. Handle Abort Errors
```javascript
try {
  const result = await operation();
  finishProcess();
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Operation was cancelled');
  } else {
    console.error('Operation failed:', error);
  }
  finishProcess(); // Always clean up
}
```

### 3. Clean Up on Unmount
```javascript
useEffect(() => {
  return () => {
    cleanup(); // Abort any ongoing processes
  };
}, [cleanup]);
```

## Example Implementation

```javascript
const FileUploadComponent = () => {
  const {
    isProcessing,
    currentProcess,
    startProcess,
    stopProcess,
    finishProcess,
    getAbortSignal
  } = useProcessManager();

  const handleUpload = async (file) => {
    const controller = startProcess('File Upload');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        signal: getAbortSignal()
      });
      
      if (response.ok) {
        const result = await response.json();
        finishProcess();
        return result;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Upload cancelled');
      } else {
        console.error('Upload failed:', error);
      }
      finishProcess();
    }
  };

  return (
    <div>
      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      
      {isProcessing && (
        <div>
          <p>Processing: {currentProcess}</p>
          <button onClick={stopProcess}>Cancel</button>
        </div>
      )}
    </div>
  );
};
```

## Benefits

1. **User Control**: Users can stop long-running operations
2. **Resource Efficiency**: Prevents unnecessary API calls and processing
3. **Better UX**: Clear feedback on process status
4. **Error Handling**: Graceful handling of cancelled operations
5. **State Management**: Clean state transitions between processes
