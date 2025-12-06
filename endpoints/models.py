"""
Pydantic Models Module

This module defines data validation models using Pydantic for API request/response handling.
"""

from pydantic import BaseModel


class SendMessageRequest(BaseModel):
    """
    Request model for sending Slack messages.

    Attributes:
        token (str): Slack bot token for authentication (format: xoxb-...)
        channel (str): Slack channel ID where the message will be sent (format: C...)
        message (str): The text content of the message to send

    Example:
        {
            "token": "xoxb-your-token-here",
            "channel": "C1234567890",
            "message": "Hello from the Slack bot!"
        }
    """
    token: str
    channel: str
    message: str


class GetChannelsRequest(BaseModel):
    """
    Request model for retrieving Slack channels.

    Attributes:
        token (str): Slack bot token for authentication (format: xoxb-...)

    Example:
        {
            "token": "xoxb-your-token-here"
        }
    """
    token: str


class GetUsersRequest(BaseModel):
    """
    Request model for retrieving Slack users.

    Attributes:
        token (str): Slack bot token for authentication (format: xoxb-...)

    Example:
        {
            "token": "xoxb-your-token-here"
        }
    """
    token: str