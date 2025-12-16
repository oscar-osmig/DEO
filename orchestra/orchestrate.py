"""
Template Orchestration Module

This module orchestrates the execution of workflow templates by coordinating
multiple blocks (trigger, message, await, response) in a sequential manner.
"""

from typing import Dict, Any, List
from .blocks import execute_trigger, execute_message, execute_response, execute_await, execute_scan


class TemplateOrchestrator:
    """
    Orchestrates the execution of template workflows.

    The orchestrator manages the sequential execution of blocks defined in a
    template's action chain. It validates the template structure, maintains
    execution context (like channel information), and coordinates block execution.

    Attributes:
        BLOCK_EXECUTORS (dict): Mapping of block names to their executor functions
        action_chain (dict): The template's action chain configuration
        bot_token (str): Slack bot token for API authentication
        template_id (str): ID of the template being executed
        workspace_id (str): ID of the workspace
        last_channel (str): Tracks the last channel used for message context
    """

    # Map block types to their execution functions
    BLOCK_EXECUTORS = {
        "trigger": execute_trigger,
        "message": execute_message,
        "scan": execute_scan,
        "await": execute_await,
        "response": execute_response
    }

    def __init__(self, action_chain: Dict[str, Any], bot_token: str = None, template_id: str = None, workspace_id: str = None):
        """
        Initialize the template orchestrator.

        Args:
            action_chain (Dict[str, Any]): Template action chain containing:
                - blocks: List of block names to execute in order
                - trigger: Trigger configuration
                - message: Message block configuration
                - await: Expected response text (optional)
                - response: Response block configuration
            bot_token (str, optional): Slack bot token for API calls
            template_id (str, optional): Template ID for tracking
            workspace_id (str, optional): Workspace ID for tracking

        Raises:
            ValueError: If template validation fails
        """
        self.action_chain = action_chain
        self.bot_token = bot_token
        self.template_id = template_id
        self.workspace_id = workspace_id
        self.last_channel = None  # Track the last channel used for response context
        self.message_mode = None  # Track whether last message was 'channel' or 'users'
        self.user_channels = []   # Store DM channel IDs for users mode
        self.monitored_users = []  # Store user IDs for await block
        self.recipients = None    # Store specific recipients for await block (channel mode)
        self.channel_members = [] # Store all channel members

        # Validate template structure before execution
        self.validate_template()

    def validate_template(self):
        """
        Validate that the template is properly structured.

        Supports two formats:
        NEW FORMAT: blocks as list of {type, config} objects
        OLD FORMAT: blocks as list of strings with separate config fields

        Raises:
            ValueError: If any validation check fails with descriptive error
        """
        blocks_list = self.action_chain.get("blocks", [])

        # Check if blocks list exists and is not empty
        if not blocks_list:
            raise ValueError("Template error: 'blocks' list is empty or missing")

        # Detect format: new format has dicts with 'type' key
        self.is_new_format = isinstance(blocks_list[0], dict) and 'type' in blocks_list[0]

        if self.is_new_format:
            # NEW FORMAT: Validate each block has valid type
            for block in blocks_list:
                block_type = block.get('type')
                if block_type not in self.BLOCK_EXECUTORS:
                    raise ValueError(
                        f"Template error: Block type '{block_type}' is not supported"
                    )
        else:
            # OLD FORMAT: Validate each block in the execution list
            for block_name in blocks_list:
                # Check if block definition exists in action_chain
                if block_name not in self.action_chain:
                    raise ValueError(
                        f"Template not created correctly: Block '{block_name}' "
                        f"is listed but not present in the payload"
                    )

                # Check if block type is supported
                if block_name not in self.BLOCK_EXECUTORS:
                    raise ValueError(
                        f"Template error: Block '{block_name}' is not a supported block type"
                    )

    async def execute(self, start_from_block: int = 0) -> List[Dict[str, Any]]:
        """
        Execute all blocks in the template sequentially.

        Supports two formats:
        NEW FORMAT: blocks as list of {type, config} objects with inline configs
        OLD FORMAT: blocks as list of strings with separate config fields

        Args:
            start_from_block (int): Index to start execution from (for resuming)

        Returns:
            List[Dict[str, Any]]: List of execution results

        Raises:
            ValueError: If required parameters are missing
            Exception: If any block execution fails
        """
        blocks_list = self.action_chain.get("blocks", [])
        results = []

        print(f"Starting orchestration with blocks: {blocks_list}")
        print(f"Format: {'NEW' if self.is_new_format else 'OLD'}")
        if start_from_block > 0:
            print(f"Resuming from block index {start_from_block}")

        # Execute each block in sequence, starting from the specified index
        for i, block_entry in enumerate(blocks_list[start_from_block:], start=start_from_block):
            # Handle both formats
            if self.is_new_format:
                block_name = block_entry.get('type')
                block_data = block_entry.get('config', {})
            else:
                block_name = block_entry
                block_data = self.action_chain.get(block_name)

            print(f"\nExecuting block: {block_name} (index {i})")

            executor = self.BLOCK_EXECUTORS[block_name]

            # Execute based on block type with appropriate parameters
            if block_name == "trigger":
                # Trigger block doesn't need bot_token
                result = await executor(block_data)

            elif block_name == "message":
                # Message block requires bot_token
                if not self.bot_token:
                    raise ValueError("Bot token required for message block")
                result = await executor(block_data, self.bot_token)
                # Track the mode and channel info for response/await blocks
                self.message_mode = result.get("mode")
                if self.message_mode == "channel":
                    self.last_channel = result.get("channel_id")  # Store channel ID
                    self.channel_members = result.get("channel_members", [])  # Store all members
                    # Use recipients if specified, otherwise fall back to all channel members
                    self.recipients = result.get("recipients")  # May be None
                    if self.recipients:
                        print(f"Using specific recipients for await: {len(self.recipients)} user(s)")
                    else:
                        print(f"No specific recipients - will use all {len(self.channel_members)} channel members for await")
                elif self.message_mode == "users":
                    # Extract DM channel IDs from user results
                    user_results = result.get("users", [])
                    self.user_channels = [
                        user.get("channel_id")
                        for user in user_results
                        if user.get("status") == "sent" and user.get("channel_id")
                    ]
                    # Store user IDs for await block
                    self.monitored_users = [
                        user.get("user_id")
                        for user in user_results
                        if user.get("status") == "sent"
                    ]
                    # Use the first successful DM channel for single response
                    if self.user_channels:
                        self.last_channel = self.user_channels[0]

            elif block_name == "scan":
                # Scan block requires bot_token
                if not self.bot_token:
                    raise ValueError("Bot token required for scan block")
                # Calculate remaining blocks to execute after scan completes
                remaining_blocks = blocks_list[i + 1:]
                result = await execute_scan(
                    block_data,
                    self.bot_token,
                    self.template_id,
                    self.workspace_id,
                    remaining_blocks,
                    self.action_chain
                )

                # Scan block pauses execution - return here
                results.append({
                    "block": block_name,
                    "result": result
                })
                print(f"\nOrchestration paused - scanning for command in channel")
                return results

            elif block_name == "await":
                # Await block requires bot_token
                if not self.bot_token:
                    raise ValueError("Bot token required for await block")
                # Calculate remaining blocks to execute after await completes
                remaining_blocks = blocks_list[i + 1:]
                # Determine mode and who to wait for
                if self.message_mode == "channel":
                    # Channel mode: wait for specific recipients if provided, otherwise all members
                    if not hasattr(self, 'channel_members') or not self.channel_members:
                        raise ValueError("Await block in channel mode requires channel_members from message block")

                    # Use recipients if specified, otherwise use all channel members
                    users_to_wait_for = getattr(self, 'recipients', None) or self.channel_members
                    print(f"Await will wait for {len(users_to_wait_for)} user(s) to respond")

                    result = await executor(
                        block_data,
                        self.bot_token,
                        [self.last_channel],  # Single channel ID
                        users_to_wait_for,  # Specific recipients OR all channel members
                        self.template_id,
                        self.workspace_id,
                        remaining_blocks,
                        self.action_chain,
                        mode="channel",
                        channel_name=self.last_channel
                    )
                else:
                    # Users mode: wait for first user to respond
                    if not self.user_channels:
                        raise ValueError("Await block requires a message block with users to be executed first")
                    result = await executor(
                        block_data,
                        self.bot_token,
                        self.user_channels,
                        self.monitored_users,
                        self.template_id,
                        self.workspace_id,
                        remaining_blocks,
                        self.action_chain,
                        mode="users"
                    )

                # Await block pauses execution - return here
                results.append({
                    "block": block_name,
                    "result": result
                })
                print(f"\nOrchestration paused - waiting for user response(s)")
                return results

            elif block_name == "response":
                # Response block requires bot_token and channel from previous message
                if not self.bot_token:
                    raise ValueError("Bot token required for response block")
                if not self.last_channel:
                    raise ValueError("Response block requires a message block to be executed first")

                # For new format, extract message from config
                if self.is_new_format:
                    response_message = block_data.get('message', '')
                else:
                    response_message = block_data

                # If message was sent to multiple users, send response to each
                if self.message_mode == "users" and len(self.user_channels) > 1:
                    # Send response to all user DM channels
                    response_results = []
                    for channel_id in self.user_channels:
                        try:
                            single_result = await executor(response_message, self.bot_token, channel_id)
                            response_results.append({
                                "channel": channel_id,
                                "result": single_result
                            })
                        except Exception as e:
                            response_results.append({
                                "channel": channel_id,
                                "error": str(e)
                            })
                    result = {
                        "status": "completed",
                        "mode": "users",
                        "responses": response_results
                    }
                else:
                    # Single channel response (either channel mode or single user)
                    result = await executor(response_message, self.bot_token, self.last_channel)

            else:
                # Generic execution for any other block types
                result = await executor(block_data)

            # Store execution result
            results.append({
                "block": block_name,
                "result": result
            })

        print("\nOrchestration completed successfully")
        return results