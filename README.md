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

**Default Behavior**: All NFC tags (BizTags) redirect to `https://app.biz365.ai/signup` by default.

**Custom Redirects**: Users can set custom redirect URLs for their BizTags. When a custom URL is set, the NFC tag will redirect to that URL instead of the default signup page.

**Tracking Parameters**: All redirects include the following parameters:
- `bizcode` - The BizCode of the NFC tag
- `nfc_uid` - The UID of the NFC tag
- `ref` - Referral parameter (if provided)
- `utm_source` - UTM source (if provided)
- `utm_medium` - UTM medium (if provided)
- `utm_campaign` - UTM campaign (if provided)

## API Endpoints for BizTag Management

### Backend API (api.biz365.ai)

**Set Custom Redirect**
```
PUT /api/nfc/tags/:bizcode/redirect
Authorization: Bearer <token>
Content-Type: application/json

{
  "redirect_url": "https://instagram.com/yourprofile",
  "title": "Instagram Profile",
  "description": "Follow us on Instagram"
}
```

**Get BizTag Details**
```
GET /api/nfc/tags/:bizcode
```

**Reset to Default Redirect**
```
DELETE /api/nfc/tags/:bizcode/redirect
Authorization: Bearer <token>
```

### NFC Service (get.biz365.ai)

**NFC Redirect**
```
GET /q/:uid
GET /:uid
```

**Health Check**
```
GET /health
```

## Configuration

The service connects to the main backend API to:
1. Look up NFC tag by UID in `app.nfc_tags` table
2. Check for custom redirect URL in `active_target_url` column
3. Use custom URL if available, otherwise default to signup page
4. Add tracking parameters and redirect user
5. Log analytics event with redirect type
