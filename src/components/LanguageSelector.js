import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { translationAPI } from '../services/api';

export default function LanguageSelector({ 
  value, 
  onChange, 
  label, 
  placeholder = "Select language",
  excludeAuto = false 
}) {
  const [languages, setLanguages] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLanguages = async () => {
      try {
        const response = await translationAPI.getSupportedLanguages();
        let langs = response.data;
        
        if (excludeAuto) {
          langs = langs.filter(lang => lang.code !== 'auto');
        }
        
        setLanguages(langs);
      } catch (error) {
        console.error('Error fetching languages:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLanguages();
  }, [excludeAuto]);

  const selectedLanguage = languages.find(lang => lang.code === value);

  if (loading) {
    return (
      <div className="space-y-2">
        {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
        <div className="relative">
          <div className="w-full p-3 border border-gray-300 rounded-md bg-gray-100 animate-pulse">
            Loading languages...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-700">{label}</label>}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full p-3 text-left border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent flex items-center justify-between"
        >
          <span className={selectedLanguage ? 'text-gray-900' : 'text-gray-500'}>
            {selectedLanguage ? selectedLanguage.name : placeholder}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {languages.map((language) => (
              <button
                key={language.code}
                type="button"
                onClick={() => {
                  onChange(language.code);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left hover:bg-gray-100 ${
                  value === language.code ? 'bg-primary-50 text-primary-700' : 'text-gray-900'
                }`}
              >
                {language.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
