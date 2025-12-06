from .account import router as account_router
from .workspace import router as workspace_router
from .oauth import router as oauth_router
from .templates import router as templates_router
from .teams import router as teams_router
from .dashboards import router as dashboards_router

__all__ = ['account_router', 'workspace_router', 'oauth_router', 'templates_router', 'teams_router', 'dashboards_router']