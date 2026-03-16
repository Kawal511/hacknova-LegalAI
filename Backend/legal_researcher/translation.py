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
import os
import requests
from dotenv import load_dotenv

load_dotenv()
HF_TOKEN = os.getenv("HF_TOKEN")

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


def translate_text_huggingface(text: str, source_lang: str, target_lang: str) -> str:
    """
    Translate text using Hugging Face Inference API.
    Primary: IndicBERT / IndicTrans (if supported)
    Fallback: mBART (facebook/mbart-large-50-many-to-many-mmt)
    """
    if not text or not text.strip() or source_lang == target_lang:
        return text

    if not HF_TOKEN:
        logger.warning("HF_TOKEN missing. Falling back to GoogleTranslator.")
        return translate_text(text, source_lang, target_lang)

    headers = {"Authorization": f"Bearer {HF_TOKEN}"}
    
    # HF mBART language codes mapping
    mbart_lang_codes = {
        'en': 'en_XX', 'hi': 'hi_IN', 'ta': 'ta_IN', 'te': 'te_IN', 
        'bn': 'bn_IN', 'mr': 'mr_IN', 'gu': 'gu_IN', 'ml': 'ml_IN', 
        'es': 'es_XX', 'fr': 'fr_XX', 'de': 'de_DE', 'zh-CN': 'zh_CN'
    }
    
    src_code = mbart_lang_codes.get(source_lang, source_lang)
    tgt_code = mbart_lang_codes.get(target_lang, target_lang)

    is_indic = source_lang in ['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'ml'] or target_lang in ['hi', 'ta', 'te', 'bn', 'mr', 'gu', 'ml']
    
    # 1. Try IndicTrans (Primary for Indic languages)
    if is_indic:
        primary_model = "ai4bharat/indictrans2-indic-en-1B" if target_lang == 'en' else "ai4bharat/indictrans2-en-indic-1B"
        try:
            response = requests.post(
                f"https://api-inference.huggingface.co/models/{primary_model}",
                headers=headers,
                json={"inputs": text},
                timeout=10
            )
            if response.status_code == 200:
                result = response.json()
                if isinstance(result, list) and len(result) > 0 and 'translation_text' in result[0]:
                    return result[0]['translation_text']
        except Exception as e:
            logger.warning(f"Primary Indic model failed: {e}. Falling back to mBART.")

    # 2. Fallback to mBART
    fallback_model = "facebook/mbart-large-50-many-to-many-mmt"
    try:
        response = requests.post(
            f"https://api-inference.huggingface.co/models/{fallback_model}",
            headers=headers,
            json={
                "inputs": text,
                "parameters": {"src_lang": src_code, "tgt_lang": tgt_code}
            },
            timeout=10
        )
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0 and 'translation_text' in result[0]:
                return result[0]['translation_text']
            elif isinstance(result, dict) and 'translation_text' in result:
                 return result['translation_text']
            elif isinstance(result, dict) and 'error' in result:
                 logger.warning(f"mBART error: {result['error']}")
    except Exception as e:
        logger.warning(f"mBART fallback failed: {e}. Falling back to GoogleTranslator.")

    return translate_text(text, source_lang, target_lang)


def translate_to_english(text: str, source_lang: str = 'auto', use_neural: bool = False) -> str:
    """
    Translate text to English for RAG processing.
    
    Args:
        text: User input text
        source_lang: Source language code
        use_neural: True to use HuggingFace APIs
        
    Returns:
        English translation of the text
    """
    if source_lang == 'en':
        return text
    if use_neural:
        return translate_text_huggingface(text, source_lang=source_lang, target_lang='en')
    return translate_text(text, source_lang=source_lang, target_lang='en')


def translate_from_english(text: str, target_lang: str, use_neural: bool = False) -> str:
    """
    Translate English text to target language.
    
    Args:
        text: English text (RAG response)
        target_lang: Target language code
        use_neural: True to use HuggingFace APIs
        
    Returns:
        Translated text in target language
    """
    if target_lang == 'en':
        return text
    if use_neural:
        return translate_text_huggingface(text, source_lang='en', target_lang=target_lang)
    return translate_text(text, source_lang='en', target_lang=target_lang)


def process_multilingual_chat(user_text: str, target_lang: str, rag_function, use_neural: bool = False) -> str:
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
        use_neural: True to use HuggingFace
        
    Returns:
        Response in user's language
    """
                                                
    english_query = translate_to_english(user_text, source_lang=target_lang, use_neural=use_neural)
    
                                                   
    english_response = rag_function(english_query)
    
                                                        
    final_response = translate_from_english(english_response, target_lang, use_neural=use_neural)
    
    return final_response


def get_supported_languages() -> dict:
    """Return dictionary of supported language codes and names."""
    return SUPPORTED_LANGUAGES.copy()


def is_language_supported(lang_code: str) -> bool:
    """Check if a language code is supported."""
    return lang_code.lower() in [k.lower() for k in SUPPORTED_LANGUAGES.keys()]
