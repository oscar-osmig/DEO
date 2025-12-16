"""
API Endpoints Module

This module provides REST API endpoints for Slack bot operations including
sending messages, retrieving channels and users, and handling Slack Events API callbacks.
"""

from fastapi import APIRouter, Request, HTTPException
import httpx
from .models import SendMessageRequest, GetChannelsRequest, GetUsersRequest
from database import get_collection
from datetime import datetime

router = APIRouter()
import logging

logger = logging.getLogger(__name__)

@router.get("/")
async def root():
    """
    Root endpoint for health check.

    Returns:
        dict: Simple status message indicating the bot is running

    Example:
        GET /
        Response: {"message": "Slack Bot is running"}
    """
    return {"message": "Slack Bot is running"}


@router.post("/send-message")
async def send_message(request: SendMessageRequest):
    """
    Send a message to a Slack channel using the Slack API.

    This endpoint accepts a Slack bot token, channel ID, and message text,
    then posts the message to the specified channel using Slack's chat.postMessage API.

    Args:
        request (SendMessageRequest): Request body containing:
            - token (str): Slack bot token (xoxb-...)
            - channel (str): Slack channel ID (C1234567890)
            - message (str): Message text to send

    Returns:
        dict: Response containing:
            - success (bool): Whether the message was sent successfully
            - channel (str): Channel ID where message was sent
            - timestamp (str): Slack timestamp of the message
            - message (str): The message that was sent

    Raises:
        HTTPException: 400 error if Slack API returns an error

    Example:
        POST /send-message
        Body: {
            "token": "xoxb-1234567890-...",
            "channel": "C1234567890",
            "message": "Hello World"
        }
    """
    url = "https://api.slack.com/api/chat.postMessage"

    # Set up authorization headers
    headers = {
        "Authorization": f"Bearer {request.token}",
        "Content-Type": "application/json"
    }

    # Prepare message payload
    payload = {
        "channel": request.channel,
        "text": request.message
    }

    # Send message to Slack API using async httpx
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, headers=headers)
        response_data = response.json()

    # Check if Slack API returned an error
    if not response_data.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=f"Slack API error: {response_data.get('error', 'Unknown error')}"
        )

    return {
        "success": True,
        "channel": request.channel,
        "timestamp": response_data.get("ts"),
        "message": request.message
    }


@router.post("/get-channels")
async def get_channels(request: GetChannelsRequest):
    """
    Retrieve all available channels from a Slack workspace.

    This endpoint uses the Slack API's conversations.list method to fetch
    all public and private channels that the bot has access to. It returns
    a simplified list containing channel IDs and names.

    Args:
        request (GetChannelsRequest): Request body containing:
            - token (str): Slack bot token for authentication

    Returns:
        dict: Response containing:
            - success (bool): Whether the request was successful
            - channels (list): List of channel objects
            - count (int): Total number of channels returned

    Raises:
        HTTPException: 400 error if Slack API returns an error
    """
    url = "https://slack.com/api/conversations.list"

    headers = {
        "Authorization": f"Bearer {request.token}",
        "Content-Type": "application/json"
    }

    params = {
        "types": "public_channel,private_channel",
        "exclude_archived": False,
        "limit": 1000
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers, params=params)
        response_data = response.json()

    if not response_data.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=f"Slack API error: {response_data.get('error', 'Unknown error')}"
        )

    channels = response_data.get("channels", [])

    formatted_channels = [
        {
            "id": channel.get("id"),
            "name": channel.get("name"),
            "is_private": channel.get("is_private", False),
            "is_archived": channel.get("is_archived", False)
        }
        for channel in channels
    ]

    return {
        "success": True,
        "channels": formatted_channels,
        "count": len(formatted_channels)
    }


