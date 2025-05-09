#!/bin/bash

# Base URL for the API
BASE_URL="http://localhost:3000/api"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a command was successful
check_error() {
    if [ $? -ne 0 ]; then
        echo -e "${RED}Error: $1${NC}"
        exit 1
    fi
}

# Function to format JSON response
format_json() {
    local response="$1"
    if [ -z "$response" ]; then
        echo -e "${YELLOW}Empty response${NC}"
        return
    fi
    echo "$response" | json_pp 2>/dev/null || echo -e "${YELLOW}Raw response: $response${NC}"
}

echo -e "${BLUE}Testing MusicBrainz Integration Endpoints${NC}\n"

# 1. Create a record with MBID
echo -e "${GREEN}1. Creating a record with MBID${NC}"
CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/records" \
  -H "Content-Type: application/json" \
  -d '{
    "artist": "The Cure",
    "album": "Disintegration",
    "price": 25,
    "qty": 10,
    "format": "Vinyl",
    "category": "Alternative",
    "mbid": "11af85e2-c272-4c59-a902-47f75141dc97"
  }')

format_json "$CREATE_RESPONSE"

# Extract record ID and verify it exists
RECORD_ID=$(echo "$CREATE_RESPONSE" | grep -o '"_id":"[^"]*' | cut -d'"' -f4)
if [ -z "$RECORD_ID" ]; then
    echo -e "${RED}Error: Failed to create record or extract ID${NC}"
    format_json "$CREATE_RESPONSE"
    exit 1
fi

echo -e "\nRecord ID: $RECORD_ID\n"

# 2. Update record with new MBID
echo -e "${GREEN}2. Updating record with new MBID${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/records/${RECORD_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 30,
    "mbid": "new-mbid-123"
  }')

format_json "$UPDATE_RESPONSE"
if [ -z "$UPDATE_RESPONSE" ]; then
    echo -e "${RED}Error: Failed to update record with new MBID${NC}"
    exit 1
fi

echo -e "\n"

# 3. Update record with same MBID (should not fetch new data)
echo -e "${GREEN}3. Updating record with same MBID${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "${BASE_URL}/records/${RECORD_ID}" \
  -H "Content-Type: application/json" \
  -d '{
    "price": 35,
    "mbid": "new-mbid-123"
  }')

format_json "$UPDATE_RESPONSE"
if [ -z "$UPDATE_RESPONSE" ]; then
    echo -e "${RED}Error: Failed to update record with same MBID${NC}"
    exit 1
fi

echo -e "\n"

# 4. Fetch MusicBrainz data directly
echo -e "${GREEN}4. Fetching MusicBrainz data directly${NC}"
MB_RESPONSE=$(curl -s -X GET "${BASE_URL}/records/mb/fetch/11af85e2-c272-4c59-a902-47f75141dc97")
format_json "$MB_RESPONSE"
if [ -z "$MB_RESPONSE" ]; then
    echo -e "${RED}Error: Failed to fetch MusicBrainz data${NC}"
    exit 1
fi

echo -e "\n"

# 5. Find record by MBID
echo -e "${GREEN}5. Finding record by MBID${NC}"
FIND_RESPONSE=$(curl -s -X GET "${BASE_URL}/records/mb/11af85e2-c272-4c59-a902-47f75141dc97")
format_json "$FIND_RESPONSE"
if [ -z "$FIND_RESPONSE" ]; then
    echo -e "${RED}Error: Failed to find record by MBID${NC}"
    exit 1
fi

echo -e "\n"

# 6. Clean up - Delete the created record
echo -e "${GREEN}6. Cleaning up - Deleting the created record${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/records/${RECORD_ID}")
if [ -z "$DELETE_RESPONSE" ]; then
    echo -e "${GREEN}Record deleted successfully${NC}"
else
    format_json "$DELETE_RESPONSE"
fi

echo -e "\n${BLUE}All tests completed!${NC}" 