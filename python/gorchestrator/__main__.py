"""Launcher entry point for the pip-installed ``gorchestrator`` command.

Locates a Node.js runtime (>= 18), then executes the bundled CLI JavaScript
(``_bundle/gorchestrator.cli.js``) forwarding all arguments, stdio, and the
child process exit code. The bundle is shipped as package data inside the
wheel, so it is resolved relative to this file.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys

MIN_NODE_MAJOR = 18

_BUNDLE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bundle", "gorchestrator.cli.js")


def _fail(message: str) -> "int":
    sys.stderr.write("gorchestrator: " + message + "\n")
    return 1


def _node_major(node: str) -> "int | None":
    """Return the major version of the given node executable, or None on failure."""
    try:
        out = subprocess.run(
            [node, "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError:
        return None
    raw = (out.stdout or out.stderr or "").strip()
    # Expected form: "v20.17.0"
    raw = raw.lstrip("vV")
    if not raw:
        return None
    try:
        return int(raw.split(".", 1)[0])
    except ValueError:
        return None


def main() -> "int":
    node = shutil.which("node")
    if not node:
        return _fail(
            "Node.js was not found on your PATH. gorchestrator runs on Node.js "
            "(>= {0}). Install it from https://nodejs.org/ and try again.".format(MIN_NODE_MAJOR)
        )

    major = _node_major(node)
    if major is None:
        return _fail(
            "Unable to determine the Node.js version from '{0}'. "
            "Node.js >= {1} is required.".format(node, MIN_NODE_MAJOR)
        )
    if major < MIN_NODE_MAJOR:
        return _fail(
            "Node.js >= {0} is required, but '{1}' reports major version {2}. "
            "Please upgrade Node.js.".format(MIN_NODE_MAJOR, node, major)
        )

    if not os.path.isfile(_BUNDLE):
        return _fail(
            "Bundled CLI not found at '{0}'. The package may be corrupted; "
            "try reinstalling with 'pip install --force-reinstall gorchestrator'.".format(_BUNDLE)
        )

    cmd = [node, _BUNDLE, *sys.argv[1:]]

    if os.name == "nt":
        # On Windows os.execv replaces the process but interacts poorly with
        # console signal handling; run as a child and propagate the exit code.
        completed = subprocess.run(cmd, check=False)
        return completed.returncode
    # On POSIX, replace this process with Node so signals/stdio pass straight
    # through and the exit code is inherited naturally.
    os.execv(node, cmd)
    return 0  # pragma: no cover (execv does not return)


if __name__ == "__main__":
    sys.exit(main())
