# Native test harness

An isolated stack for native (device) validation of the mobile app: its own PostgreSQL and MinIO
containers per run, an API built from a verified checkout, synthetic fixtures, and cleanup that
proves ownership before it deletes anything. It creates, changes and removes only the network,
volumes, containers and processes it created itself, and refuses everything else.

Windows only: the process lookups use PowerShell (`Get-CimInstance`, `Get-NetTCPConnection`) and
paths follow Windows rules. The refusal tests (`selftest`) run anywhere and need no Docker.

```
export ADULIS_NATIVE_ROOT=<absolute dir>       # an EXISTING directory for manifests and logs, outside any git work tree
node ops/native/harness.mjs plan --checkout <path>             # prints the docker arguments, runs nothing
node ops/native/harness.mjs preflight                          # memory, disk, docker, leftovers
node ops/native/harness.mjs up --checkout <path> --sha <40-hex>
node ops/native/harness.mjs fixtures --run <run> --set baseline
node ops/native/harness.mjs api start --run <run> --checkout <path> --sha <40-hex>
node ops/native/harness.mjs api canary --run <run>
node ops/native/harness.mjs verify --run <run>
node ops/native/harness.mjs metro start --run <run> --checkout <path> --sha <40-hex>
node ops/native/harness.mjs device check|prepare|restore|journal --run <run> --serial <serial>
node ops/native/harness.mjs native conditions --run <run> --serial <serial> --checkout <path> \
    --sha <40-hex> --apk <debug apk> --built-at <40-hex> [--battery smoke]   # checks only
node ops/native/harness.mjs native run <the same options>      # the session: flows, evidence, restore
node ops/native/harness.mjs metro stop --run <run>
node ops/native/harness.mjs api stop --run <run>
node ops/native/harness.mjs down --run <run>                   # then: purge --run <run>
node ops/native/harness.mjs selftest                           # the refusal tests, no Docker needed
```

`--sha` is the commit the operator verified. The checkout must be exactly that commit, have a clean
tracked tree, and contain `origin/dev` as last fetched; the harness builds the API itself on every
start and checks the commit again after the build. The API holds synthetic data and the fake SMS
adapter only; stop it when you are done.

## What is verified, and when

Before any destructive operation the harness reads the live resources and compares them with the
manifest it wrote when it created them (an environment variable only says what someone intended):

| Check               | What is read                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| manifest            | schema, run id, nonce, state, full ids; the Docker engine and context the run was created in                                                                           |
| PostgreSQL server   | system identifier and postmaster start time, over TCP and inside the container by full id                                                                              |
| database            | name and oid (`adulis_native_<run8>`; never `adulis`, `adulis_gates`, `postgres`)                                                                                      |
| database marker     | the disposable comment plus a per-run setting holding the run id and nonce                                                                                             |
| API instance        | `/healthz` boot marker, the single listener's pid, creation time and command line, a connection from this run's `application_name` in this server's `pg_stat_activity` |
| API environment     | `/v1/bootstrap` environment and media origin; the child environment is an allow-list                                                                                   |
| MinIO endpoint      | a signed request with the run's random credentials, and the deployment id                                                                                              |
| bucket marker       | run tags on both buckets, a run marker object, the repository's storage marker                                                                                         |
| mounts and volumes  | exactly one named run volume per container; no bind, tmpfs or volumes-from                                                                                             |
| addresses and ports | loopback only, ports from 57100-57999, none protected; credentials are this run's random values                                                                        |
| ownership labels    | owner, run and role labels on every container, volume and network; no compose labels                                                                                   |

Configuration problems are refused before anything is contacted. A check that cannot be made is
refused too (exit 2). There is no flag that overrides a refusal.

Fixture SQL runs through `docker exec` into the run's own PostgreSQL container by full id, in one
transaction whose first statement raises unless the server, database and run setting match.

## Cleanup

`down` first checks the manifest and that the Docker engine and context are the ones the run was
created in. It then identifies every resource of the run (by full id for containers and networks, by
the planned name for volumes) and removes nothing unless each one carries this run's owner, run and
role labels, its planned name with this run's prefix, the recorded full id, and is not in the
protected set. (A resource that fails the isolation rules of `verify`, such as a stopped container,
is still the run's own and is removed; an anonymous volume that an image created is reported, not
removed.) A failed listing is not "absent"; a removal is confirmed by a successful empty listing. A
`down` that finds nothing says so, and records the engine it looked in. `purge` deletes a cleaned
run's directory only in that same engine, after a live listing by the run's label comes back empty.
Processes are stopped only by the pid, creation time and command line recorded when the harness
started them: there is no stop by port.

