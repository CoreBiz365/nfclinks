# NFC Links Service

This service handles NFC tag redirects and will be deployed on `get.biz365.ai`.

## Purpose

- Handle NFC tag redirects from `get.biz365.ai/q/{uid}`
- Redirect to appropriate target URLs
- Track analytics and usage

## Deployment

- **Domain**: `get.biz365.ai`
- **Purpose**: NFC tag redirect service
- **Backend**: Connects to main API at `api.biz365.ai`

## API Endpoints

- `GET /q/{uid}` - Redirect to NFC tag target URL
- `GET /{uid}` - Alternative redirect endpoint
- `GET /health` - Health check

## Configuration

The service will connect to the main backend API to:
1. Look up NFC tag by UID
2. Get target URL
3. Redirect user
4. Log analytics event
