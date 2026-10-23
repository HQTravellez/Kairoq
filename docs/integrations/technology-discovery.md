# Kairoq Technology Discovery Engine

Reference catalogs:
- https://github.com/ripienaar/free-for-dev — hosted free-tier service discovery.
- https://github.com/RunaCapital/awesome-oss-alternatives — OSS alternatives to commercial software.

This change introduces a dependency-free scoring engine accepting *independently verified* provider records. It does not scrape, clone, bundle, or redistribute the upstream catalogs. In particular, free-for-dev does not provide an explicit reusable content license; do not import its entire dataset into a commercial product without permission.

Suggested future pipeline: discover candidates via catalog links; visit official provider pages; independently verify licensing, pricing, quota, residency, maintenance and security; record evidence URL and verification date; compare managed/free and self-hosted alternatives; obtain user approval before installing/deploying any provider.

Release blockers: integrate discovery into Kairoq agent orchestration and UI, add official-source verification service and cache, test real recommendations and enforce security/secret-management gates. A ranking function is not a functioning autonomous discovery engine.
