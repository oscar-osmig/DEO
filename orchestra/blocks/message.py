"""
Message Block Executor

This module handles the execution of message blocks in the orchestration system.
It sends messages to Slack channels or direct messages to users using the Slack API.
Supports sending text messages, file attachments, or both.
"""

import httpx
import base64
from typing import Dict, Any, List, Optional


async def _resolve_channel_id(channel_name: str, bot_token: str) -> str:
    """
    Resolve a channel name to its channel ID.

    If the input is already a channel ID (starts with C, G, D, or Z), returns it as-is.
    Otherwise, looks up the channel by name and returns its ID.

    Args:
        channel_name (str): Channel name (without #) or channel ID
        bot_token (str): Slack bot token

    Returns:
        str: The channel ID

    Raises:
        ValueError: If channel is not found
    """
    # If already a channel ID (starts with C, G, D, or Z), return as-is
    if channel_name and channel_name[0] in ('C', 'G', 'D', 'Z') and len(channel_name) >= 9:
        return channel_name

    # Look up channel by name
    url = "https://slack.com/api/conversations.list"
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }
    params = {
        "types": "public_channel,private_channel",
        "exclude_archived": "true",
        "limit": 200
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        data = response.json()

    if not data.get("ok"):
        raise Exception(f"Failed to list channels: {data.get('error')}")

    for channel in data.get("channels", []):
        if channel.get("name") == channel_name:
            return channel.get("id")

    raise ValueError(f"Channel '{channel_name}' not found")


async def execute_message(message_data: Dict[str, Any], bot_token: str):
    """
    Execute a message action by sending a message to a Slack channel or users.

    This function is called by the orchestrator to send messages to Slack
    channels or direct messages to users as part of a template execution workflow.

    Supports two modes:
    1. Channel mode: Send message to a specific channel
    2. Users mode: Send direct messages to multiple users

    Also supports file attachments - can send message only, file only, or both.

    Args:
        message_data (Dict[str, Any]): Dictionary containing message configuration:
            Mode 1 (Channel):
                - channel_name (str): Name or ID of the Slack channel
                - recipients (List[str]): Optional - specific user IDs to wait for in await block
                - message (str): The message text to send (optional if file provided)
                - file (dict): Optional file attachment with filename, content_type, data (base64)
            Mode 2 (Users):
                - users (List[str]): List of user IDs to send DMs to
                - message (str): The message text to send (optional if file provided)
                - file (dict): Optional file attachment with filename, content_type, data (base64)
        bot_token (str): Slack bot token for authentication

    Returns:
        dict: Execution result containing:
            - status (str): "sent" if successful
            - mode (str): "channel" or "users"
            - channel (str): Channel name (if mode is "channel")
            - channel_members (list): List of user IDs in the channel (if mode is "channel")
            - recipients (list): Specific users to wait for (if mode is "channel" and recipients specified)
            - users (list): List of user results (if mode is "users")
            - message (str): The message that was sent
            - timestamp (str): Slack message timestamp
            - file_id (str): Slack file ID if file was uploaded

    Raises:
        ValueError: If neither channel_name nor users is provided, or if neither message nor file is provided
        Exception: If Slack API returns an error
    """
    # Extract message parameters
    channel_name = message_data.get("channel_name")
    users = message_data.get("users")
    recipients = message_data.get("recipients")  # Specific users to wait for in channel mode
    message_text = message_data.get("message")
    file_data = message_data.get("file")

    # Validate that we have either channel_name or users
    if not channel_name and not users:
        raise ValueError("Message block requires either 'channel_name' or 'users'")

    # Validate that we don't have both
    if channel_name and users:
        raise ValueError("Message block cannot have both 'channel_name' and 'users'. Choose one mode.")

    # Validate that we have at least message or file
    if not message_text and not file_data:
        raise ValueError("Message block requires either 'message' or 'file' (or both)")

    # MODE 1: Send to a channel
    if channel_name:
        return await _send_to_channel(channel_name, message_text, file_data, bot_token, recipients)

    # MODE 2: Send DMs to users
    else:
        return await _send_to_users(users, message_text, file_data, bot_token)


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


async def _upload_file(channel_id: str, file_data: Dict[str, Any], message_text: Optional[str], bot_token: str) -> Dict[str, Any]:
    """
    Upload a file to a Slack channel using the new files.getUploadURLExternal API.

    This uses Slack's new two-step upload process:
    1. Get an upload URL using files.getUploadURLExternal
    2. Upload the file to that URL
    3. Complete the upload using files.completeUploadExternal

    Args:
        channel_id (str): Channel ID to upload to
        file_data (dict): File data with filename, content_type, data (base64)
        message_text (str): Optional initial comment/message
        bot_token (str): Slack bot token

    Returns:
        dict: Slack API response with file info
    """
    auth_header = {"Authorization": f"Bearer {bot_token}"}

    # Decode base64 file data
    file_content = base64.b64decode(file_data["data"])
    filename = file_data["filename"]
    file_length = len(file_content)

    async with httpx.AsyncClient() as client:
        # Step 1: Get upload URL (uses form data, not JSON)
        get_url_response = await client.post(
            "https://slack.com/api/files.getUploadURLExternal",
            headers=auth_header,
            data={
                "filename": filename,
                "length": file_length
            }
        )
        get_url_data = get_url_response.json()

        if not get_url_data.get("ok"):
            raise Exception(f"Slack file upload error (getUploadURL): {get_url_data.get('error')}")

        upload_url = get_url_data.get("upload_url")
        file_id = get_url_data.get("file_id")

        # Step 2: Upload file to the provided URL
        upload_response = await client.post(
            upload_url,
            content=file_content,
            headers={"Content-Type": file_data.get("content_type", "application/octet-stream")}
        )

        if upload_response.status_code != 200:
            raise Exception(f"Slack file upload error (upload): HTTP {upload_response.status_code}")

        # Step 3: Complete the upload (uses JSON)
        complete_payload = {
            "files": [{"id": file_id, "title": filename}],
            "channel_id": channel_id
        }

        if message_text:
            complete_payload["initial_comment"] = message_text

        complete_response = await client.post(
            "https://slack.com/api/files.completeUploadExternal",
            headers={**auth_header, "Content-Type": "application/json"},
            json=complete_payload
        )
        complete_data = complete_response.json()

        if not complete_data.get("ok"):
            raise Exception(f"Slack file upload error (complete): {complete_data.get('error')}")

    # Return in a format compatible with the old API response
    files_list = complete_data.get("files", [])
    file_info = files_list[0] if files_list else {"id": file_id}

    return {"ok": True, "file": file_info}


async def _send_to_channel(channel_name: str, message_text: Optional[str], file_data: Optional[Dict[str, Any]], bot_token: str, recipients: Optional[List[str]] = None) -> Dict[str, Any]:
    """
    Send a message and/or file to a Slack channel.

    Args:
        channel_name (str): Channel name or ID
        message_text (str): Message to send (optional if file provided)
        file_data (dict): Optional file data with filename, content_type, data (base64)
        bot_token (str): Slack bot token
        recipients (List[str]): Optional - specific user IDs to wait for in await block

    Returns:
        dict: Result with status, mode, channel, channel_members, recipients, message, timestamp, and file_id

    Raises:
        Exception: If Slack API returns an error
    """
    headers = {
        "Authorization": f"Bearer {bot_token}",
        "Content-Type": "application/json"
    }

    # Resolve channel name to channel ID (required for file uploads)
    channel_id = await _resolve_channel_id(channel_name, bot_token)

    result = {
        "status": "sent",
        "mode": "channel",
        "channel": channel_name,
        "channel_id": channel_id,
        "message": message_text
    }

    # If we have a file, upload it (with optional message as initial_comment)
    if file_data:
        file_response = await _upload_file(channel_id, file_data, message_text, bot_token)
        file_info = file_response.get("file", {})

        result["file_id"] = file_info.get("id")
        result["file_name"] = file_data["filename"]
        result["timestamp"] = file_info.get("timestamp")

        print(f"File '{file_data['filename']}' uploaded to channel {channel_name}")
        if message_text:
            print(f"With message: {message_text}")

    # If no file, just send a regular message
    else:
        url = "https://slack.com/api/chat.postMessage"
        payload = {
            "channel": channel_id,
            "text": message_text
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, headers=headers)
            response_data = response.json()

        if not response_data.get("ok"):
            raise Exception(f"Slack API error: {response_data.get('error')}")

        result["timestamp"] = response_data.get("ts")

        print(f"Message sent to channel {channel_name}: {message_text}")

    # Get all members in the channel
    channel_members = await _get_channel_members(channel_id, bot_token)
    result["channel_members"] = channel_members

    # If specific recipients were provided, include them in the result
    # The await block will use recipients (if provided) instead of all channel_members
    if recipients:
        result["recipients"] = recipients
        print(f"Specific recipients for await: {len(recipients)} user(s)")

    print(f"Channel has {len(channel_members)} members (excluding bots)")

    return result


async def _send_to_users(user_ids: List[str], message_text: Optional[str], file_data: Optional[Dict[str, Any]], bot_token: str) -> Dict[str, Any]:
    """
    Send direct messages and/or files to multiple Slack users.

    Opens a DM conversation with each user and sends them the message/file.

    Args:
        user_ids (List[str]): List of Slack user IDs
        message_text (str): Message to send (optional if file provided)
        file_data (dict): Optional file data with filename, content_type, data (base64)
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

                # Step 2: Send file or message to the DM channel
                if file_data:
                    # Upload file with optional message
                    file_response = await _upload_file(dm_channel_id, file_data, message_text, bot_token)
                    file_info = file_response.get("file", {})

                    user_results.append({
                        "user_id": user_id,
                        "status": "sent",
                        "channel_id": dm_channel_id,
                        "file_id": file_info.get("id"),
                        "file_name": file_data["filename"],
                        "timestamp": file_info.get("timestamp")
                    })
                    print(f"File '{file_data['filename']}' sent to user {user_id}")
                    if message_text:
                        print(f"With message: {message_text}")
                else:
                    # Send regular message
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

    result = {
        "status": "sent",
        "mode": "users",
        "users": user_results,
        "message": message_text
    }

    if file_data:
        result["file_name"] = file_data["filename"]

    return result