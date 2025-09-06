"""
Link archiving router for Wayback Machine integration.
"""

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Dict, List, Optional
import httpx
import logging
from urllib.parse import quote, urlparse
from datetime import datetime
import asyncio

logger = logging.getLogger(__name__)
router = APIRouter()

class ArchiveRequest(BaseModel):
    url: str
    force_new: bool = False  # Force new snapshot even if recent one exists

class ArchiveResponse(BaseModel):
    original_url: str
    archive_url: Optional[str] = None
    archive_date: Optional[str] = None
    status: str  # 'success', 'failed', 'pending', 'exists'
    message: Optional[str] = None

@router.post("/", response_model=ArchiveResponse)
async def archive_url(request: ArchiveRequest, req: Request):
    """
    Archive a URL using the Wayback Machine.
    
    First checks if a recent archive exists, then submits for archiving if needed.
    Returns archive URL and timestamp, or status if archiving failed.
    """
    try:
        url = request.url.strip()
        
        # Validate URL
        if not url.startswith(('http://', 'https://')):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        # Check if recent archive exists (unless force_new is True)
        if not request.force_new:
            existing_archive = await check_existing_archive(url)
            if existing_archive:
                return ArchiveResponse(
                    original_url=url,
                    archive_url=existing_archive['archive_url'],
                    archive_date=existing_archive['archive_date'],
                    status='exists',
                    message='Recent archive found'
                )
        
        # Submit for archiving
        archive_result = await submit_for_archiving(url)
        
        return ArchiveResponse(
            original_url=url,
            archive_url=archive_result.get('archive_url'),
            archive_date=archive_result.get('archive_date'),
            status=archive_result['status'],
            message=archive_result.get('message')
        )
        
    except Exception as e:
        logger.error(f"Archive error for {request.url}: {e}")
        return ArchiveResponse(
            original_url=request.url,
            status='failed',
            message=str(e)
        )

async def check_existing_archive(url: str) -> Optional[Dict]:
    """
    Check if a recent archive of the URL exists in Wayback Machine.
    Returns archive info if found within the last 30 days.
    """
    try:
        # Wayback availability API
        wayback_api = f"http://archive.org/wayback/available?url={quote(url)}"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(wayback_api)
            
            if response.status_code == 200:
                data = response.json()
                
                if 'archived_snapshots' in data and 'closest' in data['archived_snapshots']:
                    closest = data['archived_snapshots']['closest']
                    
                    if closest.get('available'):
                        # Check if archive is recent (within 30 days)
                        timestamp = closest.get('timestamp')
                        if timestamp:
                            try:
                                archive_date = datetime.strptime(timestamp, '%Y%m%d%H%M%S')
                                days_old = (datetime.now() - archive_date).days
                                
                                if days_old <= 30:  # Recent enough
                                    return {
                                        'archive_url': closest['url'],
                                        'archive_date': archive_date.isoformat(),
                                        'timestamp': timestamp
                                    }
                            except ValueError:
                                pass  # Invalid timestamp format
                
    except Exception as e:
        logger.warning(f"Failed to check existing archive for {url}: {e}")
    
    return None

async def submit_for_archiving(url: str) -> Dict:
    """
    Submit URL to Wayback Machine for archiving.
    Returns status and archive URL if successful.
    """
    try:
        # Wayback save API
        save_api = "https://web.archive.org/save"
        
        headers = {
            'User-Agent': 'Wiki-Drafter/0.1.0 (Wikipedia drafting tool)',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        
        data = {'url': url}
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(save_api, data=data, headers=headers, follow_redirects=True)
            
            if response.status_code == 200:
                # Success - extract archive URL from response
                content_location = response.headers.get('Content-Location')
                if content_location and 'web.archive.org' in content_location:
                    # Extract timestamp from archive URL
                    import re
                    timestamp_match = re.search(r'/web/(\d{14})/', content_location)
                    if timestamp_match:
                        timestamp = timestamp_match.group(1)
                        archive_date = datetime.strptime(timestamp, '%Y%m%d%H%M%S').isoformat()
                        
                        return {
                            'status': 'success',
                            'archive_url': content_location,
                            'archive_date': archive_date,
                            'message': 'Successfully archived'
                        }
                
                return {
                    'status': 'pending',
                    'message': 'Archive request submitted, check back later'
                }
            
            elif response.status_code == 429:
                return {
                    'status': 'failed',
                    'message': 'Rate limited by Wayback Machine'
                }
            
            else:
                return {
                    'status': 'failed',
                    'message': f'Archive request failed: HTTP {response.status_code}'
                }
                
    except httpx.TimeoutException:
        return {
            'status': 'pending',
            'message': 'Archive request timed out, may be processing'
        }
    except Exception as e:
        return {
            'status': 'failed',
            'message': f'Archive request failed: {str(e)}'
        }

@router.post("/batch", response_model=List[ArchiveResponse])
async def archive_batch(urls: List[str], req: Request):
    """
    Archive multiple URLs in batch.
    Processes up to 10 URLs concurrently with rate limiting.
    """
    if len(urls) > 50:
        raise HTTPException(status_code=400, detail="Too many URLs (max 50)")
    
    # Process in smaller batches to avoid rate limits
    batch_size = 5
    results = []
    
    for i in range(0, len(urls), batch_size):
        batch = urls[i:i + batch_size]
        
        # Process batch concurrently
        tasks = [
            archive_url(ArchiveRequest(url=url), req) 
            for url in batch
        ]
        
        batch_results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in batch_results:
            if isinstance(result, Exception):
                results.append(ArchiveResponse(
                    original_url="unknown",
                    status='failed',
                    message=str(result)
                ))
            else:
                results.append(result)
        
        # Rate limiting between batches
        if i + batch_size < len(urls):
            await asyncio.sleep(2)
    
    return results

@router.get("/check/{url:path}")
async def check_archive_status(url: str):
    """
    Check if a URL has been archived recently.
    Returns archive information without creating new archives.
    """
    try:
        archive_info = await check_existing_archive(url)
        
        if archive_info:
            return {
                'url': url,
                'archived': True,
                'archive_url': archive_info['archive_url'],
                'archive_date': archive_info['archive_date']
            }
        else:
            return {
                'url': url,
                'archived': False,
                'message': 'No recent archive found'
            }
            
    except Exception as e:
        logger.error(f"Archive check error: {e}")
        return {
            'url': url,
            'archived': False,
            'error': str(e)
        }

@router.get("/test")
async def test_archive():
    """Test endpoint to verify archive service."""
    return {"status": "archive service available"}