## Exit codes and status lines

One scheme for every command. The last line of every command is its status line.

| Exit | Meaning                                                                    | Status line                                                                                                                                                                                   |
| ---- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | the command did what it says                                               | `HARNESS READY - STACK VERIFIED - NATIVE EXECUTION NOT PERFORMED` (`up`, `verify`), `HARNESS READY - STACK AND API VERIFIED - ...` (`verify` with an API), otherwise `HARNESS OK - <command>` |
| 1    | refused: a rule was evaluated and the operation does not satisfy it        | `HARNESS REFUSED - <check> - NO RESOURCE WAS CHANGED`                                                                                                                                         |
| 2    | could not check, usage, or an unexpected error before anything was changed | `HARNESS REFUSED - <check> (could not be checked) - NO RESOURCE WAS CHANGED`, `HARNESS USAGE - <reason>`, `HARNESS ERROR - <reason> - NO RESOURCE WAS CHANGED`                                |
| 3    | something was changed and the command did not finish                       | `HARNESS INCOMPLETE - <reason> after <n> change(s) (<what>); <how to continue>`, `HARNESS CLEANUP INCOMPLETE - <n> RESOURCES LEFT, REGISTERED`                                                |
| 4    | a precondition of `up` or of a native run is not met                       | `HARNESS BLOCKED - <precondition> - NOTHING STARTED`                                                                                                                                          |
| 5    | a native run finished and at least one approved flow failed                | `HARNESS TEST FAILED - native run (<n> PASS, <m> FAIL, <k> NOT EXECUTED); device settings restored`                                                                                           |

Only `up` and a full `verify` print READY, and READY names what was verified. `status`, `env`, `plan`,
`preflight`, `down` and `purge` verify nothing about the stack and print `HARNESS OK`.
`NO RESOURCE WAS CHANGED` is printed only when no call that creates, removes, starts or stops anything
was made by that command. Counted as changes: every Docker call that is not a plain read (`run` and `rm`
whatever their exit code), `adb reverse` and every device setting (or an adb call the driver's list does
not know), stopping or starting a process (the API, its build, Metro, a Maestro run, the migration and
seed children), deleting a run directory, an HTTP request that makes the API write
(`api canary`, marked before it is sent), and the run directory `up` creates. The manifest, logs and
evidence files the harness keeps for itself in an existing run directory are not counted.
`HARNESS SELFTEST FAILED` (exit 2) is what `selftest` prints when a test fails.

## Native runs: the device driver

`native conditions` and `native run` drive one Android device through the approved flows of
`apps/mobile/.maestro`, in the isolated stack above. Nothing in this section is a device result until
`native run` has actually run on a device: `native conditions` only decides whether it may.

**Which device.** The serial is named by the operator (`--serial` or `ANDROID_SERIAL`); there is no
default device and it must be the only one attached. An emulator (`emulator-<port>` that also reports
emulator hardware) qualifies. A physical phone qualifies only if `<ADULIS_NATIVE_ROOT>/allowed-devices.json`
lists it (`serial`, `hardwareSerial`, `model` and `"disposable": true`, the operator's statement that it
holds no personal data) and the device reports the same hardware serial and model. A network (wireless)
serial is never used. Every adb call goes through a fixed list (`lib/adb.mjs`): the serial is added by the
driver, and an install, uninstall, clear, push, pull, reboot, free shell or a reverse of any port that is
not this run's API, this run's MinIO or Metro (8081) is refused before it is sent.

**Which app.** The installed package must be `com.adulis.app`, the id in `apps/mobile/app.json`, and a
debug build. The operator names the APK (`--apk`) and the commit it was built at (`--built-at`): the
installed APK must be that file byte for byte, its native libraries must include the device's CPU
architecture, and `apps/mobile/app.json` and the `dependencies` of `apps/mobile/package.json` must be the
same at that commit and at the verified one. The build record (APK hash, architectures, native fingerprint,
verified commit) is kept in the session directory.

**Which API.** The app reaches the host only through `adb reverse`, and only for this run's API, this
run's MinIO and Metro. Metro is started by `metro start` with this run's API address and recorded by pid,
creation time and command line; a Metro started by anyone else is refused. It is started on the loopback
(`--localhost`) and stopped only by that identity: the record is cleared once the process is gone and the
port is free, otherwise the command ends INCOMPLETE and says Metro may still run. The API address must be
`http://localhost:<this run's API port>`. That `adb reverse` reaches a Metro bound to the loopback has not
been shown yet: it is checked at the first run on a device.

