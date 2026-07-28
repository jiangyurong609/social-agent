# Property Discussion Discovery Service

The API worker exposes a read-oriented service for finding real property discussions on Xiaohongshu and Reddit. It expands one property into bilingual searches, normalizes posts and comments, extracts unverified offer and pending-price claims, ranks results by property relevance, and returns both structured JSON and LLM-ready Markdown.

## Endpoints

### Search with JSON

`POST /property-discussions/search`

```json
{
  "property": {
    "address": "123 Main St",
    "city": "Fremont",
    "neighborhood": "Mission San Jose",
    "zipCode": "94539",
    "mlsNumber": "ML81999999"
  },
  "query": "offers and pending price",
  "sources": ["xiaohongshu", "reddit"],
  "maxResults": 20,
  "includeComments": true,
  "commentsPerItem": 5,
  "refresh": false
}
```

### Search with query parameters

```text
GET /property-discussions/search
  ?address=123%20Main%20St
  &city=Fremont
  &zipCode=94539
  &q=offers%20pending%20price
  &sources=xiaohongshu,reddit
  &maxResults=20
```

### Read a cached snapshot

```text
GET /property-discussions/snapshots/{snapshotId}
```

### Export an ingestion batch

`POST /property-discussions/export` accepts the same request body as search and
returns an append-friendly JSONL payload. Each line is independently ingestible:
the first line is an export header, followed by `property-discussion.record.v1`
records containing the stable source ID, source URL, full available text,
hashtags, images, comments, metrics, claims, and provenance metadata.

```bash
curl -X POST https://social-agent-api.jiangyurong609.workers.dev/property-discussions/export \
  -H 'content-type: application/json' \
  -d '{
    "query": "湾区买房 offer pending price",
    "sources": ["xiaohongshu", "reddit"],
    "maxResults": 50,
    "includeComments": true,
    "commentsPerItem": 20,
    "refresh": true
  }'
```

The response contains both `records` (normal JSON) and `jsonl` (one JSON object
per line). Re-run with different query/property terms to build a larger corpus;
deduplicate on `record.id`/`record.sourceId` downstream.

Search results are cached in D1 for 15 minutes by default. Set `refresh: true` to bypass a fresh cache entry. Apply `migrations/0018_property_discussions.sql` before relying on persistence; live search still works when D1 or the table is unavailable.

### Inspect the service

```text
GET /property-discussions/schema
```

## Response

The response uses schema version `property-discussions.v1`:

```json
{
  "ok": true,
  "data": {
    "schemaVersion": "property-discussions.v1",
    "snapshotId": "pds_...",
    "cached": false,
    "generatedAt": "2026-07-27T20:00:00.000Z",
    "expiresAt": "2026-07-27T20:15:00.000Z",
    "generatedQueries": {
      "xiaohongshu": ["123 Main St Fremont", "123 Main St offer 加价 成交价"],
      "reddit": ["123 Main St Fremont", "123 Main St offers pending price"]
    },
    "sourceStatus": [],
    "items": [],
    "llm": {
      "contentType": "text/markdown",
      "document": "# Bay Area property discussion research...",
      "cautions": []
    }
  }
}
```

Each item includes:

- Source URL and source-native ID.
- Title, full available content, selected comments, and author attribution.
- Image URLs with type, alt text, and dimensions when available.
- Engagement metrics.
- Deterministic property-match score and matching signals.
- Extracted offer count and price claims. These always use `verification: "unverified"`.

`data.llm.document` is capped at 40,000 characters and contains source links, image URLs, evidence, selected comments, and an explicit warning about unverified pending prices.

## Configuration

Xiaohongshu uses the existing:

```text
XHS_MCP_BASE
```

Reddit uses OAuth application credentials:

```text
REDDIT_CLIENT_ID
REDDIT_CLIENT_SECRET
REDDIT_USER_AGENT
```

Optionally protect all property-discussion endpoints:

```text
DISCOVERY_API_KEY
```

Clients may send it as either:

```text
Authorization: Bearer {key}
```

or:

```text
X-API-Key: {key}
```

If the optional API key is not configured, the endpoints are public.

## Example

```bash
curl -X POST http://127.0.0.1:8787/property-discussions/search \
  -H 'content-type: application/json' \
  -H 'authorization: Bearer YOUR_DISCOVERY_API_KEY' \
  -d '{
    "property": {
      "address": "123 Main St",
      "city": "Fremont",
      "zipCode": "94539"
    },
    "query": "offers and pending price",
    "sources": ["xiaohongshu", "reddit"]
  }'
```

The service links to and excerpts source material. Downstream systems should preserve attribution, comply with source terms, avoid republishing entire discussions, and never present a community estimate as a verified transaction price.
