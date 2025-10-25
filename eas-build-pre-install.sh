#!/usr/bin/env bash

set -euo pipefail

# Copy google-services.json to the correct location
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "Creating google-services.json from environment variable"
  echo "$GOOGLE_SERVICES_JSON" > ./google-services.json
fi
