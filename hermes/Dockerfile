# Kairoq's Hermes service: the official, unmodified Hermes Agent image plus
# Kairoq's locked-down config and a small start wrapper. Build context: repo root
# (Railway: config file path hermes/railway.json).
#
# Pinned to the latest stable Hermes release. To upgrade, change HERMES_TAG,
# update _config_version in config.yaml to that release's value, run the checks
# in docs/HERMES.md, and record the new revision in UPSTREAM.md.
ARG HERMES_TAG=v2026.9.24
FROM nousresearch/hermes-agent:${HERMES_TAG}

USER root
COPY hermes/config.yaml /opt/kairoq/config.yaml
COPY --chmod=0755 hermes/entrypoint.sh /opt/kairoq/entrypoint.sh
# Skill libraries (Superpowers, Impeccable, Hallmark). Root-owned and read-only: Hermes runs as the hermes
# user, so it can read and follow them but cannot rewrite them.
COPY hermes/skills /opt/kairoq/skills
RUN chown -R root:root /opt/kairoq/skills && chmod -R a+rX,go-w /opt/kairoq/skills && find /opt/kairoq/skills -type f -exec chmod a-w {} +

ENV HERMES_HOME=/opt/data
EXPOSE 8642
ENTRYPOINT ["/opt/kairoq/entrypoint.sh"]
CMD []
