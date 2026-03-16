"""
This module provides multilingual support, enabling the translation of user queries and AI responses between English and supported Indian languages.
"""

"""
Translation Middleware for Legal Researcher
============================================
Provides translation utilities for multilingual support.
Uses deep-translator for reliable translation (more stable than googletrans).

Strategy:
- User input is translated to English before RAG processing
- RAG response is translated back to user's language
"""

from deep_translator import GoogleTranslator
from typing import Optional
import logging

logger = logging.getLogger(__name__)

                                      
SUPPORTED_LANGUAGES = {
    'en': 'English',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'hi': 'Hindi',
    'zh-CN': 'Chinese (Simplified)',
    'ar': 'Arabic',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'it': 'Italian',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'bn': 'Bengali',
    'ta': 'Tamil',
    'te': 'Telugu',
    'mr': 'Marathi',
    'gu': 'Gujarati',
    'kn': 'Kannada',
    'ml': 'Malayalam',
    'pa': 'Punjabi'
}


def translate_text(text: str, source_lang: str = 'auto', target_lang: str = 'en') -> str:
    """
    Translate text from source language to target language.
    
    Args:
        text: Text to translate
        source_lang: Source language code (use 'auto' for auto-detection)
        target_lang: Target language code
        
    Returns:
        Translated text, or original text if translation fails
    """
    if not text or not text.strip():
        return text
    
                                            
    if source_lang == target_lang:
        return text
    
    try:
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)
        return translated if translated else text
    except Exception as e:
        logger.warning(f"Translation failed: {e}. Returning original text.")
        return text


def translate_to_english(text: str, source_lang: str = 'auto') -> str:
    """
    Translate text to English for RAG processing.
    
    Args:
        text: User input text
        source_lang: Source language code
        
    Returns:
        English translation of the text
    """
    if source_lang == 'en':
        return text
    return translate_text(text, source_lang=source_lang, target_lang='en')


def translate_from_english(text: str, target_lang: str) -> str:
    """
    Translate English text to target language.
    
    Args:
        text: English text (RAG response)
        target_lang: Target language code
        
    Returns:
        Translated text in target language
    """
    if target_lang == 'en':
        return text
    return translate_text(text, source_lang='en', target_lang=target_lang)


def process_multilingual_chat(user_text: str, target_lang: str, rag_function) -> str:
    """
    Process a chat message with translation middleware.
    
    Flow:
    1. Translate user input to English (if not English)
    2. Run RAG/AI logic in English
    3. Translate response back to user's language
    
    Args:
        user_text: User's message in their language
        target_lang: User's preferred language code
        rag_function: Function that processes the English query and returns English response
        
    Returns:
        Response in user's language
    """
                                                
    english_query = translate_to_english(user_text, source_lang=target_lang)
    
                                                   
    english_response = rag_function(english_query)
    
                                                        
    final_response = translate_from_english(english_response, target_lang)
    
    return final_response


def get_supported_languages() -> dict:
    """Return dictionary of supported language codes and names."""
    return SUPPORTED_LANGUAGES.copy()


def is_language_supported(lang_code: str) -> bool:
    """Check if a language code is supported."""
    return lang_code.lower() in [k.lower() for k in SUPPORTED_LANGUAGES.keys()]
