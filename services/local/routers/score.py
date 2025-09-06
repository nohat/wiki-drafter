"""
Source quality scoring router using WP:RSP and reliability heuristics.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import logging
from urllib.parse import urlparse
from datetime import datetime
import re

logger = logging.getLogger(__name__)
router = APIRouter()

class SourceScoreRequest(BaseModel):
    domain: Optional[str] = None
    url: Optional[str] = None
    csl_json: Optional[Dict[str, Any]] = None
    context: Optional[str] = None  # Context about the claim being supported

class SourceScoreResponse(BaseModel):
    source_quality: int  # 0-100 score
    rsp_label: str
    rsp_notes: Optional[str] = None
    reliability_factors: Dict[str, Any]
    recommendations: List[str]

@router.post("/", response_model=SourceScoreResponse)
async def score_source(request: SourceScoreRequest, req: Request):
    """
    Score source reliability using WP:RSP database and reliability heuristics.
    
    Combines RSP ratings with algorithmic assessment of source quality indicators
    like editorial control, independence, peer review status, etc.
    """
    config = req.app.state.config
    
    try:
        # Extract domain if not provided
        domain = request.domain
        if not domain and request.url:
            parsed = urlparse(request.url)
            domain = parsed.netloc.lower().replace('www.', '')
        elif not domain and request.csl_json and 'URL' in request.csl_json:
            parsed = urlparse(request.csl_json['URL'])
            domain = parsed.netloc.lower().replace('www.', '')
        
        if not domain:
            raise HTTPException(status_code=400, detail="No domain provided or extractable")
        
        # Get RSP rating
        rsp_info = get_rsp_rating(domain, config)
        
        # Calculate algorithmic reliability factors
        reliability_factors = calculate_reliability_factors(
            domain=domain,
            csl_json=request.csl_json,
            context=request.context
        )
        
        # Combine RSP and algorithmic scores
        base_score = rsp_info['base_score']
        adjusted_score = apply_reliability_adjustments(base_score, reliability_factors)
        
        # Generate recommendations
        recommendations = generate_scoring_recommendations(
            rsp_info, reliability_factors, adjusted_score
        )
        
        return SourceScoreResponse(
            source_quality=max(0, min(100, int(adjusted_score))),
            rsp_label=rsp_info['label'],
            rsp_notes=rsp_info.get('notes'),
            reliability_factors=reliability_factors,
            recommendations=recommendations
        )
        
    except Exception as e:
        logger.error(f"Source scoring error: {e}")
        raise HTTPException(status_code=500, detail="Source scoring failed")

def get_rsp_rating(domain: str, config) -> Dict[str, Any]:
    """
    Get RSP (Reliable Sources Perennial) rating for a domain.
    """
    # Check exact domain match
    if domain in config.rsp_cache:
        rsp_entry = config.rsp_cache[domain]
        return {
            'label': rsp_entry['label'],
            'notes': rsp_entry.get('notes'),
            'base_score': rsp_label_to_score(rsp_entry['label'])
        }
    
    # Check parent domains
    domain_parts = domain.split('.')
    for i in range(1, len(domain_parts)):
        parent_domain = '.'.join(domain_parts[i:])
        if parent_domain in config.rsp_cache:
            rsp_entry = config.rsp_cache[parent_domain]
            return {
                'label': rsp_entry['label'],
                'notes': rsp_entry.get('notes') + ' (parent domain)',
                'base_score': rsp_label_to_score(rsp_entry['label']) - 5  # Slight penalty for subdomain
            }
    
    # Default for unknown sources
    return {
        'label': 'unknown',
        'notes': 'Not found in RSP database',
        'base_score': 50  # Neutral score
    }

def rsp_label_to_score(label: str) -> int:
    """
    Convert RSP label to numeric score.
    """
    label_scores = {
        'generally reliable': 85,
        'reliable': 80,
        'mixed': 60,
        'generally unreliable': 35,
        'unreliable': 25,
        'deprecated': 15,
        'blacklisted': 0,
        'context-dependent': 65,
        'unknown': 50
    }
    
    return label_scores.get(label.lower(), 50)

def calculate_reliability_factors(domain: str, csl_json: Optional[Dict], context: Optional[str]) -> Dict[str, Any]:
    """
    Calculate reliability factors based on source metadata and content analysis.
    """
    factors = {
        'editorial_control': 0,      # +/- points for editorial oversight
        'independence': 0,           # +/- points for independence from subjects
        'fact_checking': 0,          # +/- points for fact-checking standards
        'expertise': 0,              # +/- points for subject matter expertise
        'transparency': 0,           # +/- points for transparency
        'recency': 0,                # +/- points for publication recency
        'source_type_bonus': 0,      # Bonus/penalty for source type
        'context_fit': 0             # How well source fits the context
    }
    
    # Analyze domain for reliability indicators
    analyze_domain_reliability(domain, factors)
    
    # Analyze CSL-JSON metadata if available
    if csl_json:
        analyze_metadata_reliability(csl_json, factors)
    
    # Analyze context fit
    if context:
        analyze_context_fit(csl_json or {}, context, factors)
    
    return factors

def analyze_domain_reliability(domain: str, factors: Dict[str, int]):
    """
    Analyze domain-specific reliability indicators.
    """
    domain_lower = domain.lower()
    
    # Academic domains
    if any(tld in domain_lower for tld in ['.edu', '.ac.', 'university', 'college']):
        factors['editorial_control'] += 15
        factors['expertise'] += 10
        factors['fact_checking'] += 10
    
    # Government domains
    if domain_lower.endswith('.gov') or '.gov.' in domain_lower:
        factors['editorial_control'] += 10
        factors['transparency'] += 10
        factors['expertise'] += 5
    
    # Major news organizations (simplified list)
    major_news = [
        'nytimes.com', 'washingtonpost.com', 'bbc.co.uk', 'reuters.com',
        'ap.org', 'npr.org', 'theguardian.com', 'wsj.com'
    ]
    if any(news in domain_lower for news in major_news):
        factors['editorial_control'] += 10
        factors['fact_checking'] += 8
        factors['independence'] += 5
    
    # Academic publishers
    academic_publishers = [
        'springer.com', 'elsevier.com', 'wiley.com', 'cambridge.org',
        'oxford.com', 'jstor.org', 'pubmed.gov'
    ]
    if any(pub in domain_lower for pub in academic_publishers):
        factors['editorial_control'] += 15
        factors['expertise'] += 15
        factors['fact_checking'] += 10
    
    # Social media and user-generated content (penalties)
    social_platforms = [
        'twitter.com', 'facebook.com', 'instagram.com', 'tiktok.com',
        'reddit.com', 'youtube.com', 'medium.com'
    ]
    if any(social in domain_lower for social in social_platforms):
        factors['editorial_control'] -= 15
        factors['fact_checking'] -= 10
        factors['independence'] -= 5
    
    # Blogs and personal sites (mild penalties)
    if 'blog' in domain_lower or 'personal' in domain_lower:
        factors['editorial_control'] -= 8
        factors['fact_checking'] -= 5

def analyze_metadata_reliability(csl_json: Dict[str, Any], factors: Dict[str, int]):
    """
    Analyze CSL-JSON metadata for reliability indicators.
    """
    # Source type bonuses/penalties
    source_type = csl_json.get('type', '')
    type_scores = {
        'article-journal': 15,  # Peer-reviewed journals
        'book': 10,             # Published books
        'chapter': 8,           # Book chapters
        'article-newspaper': 5,  # News articles
        'webpage': -5,          # General web pages
        'post-weblog': -10      # Blog posts
    }
    factors['source_type_bonus'] = type_scores.get(source_type, 0)
    
    # Author information (indicates expertise)
    if 'author' in csl_json:
        authors = csl_json['author']
        if isinstance(authors, list) and len(authors) > 0:
            factors['expertise'] += min(len(authors) * 2, 8)  # Multi-author bonus, capped
    
    # Publisher information
    publisher = csl_json.get('publisher', '').lower()
    if 'university' in publisher or 'academic' in publisher:
        factors['expertise'] += 8
        factors['editorial_control'] += 5
    
    # DOI presence (indicates academic/formal publication)
    if 'DOI' in csl_json:
        factors['editorial_control'] += 10
        factors['transparency'] += 5
    
    # Publication date recency
    if 'issued' in csl_json:
        try:
            date_parts = csl_json['issued'].get('date-parts', [[]])[0]
            if date_parts:
                pub_year = date_parts[0]
                current_year = datetime.now().year
                age = current_year - pub_year
                
                if age <= 2:
                    factors['recency'] += 5
                elif age <= 5:
                    factors['recency'] += 2
                elif age >= 10:
                    factors['recency'] -= 2
                elif age >= 20:
                    factors['recency'] -= 5
        except (KeyError, IndexError, TypeError):
            pass

def analyze_context_fit(csl_json: Dict[str, Any], context: str, factors: Dict[str, int]):
    """
    Analyze how well the source fits the context of the claim.
    """
    context_lower = context.lower()
    
    # Medical/health context
    if any(term in context_lower for term in ['medical', 'health', 'disease', 'treatment', 'drug']):
        source_type = csl_json.get('type', '')
        if source_type == 'article-journal':
            factors['context_fit'] += 10  # Academic sources preferred for medical claims
        elif 'news' in source_type:
            factors['context_fit'] -= 5   # News less ideal for medical claims
    
    # Statistical/data context
    if any(term in context_lower for term in ['statistics', 'data', 'study', 'research', 'percent']):
        if csl_json.get('type') == 'article-journal' or 'DOI' in csl_json:
            factors['context_fit'] += 8
        elif csl_json.get('type') == 'webpage':
            factors['context_fit'] -= 5
    
    # Current events context
    if any(term in context_lower for term in ['recent', 'current', 'today', '2023', '2024', '2025']):
        # Check source recency
        if 'issued' in csl_json:
            try:
                date_parts = csl_json['issued'].get('date-parts', [[]])[0]
                if date_parts:
                    pub_year = date_parts[0]
                    if pub_year >= datetime.now().year - 1:
                        factors['context_fit'] += 8
            except:
                pass

def apply_reliability_adjustments(base_score: int, factors: Dict[str, int]) -> float:
    """
    Apply reliability factor adjustments to base RSP score.
    """
    adjustment = sum(factors.values())
    adjusted = base_score + adjustment
    
    # Apply diminishing returns for very high scores
    if adjusted > 90:
        adjusted = 90 + (adjusted - 90) * 0.3
    
    return adjusted

def generate_scoring_recommendations(rsp_info: Dict, factors: Dict[str, int], score: int) -> List[str]:
    """
    Generate recommendations based on source scoring.
    """
    recommendations = []
    
    # RSP-based recommendations
    rsp_label = rsp_info['label'].lower()
    if rsp_label in ['deprecated', 'blacklisted', 'generally unreliable']:
        recommendations.append('Find alternative sources - this source is not considered reliable')
    elif rsp_label == 'context-dependent':
        recommendations.append('Review context-dependent reliability - may be suitable for some claims')
    elif rsp_label == 'unknown':
        recommendations.append('Source not in RSP database - verify reliability independently')
    
    # Score-based recommendations
    if score < 40:
        recommendations.append('Low reliability score - consider finding higher quality sources')
    elif score < 60:
        recommendations.append('Moderate reliability - acceptable for general claims')
    elif score >= 80:
        recommendations.append('High reliability - excellent source for Wikipedia')
    
    # Factor-specific recommendations
    if factors['editorial_control'] < -5:
        recommendations.append('Limited editorial oversight - verify information independently')
    
    if factors['independence'] < -5:
        recommendations.append('May have conflicts of interest - consider independent sources')
    
    if factors['expertise'] < 0:
        recommendations.append('Limited subject matter expertise - supplement with expert sources')
    
    if factors['recency'] < -3:
        recommendations.append('Source is dated - consider more recent information if available')
    
    return recommendations

@router.get("/rsp/{domain}")
async def get_rsp_info(domain: str, req: Request):
    """
    Get RSP information for a specific domain.
    """
    config = req.app.state.config
    rsp_info = get_rsp_rating(domain, config)
    
    return {
        'domain': domain,
        'rsp_label': rsp_info['label'],
        'rsp_notes': rsp_info.get('notes'),
        'base_score': rsp_info['base_score']
    }

@router.get("/test")
async def test_scoring():
    """Test endpoint to verify source scoring service."""
    return {"status": "source scoring service available"}