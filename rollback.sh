#!/bin/bash

echo "Rolling back frontend..."

docker stop attendance-frontend-container || true
docker rm attendance-frontend-container || true

docker run -d \
  --name attendance-frontend-container \
  -p 5173:5173 \
  attendance-frontend

echo "Rollback completed"
