import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image, File } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FileUpload({ onFileSelect, onTextInput, maxSize = 10 * 1024 * 1024 }) {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        toast.error(`File is too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      console.log('FileUpload: File accepted:', file);
      onFileSelect(file);
    }
  }, [onFileSelect, maxSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp']
    },
    maxSize,
    multiple: false
  });

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'pdf':
        return <File className="h-8 w-8 text-red-500" />;
      case 'image':
        return <Image className="h-8 w-8 text-green-500" />;
      default:
        return <FileText className="h-8 w-8 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive ? 'Drop your file here' : 'Upload a file or drag and drop'}
        </p>
        <p className="text-sm text-gray-500 mb-4">
          PDF, TXT, or Image files up to {maxSize / (1024 * 1024)}MB
        </p>
        <button
          type="button"
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
        >
          Choose File
        </button>
      </div>

      {/* Text Input Area */}
      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Or paste text directly</h3>
        <textarea
          placeholder="Paste your text here..."
          className="w-full h-32 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          onChange={(e) => onTextInput(e.target.value)}
        />
      </div>
    </div>
  );
}
