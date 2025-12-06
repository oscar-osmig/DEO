"""
Message Block Executor

This module handles the execution of message blocks in the orchestration system.
It sends messages to Slack channels or direct messages to users using the Slack API.
"""

import httpx
from typing import Dict, Any, List


async def execute_message(message_data: Dict[str, Any], bot_token: str):
    """
    Execute a message action by sending a message to a Slack channel or users.

    This function is called by the orchestrator to send messages to Slack
    channels or direct messages to users as part of a template execution workflow.

    Supports two modes:
    1. Channel mode: Send message to a specific channel
    2. Users mode: Send direct messages to multiple users

    Args:
        message_data (Dict[str, Any]): Dictionary containing message configuration:
            Mode 1 (Channel):
                - channel_name (str): Name or ID of the Slack channel
                - message (str): The message text to send
            Mode 2 (Users):
                - users (List[str]): List of user IDs to send DMs to
                - message (str): The message text to send
        bot_token (str): Slack bot token for authentication

    Returns:
        dict: Execution result containing:
            - status (str): "sent" if successful
            - mode (str): "channel" or "users"
            - channel (str): Channel name (if mode is "channel")
            - channel_members (list): List of user IDs in the channel (if mode is "channel")
            - users (list): List of user results (if mode is "users")
            - message (str): The message that was sent
            - timestamp (str): Slack message timestamp

    Raises:
        ValueError: If neither channel_name nor users is provided, or if message is missing
        Exception: If Slack API returns an error
    """
    # Extract message parameters
    channel_name = message_data.get("channel_name")
    users = message_data.get("users")
    message_text = message_data.get("message")

    # Validate that we have either channel_name or users
    if not channel_name and not users:
        raise ValueError("Message block requires either 'channel_name' or 'users'")

    # Validate that we don't have both
    if channel_name and users:
        raise ValueError("Message block cannot have both 'channel_name' and 'users'. Choose one mode.")

    # Validate that message is provided
    if not message_text:
        raise ValueError("Message block requires 'message'")

    # MODE 1: Send to a channel
    if channel_name:
        return await _send_to_channel(channel_name, message_text, bot_token)

    # MODE 2: Send DMs to users
    else:
        return await _send_to_users(users, message_text, bot_token)


async def _get_channel_members(channel_id: str, bot_token: str) -> List[str]:
    """
    Get all members of a Slack channel.

    Args:
        channel_id (str): Channel ID
        bot_token (str): Slack bot token

    Returns:
        List[str]: List of user IDs in the channel (excluding bots)
    """
    url = "https://slack.com/api/conversations.members"

    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    params = {
        "channel": channel_id
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response_data = response.json()

    if not response_data.get("ok"):
        print(f"Warning: Could not get channel members: {response_data.get('error')}")
        return []

    members = response_data.get("members", [])

    # Filter out bots by checking user info
    real_members = []
    for member_id in members:
        # Get user info to check if it's a bot
        user_url = "https://slack.com/api/users.info"
        user_params = {"user": member_id}

        async with httpx.AsyncClient() as client:
            user_response = await client.get(user_url, headers=headers, params=user_params)
            user_data = user_response.json()

        if user_data.get("ok"):
            user = user_data.get("user", {})
            if not user.get("is_bot", False) and not user.get("deleted", False):
                real_members.append(member_id)

    return real_members


async def _send_to_channel(channel_name: str, message_text: str, bot_token: str) -> Dict[str, Any]:
    """
    Send a message to a Slack channel.

    Args:
        channel_name (str): Channel name or ID
        message_text (str): Message to send
        bot_token (str): Slack bot token

    Returns:
        dict: Result with status, mode, channel, channel_members, message, and timestamp

    Raises:
        Exception: If Slack API returns an error
    """
    url = "https://slack.com/api/chat.postMessage"

    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    payload = {
        "channel": channel_name,
        "text": message_text
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response_data = response.json()

    if not response_data.get("ok"):
        raise Exception(f"Slack API error: {response_data.get('error')}")

    # Get the channel ID from the response
    channel_id = response_data.get("channel")

    # Get all members in the channel
    channel_members = await _get_channel_members(channel_id, bot_token)

    print(f"Message sent to channel {channel_name}: {message_text}")
    print(f"Channel has {len(channel_members)} members (excluding bots)")

    return {
        "status": "sent",
        "mode": "channel",
        "channel": channel_name,
        "channel_id": channel_id,
        "channel_members": channel_members,
        "message": message_text,
        "timestamp": response_data.get("ts")
    }


async def _send_to_users(user_ids: List[str], message_text: str, bot_token: str) -> Dict[str, Any]:
    """
    Send direct messages to multiple Slack users.

    Opens a DM conversation with each user and sends them the message.

    Args:
        user_ids (List[str]): List of Slack user IDs
        message_text (str): Message to send
        bot_token (str): Slack bot token

    Returns:
        dict: Result with status, mode, users list, and message

    Note:
        This function attempts to send to all users even if some fail.
        Individual failures are captured in the users list results.
    """
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    user_results = []

    async with httpx.AsyncClient() as client:
        for user_id in user_ids:
            try:
                # Step 1: Open a DM conversation with the user
                open_url = "https://slack.com/api/conversations.open"
                open_payload = {
                    "users": user_id
                }

                open_response = await client.post(open_url, json=open_payload, headers=headers)
                open_data = open_response.json()

                if not open_data.get("ok"):
                    user_results.append({
                        "user_id": user_id,
                        "status": "failed",
                        "error": f"Failed to open DM: {open_data.get('error')}"
                    })
                    print(f"Failed to open DM with user {user_id}: {open_data.get('error')}")
                    continue

                # Get the DM channel ID
                dm_channel_id = open_data.get("channel", {}).get("id")

                # Step 2: Send the message to the DM channel
                send_url = "https://slack.com/api/chat.postMessage"
                send_payload = {
                    "channel": dm_channel_id,
                    "text": message_text
                }

                send_response = await client.post(send_url, json=send_payload, headers=headers)
                send_data = send_response.json()

                if not send_data.get("ok"):
                    user_results.append({
                        "user_id": user_id,
                        "status": "failed",
                        "error": f"Failed to send message: {send_data.get('error')}"
                    })
                    print(f"Failed to send message to user {user_id}: {send_data.get('error')}")
                    continue

                # Success
                user_results.append({
                    "user_id": user_id,
                    "status": "sent",
                    "channel_id": dm_channel_id,
                    "timestamp": send_data.get("ts")
                })
                print(f"Message sent to user {user_id}: {message_text}")

            except Exception as e:
                user_results.append({
                    "user_id": user_id,
                    "status": "failed",
                    "error": str(e)
                })
                print(f"Exception sending message to user {user_id}: {str(e)}")

    return {
        "status": "sent",
        "mode": "users",
        "users": user_results,
        "message": message_text
    }