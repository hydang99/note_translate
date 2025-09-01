import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import LanguageSelector from '../components/LanguageSelector';

import { notesAPI } from '../services/api';
import { BookOpen, Globe, Zap, Users, FileText, X, Clock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Home() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('vi');
  const [isUploading, setIsUploading] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({
    stage: '', // 'uploading', 'extracting', 'translating', 'complete'
    message: '',
    progress: 0,
    currentPage: 0,
    totalPages: 0
  });

  const [currentNote, setCurrentNote] = useState(null);

  // Add abort controller state for cancellation
  const [abortController, setAbortController] = useState(null);

  useEffect(() => {
    checkCurrentNote();
  }, []);

  const checkCurrentNote = () => {
    // Check if there's a current note stored in localStorage
    const storedNote = localStorage.getItem('currentNote');
    if (storedNote) {
      try {
        const noteData = JSON.parse(storedNote);
        setCurrentNote(noteData);
      } catch (error) {
        console.error('Error parsing stored note:', error);
        localStorage.removeItem('currentNote');
      }
    }
  };

  const handleReturnToNote = () => {
    if (currentNote) {
      // Navigate back to the note with the stored data
      navigate(`/notes/${currentNote.id}`, {
        state: {
          note: currentNote,
          fromHome: true
        }
      });
    }
  };

  const clearCurrentNote = () => {
    localStorage.removeItem('currentNote');
    setCurrentNote(null);
    toast.success('Current note cleared');
  };

  const handleFileSelect = (file) => {
    console.log('File selected:', file);
    setSelectedFile(file);
    setTextContent(''); // Clear text when file is selected
    toast.success(`File selected: ${file.name}`);
  };

  const handleTextInput = (text) => {
    setTextContent(text);
    setSelectedFile(null); // Clear file when text is entered
  };

  // Add cancel handler function
  const handleCancel = async () => {
    if (abortController) {
      abortController.abort();
      console.log('Process cancelled by user');
    }
    
    // Also cancel backend processing if we have a note ID
    if (currentNote?.id) {
      try {
        console.log('🛑 Cancelling backend processing for note:', currentNote.id);
        await notesAPI.cancel(currentNote.id);
        console.log('✅ Backend processing cancelled successfully');
        
        // Show success message
        toast.success('Processing cancelled and note discarded');
      } catch (error) {
        console.log('⚠️ Could not cancel backend processing:', error);
        
        // If it's a cancellation error, that's actually good - it means processing stopped
        if (error.response?.data?.error?.includes('cancelled')) {
          toast.success('Processing stopped successfully');
        } else {
          toast.error('Could not stop backend processing');
        }
      }
    } else {
      toast.info('Process cancelled');
    }
    
    // Reset all states regardless of backend cancellation result
    setIsUploading(false);
    setIsTranslating(false);
    setUploadProgress({
      stage: '',
      message: '',
      progress: 0,
      currentPage: 0,
      totalPages: 0
    });
    setSelectedFile(null);
    setTextContent('');
    setCurrentNote(null);
    setAbortController(null);
  };

  const handleUpload = async () => {
    if (!selectedFile && !textContent.trim()) {
      toast.error('Please upload a file or enter text');
      return;
    }

    // Allow guest users to upload and try the system
    // They'll be prompted to login when trying to save

    try {
      // Create new abort controller for this entire process
      const controller = new AbortController();
      setAbortController(controller);

      setIsUploading(true);
      setUploadProgress({
        stage: 'uploading',
        message: 'Preparing upload...',
        progress: 10,
        currentPage: 0,
        totalPages: 0
      });
      const formData = new FormData();
      
      if (selectedFile) {
        setUploadProgress({
          stage: 'uploading',
          message: 'Processing file...',
          progress: 20,
          currentPage: 0,
          totalPages: 0
        });

        formData.append('file', selectedFile);
        // Determine file type based on extension and MIME type
        let fileType = 'txt';
        if (selectedFile.type === 'application/pdf') {
          fileType = 'pdf';
        } else if (selectedFile.type.startsWith('image/')) {
          fileType = 'image';
        } else if (selectedFile.name.toLowerCase().endsWith('.pdf')) {
          fileType = 'pdf';
        } else if (selectedFile.name.toLowerCase().match(/\.(png|jpg|jpeg|gif|bmp|webp)$/)) {
          fileType = 'image';
        }
        formData.append('file_type', fileType);
        console.log('File type detected:', fileType, 'MIME type:', selectedFile.type);
      }
      
      if (textContent.trim()) {
        formData.append('content', textContent.trim());
        formData.append('file_type', 'txt');
      }
      
      formData.append('title', selectedFile ? selectedFile.name : 'Text Note');
      formData.append('source_language', sourceLanguage);
      formData.append('target_language', targetLanguage);

      setUploadProgress({
        stage: 'uploading',
        message: 'Uploading to server...',
        progress: 40,
        currentPage: 0,
        totalPages: 0
      });

      const response = await notesAPI.create(formData, { signal: controller.signal });
      const note = response.data;
      
      // Set current note for cancellation purposes
      setCurrentNote(note);
      
      // Get progress information from the backend
      try {
        const progressResponse = await notesAPI.getProgress(note.id);
        const progressData = progressResponse.data;
        
        setUploadProgress({
          stage: 'extracting',
          message: 'Extracting text from document...',
          progress: 60,
          currentPage: progressData.current_page || 0,
          totalPages: progressData.total_pages || 0
        });
      } catch (error) {
        console.log('Could not get progress info:', error);
        setUploadProgress({
          stage: 'extracting',
          message: 'Extracting text from document...',
          progress: 60,
          currentPage: 0,
          totalPages: 0
        });
      }

      toast.success('Note uploaded successfully!');
      
      // Automatically translate the note
      setIsTranslating(true);
      
      // Get updated progress information before translation
      try {
        const progressResponse = await notesAPI.getProgress(note.id);
        const progressData = progressResponse.data;
        
        setUploadProgress({
          stage: 'translating',
          message: 'Translating content...',
          progress: 80,
          currentPage: progressData.current_page || 0,
          totalPages: progressData.total_pages || 0
        });
      } catch (error) {
        console.log('Could not get progress info for translation:', error);
        setUploadProgress({
          stage: 'translating',
          message: 'Translating content...',
          progress: 80,
          currentPage: 0,
          totalPages: 0
        });
      }

      // Start polling for progress updates during translation
      let progressCounter = 0;
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await notesAPI.getProgress(note.id);
          const progressData = progressResponse.data;
          
          progressCounter++;
          const totalPages = progressData.total_pages || 0;
          const simulatedCurrentPage = Math.min(progressCounter, totalPages);
          
          setUploadProgress(prev => ({
            ...prev,
            currentPage: simulatedCurrentPage,
            totalPages: totalPages,
            progress: Math.min(80 + (progressCounter * 3), 95) // Gradually increase progress
          }));
        } catch (error) {
          console.log('Progress polling error:', error);
        }
      }, 3000); // Poll every 3 seconds

      try {
        const translateResponse = await notesAPI.translate(note.id, { signal: controller.signal });
        const updatedNote = {
          ...note,
          translation: translateResponse.data
        };
        
        // Clear the progress polling interval
        clearInterval(progressInterval);
        
        setUploadProgress({
          stage: 'complete',
          message: 'Translation complete!',
          progress: 100,
          currentPage: 0,
          totalPages: 0
        });

        toast.success('Translation completed!');
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Navigate to the note with translation already loaded
        navigate(`/notes/${note.id}`, { state: { note: updatedNote } });
      } catch (translateError) {
        console.error('Translation error:', translateError);
        
        // Clear the progress polling interval
        clearInterval(progressInterval);
        
        setUploadProgress({
          stage: 'error',
          message: 'Translation failed',
          progress: 0,
          currentPage: 0,
          totalPages: 0
        });
        toast.error('Upload successful, but translation failed. You can translate manually.');
        // Still navigate to the note, but without translation
        navigate(`/notes/${note.id}`);
      } finally {
        setIsTranslating(false);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Process was cancelled');
        return;
      }
      console.error('Upload error:', error);
      setUploadProgress({
        stage: 'error',
        message: 'Upload failed',
        progress: 0,
        currentPage: 0,
        totalPages: 0
      });
      toast.error('Failed to upload note');
    } finally {
      setIsUploading(false);
      setIsTranslating(false);
      setAbortController(null);
      // Reset progress after a delay
      setTimeout(() => {
        setUploadProgress({
          stage: '',
          message: '',
          progress: 0,
          currentPage: 0,
          totalPages: 0
        });
      }, 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Continue Reading Section */}
      {currentNote && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-lg font-semibold text-blue-900">Continue Reading</h3>
                <p className="text-blue-700">
                  You were working on: <span className="font-medium">"{currentNote.title}"</span>
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  Last accessed: {currentNote.updated_at || currentNote.created_at ? 
                    new Date(currentNote.updated_at || currentNote.created_at).toLocaleString() : 
                    'Recently'
                  }
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleReturnToNote}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Note</span>
              </button>
              <button
                onClick={clearCurrentNote}
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <div className="text-center py-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Translate Your Notes with AI
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Upload PDFs, images, or text and get instant translations with side-by-side viewing 
          and vocabulary building features.
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-8 mb-12">
        <div className="text-center p-6">
          <BookOpen className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Upload Any Format</h3>
          <p className="text-gray-600">Support for PDFs, images, and text files</p>
        </div>
        <div className="text-center p-6">
          <Globe className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Translation</h3>
          <p className="text-gray-600">Powered by AI for accurate translations</p>
        </div>
        <div className="text-center p-6">
          <Zap className="h-12 w-12 text-primary-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Side-by-Side View</h3>
          <p className="text-gray-600">Compare original and ls
          d content easily</p>
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Your Note</h2>
        
        <div className="space-y-6">
          <FileUpload
            onFileSelect={handleFileSelect}
            onTextInput={handleTextInput}
          />

          {/* Selected File Display */}
          {selectedFile && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  <FileText className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-800">Selected file:</p>
                  <p className="text-sm text-green-700">{selectedFile.name}</p>
                  <p className="text-xs text-green-600">
                    Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-green-600 hover:text-green-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <LanguageSelector
              label="Source Language"
              value={sourceLanguage}
              onChange={setSourceLanguage}
              placeholder="Auto-detect"
            />
            <LanguageSelector
              label="Target Language"
              value={targetLanguage}
              onChange={setTargetLanguage}
              placeholder="Select target language"
              excludeAuto={true}
            />
          </div>



          {/* Progress Indicator */}
          {(isUploading || isTranslating) && (
            <div className="mt-6 bg-blue-100 border-2 border-blue-300 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">
                  {uploadProgress.stage === 'extracting' && uploadProgress.totalPages > 0 
                    ? `📄 Extracting page ${uploadProgress.currentPage} of ${uploadProgress.totalPages}...`
                    : uploadProgress.stage === 'translating' && uploadProgress.totalPages > 0
                    ? `🔄 Translating (${uploadProgress.currentPage} of ${uploadProgress.totalPages} pages)...`
                    : `🚀 ${uploadProgress.message || (isUploading ? 'Uploading...' : 'Translating...')}`
                  }
                </span>
                
                {/* Cancel Button - Always visible during any phase */}
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors border border-red-200 bg-white"
                  disabled={!abortController}
                >
                  Cancel
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    uploadProgress.stage === 'error' 
                      ? 'bg-red-500' 
                      : uploadProgress.stage === 'complete'
                      ? 'bg-green-500'
                      : 'bg-primary-500'
                  }`}
                  style={{ width: `${uploadProgress.progress || 0}%` }}
                ></div>
              </div>
              <div className="mt-2 text-xs text-gray-500">
                {uploadProgress.stage === 'uploading' && 'Uploading your file to the server...'}
                {uploadProgress.stage === 'extracting' && uploadProgress.totalPages > 0 && 
                  `Using AI to extract text from page ${uploadProgress.currentPage} of ${uploadProgress.totalPages}...`
                }
                {uploadProgress.stage === 'extracting' && uploadProgress.totalPages === 0 && 
                  'Using AI to extract text from your document...'
                }
                {uploadProgress.stage === 'translating' && uploadProgress.totalPages > 0 && 
                  `Translating page ${uploadProgress.currentPage} of ${uploadProgress.totalPages} to your target language...`
                }
                {uploadProgress.stage === 'translating' && uploadProgress.totalPages === 0 && 
                  'Translating content to your target language...'
                }
                {uploadProgress.stage === 'complete' && 'All done! Redirecting to your note...'}
                {uploadProgress.stage === 'error' && 'Something went wrong. Please try again.'}
                {!uploadProgress.stage && isUploading && 'Preparing your upload...'}
                {!uploadProgress.stage && isTranslating && 'Processing your request...'}
              </div>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={isUploading || isTranslating || (!selectedFile && !textContent.trim())}
            className="w-full bg-primary-600 text-white py-3 px-6 rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Uploading...
              </>
            ) : isTranslating ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Translating...
              </>
            ) : (
              'Upload & Translate'
            )}
          </button>
        </div>
      </div>

      {/* Guest User Info */}
      {!currentUser && (
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center">
            <Users className="h-6 w-6 text-blue-600 mr-3" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Try the App for Free!</h3>
              <p className="text-blue-700">
                You can upload notes, view translations, and select vocabulary words. 
                Sign in to save your notes and vocabulary permanently.
              </p>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
