"""
Copyright violation detection router using similarity analysis.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional
import httpx
import logging
import re
from difflib import SequenceMatcher
import hashlib

logger = logging.getLogger(__name__)
router = APIRouter()

class CopyVioRequest(BaseModel):
    text: str
    threshold: float = 0.35  # Similarity threshold for concern
    top_n: int = 5  # Number of top matches to return

class CopyVioMatch(BaseModel):
    url: str
    similarity: float
    matching_text: str
    source_title: Optional[str] = None

class CopyVioResponse(BaseModel):
    text_hash: str
    similarity_max: float
    matches: List[CopyVioMatch]
    status: str  # 'clean', 'concern', 'violation'
    recommendations: List[str]

@router.post("/", response_model=CopyVioResponse)
async def check_copyvio(request: CopyVioRequest, req: Request):
    """
    Check text for potential copyright violations using similarity analysis.
    
    This is a simplified implementation - in production, this would integrate
    with services like the Earwig Copyvio Detector or similar tools.
    """
    try:
        text = request.text.strip()
        
        if len(text) < 50:
            return CopyVioResponse(
                text_hash=hashlib.md5(text.encode()).hexdigest()[:16],
                similarity_max=0.0,
                matches=[],
                status='clean',
                recommendations=[]
            )
        
        # Search for potential matches (simplified approach)
        matches = await search_for_matches(text, request.top_n)
        
        # Calculate maximum similarity
        similarity_max = max([m.similarity for m in matches], default=0.0)
        
        # Determine status
        status = determine_violation_status(similarity_max, request.threshold)
        
        # Generate recommendations
        recommendations = generate_recommendations(status, similarity_max, matches)
        
        return CopyVioResponse(
            text_hash=hashlib.md5(text.encode()).hexdigest()[:16],
            similarity_max=similarity_max,
            matches=matches,
            status=status,
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"CopyVio check error: {e}")
        raise HTTPException(status_code=500, detail="Copyright violation check failed")

async def search_for_matches(text: str, top_n: int) -> List[CopyVioMatch]:
    """
    Search for potential copyright violations by looking for similar text online.
    
    This is a simplified implementation. In production, this would:
    1. Use specialized search APIs (like Earwig's API)
    2. Search academic databases
    3. Check against known copyright violation databases
    4. Use more sophisticated similarity algorithms
    """
    matches = []
    
    try:
        # Extract key phrases for searching
        search_phrases = extract_search_phrases(text)
        
        # Search each phrase (limited implementation)
        for phrase in search_phrases[:3]:  # Limit searches to avoid rate limits
            phrase_matches = await search_phrase(phrase, text)
            matches.extend(phrase_matches)
        
        # Remove duplicates and sort by similarity
        unique_matches = {}
        for match in matches:
            if match.url not in unique_matches or match.similarity > unique_matches[match.url].similarity:
                unique_matches[match.url] = match
        
        sorted_matches = sorted(unique_matches.values(), key=lambda x: x.similarity, reverse=True)
        return sorted_matches[:top_n]
        
    except Exception as e:
        logger.warning(f"Match search failed: {e}")
        return []

def extract_search_phrases(text: str) -> List[str]:
    """
    Extract distinctive phrases from text for searching.
    Focuses on longer, more specific phrases that are likely to be unique.
    """
    # Clean text
    clean_text = re.sub(r'[^\w\s]', ' ', text)
    sentences = [s.strip() for s in clean_text.split('.') if len(s.strip()) > 30]
    
    phrases = []
    
    for sentence in sentences[:5]:  # Limit to first 5 sentences
        words = sentence.split()
        
        # Extract phrases of different lengths
        for length in [8, 12, 16]:  # Different phrase lengths
            for i in range(len(words) - length + 1):
                phrase = ' '.join(words[i:i + length])
                if len(phrase) > 50 and len(phrase) < 200:  # Reasonable length
                    phrases.append(phrase)
        
        if len(phrases) >= 10:  # Limit total phrases
            break
    
    return phrases

async def search_phrase(phrase: str, original_text: str) -> List[CopyVioMatch]:
    """
    Search for a specific phrase online and check similarity.
    
    This is a placeholder implementation. In production, this would use
    specialized search APIs or copyright violation detection services.
    """
    matches = []
    
    try:
        # Mock search results - in reality, this would query search engines
        # or specialized databases
        mock_results = [
            {
                'url': 'https://example.com/article1',
                'title': 'Example Article',
                'content': 'This is mock content that might match some phrases from the original text.'
            }
        ]
        
        for result in mock_results:
            similarity = calculate_similarity(original_text, result['content'])
            
            if similarity > 0.1:  # Only include if there's some similarity
                matches.append(CopyVioMatch(
                    url=result['url'],
                    similarity=similarity,
                    matching_text=result['content'][:200] + '...',
                    source_title=result.get('title')
                ))
    
    except Exception as e:
        logger.warning(f"Phrase search failed for '{phrase[:50]}...': {e}")
    
    return matches

def calculate_similarity(text1: str, text2: str) -> float:
    """
    Calculate similarity between two texts using sequence matching.
    Returns a float between 0 and 1 representing similarity.
    """
    # Normalize texts
    norm1 = re.sub(r'\s+', ' ', text1.lower().strip())
    norm2 = re.sub(r'\s+', ' ', text2.lower().strip())
    
    # Use SequenceMatcher for similarity
    matcher = SequenceMatcher(None, norm1, norm2)
    return matcher.ratio()

def determine_violation_status(similarity_max: float, threshold: float) -> str:
    """
    Determine copyright violation status based on similarity scores.
    """
    if similarity_max >= 0.8:
        return 'violation'  # Very high similarity - likely copyvio
    elif similarity_max >= threshold:
        return 'concern'    # Above threshold - needs review
    else:
        return 'clean'      # Below threshold - likely original

def generate_recommendations(status: str, similarity_max: float, matches: List[CopyVioMatch]) -> List[str]:
    """
    Generate recommendations based on copyright violation analysis.
    """
    recommendations = []
    
    if status == 'violation':
        recommendations.extend([
            'High similarity detected - review for potential copyright violation',
            'Consider rewriting in your own words',
            'If using quotes, ensure proper attribution and fair use',
            'Check if content requires permission from copyright holder'
        ])
    elif status == 'concern':
        recommendations.extend([
            'Moderate similarity detected - review for originality',
            'Consider paraphrasing to improve originality',
            'Verify sources and add proper citations'
        ])
        
        if similarity_max > 0.5:
            recommendations.append('Consider using quotation marks if directly citing')
    else:
        recommendations.append('Text appears to be original - no copyright concerns detected')
    
    # Add specific recommendations based on matches
    if matches:
        high_similarity_matches = [m for m in matches if m.similarity > 0.6]
        if high_similarity_matches:
            recommendations.append(f'Review similarity with {len(high_similarity_matches)} source(s)')
    
    return recommendations

@router.post("/quick")
async def quick_copyvio_check(text: str, threshold: float = 0.35):
    """
    Quick copyright violation check returning just the essential information.
    """
    try:
        result = await check_copyvio(
            CopyVioRequest(text=text, threshold=threshold, top_n=1), 
            None  # No request context needed for this simplified check
        )
        
        return {
            'status': result.status,
            'similarity_max': result.similarity_max,
            'concern': result.similarity_max >= threshold
        }
        
    except Exception as e:
        logger.error(f"Quick copyvio check failed: {e}")
        return {
            'status': 'error',
            'similarity_max': 0.0,
            'concern': False,
            'error': str(e)
        }

@router.get("/test")
async def test_copyvio():
    """Test endpoint to verify copyright violation detection service."""
    return {"status": "copyvio service available"}