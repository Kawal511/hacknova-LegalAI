"""
This module handles secure authentication. It provides functionality for password hashing (bcrypt), JWT token generation, verification, and dependency injection for protecting API routes.
"""

"""
JWT Authentication Module for Legal Researcher API
===================================================
Provides secure, stateless authentication using JSON Web Tokens.

Features:
- JWT token generation with configurable expiry
- Token validation and user extraction
- Password hashing with bcrypt
- Middleware for protected routes
"""

import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

                            
env_path = Path(__file__).parent / '.env'
load_dotenv(env_path)

                   
JWT_SECRET = os.getenv("JWT_SECRET", "your-super-secret-jwt-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = int(os.getenv("JWT_EXPIRY_HOURS", "24"))

                                      
security = HTTPBearer()


class TokenPayload(BaseModel):
    """Structure of JWT payload."""
    user_id: int
    username: str
    exp: datetime
    iat: datetime


class AuthResponse(BaseModel):
    """Response model for login/register endpoints."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user_id: int
    username: str


class UserCredentials(BaseModel):
    """Input model for login/register - Pydantic validation prevents mass assignment."""
    username: str
    password: str


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )


def create_access_token(user_id: int, username: str) -> tuple[str, int]:
    """
    Create a JWT access token.
    
    Returns:
        Tuple of (token_string, expires_in_seconds)
    """
    now = datetime.utcnow()
    expires_at = now + timedelta(hours=JWT_EXPIRY_HOURS)
    expires_in = int((expires_at - now).total_seconds())
    
    payload = {
        "user_id": user_id,
        "username": username,
        "exp": expires_at,
        "iat": now,
        "type": "access"
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token, expires_in


def decode_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate a JWT token.
    
    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    """
    Dependency to extract and validate the current user from JWT token.
    
    Usage in endpoints:
        @router.get("/protected")
        async def protected_route(current_user: dict = Depends(get_current_user)):
            user_id = current_user["user_id"]
    """
    token = credentials.credentials
    payload = decode_token(token)
    
                                
    if "user_id" not in payload or "username" not in payload:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    return {
        "user_id": payload["user_id"],
        "username": payload["username"],
        "token_exp": payload.get("exp")
    }


def get_user_id(current_user: dict = Depends(get_current_user)) -> int:
    """
    Convenience dependency to get just the user_id.
    
    Usage in endpoints:
        @router.get("/my-cases")
        async def get_my_cases(user_id: int = Depends(get_user_id)):
            # user_id is guaranteed to be the authenticated user
    """
    return current_user["user_id"]


                                                             
class OptionalHTTPBearer(HTTPBearer):
    """Optional bearer token - doesn't raise error if missing."""
    async def __call__(self, request) -> Optional[HTTPAuthorizationCredentials]:
        try:
            return await super().__call__(request)
        except HTTPException:
            return None


optional_security = OptionalHTTPBearer(auto_error=False)


def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security)) -> Optional[Dict[str, Any]]:
    """
    Optional authentication - returns None if no valid token.
    Useful for endpoints that work differently for authenticated users.
    """
    if credentials is None:
        return None
    try:
        return get_current_user(credentials)
    except HTTPException:
        return None


# ==================== FLEXIBLE AUTH FOR DEVELOPMENT ====================
from fastapi import Query

async def get_user_id_flexible(
    user_id: Optional[int] = Query(None, description="User ID for development/testing"),
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security)
) -> int:
    """
    Flexible user_id extraction - works with either:
    1. JWT Bearer token (production)
    2. user_id query parameter (development/testing)
    
    This allows the frontend to work without full JWT implementation.
    """
    # Try JWT first
    if credentials:
        try:
            payload = decode_token(credentials.credentials)
            return payload["user_id"]
        except HTTPException:
            pass
    
    # Fallback to query parameter
    if user_id is not None:
        return user_id
    
    # No auth provided
    raise HTTPException(status_code=403, detail="Not authenticated")

