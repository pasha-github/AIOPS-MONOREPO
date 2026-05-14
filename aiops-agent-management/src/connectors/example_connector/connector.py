"""
JSONPlaceholder Connector v1.0.0
--------------------------
Sample connector using the JSONPlaceholder fake REST API.
https://jsonplaceholder.typicode.com
"""

from typing import Any

from base_connector import BaseConnector, connector_tool
from google.adk.tools.tool_context import ToolContext


class JSONPlaceholderConnector(BaseConnector):
    """
    Pre-built connector for the JSONPlaceholder API.

    Tools exposed:
        {prefix}get_post      — fetch a single post by ID
        {prefix}list_posts    — fetch all posts (optionally filter by user)
        {prefix}create_post   — create a new post
        {prefix}delete_post   — delete a post by ID

    Example:
        connector = JSONPlaceholderConnector()
        agent = LlmAgent(..., tools=[*connector.get_tools()])
    """

    BASE_URL = "https://jsonplaceholder.typicode.com"

    def __init__(
        self, API_KEY: str, API_URL: str = "https://jsonplaceholder.typicode.com"
    ):
        super().__init__()

    # ------------------------------------------------------------------ #
    #  Tools                                                               #
    # ------------------------------------------------------------------ #

    @connector_tool
    def get_post(self, post_id: int, tool_context: ToolContext) -> dict[str, Any]:
        """Fetches a single post by its ID.

        Args:
            post_id: The ID of the post to fetch.

        Returns:
            A dict containing the post's id, title, body, and userId.
        """
        response = self.call_api(url=f"{self.BASE_URL}/posts/{post_id}")

        if response.status_code != 200:
            return {"status": "error", "code": response.status_code}

        post = response.json()

        return {"status": "success", "post": post}

    @connector_tool
    def list_posts(self, user_id: str, tool_context: ToolContext) -> dict[str, Any]:
        """Fetches all posts, optionally filtered by a user ID.

        Args:
            user_id: If provided, only return posts by this user.

        Returns:
            A dict containing a list of posts and the total count.
        """
        params = {"userId": user_id} if user_id else None
        response = self.call_api(url=f"{self.BASE_URL}/posts", params=params)

        if response.status_code != 200:
            return {"status": "error", "code": response.status_code}

        posts = response.json()

        return {"status": "success", "posts": posts, "count": len(posts)}

    @connector_tool
    def create_post(
        self,
        title: str,
        body: str,
        user_id: str,
        tool_context: ToolContext,
    ) -> dict[str, Any]:
        """Creates a new post.

        Args:
            title:   The title of the post.
            body:    The body content of the post.
            user_id: The ID of the user creating the post.

        Returns:
            A dict containing the newly created post with its assigned ID.
        """
        response = self.call_api(
            url=f"{self.BASE_URL}/posts",
            method="POST",
            headers={"Content-type": "application/json"},
            data={"title": title, "body": body, "userId": user_id},
        )

        if response.status_code != 201:
            return {
                "status": "error",
                "code": response.status_code,
                "message": response.text,
            }

        created = response.json()

        return {"status": "success", "post": created}

    @connector_tool
    def delete_post(self, post_id: int, tool_context: ToolContext) -> dict[str, Any]:
        """Deletes a post by its ID.

        Args:
            post_id: The ID of the post to delete.

        Returns:
            A dict confirming deletion.
        """
        response = self.call_api(
            url=f"{self.BASE_URL}/posts/{post_id}",
            method="DELETE",
        )

        if response.status_code != 200:
            return {"status": "error", "code": response.status_code}

        return {"status": "success", "deleted_post_id": post_id}