**Settings and restoration.** Before a setting is changed (animations, font scale, night mode, density,
stay awake, airplane mode, accessibility services, rotation, the app's locale, the reverse entries), its
current value is read, writing that value back is tried and read back, and the intent is written to the
journal `<run>/device-journal.ndjson` and flushed to disk. Only then is the setting changed. The journal
is replayed by `device restore` after a success, a failed flow, an interruption (Ctrl+C, SIGTERM), an app
crash, a cancellation, a killed process or a power loss. A value that is neither the recorded original
nor the one the run set is reported and not overwritten. A restoration that fails is reported, makes the
run INCOMPLETE (exit 3) and leaves the journal open: `down` and `status` say so and `purge` refuses
until the device is restored. The Maestro driver apps that Maestro installs on the device for itself are
not settings: the session records which are present before and after.

**One session at a time.** A native session holds `<run>/native.lock`: the pid and creation time of the
harness process and, while a flow runs, the pid, creation time and command line of the Maestro process it
started. While a session holds the run, `down`, `api start|stop`, `metro start|stop`, `device prepare|restore`
and `fixtures` refuse, and so does a lock that cannot be read (nobody knows who holds the run). If the
harness was killed while Maestro kept running, `device restore` and `down` stop that Maestro process by its
recorded identity, never by its number alone, and confirm it is gone before anything else; `device prepare`,
`native conditions` and `native run` refuse until then. A Maestro process that would not stop ends the run
INCOMPLETE, and its identity stays in the lock.

**Flows.** `ops/native/flows.json` names the approved flows and batteries, pins the SHA-256 of each flow
file and declares what it does to the device. The file is read and hashed again right before every Maestro
start, and Maestro runs a copy of exactly the bytes that were checked: a flow whose content differs from its
pin is refused, whatever the difference, until the pin is changed in a reviewed change. A flow that is not
declared is refused too. The scan that a reviewer sees when a pin is set refuses, whatever a declaration
says, a script or expression, a file load, an external link, a cloud service, another app id (also in the
string forms of `clearState`, `launchApp` and `stopApp`), a hardware key other than navigation keys, and
any permission grant other than the one declared. The `smoke` battery runs `foundation-smoke` first (it must make this
run's database gain a device, which proves the app talks to this run's API) and then `buyer-shell`.
Maestro is started from its JVM with a fixed list of options and a small environment; results (JUnit
report, log, screenshots, the device log and, on a failure, a screenshot) are written under
`<run>/native/<session>/`. Only an infrastructure error (the device, adb or the Maestro driver failed
before the flow ran) is retried, once per battery, after the device and API checks passed again; an
assertion failure, a crash and a timeout never are.

**Conditions.** `native conditions` evaluates thirteen conditions: the device is attached and authorised
(NC-01) and identified (NC-02), the app (NC-03) and build (NC-04) are the ones named, the endpoint is
isolated (NC-05), the ten identity checks pass (NC-06), free memory is at least 6 GB (NC-07), commit headroom
at least 8 GB (NC-08), free disk at least 10 GB under the run root and TEMP (NC-09), adb and Maestro with a
Java are present (NC-10), restoration is provable (NC-11: a readable and writable journal, nothing open in
this run or in another run for the same device), no other session holds the run and no Maestro process of an
earlier one is left (NC-12) and no adb server is selected by the environment (NC-13). A rule that fails is a refusal (exit 1), a condition that cannot be checked is
exit 2, and a missing resource blocks (exit 4, nothing started).

A device that no longer exists (an emulator that was deleted) leaves an open journal that makes `purge`
refuse. Nothing in the harness retires it: remove the run directory by hand once the device is known to be
gone, after copying out any evidence you want to keep.

## After a Docker reset or reinstall

Every run records the Docker engine it was created in, and `down`, `verify` and `purge` refuse to work in
any other engine, with no override: in a different engine every lookup would say "no such object" and a
run could look cleaned while its resources still exist. After Docker Desktop is reset or reinstalled (or the
context is switched), `down` therefore refuses and `preflight` keeps naming the old run. To recover:

1. Switch back to the original context if it was only switched (`docker context use <name>`), and run
   `down` and `purge` as usual.
2. If the engine really was reset, its containers, volumes and networks are gone with it; check with
   `docker ps -a`, `docker volume ls` and `docker network ls` that nothing named `adulis-native-<run8>-...`
   is left in the new engine.
3. Only then remove the run directory (`<ADULIS_NATIVE_ROOT>/runs/<run>`) by hand. Nothing in Docker is
   touched by this.

Not included: the worker process (no Buyer flow needs it; `/healthz` then reports `degraded` with
HTTP 200, and the harness requires only `db: up`).
