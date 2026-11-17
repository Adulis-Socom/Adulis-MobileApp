# Disposable Docker resources: what may be removed, by whom, on what proof (PLAT-HARD-01, IC01-006)

This policy covers the Docker containers, volumes and networks that Adulis tests, rehearsals and work
orders create on a development machine. It says which leftovers a script or an agent may remove, and
on what evidence. It does not cover images. It never covers the persistent development stack, and it
never covers a resource of another project or of unknown origin: those are never removed.

## 1. The rule

**A leftover is removed only on positive proof that an Adulis run created it and that the run has
ended.** A name, a name pattern, an age, a content type or "looks unused" is never proof on its own.
**Any doubt: register the resource (section 7), leave it alone, and ask the founder.**

Never, on any machine that holds development data:

- `docker system prune`, `docker volume prune`, `docker container prune`, `docker network prune`;
- `docker compose down`, with or without `-v`, for any project. `down` stops and removes every
  container of the project, so it is never a cleanup command;
- a removal by name or name pattern alone (`docker rm -f adulis-test-pg` without the label check);
- `docker rm -v` on a container that mounts a named volume or a bind mount.

Leftovers are removed by full ID, one resource at a time, after the checks below, and each removal is
recorded in the run's evidence: ID, labels, creation time, the command and the time.

## 2. A script's own teardown

**A script's own teardown of the resources it created is governed by that script, its tests and its
work order, not by sections 3 to 6.** That covers:

- the failure cleanup and teardown of the same run, by the IDs or run-unique names the script holds:
  - `test-db.sh`'s ERR and INT traps and its `--rm` containers, which take their anonymous volumes
    with them;
  - `minio-migrate.mjs`'s run helpers (`minio-migrate-<run>-*` containers, networks and scratch
    volume), its measure container, and its undo of the target volume the same run created;
- the creating script's documented teardown command, which removes only what carries its own owner
  label for this owner. Example: `test-db.sh down`, which refuses a container with a bind mount or a
  named volume.

Sections 3 to 6 govern **leftovers**: what such a teardown did not remove (a killed run, a crash), and
any removal by anyone else.

## 3. Protected: never removed by a script or an agent

| Resource | Why |
|---|---|
| **The whole compose project `adulis-platform`**: every container (`adulis-postgres`, `adulis-minio`, `adulis-minio-volume-guard`, `adulis-minio-init`, and any other), its networks (`adulis-platform_default`) and its volumes | The persistent development stack |
| Volume `adulis-platform_adulis-pgdata` | The development PostgreSQL data |
| Volume `adulis-pgdata` | The legacy volume that still holds MinIO's data until the MinIO move (INF-04); never delete |
| Volume `adulis-platform_adulis-miniodata` (once created by the move) | MinIO's data after the move |
| **Every `nac-trial*` container and volume** | Another organisation's stack, not Adulis's |
| Containers `adulis-final-check` and `welcome-to-docker` | Not created by a recorded disposable run |
| **Any anonymous volume attached to any container above** | It belongs to that container |
| Any resource carrying `com.docker.compose.*` labels of a project other than a disposable Adulis run's | Another project's |
| Any resource named in a work order's record or move record | Evidence |
| Networks `bridge`, `host`, `none` | Docker's own |

Only a founder work order that names the resource can change this.

## 4. Labelled resources

A disposable resource carries an **owner label** from the moment it is created. The owner label is the
only thing that lets a cleanup act on a leftover without further proof.

| Label | Set by | Value |
|---|---|---|
| `adulis.test-db.owner` (+ `adulis.test-db.role=disposable`) | `ops/scripts/test-db.sh up` | the checkout that ran it (or `ADULIS_TEST_DB_OWNER`) |
| `adulis.inf04.owner` | the INF-04 rehearsal scripts (`rh04.sh`, `restore-test.sh`, outside the repository); also compose project `inf04r` | `INF-04` |
| `adulis.inf-close-01.owner` | the INF-CLOSE-01 scripts (`disposable-restore.sh`, `repair-rehearsal.sh`, outside the repository) | `INF-CLOSE-01` |

A cleanup may remove a labelled leftover only when all of these hold:

1. the label's value is the caller's own owner value (a checkout path, or the work order ID);
2. the run that created it has ended (no process of that run is still using it);
3. for a container: it mounts no bind mount and no named volume;
4. it is not protected (section 3);
5. the removal is recorded (section 1).

**Future labels.** A new work order that creates Docker resources uses
`adulis.<work-order-id-in-lowercase>.owner=<WORK-ORDER-ID>` on every container, volume and network it
creates. It adds a row to the table above in the same PR as the script that sets it.

A volume that a container creates implicitly (an image's `VOLUME`, such as PostgreSQL's data
directory) carries no label unless the script creates it labelled. For example:
`--mount type=volume,dst=/var/lib/postgresql/data,volume-label=adulis.test-db.owner=<owner>`. That
must be verified in a disposable run before a script relies on it.

## 5. Unlabelled anonymous volumes

