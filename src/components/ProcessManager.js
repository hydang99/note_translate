import React, { useState, useRef, useEffect } from 'react';

const ProcessManager = ({ 
  isProcessing, 
  currentProcess, 
  onStopProcess, 
  onStartProcess,
  children 
}) => {
  const [showStopButton, setShowStopButton] = useState(false);
  const stopButtonTimeoutRef = useRef(null);

  // Show stop button after 2 seconds of processing
  useEffect(() => {
    if (isProcessing) {
      stopButtonTimeoutRef.current = setTimeout(() => {
        setShowStopButton(true);
      }, 2000);
    } else {
      setShowStopButton(false);
      if (stopButtonTimeoutRef.current) {
        clearTimeout(stopButtonTimeoutRef.current);
      }
    }

    return () => {
      if (stopButtonTimeoutRef.current) {
        clearTimeout(stopButtonTimeoutRef.current);
      }
    };
  }, [isProcessing]);

  const handleStopProcess = () => {
    onStopProcess();
    setShowStopButton(false);
  };

  const handleStartNewProcess = () => {
    // Stop current process if running
    if (isProcessing) {
      onStopProcess();
    }
    // Start new process
    onStartProcess();
  };

  return (
    <div className="process-manager">
      {/* Process Status Bar */}
      {isProcessing && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span className="text-sm font-medium">
              Processing: {currentProcess}
            </span>
            {showStopButton && (
              <button
                onClick={handleStopProcess}
                className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-xs font-medium transition-colors"
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* Process Control Panel */}
      <div className="fixed bottom-4 right-4 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Process Control</h3>
          
          {isProcessing ? (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                Current: {currentProcess}
              </div>
              <button
                onClick={handleStopProcess}
                className="w-full bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                🛑 Stop Process
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-gray-600">
                No active process
              </div>
              <button
                onClick={handleStartNewProcess}
                className="w-full bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
              >
                🚀 Start New Process
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      {children}
    </div>
  );
};

export default ProcessManager;
