# Native test harness

An isolated stack for native (device) validation of the mobile app: its own PostgreSQL and MinIO
containers per run, an API built from a verified checkout, synthetic fixtures, and cleanup that
proves ownership before it deletes anything. It never touches the development PostgreSQL (5434),
the development MinIO (9100), the host PostgreSQL, or any other container, volume or network.

```
export ADULIS_NATIVE_ROOT=/absolute/dir        # manifests, logs; keep it off the C: drive
node ops/native/harness.mjs plan --checkout <path>             # prints the docker arguments, runs nothing
node ops/native/harness.mjs preflight                          # memory, disk, docker, leftovers
node ops/native/harness.mjs up --checkout <path> --sha <40-hex>
node ops/native/harness.mjs fixtures --run <run> --set baseline
node ops/native/harness.mjs api start --run <run> --checkout <path> --sha <40-hex>
node ops/native/harness.mjs api canary --run <run>
node ops/native/harness.mjs verify --run <run>
node ops/native/harness.mjs device check|prepare|restore --run <run> --serial <serial>
node ops/native/harness.mjs api stop --run <run>
node ops/native/harness.mjs down --run <run>                   # then: purge --run <run>
node ops/native/harness.mjs selftest                           # the refusal tests, no Docker needed
```

`--sha` is the commit the operator verified. The checkout must be exactly that commit, have a clean
tracked tree, and contain `origin/dev`; the harness builds the API itself on every start.

## What is verified, and when

Before any destructive operation the harness reads the live resources and compares them with the
manifest it wrote when it created them (an environment variable only says what someone intended):

| Check               | What is read                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| manifest            | schema, run id, nonce, state                                                                                                                                           |
| PostgreSQL server   | system identifier and postmaster start time, over TCP and inside the container by full id                                                                              |
| database            | name and oid (`adulis_native_<run8>`; never `adulis`, `adulis_gates`, `postgres`)                                                                                      |
| database marker     | the disposable comment plus a per-run setting holding the run id and nonce                                                                                             |
| API instance        | `/healthz` boot marker, the single listener's pid, creation time and command line, a connection from this run's `application_name` in this server's `pg_stat_activity` |
| API environment     | `/v1/bootstrap` environment and media origin; the child environment is an allow-list                                                                                   |
| MinIO endpoint      | a signed request with the run's random credentials, and the deployment id                                                                                              |
| bucket marker       | run tags on both buckets, a run marker object, the repository's storage marker                                                                                         |
| mounts and volumes  | exactly one named run volume per container; no bind, tmpfs or volumes-from                                                                                             |
| addresses and ports | loopback only, ports from 57100-57999, none protected; no known credential                                                                                             |
| ownership labels    | owner, run and role labels on every container, volume and network                                                                                                      |

Configuration problems are refused before anything is contacted. A check that cannot be made is
refused too (exit 2). There is no flag that overrides a refusal.

Fixture SQL runs through `docker exec` into the run's own PostgreSQL container by full id, in one
transaction whose first statement raises unless the server, database and run setting match.

## Cleanup

`down` identifies every resource of the run first (by full id for containers and networks, by the
verified name for volumes) and removes nothing unless each one carries this run's labels, this run's
name prefix, mounts only this run's volumes, and is not in the protected set. A failed listing is not
"absent"; a removal is confirmed by a successful empty listing. Processes are stopped only by the pid,
creation time and command line recorded when the harness started them: there is no stop by port.

Exit codes: 0 ok; 1 refused; 2 could not check or usage; 3 cleanup incomplete; 4 blocked.
The last line of every command is a status line, for example
`HARNESS READY - NATIVE EXECUTION NOT PERFORMED`.

Not included: the worker process (no Buyer flow needs it; `/healthz` then reports `degraded` with
HTTP 200, and the harness requires only `db: up`), device settings changes, Maestro runs.
