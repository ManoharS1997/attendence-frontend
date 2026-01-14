#!/bin/bash
URL="http://localhost:5173"
RETRIES=5

echo "Checking frontend availability..."

for i in $(seq 1 $RETRIES); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" $URL)
  if [ "$STATUS" == "200" ]; then
    echo "Frontend is UP"
    exit 0
  fi
  sleep 5
done

echo "Frontend health check failed"
exit 1
