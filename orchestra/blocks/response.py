"""
Response Block Executor

This module handles the execution of response blocks in the orchestration system.
It sends formatted responses to Slack channels.
"""

import httpx
from typing import Dict, Any


async def execute_response(response_data: str, bot_token: str, channel: str):
    """
    Execute a response action by sending a formatted response to a Slack channel.

    This function sends the final response/output of a workflow to a Slack channel.
    The response is wrapped in backticks for code-like formatting in Slack.

    Args:
        response_data (str): The response text to send
        bot_token (str): Slack bot token for authentication
        channel (str): Slack channel ID or name where the response will be sent

    Returns:
        dict: Execution result containing:
            - status (str): "completed" if successful
            - response (str): The original response data
            - channel (str): Channel where response was sent
            - timestamp (str): Slack message timestamp

    Raises:
        Exception: If Slack API returns an error

    Example:
        >>> result = await execute_response(
        ...     "Task completed: 5 items processed",
        ...     "xoxb-...",
        ...     "C1234567890"
        ... )
        >>> print(result)
        {
            "status": "completed",
            "response": "Task completed: 5 items processed",
            "channel": "C1234567890",
            "timestamp": "1234567890.123456"
        }

    Note:
        The response is automatically wrapped in backticks (`) for
        monospace formatting in Slack.
    """
    # Format response with backticks for code-style formatting in Slack
    formatted_response = f"`{response_data}`"

    # Slack API endpoint for posting messages
    url = "https://slack.com/api/chat.postMessage"

    # Set up authorization headers
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    # Prepare message payload
    payload = {
        "channel": channel,
        "text": formatted_response
    }

    # Send response to Slack using async httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response_data_result = response.json()

    # Check if Slack API returned an error
    if not response_data_result.get("ok"):
        raise Exception(f"Slack API error: {response_data_result.get('error')}")

    print(f"Response sent to {channel}: {formatted_response}")

    return {
        "status": "completed",
        "response": response_data,
        "channel": channel,
        "timestamp": response_data_result.get("ts")
    }