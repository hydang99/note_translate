import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { notesAPI } from '../services/api';
import { Plus, FileText, Calendar, Globe, Eye, Clock, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Notes() {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [currentNote, setCurrentNote] = useState(null);

  useEffect(() => {
    fetchNotes();
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
          fromNotes: true
        }
      });
    }
  };

  const clearCurrentNote = () => {
    localStorage.removeItem('currentNote');
    setCurrentNote(null);
    toast.success('Current note cleared');
  };

  // Helper function to extract readable content from note
  const getReadableContent = (content) => {
    if (!content) return '';
    
    try {
      // Check if content is JSON (page-based structure)
      if (content.startsWith('[') || content.startsWith('{')) {
        const parsed = JSON.parse(content);
        
        // If it's an array of pages
        if (Array.isArray(parsed)) {
          const text = parsed.map(page => page.content || '').join(' ').trim();
          // Clean up any remaining JSON artifacts
          return text.replace(/[{}[\]]/g, '').replace(/"/g, '').trim();
        }
        
        // If it's a single object with content
        if (parsed.content) {
          return parsed.content.replace(/[{}[\]]/g, '').replace(/"/g, '').trim();
        }
      }
      
      // If it's plain text, clean it up and return
      return content.replace(/[{}[\]]/g, '').replace(/"/g, '').trim();
    } catch (error) {
      // If JSON parsing fails, clean up the original content
      return content.replace(/[{}[\]]/g, '').replace(/"/g, '').trim();
    }
  };

  const fetchNotes = async () => {
    try {
      const response = await notesAPI.getAll();
      // Handle paginated response
      const notesData = response.data.results || response.data;
      setNotes(Array.isArray(notesData) ? notesData : []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
      setNotes([]); // Ensure notes is always an array
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await notesAPI.delete(noteId);
      setNotes(notes.filter(note => note.id !== noteId));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const filteredNotes = Array.isArray(notes) ? notes.filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         getReadableContent(note.content).toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTag = !tagFilter || (note.tags && note.tags.toLowerCase().includes(tagFilter.toLowerCase()));
    
    return matchesSearch && matchesTag;
  }) : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Notes</h1>
          <p className="text-gray-600 mt-2">Manage and view your translated notes</p>
        </div>
        <Link
          to="/"
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>New Note</span>
        </Link>
      </div>

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

      {/* Search and Filters */}
      <div className="mb-6 space-y-4">
        <input
          type="text"
          placeholder="Search notes..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <input
          type="text"
          placeholder="Filter by tags..."
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No notes found' : 'No notes yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Upload your first note to get started'
            }
          </p>
          {!searchTerm && (
            <Link
              to="/"
              className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
            >
              Upload Note
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <div key={note.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                    {note.title}
                  </h3>
                  <div className="flex items-center space-x-1 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    <FileText className="h-3 w-3" />
                    <span>{note.file_type.toUpperCase()}</span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {(() => {
                    const readableContent = getReadableContent(note.content);
                    return readableContent.length > 150 ? 
                      readableContent.substring(0, 150) + '...' : 
                      readableContent;
                  })()}
                </p>

                <div className="flex items-center space-x-4 text-xs text-gray-500 mb-4">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Globe className="h-3 w-3" />
                    <span>
                      {note.detected_language || note.source_language} → {note.target_language}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                {note.tags && (
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-1">
                      {note.tags.split(',').map((tag, index) => (
                        <span
                          key={index}
                          className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Link
                    to={`/notes/${note.id}`}
                    className="flex items-center space-x-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    <Eye className="h-4 w-4" />
                    <span>View</span>
                  </Link>
                  
                  <div className="flex items-center space-x-2">
                    {note.translation && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Translated
                      </span>
                    )}
                    <button
                      onClick={() => handleDelete(note.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