@router.post("/get-users")
async def get_users(request: GetUsersRequest):
    """
    Retrieve all users from a Slack workspace.

    This endpoint uses the Slack API's users.list method to fetch
    all users in the workspace, including both active and deactivated users.

    Args:
        request (GetUsersRequest): Request body containing:
            - token (str): Slack bot token for authentication

    Returns:
        dict: Response containing:
            - success (bool): Whether the request was successful
            - users (list): List of user objects
            - count (int): Total number of users returned

    Raises:
        HTTPException: 400 error if Slack API returns an error
    """
    url = "https://slack.com/api/users.list"

    headers = {
        "Authorization": f"Bearer {request.token}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        response_data = response.json()

    if not response_data.get("ok"):
        raise HTTPException(
            status_code=400,
            detail=f"Slack API error: {response_data.get('error', 'Unknown error')}"
        )

    members = response_data.get("members", [])

    formatted_users = [
        {
            "id": user.get("id"),
            "name": user.get("name"),
            "real_name": user.get("real_name"),
            "email": user.get("profile", {}).get("email"),
            "is_bot": user.get("is_bot", False),
            "is_admin": user.get("is_admin", False),
            "is_owner": user.get("is_owner", False),
            "is_deleted": user.get("deleted", False),
            "profile_image": user.get("profile", {}).get("image_72")
        }
        for user in members
    ]

    return {
        "success": True,
        "users": formatted_users,
        "count": len(formatted_users)
    }


@router.post("/slack/events")
async def slack_events(request: Request):
    """Handle Slack Events API requests."""
    body = await request.json()

    print(f"\n{'=' * 50}")
    print(f"SLACK EVENT RECEIVED AT: {datetime.utcnow().isoformat()}")
    print(f"Event type: {body.get('type')}")
    print(f"Full body: {body}")
    print(f"{'=' * 50}\n")

    # Handle URL verification challenge from Slack
    if body.get("type") == "url_verification":
        print("✅ URL verification challenge received")
        return {"challenge": body.get("challenge")}

    # Handle event callbacks
    if body.get("type") == "event_callback":
        event = body.get("event", {})
        event_type = event.get("type")

        print(f"📨 Event callback received")
        print(f"Event type: {event_type}")
        print(f"Event data: {event}")

        # Check if this is a message event
        if event_type == "message":
            # Check for bot_id
            if event.get("bot_id"):
                print("⚠️ Skipping bot message")
                return {"status": "ok"}

            # Check for subtype (like message_changed, message_deleted)
            if event.get("subtype"):
                print(f"⚠️ Skipping message with subtype: {event.get('subtype')}")
                return {"status": "ok"}

            user_id = event.get("user")
            channel_id = event.get("channel")
            message_text = event.get("text", "")

            print(f"👤 User: {user_id}")
            print(f"📍 Channel: {channel_id}")
            print(f"💬 Message: {message_text}")

            # Check for pending await executions
            print(f"🔍 Checking for pending awaits...")
            await check_and_resume_awaits(user_id, channel_id, message_text)

        return {"status": "ok"}

    return {"status": "ok"}


async def check_and_resume_awaits(user_id: str, channel_id: str, message_text: str):
    """Check if user message matches pending awaits and resume if conditions met."""
    from orchestra.blocks.await_block import check_response_match
    from orchestra.orchestrate import TemplateOrchestrator

    pending_executions = get_collection("pending_executions")
    completed_executions = get_collection("completed_executions")

    print(f"\n🔍 Checking for pending awaits...")
    print(f"   Channel: {channel_id}")
    print(f"   User: {user_id}")
    print(f"   Message: '{message_text}'")

    # Find pending executions monitoring this channel/user
    pending = await pending_executions.find({
        "status": "awaiting_response",
        "monitored_channels": channel_id,
        "monitored_users": user_id
    }).to_list(length=100)

    print(f"   Found {len(pending)} pending execution(s)")

    if len(pending) == 0:
        print(f"   No pending executions found for this channel/user")
        return

    for execution in pending:
        print(f"\n📋 Processing execution: {execution.get('_id')}")
        print(f"   Mode: {execution.get('mode')}")
        # Show expected responses (new format) or single expected response (legacy)
        expected_responses = execution.get("expected_responses", [])
        expected_response = execution.get("expected_response", "")
        if expected_responses:
            print(f"   Expected (any of): {expected_responses}")
        else:
            print(f"   Expected: '{expected_response}'")
        print(f"   Monitored users: {execution.get('monitored_users')}")
        print(f"   Users responded so far: {execution.get('users_responded', [])}")

        match_type = execution.get("match_type", "contains")
        case_sensitive = execution.get("case_sensitive", False)
        mode = execution.get("mode", "users")

        # Check if message matches - use expected_responses list if available (OR logic)
        is_match = await check_response_match(
            message_text,
            expected_response,
            match_type,
            case_sensitive,
            expected_responses=expected_responses if expected_responses else None
        )

        print(f"   Message match: {is_match}")

        if is_match:
            # Add user to responded list
            users_responded = execution.get("users_responded", [])

            if user_id not in users_responded:
                users_responded.append(user_id)

                # Update the document with new user response
                update_result = await pending_executions.update_one(
                    {"_id": execution["_id"]},
                    {
                        "$set": {"users_responded": users_responded},
                        "$push": {
                            "responses_received": {
                                "user_id": user_id,
                                "channel_id": channel_id,
                                "message": message_text,
                                "timestamp": datetime.utcnow()
                            }
                        }
                    }
                )

                print(f"✅ User {user_id} responded: '{message_text}'")
                print(f"   Update result: modified {update_result.modified_count} document(s)")
            else:
                print(f"⚠️ User {user_id} already responded")

            # Check if we should resume execution
            should_resume = False

            if mode == "users":
                # Users mode: ALL users must respond
                monitored_users = execution.get("monitored_users", [])
                print(f"   Monitored users: {monitored_users}")
                print(f"   Users responded: {users_responded}")

                all_responded = set(users_responded) >= set(monitored_users)

                if all_responded:
                    should_resume = True
                    print(f"👤 Users mode: All {len(monitored_users)} user(s) responded, resuming...")
                else:
                    remaining_users = set(monitored_users) - set(users_responded)
                    print(f"⏳ Users mode: Waiting for {len(remaining_users)} more user(s)")
                    print(f"   Still waiting for: {remaining_users}")

            elif mode == "channel":
                # Channel mode: all users must respond
                monitored_users = execution.get("monitored_users", [])
                print(f"   Monitored users: {monitored_users}")
                print(f"   Users responded: {users_responded}")

                all_responded = set(users_responded) >= set(monitored_users)

                if all_responded:
                    should_resume = True
                    print(f"📢 Channel mode: All {len(monitored_users)} user(s) responded, resuming...")
                else:
                    remaining_users = set(monitored_users) - set(users_responded)
                    print(f"⏳ Channel mode: Waiting for {len(remaining_users)} more user(s)")
                    print(f"   Still waiting for: {remaining_users}")

            if should_resume:
                print(f"\n🚀 Resuming execution...")

                # Fetch the latest execution state
                latest_execution = await pending_executions.find_one({"_id": execution["_id"]})

                # Update status
                latest_execution["status"] = "completed"
                latest_execution["completed_at"] = datetime.utcnow()

                # Resume execution
                try:
                    remaining_blocks = latest_execution.get("remaining_blocks", [])
                    action_chain = latest_execution.get("action_chain")
                    bot_token = latest_execution.get("bot_token")
                    template_id = latest_execution.get("template_id")
                    workspace_id = latest_execution.get("workspace_id")

                    print(f"   Remaining blocks: {remaining_blocks}")

                    if action_chain:
                        orchestrator = TemplateOrchestrator(
                            action_chain,
                            bot_token,
                            template_id=template_id,
                            workspace_id=workspace_id
                        )

                        # Set response destination based on mode
                        if mode == "channel":
                            orchestrator.last_channel = latest_execution.get("monitored_channels", [])[0]
                            orchestrator.message_mode = "channel"
                            print(f"   Set orchestrator to channel mode, channel: {orchestrator.last_channel}")
                        else:
                            orchestrator.last_channel = latest_execution.get("monitored_channels", [])[0]
                            orchestrator.message_mode = "users"
                            orchestrator.user_channels = latest_execution.get("monitored_channels", [])
                            print(f"   Set orchestrator to users mode, channels: {orchestrator.user_channels}")

                        # Set execution context with response data for condition blocks
                        responses_received = latest_execution.get("responses_received", [])
                        orchestrator.context = {
                            "last_response": message_text,  # The message that triggered resume
                            "last_user": user_id,           # User who sent the final response
                            "response_count": len(responses_received),
                            "responses": responses_received
                        }
                        print(f"   Set context: last_response='{message_text}', last_user={user_id}")

                        # Find the await node in the graph and get the next node after it
                        start_node = None
                        if orchestrator.node_to_block:
                            # Find await node
                            await_node_id = None
                            for node_id, node_info in orchestrator.node_to_block.items():
                                if node_info.get("type") == "await":
                                    await_node_id = node_id
                                    break

                            if await_node_id:
                                # Get the next node connected to await's bottom output
                                start_node = orchestrator._get_next_node(await_node_id, "bottom")
                                print(f"   Graph mode: Found await node {await_node_id}, resuming from {start_node}")

                        if start_node:
                            # Use graph-based execution starting from the node after await
                            results = await orchestrator._execute_graph(start_from_node=start_node)
                        else:
                            # Fall back to sequential execution
                            all_blocks = action_chain.get("blocks", [])
                            await_index = None
                            for i, block in enumerate(all_blocks):
                                if isinstance(block, dict):
                                    if block.get("type") == "await":
                                        await_index = i
                                        break
                                elif block == "await":
                                    await_index = i
                                    break

                            resume_index = (await_index + 1) if await_index is not None else 0
                            print(f"   Sequential mode: resuming from block {resume_index}")
                            results = await orchestrator._execute_sequential(start_from_block=resume_index, results=[])

                        print(f"✅ Execution resumed and completed successfully")
                        latest_execution["execution_results"] = results

                except Exception as e:
                    print(f"❌ Error resuming execution: {str(e)}")
                    import traceback
                    traceback.print_exc()
                    latest_execution["status"] = "failed"
                    latest_execution["error"] = str(e)

                # Move to completed_executions
                await completed_executions.insert_one(latest_execution)
                await pending_executions.delete_one({"_id": latest_execution["_id"]})
                print(f"📦 Moved execution to completed_executions collection")

                break  # Only process first matching execution
        else:
            print(f"   ❌ Message doesn't match expected response")