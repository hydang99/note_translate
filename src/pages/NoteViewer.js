 import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { notesAPI } from '../services/api';
import SideBySideViewer from '../components/SideBySideViewer';
import LanguageSelector from '../components/LanguageSelector';
import LoginPrompt from '../components/LoginPrompt';
import { ArrowLeft, RefreshCw, Trash2, Save, Edit3, BookOpen, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NoteViewer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [updatingLanguage, setUpdatingLanguage] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTags, setNewTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [showVocabulary, setShowVocabulary] = useState(true);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isEditingOriginal, setIsEditingOriginal] = useState(false);
  const [editedOriginalContent, setEditedOriginalContent] = useState('');
  const { currentUser } = useAuth();

  useEffect(() => {
    const fetchNote = async () => {
      try {
        // Check if note is passed from navigation state (from Home page with translation)
        if (location.state?.note) {
          setNote(location.state.note);
          // Store current note in localStorage for easy return
          localStorage.setItem('currentNote', JSON.stringify(location.state.note));
          setLoading(false);
          return;
        }
        
        // Otherwise fetch from API
        const response = await notesAPI.getById(id);
        setNote(response.data);
        // Store current note in localStorage for easy return
        localStorage.setItem('currentNote', JSON.stringify(response.data));
      } catch (error) {
        console.error('Error fetching note:', error);
        toast.error('Failed to load note');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchNote();
  }, [id, navigate, location.state]);

  const handleTranslate = async () => {
    if (!note) return;

    setTranslating(true);
    try {
      const response = await notesAPI.translate(note.id);
      setNote(prev => ({
        ...prev,
        translation: response.data
      }));
      toast.success('Translation completed!');
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Failed to translate note');
    } finally {
      setTranslating(false);
    }
  };

  const handleLanguageChange = async (field, value) => {
    if (!note) return;

    setUpdatingLanguage(true);
    try {
      const updatedNote = { ...note, [field]: value };
      await notesAPI.update(note.id, { [field]: value });
      setNote(updatedNote);
      toast.success('Language updated!');
    } catch (error) {
      console.error('Error updating language:', error);
      toast.error('Failed to update language');
    } finally {
      setUpdatingLanguage(false);
    }
  };

  const handlePageChange = async (page) => {
    try {
      await notesAPI.updateLastViewedPage(note.id, page);
    } catch (error) {
      console.error('Error updating last viewed page:', error);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this note?')) {
      return;
    }

    try {
      await notesAPI.delete(note.id);
      toast.success('Note deleted successfully');
      navigate('/notes');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleDownloadOriginal = () => {
    if (!note || !note.file) {
      toast.error('No original file available for download');
      return;
    }

    try {
      // Construct the full URL for the file
      const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:8000';
      const fileUrl = `${baseUrl}${note.file}`;
      
      // Create a download link for the original file
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = note.title || 'original_file';
      link.target = '_blank'; // Open in new tab as fallback
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  };

  const handleSaveNote = async () => {
    if (!note) return;

    // Check if user is logged in
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }

    setSaving(true);
    try {
      const response = await notesAPI.update(note.id, {
        title: note.title,
        content: note.content,
        source_language: note.source_language,
        target_language: note.target_language
      });
      
      const updatedNote = {
        ...note,
        ...response.data
      };
      
      setNote(updatedNote);
      
      // Update localStorage with the new note data
      localStorage.setItem('currentNote', JSON.stringify(updatedNote));
      
      toast.success('Note saved successfully!');
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  const handleRenameNote = () => {
    setNewTitle(note.title);
    setNewTags(note.tags || '');
    setShowRenameModal(true);
  };

  const handleConfirmRename = async () => {
    if (!newTitle.trim()) {
      toast.error('Please enter a valid title');
      return;
    }

    // Check if user is logged in
    if (!currentUser) {
      setShowLoginPrompt(true);
      setShowRenameModal(false);
      return;
    }

    setSaving(true);
    try {
      await notesAPI.update(note.id, {
        title: newTitle.trim(),
        tags: newTags.trim()
      });
      
      const updatedNote = {
        ...note,
        title: newTitle.trim(),
        tags: newTags.trim()
      };
      
      setNote(updatedNote);
      
      // Update localStorage with the new note data
      localStorage.setItem('currentNote', JSON.stringify(updatedNote));
      
      setShowRenameModal(false);
      toast.success('Note updated successfully!');
    } catch (error) {
      console.error('Error renaming note:', error);
      toast.error('Failed to rename note');
    } finally {
      setSaving(false);
    }
  };

  const handleEditOriginal = () => {
    if (!note) return;
    
    // Set the edited content to the current note content
    setEditedOriginalContent(note.content);
    setIsEditingOriginal(true);
  };

  const handleSaveEditedOriginal = async () => {
    if (!note) return;

    setSaving(true);
    try {
      // Update the note with the edited content
      await notesAPI.update(note.id, {
        content: editedOriginalContent.trim()
      });
      
      const updatedNote = {
        ...note,
        content: editedOriginalContent.trim()
      };
      
      setNote(updatedNote);
      
      // Update localStorage with the new note data
      localStorage.setItem('currentNote', JSON.stringify(updatedNote));
      
      setIsEditingOriginal(false);
      toast.success('Original text updated successfully!');
    } catch (error) {
      console.error('Error updating original text:', error);
      toast.error('Failed to update original text');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingOriginal(false);
    setEditedOriginalContent('');
  };

  const handleReTranslate = async () => {
    if (!note) return;

    console.log('Re-translating note:', note.id, note.title);
    setTranslating(true);
    try {
      // Send the edited content if we're in edit mode
      const requestData = isEditingOriginal && editedOriginalContent ? {
        content: editedOriginalContent
      } : {};
      
      const response = await notesAPI.translate(note.id, requestData);
      console.log('Translation response:', response.data);
      
      const updatedNote = {
        ...note,
        translation: response.data,
        // Update the content if we sent edited content
        content: isEditingOriginal && editedOriginalContent ? editedOriginalContent : note.content
      };
      
      console.log('Updated note:', updatedNote);
      setNote(updatedNote);
      
      // Update localStorage with the new note data
      localStorage.setItem('currentNote', JSON.stringify(updatedNote));
      
      // Force a re-render by updating the translation state
      if (updatedNote.translation && updatedNote.translation.translated_content) {
        console.log('Translation content:', updatedNote.translation.translated_content);
      } else {
        console.log('No translation content found in response');
      }
      
      toast.success('Translation updated successfully!');
    } catch (error) {
      console.error('Translation error:', error);
      console.error('Note ID:', note.id);
      console.error('Error details:', error.response?.data);
      toast.error(`Failed to re-translate note: ${error.response?.data?.error || error.message}`);
    } finally {
      setTranslating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Note not found</h2>
        <button
          onClick={() => navigate('/notes')}
          className="bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700"
        >
          Back to Notes
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/notes')}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Notes</span>
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{note.title}</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowVocabulary(!showVocabulary)}
            className="flex items-center space-x-1 px-3 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md"
          >
            <BookOpen className="h-4 w-4" />
            <span>{showVocabulary ? 'Hide Vocabulary' : 'Show Vocabulary'}</span>
          </button>
          {note.file && (
            <button
              onClick={handleDownloadOriginal}
              className="flex items-center space-x-1 px-3 py-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-md"
            >
              <FileDown className="h-4 w-4" />
              <span>Download Original</span>
            </button>
          )}
          <button
            onClick={handleEditOriginal}
            className="flex items-center space-x-1 px-3 py-2 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded-md"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit Original</span>
          </button>
          <button
            onClick={handleSaveNote}
            disabled={saving}
            className="flex items-center space-x-1 px-3 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-md disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Note'}</span>
          </button>
          <button
            onClick={handleRenameNote}
            disabled={saving}
            className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded-md disabled:opacity-50"
          >
            <Edit3 className="h-4 w-4" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center space-x-1 px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Translation Settings</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <LanguageSelector
            label="Source Language"
            value={note.source_language}
            onChange={(value) => handleLanguageChange('source_language', value)}
            placeholder="Auto-detect"
          />
          <LanguageSelector
            label="Target Language"
            value={note.target_language}
            onChange={(value) => handleLanguageChange('target_language', value)}
            placeholder="Select target language"
            excludeAuto={true}
          />
        </div>
        
        <div className="mt-4">
          <button
            onClick={handleTranslate}
            disabled={translating || updatingLanguage}
            className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 ${translating ? 'animate-spin' : ''}`} />
            <span>{translating ? 'Translating...' : 'Translate'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {note.translation ? (
        <SideBySideViewer
          key={`${note.id}-${note.translation?.updated_at || note.translation?.created_at || 'no-translation'}`}
          originalContent={note.content}
          translatedContent={note.translation.translated_content}
          noteId={note.id}
          sourceLanguage={note.source_language}
          targetLanguage={note.target_language}
          onPageChange={handlePageChange}
          vocabularyNavigation={location.state}
          showVocabulary={showVocabulary}
          isEditingOriginal={isEditingOriginal}
          editedOriginalContent={editedOriginalContent}
          onEditedContentChange={setEditedOriginalContent}
          onSaveEditedOriginal={handleSaveEditedOriginal}
          onCancelEdit={handleCancelEdit}
          onReTranslate={handleReTranslate}
          isSavingEdit={saving}
          isTranslatingEdit={translating}
        />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Translation Yet</h3>
          <p className="text-gray-600 mb-4">
            Click the "Translate" button above to generate a translation of your note.
          </p>
          <button
            onClick={handleTranslate}
            disabled={translating}
            className="bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:bg-gray-400"
          >
            {translating ? 'Translating...' : 'Generate Translation'}
          </button>
        </div>
      )}

      {/* Note Info */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Created:</span> {new Date(note.created_at).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">Last Updated:</span> {new Date(note.updated_at).toLocaleDateString()}
          </div>
          <div>
            <span className="font-medium">File Type:</span> {note.file_type.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Note</h3>
            <div className="mb-4">
              <label htmlFor="note-title" className="block text-sm font-medium text-gray-700 mb-2">
                Note Title
              </label>
              <input
                id="note-title"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter note title..."
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmRename();
                  }
                }}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="note-tags" className="block text-sm font-medium text-gray-700 mb-2">
                Tags (comma-separated)
              </label>
              <input
                id="note-tags"
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., work, important, meeting"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleConfirmRename();
                  }
                }}
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRenameModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRename}
                disabled={saving || !newTitle.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Prompt */}
      <LoginPrompt
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        onSuccess={() => {
          // After successful login, retry the save action
          handleSaveNote();
        }}
        title="Login Required to Save Notes"
      />
    </div>
  );
}
