# Roamio Expert & Integration Service

The FastAPI service behind Roamio's recommendations, landmarks, weather,
translation, exchange rates and trip chat. Only the Core API (Express) calls it;
browsers never do, and this service never touches the database. For keeping the
destination data up to date, see [MAINTAINING.md](MAINTAINING.md).

## Run it

```bash
cd Roamio/backend/ai-features
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt                    # or: uv pip install -r requirements-dev.txt
cp .env.example .env                                   # then fill in at least superSecretKey
uvicorn main:app --reload --port 8000
```

The log lists every key that is not set and which feature that switches off, so
you only need the keys for what you are working on. `GET /health` (with the
service key) shows the same thing as a list of true/false values.

Checks, the same ones CI runs:

```bash
ruff check .
mypy
coverage run -m pytest -q && coverage report --fail-under=90
```

## Calling it

Every feature lives under `/v1`. Send the shared secret in `node-secretkey`.
(The old unversioned paths still answer, hidden from the schema, until every
caller has moved.) The full list of routes and shapes is
[tests/openapi.snapshot.json](tests/openapi.snapshot.json); a test fails when it
changes without being regenerated, and the Core API has a matching check.

```bash
KEY="node-secretkey: your-secret"

# live exchange rate
curl -H "$KEY" http://localhost:8000/v1/rates/USD/ZAR

# five cities in Portugal for a couple on R1,500 a day
curl -X POST http://localhost:8000/v1/recommendations -H "$KEY" -H "Content-Type: application/json" -d '{
  "request_id": "11111111-1111-1111-1111-111111111111",
  "session_id": "22222222-2222-2222-2222-222222222222",
  "level": "city", "parent_id": "portugal",
  "preferences": {
    "budget_per_day": 1500, "currency": "ZAR",
    "interests": ["history", "food", "beaches"],
    "travellers": {"adults": 2}
  }
}'
```

A recommendation answer carries, besides the ranked `results`:
- `excluded`: places left out, each with a `reason` and, when one change would bring it back, a `suggestion`
- `degraded`: inputs that could not be had this time (`"safety"`, `"currency"`), so the scores lean on less than usual
- `comparison`, `group_*`: why #1 beat #2, and how a group's preferences were combined

### Errors

Every error has the same shape:

```json
{ "message": "Sentence a person can read.", "code": "not_found", "detail": "..." }
```

Show `message`; branch on `code` (`invalid_request`, `unauthorized`, `not_found`,
`rate_limited`, `provider_unavailable`, `not_configured`, ...). `detail` is what
FastAPI always sent and stays for older callers.

## How it is put together

| Folder / file | What it is |
|---|---|
| `routers/` | The HTTP routes. Thin: validate, call, shape the answer. |
| `schemas/` | Request and response models. The contract. |
| `engine/` | Scoring: gates, scorers, weights, explanations. No web code. |
| `weather/ landmarks/ translation/ ocr/ chat/` | One folder per outside provider. |
| `config/settings.py` | Every environment variable, in one list. Add new ones here and in `.env.example`. |
| `http_client.py` | The one way to call a provider: timeout, one retry, no keys in logs. |
| `errors.py` | The one error shape. |
| `services/` | Per-caller rate limits, in-memory caches and the translation-history storage helpers. Limits and caches are per server instance. |
| `scripts/` | Offline tools for the fallback seed data. Not deployed. |

Conventions worth keeping:
- A new provider call goes through `http_client`, not `requests` directly, and a failure is logged with `http_client.describe_error`, never the exception text (it can contain the API key).
- A new setting is added to `config/settings.py` and `.env.example`; a test fails if they disagree.
- Changing scoring (`engine/weights.py`)? Raise `WEIGHTS_VERSION`, run `UPDATE_GOLDEN=1 python -m pytest tests/test_golden.py`, and commit the changed `tests/golden_rankings.json`. Its diff shows which recommendations moved.
- Changing a route or model? The same command refreshes `tests/openapi.snapshot.json`; check the Core API's `src/utils/aiContract.selfcheck.js` still holds.

## Deploying

Vercel installs from `requirements.txt` (loose on purpose). `requirements.lock` is the
exact set of versions the tests last ran with: `uv pip install -r requirements.lock`
reproduces them, and `uv pip compile requirements.txt -o requirements.lock` refreshes it.

Optional: `pre-commit install` (config at the repository root) runs ruff, mypy and the
tests before each commit.
