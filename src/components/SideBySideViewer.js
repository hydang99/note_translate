import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronLeft, ChevronRight, BookOpen, Globe, Save } from 'lucide-react';
import { vocabularyAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import LoginPrompt from './LoginPrompt';
import toast from 'react-hot-toast';

export default function SideBySideViewer({
  originalContent,
  translatedContent,
  noteId, 
  sourceLanguage, 
  targetLanguage,
  onPageChange,
  vocabularyNavigation,
  showVocabulary = false,
  isEditingOriginal = false,
  editedOriginalContent = '',
  onEditedContentChange,
  onSaveEditedOriginal,
  onCancelEdit,
  onReTranslate,
  isSavingEdit = false,
  isTranslatingEdit = false
}) {
  const [selectedText, setSelectedText] = useState('');
  const [contextSentence, setContextSentence] = useState('');
  const [showVocabPopup, setShowVocabPopup] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [wordDefinition, setWordDefinition] = useState(null);
  const [isLoadingDefinition, setIsLoadingDefinition] = useState(false);
  const [savedWords, setSavedWords] = useState([]); // Store multiple saved words
  const [currentWordDefinition, setCurrentWordDefinition] = useState(null); // Current word being viewed
  const [highlightedWords, setHighlightedWords] = useState(new Set()); // Track highlighted words
  const [allSelectedWords, setAllSelectedWords] = useState([]); // Store all selected words with their definitions
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [syncScrolling, setSyncScrolling] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(false);
  
  const leftPaneRef = useRef(null);
  const rightPaneRef = useRef(null);
  const { currentUser } = useAuth();

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Helper functions for editing
  const getCleanTextForEditing = (content) => {
    if (!content) return '';
    
    try {
      // Try to parse as JSON (page-based format)
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        if (parsed.content) {
          // Single page format: {"page_number": 1, "content": "..."}
          return parsed.content.replace(/\\n/g, '\n');
        } else if (Array.isArray(parsed)) {
          // Multiple pages format: [{"page_number": 1, "content": "..."}, ...]
          return parsed.map(page => page.content || '').join('\n\n--- Page Break ---\n\n').replace(/\\n/g, '\n');
        }
      }
    } catch (e) {
      // Not JSON, return as is but clean up escape characters
      return content.replace(/\\n/g, '\n');
    }
    
    return content.replace(/\\n/g, '\n');
  };

  const convertCleanTextToOriginal = (cleanText) => {
    if (!cleanText) return '';
    
    // Check if the original content was JSON format
    try {
      const originalParsed = JSON.parse(originalContent);
      if (originalParsed && typeof originalParsed === 'object') {
        if (originalParsed.content) {
          // Single page format - preserve the structure
          return JSON.stringify({
            ...originalParsed,
            content: cleanText.replace(/\n/g, '\\n')
          });
        } else if (Array.isArray(originalParsed)) {
          // Multiple pages format - split by page breaks and preserve structure
          const pages = cleanText.split('\n\n--- Page Break ---\n\n');
          const updatedPages = pages.map((pageContent, index) => {
            if (originalParsed[index]) {
              return {
                ...originalParsed[index],
                content: pageContent.replace(/\n/g, '\\n')
              };
            }
            return {
              page_number: index + 1,
              content: pageContent.replace(/\n/g, '\\n')
            };
          });
          return JSON.stringify(updatedPages);
        }
      }
    } catch (e) {
      // Original wasn't JSON, return clean text with escaped newlines
      return cleanText.replace(/\n/g, '\\n');
    }
    
    return cleanText.replace(/\n/g, '\\n');
  };

  // Enhanced synchronized scrolling with better content alignment
  const handleLeftPaneScroll = (e) => {
    if (isScrolling || !syncScrolling) return;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    setIsScrolling(true);
    setIsSyncActive(true);
    const leftPane = e.target;
    const rightPane = rightPaneRef.current;
    
    if (rightPane && leftPane.scrollHeight > leftPane.clientHeight) {
      // Calculate scroll progress (0 to 1)
      const leftScrollProgress = leftPane.scrollTop / (leftPane.scrollHeight - leftPane.clientHeight);
      
      // Apply the same progress to the right pane
      const rightMaxScroll = rightPane.scrollHeight - rightPane.clientHeight;
      const rightTargetScrollTop = leftScrollProgress * rightMaxScroll;
      
      // Use smooth scrolling for better user experience
      rightPane.scrollTo({
        top: rightTargetScrollTop,
        behavior: 'auto' // Use 'auto' for immediate response during user scroll
      });
    }
    
    // Debounce the scrolling flag reset
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      setIsSyncActive(false);
    }, 100);
  };

  const handleRightPaneScroll = (e) => {
    if (isScrolling || !syncScrolling) return;
    
    // Clear any existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    setIsScrolling(true);
    setIsSyncActive(true);
    const rightPane = e.target;
    const leftPane = leftPaneRef.current;
    
    if (leftPane && rightPane.scrollHeight > rightPane.clientHeight) {
      // Calculate scroll progress (0 to 1)
      const rightScrollProgress = rightPane.scrollTop / (rightPane.scrollHeight - rightPane.clientHeight);
      
      // Apply the same progress to the left pane
      const leftMaxScroll = leftPane.scrollHeight - leftPane.clientHeight;
      const leftTargetScrollTop = rightScrollProgress * leftMaxScroll;
      
      // Use smooth scrolling for better user experience
      leftPane.scrollTo({
        top: leftTargetScrollTop,
        behavior: 'auto' // Use 'auto' for immediate response during user scroll
      });
    }
    
    // Debounce the scrolling flag reset
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
      setIsSyncActive(false);
    }, 100);
  };

  // Handle click on section to navigate to corresponding section in other pane
  const handleSectionClick = (event, isLeftPane) => {
    event.preventDefault();
    event.stopPropagation();
    
    const clickedElement = event.target;
    const container = isLeftPane ? leftPaneRef.current : rightPaneRef.current;
    const targetContainer = isLeftPane ? rightPaneRef.current : leftPaneRef.current;
    
    if (!container || !targetContainer) return;
    
    // Find the section (paragraph, heading, or block) that was clicked
    let sectionElement = clickedElement;
    while (sectionElement && sectionElement !== container) {
      // Check if this element is a section (paragraph, heading, div, etc.)
      if (sectionElement.tagName && ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'DIV', 'LI'].includes(sectionElement.tagName)) {
        break;
      }
      sectionElement = sectionElement.parentElement;
    }
    
    if (!sectionElement || sectionElement === container) return;
    
    // Get all sections in the source container
    const sourceSections = container.querySelectorAll('.clickable-section');
    const targetSections = targetContainer.querySelectorAll('.clickable-section');
    
    // Find the index of the clicked section
    let clickedIndex = -1;
    for (let i = 0; i < sourceSections.length; i++) {
      if (sourceSections[i] === sectionElement) {
        clickedIndex = i;
        break;
      }
    }
    
    if (clickedIndex === -1) return;
    
    // Find the corresponding section in the target container
    let targetSection = null;
    if (clickedIndex < targetSections.length) {
      // Direct index match
      targetSection = targetSections[clickedIndex];
    } else {
      // Fallback: use the last section if index is out of bounds
      targetSection = targetSections[targetSections.length - 1];
    }
    
    // Scroll to the target section
    if (targetSection) {
      const targetRect = targetSection.getBoundingClientRect();
      const targetContainerRect = targetContainer.getBoundingClientRect();
      const targetScrollTop = targetContainer.scrollTop + targetRect.top - targetContainerRect.top - 50; // 50px offset from top
      
      targetContainer.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
    
    // Add visual feedback to the clicked section
    sectionElement.style.backgroundColor = '#dbeafe';
    sectionElement.style.borderLeft = '4px solid #3b82f6';
    sectionElement.style.transition = 'all 0.3s ease';
    
    // Highlight the corresponding section in the target container
    if (targetSection) {
      setTimeout(() => {
        targetSection.style.backgroundColor = '#dbeafe';
        targetSection.style.borderLeft = '4px solid #3b82f6';
        targetSection.style.transition = 'all 0.3s ease';
      }, 300); // Wait for scroll animation to complete
    }
    
    // Clear visual feedback after 1.5 seconds
    setTimeout(() => {
      sectionElement.style.backgroundColor = '';
      sectionElement.style.borderLeft = '';
      
      if (targetSection) {
        targetSection.style.backgroundColor = '';
        targetSection.style.borderLeft = '';
      }
    }, 1500);
  };

  // Handle click on highlighted word to sync scroll to corresponding position
  const handleWordClick = (word, event) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Only sync scroll if user explicitly wants it (e.g., double-click or Ctrl+click) AND sync is enabled
    if ((!event.ctrlKey && !event.metaKey && event.detail !== 2) || !syncScrolling) {
      return;
    }
    
    // Find the clicked element
    const clickedElement = event.target;
    const container = clickedElement.closest('.text-pane-content');
    
    if (!container) return;
    
    // Get the position of the clicked word relative to the container
    const containerRect = container.getBoundingClientRect();
    const elementRect = clickedElement.getBoundingClientRect();
    const relativeTop = elementRect.top - containerRect.top + container.scrollTop;
    
    // Calculate scroll percentage
    const scrollPercentage = relativeTop / (container.scrollHeight - container.clientHeight);
    
    // Determine which pane was clicked and scroll the other pane
    const isLeftPane = container === leftPaneRef.current;
    const targetPane = isLeftPane ? rightPaneRef.current : leftPaneRef.current;
    
    if (targetPane) {
      setIsScrolling(true);
      const targetScrollTop = scrollPercentage * (targetPane.scrollHeight - targetPane.clientHeight);
      
      // Smooth scroll to the target position
      targetPane.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
      
      // Also scroll the source pane to the same position for better alignment
      if (syncScrolling) {
        const sourcePane = isLeftPane ? leftPaneRef.current : rightPaneRef.current;
        if (sourcePane) {
          sourcePane.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        }
      }
      
      setTimeout(() => setIsScrolling(false), 500);
      
      // Show a brief visual feedback
      clickedElement.style.backgroundColor = '#fef3c7';
      clickedElement.style.transform = 'scale(1.05)';
      clickedElement.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.5)';
      setTimeout(() => {
        clickedElement.style.backgroundColor = '';
        clickedElement.style.transform = '';
        clickedElement.style.boxShadow = '';
      }, 300);
    }
  };

  // Fetch vocabulary items for this note
  const fetchNoteVocabulary = async () => {
    try {
      const response = await vocabularyAPI.getAll({ source_note: noteId });
      const vocabularyItems = response.data.results || response.data;
      
      if (Array.isArray(vocabularyItems) && vocabularyItems.length > 0) {
        // Get saved vocabulary words from API
        const savedWords = vocabularyItems.map(item => item.word);
        
        // Merge with existing highlighted words (don't clear user selections)
        setHighlightedWords(prev => {
          const newSet = new Set([...prev, ...savedWords]);
          return newSet;
        });
        
        // Add saved vocabulary to all selected words (avoid duplicates)
        const vocabularyWords = vocabularyItems.map(item => ({
          word: item.word,
          definition: {
            definition: item.definition,
            translation: item.target_language,
            context: item.context_definition,
            example: item.context_sentence
          },
          timestamp: Date.now(),
          isSaved: true // Mark as saved vocabulary
        }));
        
        setAllSelectedWords(prev => {
          const existingWords = new Set(prev.map(item => item.word));
          const newWords = vocabularyWords.filter(item => !existingWords.has(item.word));
          return [...prev, ...newWords];
        });
        
        // Update saved words
        setSavedWords(vocabularyItems);
      }
      // Don't clear state if no vocabulary - keep user selections
    } catch (error) {
      console.error('Error fetching note vocabulary:', error);
      // Don't clear state on error - keep user selections
    }
  };

  // Handle vocabulary navigation - pre-highlight words and show vocabulary popup
  useEffect(() => {
    if (vocabularyNavigation?.fromVocabulary && vocabularyNavigation?.highlightWord) {
      const word = vocabularyNavigation.highlightWord;
      const vocabularyItem = vocabularyNavigation.vocabularyItem;
      
      // Add word to highlighted words
      setHighlightedWords(prev => new Set([...prev, word]));
      
      // Add to all selected words with the vocabulary item data
      if (vocabularyItem) {
        setAllSelectedWords(prev => {
          const existingIndex = prev.findIndex(item => item.word === word);
          if (existingIndex >= 0) {
            return prev; // Already exists
          } else {
            return [...prev, { 
              word, 
              definition: {
                definition: vocabularyItem.definition,
                translation: vocabularyItem.target_language,
                context: vocabularyItem.context_definition,
                example: vocabularyItem.context_sentence
              },
              timestamp: Date.now()
            }];
          }
        });
      }
      
      // Show vocabulary popup
      setShowVocabPopup(true);
      
      // Navigate to the correct page if specified
      if (vocabularyItem?.page_number) {
        setCurrentPage(vocabularyItem.page_number);
      }
      
      // Show a toast to indicate we're highlighting the word
      toast.success(`Highlighting "${word}" from vocabulary`);
    } else {
      // If not from vocabulary navigation, fetch all vocabulary for this note
      fetchNoteVocabulary();
    }
  }, [vocabularyNavigation, noteId]);

  // Always fetch vocabulary for this note when component mounts or noteId changes
  useEffect(() => {
    if (noteId) {
      // First, try to restore vocabulary state from localStorage
      const savedState = localStorage.getItem(`vocabulary_${noteId}`);
      if (savedState) {
        try {
          const parsedState = JSON.parse(savedState);
          setHighlightedWords(new Set(parsedState.highlightedWords || []));
          setAllSelectedWords(parsedState.allSelectedWords || []);
          setSavedWords(parsedState.savedWords || []);
        } catch (error) {
          console.error('Error parsing saved vocabulary state:', error);
        }
      }
      
      // Then fetch fresh vocabulary from API
      fetchNoteVocabulary();
    }
  }, [noteId]);

  // Handle showVocabulary prop from parent
  useEffect(() => {
    if (showVocabulary && allSelectedWords.length > 0) {
      setShowVocabPopup(true);
    } else if (!showVocabulary) {
      setShowVocabPopup(false);
    }
  }, [showVocabulary, allSelectedWords.length]);

  // Persist vocabulary state to localStorage whenever it changes
  useEffect(() => {
    if (noteId && (highlightedWords.size > 0 || allSelectedWords.length > 0 || savedWords.length > 0)) {
      const stateToSave = {
        highlightedWords: Array.from(highlightedWords),
        allSelectedWords,
        savedWords
      };
      localStorage.setItem(`vocabulary_${noteId}`, JSON.stringify(stateToSave));
    }
  }, [noteId, highlightedWords, allSelectedWords, savedWords]);

  // Expose handleWordClick to global scope for onclick handlers
  useEffect(() => {
    window.handleWordClick = handleWordClick;
    return () => {
      delete window.handleWordClick;
    };
  }, []);

  // Parse content - check if it's page-based JSON or plain text
  const parseContent = (content) => {
    if (!content) return [];
    
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].page_number) {
        // Page-based content - unescape newlines
        return parsed.map(page => page.content ? page.content.replace(/\\n/g, '\n') : '');
      } else if (parsed && typeof parsed === 'object' && parsed.content) {
        // Single page format - unescape newlines
        return [parsed.content.replace(/\\n/g, '\n')];
      }
    } catch (e) {
      // Not JSON, treat as plain text - unescape newlines
      return [content.replace(/\\n/g, '\n')];
    }
    
    // Fallback to word-based splitting for plain text
    const words = content.split(' ');
    const pages = [];
    const wordsPerPage = 200;
    for (let i = 0; i < words.length; i += wordsPerPage) {
      pages.push(words.slice(i, i + wordsPerPage).join(' '));
    }
    return pages;
  };

  // Custom component to render markdown with highlights and clickable sections
  const MarkdownWithHighlights = ({ content, highlightedWords, isLeftPane = false }) => {
    if (!content) return null;
    
    // Convert markdown to HTML first with clickable sections
    const htmlContent = content
      .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 border-blue-500 clickable-section cursor-pointer hover:bg-blue-50 transition-colors duration-200 rounded px-2 py-1" data-section="heading">$1</h1>')
      .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold text-gray-800 mb-3 pb-1 border-b border-gray-300 clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="heading">$1</h2>')
      .replace(/^### (.*$)/gim, '<h3 class="text-lg font-semibold text-gray-700 mb-2 clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="heading">$1</h3>')
      .replace(/^\* (.*$)/gim, '<li class="text-gray-700 leading-relaxed clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="list-item">$1</li>')
      .replace(/^- (.*$)/gim, '<li class="text-gray-700 leading-relaxed clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="list-item">$1</li>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-gray-900">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-gray-600">$1</em>')
      .replace(/\n\n/g, '</p><p class="text-gray-700 leading-relaxed mb-3 clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="paragraph">')
      .replace(/\n/g, '<br>');
    
    // Wrap in paragraph tags with clickable class
    let finalContent = `<p class="text-gray-700 leading-relaxed mb-3 clickable-section cursor-pointer hover:bg-gray-50 transition-colors duration-200 rounded px-2 py-1" data-section="paragraph">${htmlContent}</p>`;
    
    // Add highlights
    if (highlightedWords.size > 0) {
      const sortedWords = Array.from(highlightedWords).sort((a, b) => b.length - a.length);
      console.log('Applying highlights to words:', sortedWords);
      
              sortedWords.forEach(word => {
          // Escape special regex characters
          const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          
          // Use a more flexible regex that doesn't rely on word boundaries
          // This will match the word even if it's part of a larger word or has special characters
          const regex = new RegExp(`(${escapedWord})`, 'gi');
          
          finalContent = finalContent.replace(regex, (match) => {
            return `<span class="selected-word-highlight" style="background-color: #fef3c7; border-bottom: 2px solid #f59e0b; padding: 1px 2px; border-radius: 3px; font-weight: 500; display: inline; cursor: pointer; transition: all 0.2s ease;" data-word="${word}" onclick="window.handleWordClick('${word}', event)">${match}</span>`;
          });
        });
    }
    
    return <div dangerouslySetInnerHTML={{ __html: finalContent }} />;
  };

  const originalPages = parseContent(originalContent);
  const translatedPages = parseContent(translatedContent);

  const getWordDefinition = async (word) => {
    setIsLoadingDefinition(true);
    
    // Debug: Log what context is being used
    console.log(`🔍 getWordDefinition called for: "${word}"`);
    console.log(`📖 Current contextSentence: "${contextSentence}"`);
    console.log(`📏 Context length: ${contextSentence ? contextSentence.length : 0} characters`);
    
    try {
      // Use AI to get definition and translation
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/'}translation/define/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          word: word,
          source_language: sourceLanguage,
          target_language: targetLanguage,
          context: contextSentence || word
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setWordDefinition(data);
        setCurrentWordDefinition(data); // Also store in current word definition
        
        // Add to all selected words list
        setAllSelectedWords(prev => {
          // Check if word already exists, if so update it, otherwise add new
          const existingIndex = prev.findIndex(item => item.word === word);
          if (existingIndex >= 0) {
            // Update existing word
            const updated = [...prev];
            updated[existingIndex] = { word, definition: data, timestamp: Date.now() };
            return updated;
          } else {
            // Add new word
            return [...prev, { word, definition: data, timestamp: Date.now() }];
          }
        });
      }
    } catch (error) {
      console.error('Error getting definition:', error);
    } finally {
      setIsLoadingDefinition(false);
    }
  };

  const clearPreviousHighlights = () => {
    // Remove all previous highlights
    const highlights = document.querySelectorAll('.selected-word-highlight');
    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
      parent.normalize(); // Merge adjacent text nodes
    });
  };

  const handleTextSelection = (e) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    console.log('Text selection:', text, 'Length:', text.length);
    
    if (text && text.length > 0) { // Allow any non-empty text selection
      // Clear previous context and word definition
      setContextSentence('');
      setWordDefinition(null);
      setCurrentWordDefinition(null);
      
      setSelectedText(text);
      setShowVocabPopup(true);
      
      // Add word to highlighted words set
      setHighlightedWords(prev => {
        const newSet = new Set([...prev, text]);
        console.log('Highlighted words set:', Array.from(newSet));
        return newSet;
      });
      
      console.log('Added word to highlights:', text);
      
      // Get context around the selected word - extract surrounding text
      let contextSentence = ''; // Start with empty context
      try {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        let fullText = '';
        
        // Try to get the full text from the current page content
        if (currentPage && originalPages[currentPage - 1]) {
          // Use the parsed page content for better context
          fullText = originalPages[currentPage - 1].content || '';
          console.log(`📄 Using page ${currentPage} content for context extraction`);
        } else {
          // Fallback to DOM container text
          if (container.nodeType === Node.TEXT_NODE) {
            fullText = container.textContent;
          } else {
            fullText = container.innerText || container.textContent;
          }
          console.log(`📄 Using DOM container text for context extraction`);
        }
        
        // Find the position of the selected text in the full text
        const selectedTextLower = text.toLowerCase();
        const fullTextLower = fullText.toLowerCase();
        const textIndex = fullTextLower.indexOf(selectedTextLower);
        
        if (textIndex !== -1) {
          // Extract context around the selected word (300-500 characters BEFORE AND AFTER)
          const contextLength = 400; // Characters before and after (400 + 400 = 800 total, plus word length)
          const startIndex = Math.max(0, textIndex - contextLength);
          const endIndex = Math.min(fullText.length, textIndex + text.length + contextLength);
          
          let contextText = fullText.substring(startIndex, endIndex).trim();
          
          // Ensure the selected word is included in the context
          if (!contextText.includes(text)) {
            console.log('⚠️  Selected word not found in context, adjusting...');
            // If word was cut off, expand context to include it
            const wordStartIndex = fullText.indexOf(text, startIndex);
            if (wordStartIndex !== -1) {
              const newStartIndex = Math.max(0, wordStartIndex - contextLength);
              const newEndIndex = Math.min(fullText.length, wordStartIndex + text.length + contextLength);
              contextText = fullText.substring(newStartIndex, newEndIndex).trim();
            }
          }
          
          // Try to start and end at word boundaries for cleaner context
          const words = contextText.split(' ');
          if (words.length > 3) {
            // Remove first word if it's cut off, remove last word if it's cut off
            if (startIndex > 0 && !fullText[startIndex - 1].match(/\s/)) {
              words.shift(); // Remove first word if it's cut off
            }
            if (endIndex < fullText.length && !fullText[endIndex].match(/\s/)) {
              words.pop(); // Remove last word if it's cut off
            }
            contextText = words.join(' ');
          }
          
          // Final check: ensure the selected word is still in the context
          if (contextText && contextText.trim().length > 0) {
            if (contextText.includes(text)) {
              contextSentence = contextText.trim();
              const beforeWord = contextText.substring(0, contextText.indexOf(text));
              const afterWord = contextText.substring(contextText.indexOf(text) + text.length);
              console.log(`✅ Context extracted successfully: "${text}" found in context`);
              console.log(`📏 Characters before word: ${beforeWord.length}`);
              console.log(`📏 Characters after word: ${afterWord.length}`);
              console.log(`📏 Total context length: ${contextSentence.length}`);
            } else {
              console.log('❌ Selected word still not in context after processing');
                             // Fallback: use a smaller context that definitely includes the word
               const wordIndex = fullText.indexOf(text);
               if (wordIndex !== -1) {
                 const fallbackStart = Math.max(0, wordIndex - 300);
                 const fallbackEnd = Math.min(fullText.length, wordIndex + text.length + 300);
                 contextSentence = fullText.substring(fallbackStart, fallbackEnd).trim();
                 console.log('🔄 Using fallback context extraction (300 chars before/after)');
               }
            }
          }
        }
      } catch (error) {
        console.log('Could not extract context around word:', error);
      }
      
      // Store context sentence for later use
      setSelectedText(text);
      setContextSentence(contextSentence);
      
      // Debug: Log the context that will be stored
      console.log(`💾 Storing context for "${text}": "${contextSentence}"`);
      console.log(`📏 Context length to store: ${contextSentence ? contextSentence.length : 0} characters`);
      
      // Don't clear the selection immediately - let the user see what they selected
      // The selection will be cleared when they click elsewhere or select new text
      
      // Get definition for the selected word
      console.log(`🔍 Getting definition for: "${text}"`);
      console.log(`📖 Context being sent: "${contextSentence}"`);
      console.log(`📏 Context length: ${contextSentence ? contextSentence.length : 0} characters`);
      getWordDefinition(text);
    }
    // Don't close popup if no text selected - let user explicitly close it
  };

  // Only close popup when user explicitly clicks the close button
  const handleClosePopup = () => {
    setShowVocabPopup(false);
    setSelectedText('');
    setWordDefinition(null);
    // Don't clear allSelectedWords or highlightedWords - keep them persistent
  };

  // Remove a saved word from the list
  const handleRemoveSavedWord = (wordId) => {
    const wordToRemove = savedWords.find(w => w.id === wordId);
    if (wordToRemove) {
      setSavedWords(prev => prev.filter(word => word.id !== wordId));
      // Also remove from highlighted words
      setHighlightedWords(prev => {
        const newSet = new Set(prev);
        newSet.delete(wordToRemove.word);
        return newSet;
      });
    }
  };

  // Remove a selected word from the allSelectedWords list
  const handleRemoveSelectedWord = (word) => {
    setAllSelectedWords(prev => prev.filter(item => item.word !== word));
    // Also remove from highlighted words
    setHighlightedWords(prev => {
      const newSet = new Set(prev);
      newSet.delete(word);
      return newSet;
    });
  };

  // Save individual word to vocabulary
  const handleSaveWordToVocabulary = async (word, definition) => {
    // Check if user is logged in
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }

    setIsSaving(true);
    try {
      const response = await vocabularyAPI.saveWord({
        word: word,
        context_sentence: contextSentence || word, // Use captured context or fallback to word
        source_note_id: noteId,
        page_number: currentPage,
        source_language: sourceLanguage,
        target_language: targetLanguage
      });

      toast.success(`"${word}" saved to vocabulary!`);
      
      // Add to saved words list
      const newSavedWord = {
        id: response.data?.id || Date.now(),
        word: word,
        definition: definition?.definition || '',
        context_definition: definition?.context || '',
        context_sentence: word,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        page_number: currentPage
      };
      
      setSavedWords(prev => [...prev, newSavedWord]);
      
    } catch (error) {
      console.error('Error saving word:', error);
      if (error.isLoginRequired) {
        setShowLoginPrompt(true);
      } else {
        toast.error(`Failed to save "${word}" to vocabulary`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Save all selected words to vocabulary
  const handleSaveAllToVocabulary = async () => {
    if (allSelectedWords.length === 0) return;

    // Check if user is logged in
    if (!currentUser) {
      setShowLoginPrompt(true);
      return;
    }

    setIsSaving(true);
    try {
      const savePromises = allSelectedWords.map(item => 
        vocabularyAPI.saveWord({
          word: item.word,
          context_sentence: contextSentence || item.word,
          source_note_id: noteId,
          page_number: currentPage,
          source_language: sourceLanguage,
          target_language: targetLanguage
        })
      );

      const responses = await Promise.all(savePromises);
      
      // Add all to saved words list
      const newSavedWords = allSelectedWords.map((item, index) => ({
        id: responses[index].data?.id || Date.now() + index,
        word: item.word,
        definition: item.definition?.definition || '',
        context_definition: item.definition?.context || '',
        context_sentence: item.word,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        page_number: currentPage
      }));
      
      setSavedWords(prev => [...prev, ...newSavedWords]);
      
      toast.success(`${allSelectedWords.length} words saved to vocabulary!`);
      
      // Clear all selected words after saving
      setAllSelectedWords([]);
      setHighlightedWords(new Set());
      
    } catch (error) {
      console.error('Error saving words:', error);
      if (error.isLoginRequired) {
        setShowLoginPrompt(true);
      } else {
        toast.error('Failed to save some words to vocabulary');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.max(originalPages.length, translatedPages.length)) {
      setCurrentPage(newPage);
      if (onPageChange) {
        onPageChange(newPage);
      }
    }
  };

  const currentOriginalPage = originalPages[currentPage - 1] || '';
  const currentTranslatedPage = translatedPages[currentPage - 1] || '';

  return (
    <div className="space-y-4">
      {/* Page Navigation */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Previous</span>
        </button>

        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            Page {currentPage} of {Math.max(originalPages.length, translatedPages.length)}
          </span>
          <input
            type="number"
            min="1"
            max={Math.max(originalPages.length, translatedPages.length)}
            value={currentPage}
            onChange={(e) => handlePageChange(parseInt(e.target.value))}
            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded text-center"
          />
          <div className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Click sections to jump</span>
            <div className="text-xs text-gray-500 font-normal">
              (Click any section to navigate)
            </div>
          </div>
        </div>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= Math.max(originalPages.length, translatedPages.length)}
          className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Side-by-Side Content */}
              <div className="grid md:grid-cols-2 gap-4 h-[70vh]">
        {/* Original Content */}
        <div className="text-pane">
          <div className="text-pane-header">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-4 w-4" />
              <span>Original ({sourceLanguage})</span>
            </div>
            {isEditingOriginal && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={onSaveEditedOriginal}
                  disabled={isSavingEdit}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {isSavingEdit ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={onCancelEdit}
                  disabled={isSavingEdit}
                  className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={onReTranslate}
                  disabled={isTranslatingEdit}
                  className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {isTranslatingEdit ? 'Translating...' : 'Re-translate'}
                </button>
              </div>
            )}
          </div>
          {isEditingOriginal ? (
            <div className="text-pane-content">
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                <strong>Edit Mode:</strong> You're now editing the original text. 
                For multi-page documents, use <code className="bg-blue-100 px-1 rounded">--- Page Break ---</code> to separate pages.
              </div>
              <textarea
                value={getCleanTextForEditing(editedOriginalContent)}
                onChange={(e) => onEditedContentChange(convertCleanTextToOriginal(e.target.value))}
                className="w-full h-full p-4 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm leading-relaxed"
                placeholder="Edit your original text here...

Tip: For multi-page documents, use '--- Page Break ---' to separate pages.
All formatting will be preserved when you save."
              />
            </div>
          ) : (
            <div 
              ref={leftPaneRef}
              className="text-pane-content markdown-content overflow-y-auto scroll-smooth"
              onMouseUp={handleTextSelection}
              onScroll={handleLeftPaneScroll}
              onClick={(e) => handleSectionClick(e, true)}
              style={{ scrollBehavior: 'smooth' }}
            >
              <MarkdownWithHighlights 
                content={currentOriginalPage} 
                highlightedWords={highlightedWords}
                isLeftPane={true}
              />
            </div>
          )}
        </div>

        {/* Translated Content */}
        <div className="text-pane">
          <div className="text-pane-header">
            <div className="flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Translation ({targetLanguage})</span>
            </div>
          </div>
                     <div 
             ref={rightPaneRef}
             className="text-pane-content markdown-content overflow-y-auto scroll-smooth"
             onMouseUp={handleTextSelection}
             onScroll={handleRightPaneScroll}
             onClick={(e) => handleSectionClick(e, false)}
             style={{ scrollBehavior: 'smooth' }}
           >
             <MarkdownWithHighlights 
               content={currentTranslatedPage} 
               highlightedWords={highlightedWords}
               isLeftPane={false}
             />
           </div>
        </div>
      </div>

      {/* Horizontal Definition Box */}
      {showVocabPopup && (
        <div className="definition-box mt-4 bg-white rounded-lg shadow-lg border border-gray-200 p-4 animate-in slide-in-from-bottom-2 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedText ? `Selected: ${selectedText}` : 'Vocabulary Builder'}
            </h3>
            <button
              onClick={handleClosePopup}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Loading State */}
          {isLoadingDefinition && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 text-sm">Getting definition...</span>
            </div>
          )}

          {/* All Selected Words */}
          {allSelectedWords.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3">Selected Words ({allSelectedWords.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                 {allSelectedWords.map((item, index) => (
                   <div key={`${item.word}-${item.timestamp}`} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                     <div className="flex items-start justify-between mb-2">
                       <h5 className="font-medium text-gray-900 text-sm">{item.word}</h5>
                       <div className="flex items-center space-x-1">
                         <button
                           onClick={() => handleSaveWordToVocabulary(item.word, item.definition)}
                           disabled={isSaving}
                           className="text-green-600 hover:text-green-700 disabled:text-gray-400"
                           title="Save to vocabulary"
                         >
                           <Save className="h-4 w-4" />
                         </button>
                         <button
                           onClick={() => handleRemoveSelectedWord(item.word)}
                           className="text-red-400 hover:text-red-600"
                           title="Remove word"
                         >
                           <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                           </svg>
                         </button>
                       </div>
                     </div>
                    
                    {item.definition && (
                      <div className="space-y-2">
                        {/* Definition */}
                        <div>
                          <h6 className="font-semibold text-gray-800 text-xs">Definition:</h6>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {item.definition.definition}
                          </p>
                        </div>

                        {/* Translation */}
                        <div>
                          <h6 className="font-semibold text-gray-800 text-xs">Translation:</h6>
                          <p className="text-xs text-gray-600">
                            {item.definition.translation}
                          </p>
                        </div>

                        {/* Context */}
                        <div>
                          <h6 className="font-semibold text-gray-800 text-xs">Context:</h6>
                          <p className="text-xs text-gray-600 leading-relaxed">
                            {item.definition.context}
                          </p>
                        </div>

                        {/* Example */}
                        {item.definition.example && (
                          <div>
                            <h6 className="font-semibold text-gray-800 text-xs">Example:</h6>
                            <div className="bg-green-50 border border-green-200 rounded-md p-2">
                              <p className="text-xs text-green-800 italic">
                                "{item.definition.example}"
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="text-xs text-gray-500 space-y-1">
                          {item.definition.type && <div>Type: {item.definition.type}</div>}
                          {item.definition.level && <div>Level: {item.definition.level}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

                     {/* Action Button */}
           {allSelectedWords.length > 0 && (
             <div className="mt-4 pt-4 border-t border-gray-200">
               <button
                 onClick={handleSaveAllToVocabulary}
                 disabled={isSaving}
                 className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
               >
                 <Save className="h-4 w-4" />
                 <span>{isSaving ? 'Saving...' : `Save All (${allSelectedWords.length})`}</span>
               </button>
             </div>
           )}

          {/* Saved Words Section */}
          {savedWords.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Saved Words ({savedWords.length})</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {savedWords.map((word) => (
                  <div key={word.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 text-sm">{word.word}</h5>
                        {word.definition && (
                          <p className="text-xs text-gray-600 mt-1 line-clamp-2">{word.definition}</p>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {word.source_language} → {word.target_language}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSavedWord(word.id)}
                        className="text-red-400 hover:text-red-600 ml-2"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Login Prompt */}
      <LoginPrompt
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
        onSuccess={() => {
          // Refresh vocabulary after successful login
          fetchNoteVocabulary();
        }}
        title="Login Required to Save Vocabulary"
      />

    </div>
  );
}
