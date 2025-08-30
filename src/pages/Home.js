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

  const [currentNote, setCurrentNote] = useState(null);

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

  const handleUpload = async () => {
    if (!selectedFile && !textContent.trim()) {
      toast.error('Please upload a file or enter text');
      return;
    }

    // Allow guest users to upload and try the system
    // They'll be prompted to login when trying to save

    setIsUploading(true);
    try {
      const formData = new FormData();
      
      if (selectedFile) {
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

      // Debug: Log FormData contents
      console.log('FormData contents:');
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }
      console.log('Selected file:', selectedFile);
      console.log('Text content:', textContent);

      const response = await notesAPI.create(formData);
      const note = response.data;
      
      toast.success('Note uploaded successfully!');
      
      // Automatically translate the note
      setIsTranslating(true);
      try {
        const translateResponse = await notesAPI.translate(note.id);
        const updatedNote = {
          ...note,
          translation: translateResponse.data
        };
        
        toast.success('Translation completed!');
        // Navigate to the note with translation already loaded
        navigate(`/notes/${note.id}`, { state: { note: updatedNote } });
      } catch (translateError) {
        console.error('Translation error:', translateError);
        toast.error('Upload successful, but translation failed. You can translate manually.');
        // Still navigate to the note, but without translation
        navigate(`/notes/${note.id}`);
      } finally {
        setIsTranslating(false);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload note');
    } finally {
      setIsUploading(false);
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
