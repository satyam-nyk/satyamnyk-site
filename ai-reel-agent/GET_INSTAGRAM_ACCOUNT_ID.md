## 📱 How to Get Your Numeric Instagram Business Account ID

### Method 1: Meta Business Suite (Easiest)

1. Go to [business.facebook.com](https://business.facebook.com)
2. On the left sidebar, click **Settings** → **Instagram Accounts**
3. Click your Instagram Business Account (`globaldailydose`)
4. In the URL bar, you'll see: `businessaccountid=17841XXXXXXXXX`
5. That numeric ID is what you need

**Example:** `INSTAGRAM_BUSINESS_ACCOUNT_ID=17841400963XXX`

---

### Method 2: Instagram Graph API Explorer

1. Go to [developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer)
2. Select your app and Instagram graph API version
3. In the query field, type: `GET /me/instagram_business_accounts`
4. Click **Submit**
5. Look for `"id": "17841XXXXXXXXX"` in the response
6. Copy this numeric ID

---

### Method 3: Get Current Token Info

Using your existing access token, you can query directly:

```bash
curl "https://graph.instagram.com/me/instagram_business_accounts?access_token=YOUR_TOKEN" | jq '.data[0].id'
```

This returns: `17841XXXXXXXXX`

---

### ✅ After Getting the ID:

Update your `.env` file:

```bash
# BEFORE (WRONG)
INSTAGRAM_BUSINESS_ACCOUNT_ID=globaldailydose

# AFTER (CORRECT)
INSTAGRAM_BUSINESS_ACCOUNT_ID=17841XXXXXXXXX
```

Then verify with:

```bash
node verify-production.js
```

Should show: `✅ Instagram Business Account ID: 17841XXXXXXXXX`

