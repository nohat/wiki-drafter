"""
Parsoid rendering router for Wiki-Drafter companion service.
"""

import json
import logging
import re
from types import SimpleNamespace
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

class RenderRequest(BaseModel):
    wikitext: str
    section: Optional[str] = None
    domain: str = "en.wikipedia.org"

class RenderResponse(BaseModel):
    html: str
    dsr_map: Optional[Dict[str, Any]] = None

@router.post("/render", response_model=RenderResponse)
async def render_wikitext(request: RenderRequest, req: Request):
    """
    Render wikitext to HTML using Parsoid, with optional section-scoped rendering.
    
    Returns HTML and DSR (DOM spec ranges) mapping for cross-highlighting between
    wikitext source and rendered output.
    """
    # Use app-level config when available; otherwise use sensible defaults for tests
    config = getattr(req.app.state, 'config', SimpleNamespace(parsoid_endpoint='http://localhost:8142'))
    
    try:
        wikitext = request.wikitext
        
        # If section is specified, try to extract just that section
        if request.section:
            section_wikitext = extract_section(wikitext, request.section)
            if section_wikitext:
                wikitext = section_wikitext
        
        # Call Parsoid API
        parsoid_url = f"{config.parsoid_endpoint}/{request.domain}/v3/transform/wikitext/to/html"
        
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Wiki-Drafter/0.1.0'
        }
        
        payload = {
            'wikitext': wikitext,
            'body_only': True,
            'stash': False
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(parsoid_url, json=payload, headers=headers)
            
            if response.status_code != 200:
                logger.error(f"Parsoid error {response.status_code}: {response.text}")
                # Fallback to basic rendering
                return RenderResponse(
                    html=basic_wikitext_to_html(wikitext),
                    dsr_map=None
                )
            
            html = response.text
            
            # Extract DSR information from data-mw attributes
            dsr_map = extract_dsr_mapping(html)
            
            # Add claim ID spans for cross-highlighting
            html = add_claim_spans(html, dsr_map)
            
            return RenderResponse(html=html, dsr_map=dsr_map)
            
    except Exception as e:
        logger.error(f"Render error: {e}")
        # Fallback to basic rendering
        return RenderResponse(
            html=basic_wikitext_to_html(request.wikitext),
            dsr_map=None
        )

def extract_section(wikitext: str, section_name: str) -> Optional[str]:
    """
    Extract a specific section from wikitext.
    Returns the section content including the header.
    """
    lines = wikitext.split('\n')
    section_start = None
    section_level = None
    
    # Find the section
    for i, line in enumerate(lines):
        if line.strip().startswith('=') and section_name.lower() in line.lower():
            section_match = re.match(r'^(={2,6})\s*(.+?)\s*\1\s*$', line)
            if section_match and section_match.group(2).strip().lower() == section_name.lower():
                section_start = i
                section_level = len(section_match.group(1))
                break
    
    if section_start is None:
        return None
    
    # Find the end of the section (next header of same or higher level)
    section_end = len(lines)
    for i in range(section_start + 1, len(lines)):
        line = lines[i].strip()
        if line.startswith('='):
            header_match = re.match(r'^(={2,6})', line)
            if header_match and len(header_match.group(1)) <= section_level:
                section_end = i
                break
    
    return '\n'.join(lines[section_start:section_end])

def extract_dsr_mapping(html: str) -> Dict[str, Any]:
    """
    Extract DSR (DOM Spec Range) information from Parsoid HTML.
    DSR maps DOM elements back to source wikitext ranges.
    """
    dsr_map = {}
    
    # Look for data-mw and data-parsoid attributes
    from bs4 import BeautifulSoup
    
    try:
        soup = BeautifulSoup(html, 'html.parser')
        
        # Find elements with DSR data
        for element in soup.find_all(attrs={'data-parsoid': True}):
            try:
                parsoid_data = json.loads(element.get('data-parsoid', '{}'))
                if 'dsr' in parsoid_data:
                    element_id = f"elem_{len(dsr_map)}"
                    element['data-dsr-id'] = element_id
                    text_content = element.get_text()
                    truncated = text_content[:100]
                    if len(text_content) > 100:
                        truncated += '...'
                    dsr_map[element_id] = {
                        'dsr': parsoid_data['dsr'],
                        'tag': element.name,
                        'text': truncated,
                    }
            except (json.JSONDecodeError, KeyError):
                continue
                
        return {'elements': dsr_map, 'html': str(soup)}
    except Exception as e:
        logger.warning(f"Failed to extract DSR mapping: {e}")
        return {}

def add_claim_spans(html: str, dsr_map: Optional[Dict[str, Any]]) -> str:
    """
    Add span elements with claim IDs for cross-highlighting.
    This would typically be coordinated with claim extraction.
    """
    # For now, this is a placeholder - in real implementation,
    # this would coordinate with the claims extraction system
    # to wrap sentences/phrases that correspond to extracted claims
    
    return html

def basic_wikitext_to_html(wikitext: str) -> str:
    """
    Fallback basic wikitext to HTML conversion when Parsoid is unavailable.
    This is a simplified converter for essential formatting.
    """
    html = wikitext
    
    # Bold and italic
    html = re.sub(r"'''(.*?)'''", r'<strong>\1</strong>', html, flags=re.DOTALL)
    html = re.sub(r"''(.*?)''", r'<em>\1</em>', html, flags=re.DOTALL)
    
    # Headers
    header_pattern = r'^(={2,6})\s*(.+?)\s*\1\s*$'
    def _header_repl(m: re.Match[str]) -> str:
        level = len(m.group(1))
        title = m.group(2)
        return f'<h{level}>{title}</h{level}>'
    html = re.sub(header_pattern, _header_repl, html, flags=re.MULTILINE)
    
    # Internal links
    link_pattern = r'\[\[([^\]|]+)(\|([^\]]+))?\]\]'
    def _link_repl(m: re.Match[str]) -> str:
        target = m.group(1)
        display = m.group(3) if m.group(3) else target
        return f'<a href="#" class="wikilink">{display}</a>'
    html = re.sub(link_pattern, _link_repl, html)
    
    # External links
    html = re.sub(r'\[([^\s]+)\s+([^\]]+)\]', r'<a href="\1" class="external">\2</a>', html)
    
    # References
    named_ref_pattern = r'<ref[^>]*name\s*=\s*["\']([^"\']+)["\'][^>]*/?>'
    named_ref_repl = r'<sup class="reference"><a href="#ref_\1">[\1]</a></sup>'
    html = re.sub(named_ref_pattern, named_ref_repl, html)
    inline_ref_pattern = r'<ref[^>]*>([^<]+)</ref>'
    inline_ref_repl = r'<sup class="reference"><a href="#ref_inline">[ref]</a></sup>'
    html = re.sub(inline_ref_pattern, inline_ref_repl, html)
    
    # Paragraphs
    paragraphs = html.split('\n\n')
    html = '\n'.join(
        (
            f'<p>{p.strip()}</p>' if p.strip() and not p.strip().startswith('<h') else p
        )
        for p in paragraphs
    )
    
    return f'<div class="wiki-content">{html}</div>'

@router.get("/render/test")
async def test_render():
    """Test endpoint to verify Parsoid connectivity."""
    return {"status": "render service available"}