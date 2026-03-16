"""
This module implements Token Bucket rate limiting to prevent abuse of the API and LLM resources.
"""

import time
from collections import deque

class RateLimiter:
    """
    Token bucket rate limiter to prevent API spam.
    Security layer to protect against abuse.
    """
    def __init__(self, tokens_per_minute: int = 20):
        self.tokens_per_minute = tokens_per_minute
        self.requests = deque()
    
    def try_acquire(self) -> bool:
        """
        Try to acquire a token. Returns True if allowed, False if rate limited.
        """
        current_time = time.time()
        window_start = current_time - 60                   
        
                                                
        while self.requests and self.requests[0] < window_start:
            self.requests.popleft()
        
                                        
        if len(self.requests) < self.tokens_per_minute:
            self.requests.append(current_time)
            return True
        
        return False
    
    def get_wait_time(self) -> float:
        """Returns seconds until next token is available."""
        if not self.requests:
            return 0
        
        oldest_request = self.requests[0]
        wait_time = 60 - (time.time() - oldest_request)
        return max(0, wait_time)
