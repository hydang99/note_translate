import { useState, useRef, useCallback } from 'react';

export const useProcessManager = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentProcess, setCurrentProcess] = useState(null);
  const [processAbortController, setProcessAbortController] = useState(null);

  const startProcess = useCallback((processName) => {
    console.log(`🚀 Starting process: ${processName}`);
    
    // Stop any existing process first
    if (isProcessing && processAbortController) {
      console.log(`🔄 Stopping existing process: ${currentProcess}`);
      processAbortController.abort();
    }
    
    setIsProcessing(true);
    setCurrentProcess(processName);
    
    // Create new AbortController for this process
    const controller = new AbortController();
    setProcessAbortController(controller);
    
    return controller;
  }, [isProcessing, processAbortController, currentProcess]);

  const stopProcess = useCallback(() => {
    console.log(`🛑 Stopping current process: ${currentProcess}`);
    
    if (processAbortController) {
      processAbortController.abort();
      setProcessAbortController(null);
    }
    
    setIsProcessing(false);
    setCurrentProcess(null);
  }, [currentProcess, processAbortController]);

  const finishProcess = useCallback(() => {
    console.log(`✅ Finishing process: ${currentProcess}`);
    setIsProcessing(false);
    setCurrentProcess(null);
    setProcessAbortController(null);
  }, [currentProcess]);

  const isProcessActive = useCallback((processName) => {
    return isProcessing && currentProcess === processName;
  }, [isProcessing, currentProcess]);

  const getAbortSignal = useCallback(() => {
    return processAbortController?.signal;
  }, [processAbortController]);

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (processAbortController) {
      processAbortController.abort();
    }
  }, [processAbortController]);

  return {
    // State
    isProcessing,
    currentProcess,
    
    // Actions
    startProcess,
    stopProcess,
    finishProcess,
    
    // Utilities
    isProcessActive,
    getAbortSignal,
    cleanup
  };
};
