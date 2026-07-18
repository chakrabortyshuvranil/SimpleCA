import secrets
from urllib.parse import urlencode

import httpx

from .config import GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI

AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo"

STATE_COOKIE = "google_oauth_state"


def is_configured() -> bool:
    return bool(GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET)


def build_authorization_url() -> tuple[str, str]:
    """Returns (authorization_url, state). The caller must stash state
    somewhere it can compare against the callback's state param later
    (a short-lived cookie), to guard against CSRF.
    """
    state = secrets.token_urlsafe(24)
    params = {
        "client_id": GOOGLE_OAUTH_CLIENT_ID,
        "redirect_uri": GOOGLE_OAUTH_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "prompt": "select_account",
    }
    return f"{AUTHORIZATION_ENDPOINT}?{urlencode(params)}", state


def exchange_code_for_email(code: str) -> str:
    """Exchanges an authorization code for tokens, then returns the verified
    email address of the Google account that signed in.
    """
    token_response = httpx.post(
        TOKEN_ENDPOINT,
        data={
            "code": code,
            "client_id": GOOGLE_OAUTH_CLIENT_ID,
            "client_secret": GOOGLE_OAUTH_CLIENT_SECRET,
            "redirect_uri": GOOGLE_OAUTH_REDIRECT_URI,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    token_response.raise_for_status()
    access_token = token_response.json()["access_token"]

    userinfo_response = httpx.get(
        USERINFO_ENDPOINT,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    userinfo_response.raise_for_status()
    userinfo = userinfo_response.json()

    if not userinfo.get("email_verified", True):
        raise ValueError("Google account email is not verified")

    return userinfo["email"]
