FROM ghcr.io/tashfeenahmed/freellmapi:latest

USER root
COPY freellmapi-railway/entrypoint.sh /usr/local/bin/kairoq-freellmapi-entrypoint.sh
COPY freellmapi-railway/sync-unified-key.cjs /opt/kairoq/sync-unified-key.cjs
RUN chmod 755 /usr/local/bin/kairoq-freellmapi-entrypoint.sh \
 && mkdir -p /opt/kairoq

ENTRYPOINT ["/usr/local/bin/kairoq-freellmapi-entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
