#!/bin/sh
set -e
docker build -t nbittich/openartcoded-backoffice .
docker push nbittich/openartcoded-backoffice
