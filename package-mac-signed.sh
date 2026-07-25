#!/usr/bin/env sh
set -eu

required_vars="APPLE_ID APPLE_APP_SPECIFIC_PASSWORD APPLE_TEAM_ID CSC_LINK CSC_KEY_PASSWORD"

for var_name in $required_vars; do
    if [ -z "${!var_name:-}" ]; then
        echo "Missing required environment variable: $var_name" >&2
        echo "Export signing/notarization credentials in your shell before running this script." >&2
        exit 1
    fi
done

rm -rf dist-mac/
npm run build:mac
