# NFC Links Service (BizTag)

This service handles NFC tag redirects and will be deployed on `get.biz365.ai`.

## Purpose

- Handle NFC tag redirects from `get.biz365.ai/q/{uid}`
- **All NFC tags redirect to `https://app.biz365.ai/signup`**
- Track analytics and usage with UTM parameters
- Preserve BizCode and NFC UID for identification

## Deployment

- **Domain**: `get.biz365.ai`
- **Purpose**: NFC tag redirect service (BizTag)
- **Backend**: Connects to main API at `api.biz365.ai`
- **Target**: All redirects go to `https://app.biz365.ai/signup`

## API Endpoints

- `GET /q/{uid}` - Redirect to signup page with tracking parameters
- `GET /{uid}` - Alternative redirect endpoint
- `GET /health` - Health check

## Redirect Behavior

All NFC tags (BizTags) will redirect to `https://app.biz365.ai/signup` with the following parameters:
- `bizcode` - The BizCode of the NFC tag
- `nfc_uid` - The UID of the NFC tag
- `ref` - Referral parameter (if provided)
- `utm_source` - UTM source (if provided)
- `utm_medium` - UTM medium (if provided)
- `utm_campaign` - UTM campaign (if provided)

## Configuration

The service connects to the main backend API to:
1. Look up NFC tag by UID in `app.nfc_tags` table
2. Verify tag exists and is active
3. Redirect to signup page with tracking parameters
4. Log analytics event with redirect type
