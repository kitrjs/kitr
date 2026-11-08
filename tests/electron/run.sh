#!/bin/bash
# Runs the Electron smoke test with a virtual display, a session bus and an unlocked keyring,
# which safeStorage needs on Linux. Usage: tests/electron/run.sh [playwright args]
set -e
exec xvfb-run -a dbus-run-session -- bash -c 'echo -n "kitr-test" | gnome-keyring-daemon --unlock --components=secrets > /dev/null; pnpm test:electron "$@"' _ "$@"