An anonymous volume has a 64-hex-digit name, the label `com.docker.volume.anonymous`, and no owner.
They appear when a `--rm` container is removed without its volumes. After a Docker Desktop crash, the
daemon's own cleanup does exactly that.

**Default: register it, leave it alone, and ask the founder. No cleanup script removes an unlabelled
volume.**

An agent may remove one only with **all** of this evidence, **written down before the removal**:

1. **Not attached:** `docker ps -a --filter volume=<name>` lists no container, running or stopped.
2. **Created by a disposable container:** the volume's `CreatedAt` matches, to the millisecond, a
   create event of a container that **itself carried a disposable owner label** (section 4), and that
   container is named in the run's own record. The event comes from the Docker Desktop API log or the
   run's own log, and it is the only container create in that window. A creation by an unlabelled,
   protected or other-project container disqualifies the volume.
3. **Content consistent with that run, and only as corroboration** (content type alone is never
   sufficient):
   - Take the listing with a helper that cannot write or reach the network, and only after
     `docker volume inspect <name>` succeeds:
     `docker run --rm --pull never --network none --read-only --mount type=volume,src=<name>,dst=/d,readonly,volume-nocopy <image already present> ls /d`.
   - For a PostgreSQL data directory, the helper also reads its system identifier with the image's
     `pg_controldata`. It must differ from the development cluster's, as recorded in the INF evidence.
4. **Not protected:** no `com.docker.compose.*` labels of another project, and not attached to or
   created by any container in section 3.
5. **Authority:** a work order that names this removal, or the founder's approval of it.

If any item is missing or in doubt, the volume stays, in the register.

**The precedent.** INF-CLOSE-01 removed anonymous volume `75e3a44f2995...ddb6`:
- unused;
- created at 2026-11-16T15:30:31Z;
- looked up in Docker Desktop's API log 37 ms after INF-04's `create adulis-test-pg`, the `--rm`
  disposable whose post-crash removal left it behind;
- a PostgreSQL 17 data directory of 75 MB.

Evidence: INF-CLOSE-01 `evidence/extra-volume.txt`. That removal **predates this policy**, and it
does not meet the bar above:
- the API-log tie was recorded by a review after the removal, not before it;
- no explicit authority (item 5) is recorded;
- no system identifier was compared.

It shows the kind of proof required. It is not a licence to repeat a removal without the full proof.

## 6. Abandoned containers

- **Labelled:** section 4.
- **Protected** (section 3): never.
- **Unlabelled:**
  - Register it. Identify it read-only from its image, creation time, compose labels
    (`com.docker.compose.project`, `com.docker.compose.service`), mounts and command.
  - Removal needs the founder's approval, or a work order naming it, plus evidence equivalent to
    section 5: stopped, no container depends on it, and created by a recorded disposable run.
  - Remove it **without** `-v`. Any anonymous volume it leaves is then judged under section 5 on its
    own.
- **Never** remove a container that mounts a named volume or a bind mount without the founder.
- **Never** start, restart, recreate or `docker compose up` anything to find out what it is.

## 7. Networks

- A network is removed only with `docker network rm <id>`, and only when **both** hold:
  - it carries a disposable owner label for the caller's run (section 4);
  - `docker network inspect <id>` shows no attached container.
- Every other network (unlabelled, a compose project's, or protected) is registered and left alone.

## 8. The register and the read-only listing

When proof is missing, the resource is written to the current work order's evidence, in a file such as
`<work order>\evidence\docker-register-<date>.txt`, one line per resource:
`kind | ID or name | created | labels | mounts or attached containers | in use? | suspected owner | evidence | decision needed`.

These commands only read. They are the whole listing a cleanup needs:

```
docker ps -a --no-trunc --format '{{.ID}} {{.Names}} {{.Image}} {{.CreatedAt}} {{.Status}} {{.Labels}} {{.Mounts}}'
docker volume ls --format '{{.Name}} {{.Driver}} {{.Labels}}'
docker volume inspect --format '{{.Name}} {{.CreatedAt}} {{.Labels}}' <volume>
docker ps -a --filter volume=<volume> --format '{{.ID}} {{.Names}}'
docker network ls --no-trunc --format '{{.ID}} {{.Name}} {{.Driver}} {{.Labels}}'
docker network inspect --format '{{.Name}} {{.Created}} {{range $k, $v := .Containers}}{{$v.Name}} {{end}}' <network>
```

`ops/scripts/postcrash-health.sh` reports these leftovers after a crash, and removes nothing:
- `adulis.test-db.owner` and `adulis.inf04.owner` containers;
- `inf04*` and `minio-migrate*` containers and volumes;
- `inf04*` networks.

## 9. Not covered

- **Images**, including the old MinIO image `14cea493...` and its saved copies: never removed by a
  cleanup.
- **Backups and evidence on disk:** never deleted, moved or overwritten by a cleanup.
- **CI:** GitHub-hosted runners are discarded after each job. This policy is for development machines.
