# Edition workflow

`main` contains the free edition: no account storage quota, paid tiers or checkout integration. Its public repository starts from a clean initial snapshot, excluding the earlier history containing agent metadata and any subscription implementation.

The subscription edition is preserved on the local `codex/subscriptions` branch and is published separately to the `subscriptions-private` remote. That remote must stay private. A Git branch is not an access-control boundary inside a shared repository.

Keep fixes to shared notebook features small enough to cherry-pick from `main` into the other edition. Do not merge the subscription branch into `main`: doing so would put private implementation commits into the free branch's reachable history even if a later commit removed the files. Never publish all branches with `--all` or `--mirror` to a public remote.

Use a separate installation, environment configuration and database for each edition. Git does not switch ignored `.env`, `.setup`, service credentials or database contents. These editions have different migration histories after the shared account-cleanup migrations; never run one edition's migrations against the other's database.

To update the subscription repository explicitly:

```sh
git push subscriptions-private codex/subscriptions:main
```

The free branch is published to the public `origin` repository, separately from `subscriptions-private`. Push only `main` there. Before any public push, confirm that the subscription commit is not an ancestor of `main` and that no paid routes, models, settings or private credentials are tracked there. The project website is https://ntbk.ajmission.dev/.
