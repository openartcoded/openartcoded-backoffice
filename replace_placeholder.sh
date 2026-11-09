#!/bin/sh
# Generates the runtime config from environment variables (KEYCLOAK_URL, BACKEND_URL, ...)
APP_BASE_PATH=/usr/share/nginx/html/assets
envsubst < $APP_BASE_PATH/config/config.prod.json > $APP_BASE_PATH/config/config.json

exec "$@"
