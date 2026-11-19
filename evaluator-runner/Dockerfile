FROM node:24-bookworm-slim

ARG PNPM_VERSION=10.34.9

ENV PNPM_HOME=/usr/local/pnpm \
    PATH=/usr/local/pnpm:$PATH \
    CI=1 \
    NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates tini \
    && rm -rf /var/lib/apt/lists/* \
    && npm install --global "pnpm@${PNPM_VERSION}" \
    && npm cache clean --force

RUN useradd --create-home --uid 10001 --shell /bin/bash benchmark \
    && mkdir -p /workspace /artifacts /hidden-tests \
    && chown -R benchmark:benchmark /workspace /artifacts /hidden-tests

WORKDIR /workspace
USER benchmark

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["bash"]
