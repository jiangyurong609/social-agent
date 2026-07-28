#!/usr/bin/env bash
set -euo pipefail

# Portable XHS archive job. It can run against a local/remote MCP endpoint and
# optionally upload the resulting archive to Azure Blob Storage.
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage: xhs_azure_scrape.sh

Environment:
  XHS_BASE              MCP base URL (default: http://127.0.0.1:18060)
  ARCHIVE_ROOT          Local archive directory (default: /opt/xhs-mcp/archive)
  QUERIES_FILE          Optional UTF-8 file with one query per line
  MAX_PAGES             Search pages per query (default: 3)
  MAX_POSTS             Maximum detailed posts per run (default: 100)
  COMMENTS_PER_POST     Comment cap metadata (default: 50)
  UPLOAD_TO_AZURE       true/false (default: true)
  STORAGE_ACCOUNT       Azure storage account
  STORAGE_CONTAINER     Azure blob container
  AZURE_AUTH_MODE       login or key (default: login)
  AZURE_STORAGE_KEY     Required only when AZURE_AUTH_MODE=key
EOF
  exit 0
fi

XHS_BASE="${XHS_BASE:-http://127.0.0.1:18060}"
ARCHIVE_ROOT="${ARCHIVE_ROOT:-/opt/xhs-mcp/archive}"
QUERIES_FILE="${QUERIES_FILE:-}"
UPLOAD_TO_AZURE="${UPLOAD_TO_AZURE:-true}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-xhsscrapejyr20260728}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-xhs-property-discussions}"
AZURE_AUTH_MODE="${AZURE_AUTH_MODE:-login}"
MAX_PAGES="${MAX_PAGES:-3}"
MAX_POSTS="${MAX_POSTS:-100}"
COMMENTS_PER_POST="${COMMENTS_PER_POST:-50}"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
ROOT="${ARCHIVE_ROOT%/}/${RUN_ID}"
RAW="$ROOT/raw"
mkdir -p "$RAW"

if ! command -v jq >/dev/null || ! command -v curl >/dev/null; then
  echo "jq and curl are required" >&2
  exit 1
fi

if [ -n "$QUERIES_FILE" ]; then
  mapfile -t queries < <(sed '/^[[:space:]]*#/d;/^[[:space:]]*$/d' "$QUERIES_FILE")
else
  queries=(
    "湾区买房 offer pending price"
    "湾区房产 加价 成交价"
    "旧金山湾区 买房 价格"
    "硅谷 买房 学区房"
    "Fremont house offer pending price"
    "San Jose home buying multiple offers"
    "Bay Area real estate sold price"
  )
fi

jsonl="$ROOT/discussions.jsonl"
manifest="$ROOT/manifest.json"
: > "$jsonl"
post_count=0
query_count=0

for query in "${queries[@]}"; do
  query_count=$((query_count + 1))
  for page in $(seq 1 "$MAX_PAGES"); do
    [ "$post_count" -ge "$MAX_POSTS" ] && break 2
    search_file="$RAW/search_${query_count}_${page}.json"
    if ! curl -fsS --max-time 25 -H 'content-type: application/json' \
      -d "$(jq -nc --arg keyword "$query" --argjson page "$page" '{keyword:$keyword,page:$page}')" \
      "$XHS_BASE/api/v1/feeds/search" > "$search_file"; then
      continue
    fi

    while IFS= read -r feed; do
      [ "$post_count" -ge "$MAX_POSTS" ] && break 2
      id="$(jq -r '.id // empty' <<<"$feed")"
      token="$(jq -r '.xsecToken // .xsec_token // empty' <<<"$feed")"
      [ -n "$id" ] && [ -n "$token" ] || continue
      slug="$(printf '%s' "$id" | tr -cd '[:alnum:]_-')"
      detail_file="$RAW/detail_${slug}.json"
      # The MCP sometimes returns comments {list: [], hasMore: true} even
      # when the post has comments (transient load failure) — retry the
      # whole detail call until the list is non-empty or attempts run out.
      detail_ok=0
      for detail_attempt in 1 2 3; do
        if ! curl -fsS --max-time 30 -H 'content-type: application/json' \
          -d "$(jq -nc --arg id "$id" --arg token "$token" '{feed_id:$id,xsec_token:$token,load_all_comments:true}')" \
          "$XHS_BASE/api/v1/feeds/detail" > "$detail_file"; then
          sleep 3
          continue
        fi
        detail_ok=1
        comment_count="$(jq -r '(.data.data // .data // {}).note.interactInfo.commentCount // "0"' "$detail_file")"
        comments_loaded="$(jq -r '(.data.data // .data // {}).comments.list // [] | length' "$detail_file")"
        if [ "$comments_loaded" -gt 0 ] || [ "$comment_count" = "0" ]; then
          break
        fi
        [ "$detail_attempt" -lt 3 ] && sleep 3
      done
      [ "$detail_ok" = "1" ] || continue

      jq -c --arg query "$query" --argjson search "$feed" --arg scrapedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
        def media_images: (.imageList // .images // .image_list // []);
        def media_videos: (.videoInfo // .videoList // .videos // .video // []);
        (.data.data // .data // {}) as $detail |
        ($detail.note // {}) as $note |
        ($detail.comments.list // []) as $top |
        ($top | map(. as $parent | ([($parent | . + {parentId:null})] + (($parent.subComments // []) | map(. + {parentId:$parent.id})))) | add // []) as $comments |
        {
          recordType: "discussion",
          schemaVersion: "property-discussion.record.v1",
          id: ("xiaohongshu:" + (($note.noteId // $search.id) | tostring)),
          source: "xiaohongshu",
          sourceId: ($note.noteId // $search.id),
          sourceUrl: ("https://www.xiaohongshu.com/explore/" + (($note.noteId // $search.id) | tostring) + "?xsec_token=" + (($note.xsecToken // $search.xsecToken // $search.xsec_token) | tostring) + "&xsec_source=pc_search"),
          originalPublishedAt: (if ($note.time | type) == "number" then (($note.time / 1000) | todateiso8601) else $note.time end),
          scrapedAt: $scrapedAt,
          matchedQuery: $query,
          title: ($note.title // $search.noteCard.displayTitle // ""),
          content: ($note.desc // ""),
          hashtags: [($note.desc // "") | scan("#[^#[:space:]]+") | sub("^#";"") | sub("\\[话题\\]$";"")] | unique,
          author: ($note.user // $search.noteCard.user // null),
          images: ($note | media_images),
          videos: ($note | media_videos),
          media: {images:($note | media_images),videos:($note | media_videos)},
          comments: ($comments[:50] | map({id:(.id // null),parentId:(.parentId // null),isReply:((.parentId // null) != null),content:(.content // ""),author:(.userInfo // .user // null),score:(.likeCount // null),originalPublishedAt:(if (.createTime | type) == "number" then ((.createTime / 1000) | todateiso8601) else .createTime end),subCommentCount:(.subCommentCount // null),images:(. | media_images),videos:(. | media_videos),media:{images:(. | media_images),videos:(. | media_videos)}))),
          commentsReturned: ($comments | length),
          commentsComplete: ((($note.interactInfo.commentCount // 0) | tonumber) <= ($comments | length) and (($detail.comments.hasMore // false) | not)),
          metrics: ($note.interactInfo // $search.noteCard.interactInfo // {}),
          provenance: {sourcePayload: ("raw/detail_" + (($note.noteId // $search.id) | tostring) + ".json"), xsecToken: ($note.xsecToken // $search.xsecToken // $search.xsec_token)},
          llmText: (($note.title // "") + "\n" + ($note.desc // "") + "\n" + ($comments | map(.content // "") | join("\n")))
        }' "$detail_file" >> "$jsonl"
      post_count=$((post_count + 1))
    done < <(jq -c '.data.feeds[]? // empty' "$search_file")
  done
done

jq -n --arg runId "$RUN_ID" --arg generatedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson queries "$query_count" --argjson posts "$post_count" \
  '{schemaVersion:"property-discussions.archive.v1",runId:$runId,generatedAt:$generatedAt,queriesAttempted:$queries,postsArchived:$posts,originalTimestampField:"originalPublishedAt",recordFile:"discussions.jsonl"}' > "$manifest"

if [ "$UPLOAD_TO_AZURE" = "true" ]; then
  command -v az >/dev/null || { echo "Azure CLI is required when UPLOAD_TO_AZURE=true" >&2; exit 1; }
  if [ "$AZURE_AUTH_MODE" = "login" ]; then
    az account show >/dev/null 2>&1 || az login --identity --allow-no-subscriptions >/dev/null
    az storage blob upload-batch --account-name "$STORAGE_ACCOUNT" --destination "$STORAGE_CONTAINER/$RUN_ID" --source "$ROOT" --auth-mode login --overwrite true >/dev/null
    az storage blob upload --account-name "$STORAGE_ACCOUNT" --container-name "$STORAGE_CONTAINER" --name latest/manifest.json --file "$manifest" --auth-mode login --overwrite true >/dev/null
  else
    az storage blob upload-batch --account-name "$STORAGE_ACCOUNT" --destination "$STORAGE_CONTAINER/$RUN_ID" --source "$ROOT" --account-key "$AZURE_STORAGE_KEY" --overwrite true >/dev/null
    az storage blob upload --account-name "$STORAGE_ACCOUNT" --container-name "$STORAGE_CONTAINER" --name latest/manifest.json --file "$manifest" --account-key "$AZURE_STORAGE_KEY" --overwrite true >/dev/null
  fi
  echo "archived $post_count posts and uploaded run $RUN_ID"
else
  echo "archived $post_count posts locally at $ROOT"
fi
