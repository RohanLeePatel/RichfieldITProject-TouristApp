# Maintaining the recommendation data

How the destinations behind the recommendations are kept up to date, and how
the scoring can be retuned, without a developer.

## Where the destinations live

| What | Where | Who changes it |
|---|---|---|
| The cities the engine can suggest | Supabase table `CatalogDestination` | Administrators, in the **Admin → Destinations** card |
| Fallback copy of the same cities | `data/destinations_seed.json` | Developers only; used only if the table is empty or unreachable |
| Scoring rules (weights, cost bands) | `engine/weights.py` | Developers, with a version bump (below) |

The AI service never reads the database. The Core API loads the active cities
and sends them with each recommendation request (`catalog`), and the AI service
scores them. If the table has no usable rows, the service quietly uses the seed
file, so recommendations keep working.

## Day-to-day, in the admin dashboard

- **Add a city**: *Add destination*, type the city and country, pick a cost
  level, *Add and fetch data*. The city is found on the map by name and its
  numbers (points of interest, wheelchair accessibility, monthly climate, a cover
  photo) are fetched. It takes up to 30 seconds. If the lookup fails the city is
  still saved; press the refresh button on its row to retry. Tick *Enter the
  coordinates myself* if the name lookup picks the wrong place.
- **Hide a city** with the eye button. It stays in the list with its data and
  is simply not suggested. Prefer this over deleting.
- **Change the cost level** from the drop-down on the row. It takes effect on
  the next recommendation.
- **Fresh data**: the refresh button re-fetches one city. A weekly job
  (`/api/cron/destinations`, Mondays 03:00 UTC) also refreshes up to two cities
  a run that have no data or whose data is older than six months. A row marked
  *Data is old* or *Needs data* is waiting for that.

A city only appears in recommendations when it is active **and** has data
(status *Live* or *Data is old*).

## Things worth knowing

- **Countries are not stored.** Each country is built by averaging its cities, so
  adding or hiding a city also shifts its country's scores. A country appears
  once it has one city.
- **Densities are relative.** Interest scores are scaled against the strongest
  city for each interest, computed from the whole list on every request. Adding
  a very dense city (say Tokyo) slightly lowers everyone else's interest scores.
  That is by design; nothing needs re-running.
- **Safety** is not stored. It comes from the travel advisory for the country at
  request time (`engine/safety.py`).
- **Provider quota.** Each fetch uses about 20 Geoapify requests; the free tier
  allows 3,000 a day, so a few cities a day is fine.
- **Required settings** (Vercel, Core API and AI service): `superSecretKey` on
  both, `AI_FEATURES_URL` on the Core API, `geoapifyAPIKey` on the AI service,
  `CRON_SECRET` on the Core API for the weekly job.
- **The slow call.** Fetching a city makes the Core API wait for the AI service.
  If Vercel cuts the request short on a small plan, the dashboard shows "did not
  answer in time"; pressing refresh again usually finishes it, because the data
  provider answers faster the second time.

## Retuning the scoring (developers)

`engine/weights.py` holds how much each factor counts at each level (country,
city, place), the cost bands in rand per day, and how many results are shown.
Weights per level must add up to 1.0 (a test enforces it).

When you change any value there, raise `WEIGHTS_VERSION` and add one line to the
change log beside it saying what changed and why. Recommendations then differ
between versions, and the log is how a later reader finds out when and why.

## Rebuilding the fallback seed file (rarely)

Only needed if you want `data/destinations_seed.json` brought in line with the
database. From `ai-features`: edit `scripts/cities_seed.py`, then
`python scripts/enrich_destinations.py` and `python scripts/add_destination_images.py`.
