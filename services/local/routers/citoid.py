"""
Citoid integration router for citation normalization and metadata extraction.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
import httpx
import json
import logging
import re
from urllib.parse import quote, urlparse
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

class CitoidRequest(BaseModel):
    identifier: str  # URL, DOI, ISBN, etc.
    format: str = "mediawiki"  # Output format

class CitoidResponse(BaseModel):
    csl_json: Dict[str, Any]
    template: str
    refname: str
    metadata: Dict[str, Any]

@router.post("/", response_model=CitoidResponse)
async def normalize_citation(request: CitoidRequest, req: Request):
    """
    Normalize a citation using Citoid service and generate a stable refname.
    
    Takes a URL, DOI, ISBN or other identifier and returns structured citation
    data along with a MediaWiki cite template and stable reference name.
    """
    config = req.app.state.config
    
    try:
        # Call Citoid API
        citoid_url = f"{config.citoid_endpoint}/api"
        
        headers = {
            'Accept': 'application/json',
            'User-Agent': 'Wiki-Drafter/0.1.0'
        }
        
        params = {
            'search': request.identifier,
            'format': request.format
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(citoid_url, params=params, headers=headers)
            
            if response.status_code != 200:
                logger.warning(f"Citoid request failed: {response.status_code}")
                # Fallback to manual parsing
                return await fallback_citation_parsing(request.identifier, config)
            
            citoid_data = response.json()
            
            if not citoid_data:
                raise HTTPException(status_code=404, detail="No citation data found")
            
            # Take first result
            citation = citoid_data[0] if isinstance(citoid_data, list) else citoid_data
            
            # Generate stable refname
            refname = generate_refname(citation, request.identifier)
            
            # Convert to MediaWiki template
            template = generate_cite_template(citation)
            
            # Extract additional metadata
            metadata = extract_metadata(citation, request.identifier)
            
            # Store in sources cache
            source_key = refname
            config.sources[source_key] = {
                'normalized_key': refname,
                'csl_json': citation,
                'cite_template': template,
                'original_identifier': request.identifier,
                'access_date': datetime.now().isoformat(),
                'metadata': metadata
            }
            config.save_sources()
            
            return CitoidResponse(
                csl_json=citation,
                template=template,
                refname=refname,
                metadata=metadata
            )
            
    except Exception as e:
        logger.error(f"Citoid error: {e}")
        # Fallback to basic citation
        return await fallback_citation_parsing(request.identifier, config)

async def fallback_citation_parsing(identifier: str, config) -> CitoidResponse:
    """
    Fallback citation parsing when Citoid is unavailable.
    Attempts basic URL parsing and metadata extraction.
    """
    try:
        # Parse URL for basic information
        if identifier.startswith(('http://', 'https://')):
            parsed = urlparse(identifier)
            domain = parsed.netloc.lower().replace('www.', '')
            
            # Basic CSL-JSON structure
            csl_json = {
                'type': 'webpage',
                'URL': identifier,
                'accessed': datetime.now().strftime('%Y-%m-%d'),
                'container-title': domain.title(),
                'title': f"Page at {domain}"  # Placeholder - would extract from HTML in full implementation
            }
            
            # Try to extract page title via HTTP request
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(identifier, headers={'User-Agent': 'Wiki-Drafter/0.1.0'})
                    if response.status_code == 200:
                        import re
                        title_match = re.search(r'<title[^>]*>([^<]+)</title>', response.text, re.IGNORECASE)
                        if title_match:
                            csl_json['title'] = title_match.group(1).strip()
            except:
                pass  # Use placeholder title
            
            refname = generate_refname(csl_json, identifier)
            template = generate_cite_template(csl_json)
            metadata = extract_metadata(csl_json, identifier)
            
            return CitoidResponse(
                csl_json=csl_json,
                template=template,
                refname=refname,
                metadata=metadata
            )
        
        # Handle DOI
        elif identifier.lower().startswith('doi:') or '10.' in identifier:
            doi = identifier.replace('doi:', '').strip()
            csl_json = {
                'type': 'article',
                'DOI': doi,
                'title': f"DOI: {doi}"
            }
            
            refname = f"doi_{doi.replace('/', '_').replace('.', '_')}"
            template = f"{{{{cite journal|doi={doi}}}}}"
            
            return CitoidResponse(
                csl_json=csl_json,
                template=template,
                refname=refname,
                metadata={'type': 'academic', 'doi': doi}
            )
        
        else:
            raise HTTPException(status_code=400, detail="Unable to parse identifier")
            
    except Exception as e:
        logger.error(f"Fallback citation parsing failed: {e}")
        raise HTTPException(status_code=500, detail="Citation parsing failed")

def generate_refname(citation: Dict[str, Any], identifier: str) -> str:
    """
    Generate a stable, human-readable reference name.
    Format: domain_year_slugN where N is incremented for duplicates.
    """
    try:
        # Extract domain from URL or container
        domain = None
        if 'URL' in citation:
            parsed = urlparse(citation['URL'])
            domain = parsed.netloc.lower().replace('www.', '')
        elif 'container-title' in citation:
            domain = citation['container-title'].lower().replace(' ', '')
        elif identifier.startswith(('http://', 'https://')):
            parsed = urlparse(identifier)
            domain = parsed.netloc.lower().replace('www.', '')
        
        if not domain:
            domain = 'source'
        
        # Extract year
        year = None
        if 'issued' in citation and 'date-parts' in citation['issued']:
            year = citation['issued']['date-parts'][0][0]
        elif 'accessed' in citation:
            try:
                year = datetime.fromisoformat(citation['accessed'].replace('Z', '+00:00')).year
            except:
                year = datetime.now().year
        else:
            year = datetime.now().year
        
        # Create base refname
        domain_clean = re.sub(r'[^a-zA-Z0-9]', '', domain)[:15]  # Clean and truncate
        base_refname = f"{domain_clean}_{year}"
        
        # Add slug if title is available
        if 'title' in citation:
            title_slug = re.sub(r'[^a-zA-Z0-9\s]', '', citation['title'])
            title_slug = re.sub(r'\s+', '_', title_slug).lower()[:20]  # Truncate
            base_refname += f"_{title_slug}"
        
        return base_refname
        
    except Exception as e:
        logger.warning(f"Failed to generate refname: {e}")
        return f"ref_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

def generate_cite_template(citation: Dict[str, Any]) -> str:
    """
    Generate MediaWiki citation template from CSL-JSON data.
    """
    cite_type = citation.get('type', 'web')
    
    # Map CSL types to MediaWiki templates
    template_map = {
        'article-journal': 'cite journal',
        'article-newspaper': 'cite news',
        'book': 'cite book',
        'chapter': 'cite book',
        'webpage': 'cite web',
        'article': 'cite journal'
    }
    
    template_name = template_map.get(cite_type, 'cite web')
    params = []
    
    # Title
    if 'title' in citation:
        params.append(f"title={citation['title']}")
    
    # Author(s)
    if 'author' in citation:
        authors = citation['author']
        if isinstance(authors, list) and authors:
            first_author = authors[0]
            if isinstance(first_author, dict):
                if 'family' in first_author:
                    params.append(f"last={first_author['family']}")
                if 'given' in first_author:
                    params.append(f"first={first_author['given']}")
            elif isinstance(first_author, str):
                params.append(f"author={first_author}")
    
    # Publication details
    if 'container-title' in citation:
        if template_name == 'cite journal':
            params.append(f"journal={citation['container-title']}")
        elif template_name == 'cite news':
            params.append(f"newspaper={citation['container-title']}")
        else:
            params.append(f"website={citation['container-title']}")
    
    # Date
    if 'issued' in citation and 'date-parts' in citation['issued']:
        date_parts = citation['issued']['date-parts'][0]
        if len(date_parts) >= 3:
            params.append(f"date={date_parts[0]}-{date_parts[1]:02d}-{date_parts[2]:02d}")
        elif len(date_parts) >= 1:
            params.append(f"date={date_parts[0]}")
    
    # URL and access date
    if 'URL' in citation:
        params.append(f"url={citation['URL']}")
    
    if 'accessed' in citation:
        params.append(f"access-date={citation['accessed']}")
    
    # DOI
    if 'DOI' in citation:
        params.append(f"doi={citation['DOI']}")
    
    # Publisher
    if 'publisher' in citation:
        params.append(f"publisher={citation['publisher']}")
    
    return f"{{{{{template_name}|{' |'.join(params)}}}}}"

def extract_metadata(citation: Dict[str, Any], identifier: str) -> Dict[str, Any]:
    """
    Extract additional metadata for source quality scoring and policy checks.
    """
    metadata = {}
    
    # Source type
    if 'type' in citation:
        metadata['source_type'] = citation['type']
    
    # Domain for RSP lookup
    if 'URL' in citation or identifier.startswith(('http://', 'https://')):
        url = citation.get('URL', identifier)
        parsed = urlparse(url)
        metadata['domain'] = parsed.netloc.lower().replace('www.', '')
    
    # Publisher info
    if 'publisher' in citation:
        metadata['publisher'] = citation['publisher']
    
    # Academic indicators
    if 'DOI' in citation or citation.get('type') == 'article-journal':
        metadata['is_academic'] = True
    
    # Publication date for freshness checks
    if 'issued' in citation:
        metadata['published_date'] = citation['issued']
    
    return metadata

@router.get("/test")
async def test_citoid():
    """Test endpoint to verify Citoid connectivity."""
    return {"status": "citoid service available"}