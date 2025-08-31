import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { vocabularyAPI, notesAPI } from '../services/api';
import { BookMarked, Search, Filter, Trash2, Eye, ExternalLink, ArrowLeft, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Vocabulary() {
  const navigate = useNavigate();
  const [vocabularyItems, setVocabularyItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [selectedNote, setSelectedNote] = useState('');
  const [stats, setStats] = useState(null);
  const [availableNotes, setAvailableNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState(null);

  const fetchVocabulary = useCallback(async () => {
    try {
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedLanguage) params.source_language = selectedLanguage;
      if (selectedNote) params.source_note = selectedNote;

      const response = await vocabularyAPI.getAll(params);
      // Handle paginated response - data is in response.data.results
      const items = Array.isArray(response.data.results) ? response.data.results : [];
      setVocabularyItems(items);
    } catch (error) {
      console.error('Error fetching vocabulary:', error);
      toast.error('Failed to load vocabulary');
      // Set empty array on error to prevent map error
      setVocabularyItems([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedLanguage, selectedNote]);

  useEffect(() => {
    fetchVocabulary();
    fetchStats();
    fetchAvailableNotes();
    checkCurrentNote();
  }, [fetchVocabulary]);

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
          fromVocabulary: true
        }
      });
    }
  };

  const clearCurrentNote = () => {
    localStorage.removeItem('currentNote');
    setCurrentNote(null);
    toast.success('Current note cleared');
  };

  const fetchStats = async () => {
    try {
      const response = await vocabularyAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
      // Set default stats on error
      setStats({
        total_words: 0,
        by_language: {},
        recent_count: 0
      });
    }
  };

  const fetchAvailableNotes = async () => {
    try {
      const response = await notesAPI.getAll();
      const notesData = response.data.results || response.data;
      setAvailableNotes(Array.isArray(notesData) ? notesData : []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setAvailableNotes([]);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this vocabulary item?')) {
      return;
    }

    try {
      await vocabularyAPI.delete(itemId);
      // Ensure vocabularyItems is an array before filtering
      if (Array.isArray(vocabularyItems)) {
        setVocabularyItems(vocabularyItems.filter(item => item.id !== itemId));
      }
      toast.success('Vocabulary item deleted successfully');
      fetchStats(); // Refresh stats
    } catch (error) {
      console.error('Error deleting vocabulary item:', error);
      toast.error('Failed to delete vocabulary item');
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchVocabulary();
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, selectedLanguage, selectedNote, fetchVocabulary]);

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Vocabulary</h1>
        <p className="text-gray-600">Review and manage your saved words and phrases</p>
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

      {/* Stats */}
      {stats && stats.by_language && (
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <BookMarked className="h-8 w-8 text-primary-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.total_words}</p>
                <p className="text-sm text-gray-600">Total Words</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <Filter className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.by_language).length}</p>
                <p className="text-sm text-gray-600">Language Pairs</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <Eye className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{stats.recent_count}</p>
                <p className="text-sm text-gray-600">Added This Week</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search words..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="vi">Vietnamese</option>
              <option value="zh">Chinese</option>
              <option value="ja">Japanese</option>
              <option value="ko">Korean</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
            <select
              value={selectedNote}
              onChange={(e) => setSelectedNote(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Notes</option>
              {availableNotes.map((note) => (
                <option key={note.id} value={note.id}>
                  {note.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Vocabulary List */}
      {!Array.isArray(vocabularyItems) || vocabularyItems.length === 0 ? (
        <div className="text-center py-12">
          <BookMarked className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No vocabulary items yet</h3>
          <p className="text-gray-600">
            Start reading and translating notes to build your vocabulary list.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Array.isArray(vocabularyItems) && vocabularyItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{item.word}</h3>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {item.source_language} → {item.target_language}
                    </span>
                  </div>
                  
                  {item.definition && (
                    <p className="text-gray-700 mb-2">
                      <span className="font-medium">Definition:</span> {item.definition}
                    </p>
                  )}
                  
                  {item.context_definition && (
                    <p className="text-gray-700 mb-2">
                      <span className="font-medium">Context:</span> {item.context_definition}
                    </p>
                  )}
                  
                  <p className="text-gray-600 text-sm mb-2">
                    <span className="font-medium">From:</span> "{item.context_sentence}"
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <Link 
                        to={`/notes/${item.source_note.id}`}
                        state={{ 
                          highlightWord: item.word,
                          vocabularyItem: item,
                          fromVocabulary: true
                        }}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        Source: {item.source_note.title}
                      </Link>
                      {item.page_number && <span>Page: {item.page_number}</span>}
                      <span>Added: {new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    <Link
                      to={`/notes/${item.source_note.id}`}
                      state={{ 
                        highlightWord: item.word,
                        vocabularyItem: item,
                        fromVocabulary: true
                      }}
                      className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View Note</span>
                    </Link>
                  </div>
                </div>
                
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-red-600 hover:text-red-700 p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
