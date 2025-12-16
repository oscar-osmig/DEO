"""
Template Orchestration Module

This module orchestrates the execution of workflow templates by coordinating
multiple blocks (trigger, message, await, response, condition) in a sequential manner.
Supports conditional branching through condition blocks using graph-based execution.
"""

from typing import Dict, Any, List, Optional
from .blocks import execute_trigger, execute_message, execute_response, execute_await, execute_scan, execute_condition


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
        "response": execute_response,
        "condition": execute_condition
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

        # Execution context for passing data between blocks (e.g., for condition blocks)
        self.context = {
            "last_response": "",      # Last response text from user (set after await)
            "last_user": "",          # User ID who last responded
            "response_count": 0,      # Number of responses received
            "responses": []           # All responses received
        }

        # Build graph structure from canvas_layout for branching support
        self._build_graph()

        # Validate template structure before execution
        self.validate_template()

    def _build_graph(self):
        """
        Build graph structure from canvas_layout connections.

        Creates:
        - node_to_block: Maps node IDs to their block index and config
        - connections_from: Maps (nodeId, side) to connected node
        """
        self.node_to_block = {}  # nodeId -> {index, type, config}
        self.connections_from = {}  # (fromNodeId, fromSide) -> toNodeId
        self.connections_to = {}  # toNodeId -> (fromNodeId, fromSide)

        canvas_layout = self.action_chain.get("canvas_layout", {})
        connections = canvas_layout.get("connections", [])
        nodes = canvas_layout.get("nodes", [])
        node_configs = canvas_layout.get("nodeConfigs", {})

        blocks_list = self.action_chain.get("blocks", [])

        # Map node IDs to their block data
        # Priority: 1) nodeConfigs from canvas_layout, 2) matching block from blocks list
        for i, node in enumerate(nodes):
            node_id = node.get("id")
            node_type = node.get("type")

            # First check if nodeConfigs has config for this node (most reliable)
            node_config_from_layout = node_configs.get(node_id, {})

            # Find matching block in blocks list as backup
            block_config = None
            block_index = None
            for j, block in enumerate(blocks_list):
                if isinstance(block, dict) and block.get("type") == node_type:
                    # Check if this block hasn't been assigned yet
                    if not any(self.node_to_block.get(nid, {}).get("index") == j for nid in self.node_to_block):
                        block_config = block.get("config", {})
                        block_index = j
                        break

            # Use nodeConfigs first (has file data), fall back to block config
            final_config = node_config_from_layout if node_config_from_layout else block_config

            self.node_to_block[node_id] = {
                "index": block_index,
                "type": node_type,
                "config": final_config or {}
            }

            # Debug: log what config was used
            config_source = "nodeConfigs" if node_config_from_layout else ("blocks" if block_config else "none")
            print(f"   Node {node_id} ({node_type}): config from {config_source}")

        # Build connection maps
        for conn in connections:
            from_node = conn.get("from", {}).get("nodeId")
            from_side = conn.get("from", {}).get("side")
            to_node = conn.get("to", {}).get("nodeId")

            if from_node and to_node:
                self.connections_from[(from_node, from_side)] = to_node
                self.connections_to[to_node] = (from_node, from_side)

        print(f"Graph built: {len(self.node_to_block)} nodes, {len(self.connections_from)} connections")

    def _get_next_node(self, current_node_id: str, output_side: str = "bottom") -> Optional[str]:
        """
        Get the next node ID connected to the given output side.

        Args:
            current_node_id: Current node's ID
            output_side: Output connector side (bottom, right, left)

        Returns:
            Next node ID or None if no connection
        """
        return self.connections_from.get((current_node_id, output_side))

    def _get_first_node_after_trigger(self) -> Optional[str]:
        """Get the first node connected to the trigger."""
        return self.connections_from.get(("trigger-node", "bottom"))

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

    async def execute(self, start_from_block: int = 0, start_from_node: str = None) -> List[Dict[str, Any]]:
        """
        Execute blocks using graph-based traversal with conditional branching support.

        Traverses the workflow graph following connections. After condition blocks,
        follows the path based on the evaluated output_side.

        Args:
            start_from_block (int): Index to start execution from (for resuming, legacy)
            start_from_node (str): Node ID to start from (for resuming with graph)

        Returns:
            List[Dict[str, Any]]: List of execution results

        Raises:
            ValueError: If required parameters are missing
            Exception: If any block execution fails
        """
        blocks_list = self.action_chain.get("blocks", [])
        results = []

        print(f"Starting orchestration with {len(blocks_list)} blocks")
        print(f"Format: {'NEW' if self.is_new_format else 'OLD'}")
        print(f"Graph mode: {len(self.node_to_block)} nodes mapped")

        # Determine if we should use graph-based execution
        use_graph = len(self.node_to_block) > 0 and len(self.connections_from) > 0

        if use_graph:
            # Graph-based execution for proper branching
            return await self._execute_graph(start_from_node, results)
        else:
            # Fall back to sequential execution (legacy)
            return await self._execute_sequential(start_from_block, results)

    async def _execute_graph(self, start_from_node: str = None, results: List = None) -> List[Dict[str, Any]]:
        """Execute using graph traversal with proper branching."""
        if results is None:
            results = []

        # Start from first node after trigger (or specified node)
        current_node_id = start_from_node or self._get_first_node_after_trigger()

        if not current_node_id:
            print("No nodes connected to trigger, nothing to execute")
            return results

        visited = set()
        blocks_list = self.action_chain.get("blocks", [])

        while current_node_id and current_node_id not in visited:
            visited.add(current_node_id)

            node_info = self.node_to_block.get(current_node_id, {})
            block_name = node_info.get("type")
            block_data = node_info.get("config", {})

            if not block_name:
                print(f"Unknown node {current_node_id}, skipping")
                current_node_id = self._get_next_node(current_node_id, "bottom")
                continue

            print(f"\nExecuting block: {block_name} (node {current_node_id})")
            print(f"   Block config keys: {list(block_data.keys()) if block_data else 'empty'}")
            if block_name == "message" and block_data:
                has_file = "file" in block_data and block_data["file"]
                print(f"   Has file attachment: {has_file}")
                if has_file:
                    print(f"   File: {block_data['file'].get('filename', 'unknown')}")

            # Execute block based on type
            result = await self._execute_block(block_name, block_data, current_node_id, blocks_list)

            if result is None:
                # Block returned None, meaning execution should stop (await/scan)
                return results

            # Store execution result
            results.append({
                "block": block_name,
                "node_id": current_node_id,
                "result": result
            })

            # Determine next node based on block type
            if block_name == "condition":
                # Use the output_side from condition result to branch
                output_side = result.get("output_side", "bottom")
                next_node = self._get_next_node(current_node_id, output_side)
                print(f"Condition branching: following '{output_side}' path -> {next_node}")
                current_node_id = next_node
            else:
                # Default: follow bottom connector
                current_node_id = self._get_next_node(current_node_id, "bottom")

        print("\nOrchestration completed successfully")
        return results

    async def _execute_block(self, block_name: str, block_data: Dict, node_id: str, blocks_list: List) -> Optional[Dict]:
        """Execute a single block and return result (or None to stop execution)."""
        executor = self.BLOCK_EXECUTORS.get(block_name)
        if not executor:
            print(f"No executor for block type: {block_name}")
            return {"error": f"Unknown block type: {block_name}"}

        if block_name == "trigger":
            return await executor(block_data)

        elif block_name == "message":
            if not self.bot_token:
                raise ValueError("Bot token required for message block")
            result = await executor(block_data, self.bot_token)
            # Track mode and channel info
            self.message_mode = result.get("mode")
            if self.message_mode == "channel":
                self.last_channel = result.get("channel_id")
                self.channel_members = result.get("channel_members", [])
                self.recipients = result.get("recipients")
            elif self.message_mode == "users":
                user_results = result.get("users", [])
                self.user_channels = [u.get("channel_id") for u in user_results if u.get("status") == "sent" and u.get("channel_id")]
                self.monitored_users = [u.get("user_id") for u in user_results if u.get("status") == "sent"]
                if self.user_channels:
                    self.last_channel = self.user_channels[0]
            return result

        elif block_name == "scan":
            if not self.bot_token:
                raise ValueError("Bot token required for scan block")
            # For scan, we need remaining blocks - but with graph execution we pass the whole action_chain
            result = await execute_scan(
                block_data, self.bot_token, self.template_id, self.workspace_id,
                blocks_list, self.action_chain
            )
            print(f"\nOrchestration paused - scanning for command in channel")
            return None  # Stop execution

        elif block_name == "await":
            if not self.bot_token:
                raise ValueError("Bot token required for await block")

            if self.message_mode == "channel":
                if not self.channel_members:
                    raise ValueError("Await block in channel mode requires channel_members")
                users_to_wait_for = self.recipients or self.channel_members
                result = await executor(
                    block_data, self.bot_token, [self.last_channel], users_to_wait_for,
                    self.template_id, self.workspace_id, blocks_list, self.action_chain,
                    mode="channel", channel_name=self.last_channel
                )
            else:
                if not self.user_channels:
                    raise ValueError("Await block requires a message block with users first")
                result = await executor(
                    block_data, self.bot_token, self.user_channels, self.monitored_users,
                    self.template_id, self.workspace_id, blocks_list, self.action_chain,
                    mode="users"
                )
            print(f"\nOrchestration paused - waiting for user response(s)")
            return None  # Stop execution

        elif block_name == "response":
            if not self.bot_token:
                raise ValueError("Bot token required for response block")
            if not self.last_channel:
                raise ValueError("Response block requires a message block first")

            response_message = block_data.get('message', '') if isinstance(block_data, dict) else block_data

            if self.message_mode == "users" and len(self.user_channels) > 1:
                response_results = []
                for channel_id in self.user_channels:
                    try:
                        single_result = await executor(response_message, self.bot_token, channel_id)
                        response_results.append({"channel": channel_id, "result": single_result})
                    except Exception as e:
                        response_results.append({"channel": channel_id, "error": str(e)})
                return {"status": "completed", "mode": "users", "responses": response_results}
            else:
                return await executor(response_message, self.bot_token, self.last_channel)

        elif block_name == "condition":
            result = await execute_condition(block_data, self.context)
            self.context["last_condition_result"] = result
            print(f"Condition evaluated: output_side={result.get('output_side')}")
            return result

        else:
            return await executor(block_data)

    async def _execute_sequential(self, start_from_block: int, results: List) -> List[Dict[str, Any]]:
        """Legacy sequential execution for templates without canvas_layout."""
        blocks_list = self.action_chain.get("blocks", [])

        if start_from_block > 0:
            print(f"Resuming from block index {start_from_block}")

        for i, block_entry in enumerate(blocks_list[start_from_block:], start=start_from_block):
            if self.is_new_format:
                block_name = block_entry.get('type')
                block_data = block_entry.get('config', {})
            else:
                block_name = block_entry
                block_data = self.action_chain.get(block_name)

            print(f"\nExecuting block: {block_name} (index {i})")

            result = await self._execute_block(block_name, block_data, f"index-{i}", blocks_list)

            if result is None:
                return results

            results.append({"block": block_name, "result": result})

        print("\nOrchestration completed successfully")
        return results