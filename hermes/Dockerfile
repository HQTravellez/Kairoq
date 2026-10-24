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

ENV HERMES_HOME=/opt/data
EXPOSE 8642
ENTRYPOINT ["/opt/kairoq/entrypoint.sh"]
CMD []
