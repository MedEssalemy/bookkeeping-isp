"""
Serves the built Vue app from the same process as the API (production image).
Locally STATIC_DIR is unset and Vite serves the UI instead.
"""
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


class _HashedAssets(StaticFiles):
    """Vite's /assets files carry a content hash in their name: cache them for good."""

    async def get_response(self, path, scope):
        response = await super().get_response(path, scope)
        if response.status_code == 200:
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


def mount_spa(app: FastAPI, static_dir: str, api_prefix: str) -> None:
    """Register last: the catch-all must not shadow API routes."""
    root = Path(static_dir).resolve()
    index = root / "index.html"
    api_root = api_prefix.strip("/")

    # A missing asset (stale chunk name after a deploy) is a 404, never index.html.
    app.mount("/assets", _HashedAssets(directory=root / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == api_root or path.startswith(api_root + "/"):
            raise HTTPException(status_code=404, detail="Not Found")
        file = (root / path).resolve()
        if path and file.is_file() and file.is_relative_to(root):
            return FileResponse(file)
        # SPA history-mode routing; index.html must always be revalidated.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
