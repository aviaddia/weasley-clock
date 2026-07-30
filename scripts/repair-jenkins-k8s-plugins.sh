#!/usr/bin/env bash
set -euo pipefail

# Repairs Jenkins Kubernetes agent plugin mismatch errors like:
# NoSuchMethodError in io.fabric8.kubernetes.client.ConfigBuilder.withMasterUrl
#
# Required env vars:
#   JENKINS_URL
#   JENKINS_USER
#   JENKINS_TOKEN
# Optional:
#   JENKINS_CLI_TRANSPORT=http|websocket (default: http)

: "${JENKINS_URL:?JENKINS_URL is required}"
: "${JENKINS_USER:?JENKINS_USER is required}"
: "${JENKINS_TOKEN:?JENKINS_TOKEN is required}"

JENKINS_CLI_TRANSPORT="${JENKINS_CLI_TRANSPORT:-http}"
CLI_JAR="/tmp/jenkins-cli.jar"

log() { echo "==> $*"; }

jenkins_cli() {
  case "${JENKINS_CLI_TRANSPORT}" in
    http)
      java -jar "${CLI_JAR}" -http -s "${JENKINS_URL}" -auth "${JENKINS_USER}:${JENKINS_TOKEN}" "$@"
      ;;
    websocket)
      java -jar "${CLI_JAR}" -webSocket -s "${JENKINS_URL}" -auth "${JENKINS_USER}:${JENKINS_TOKEN}" "$@"
      ;;
    *)
      echo "Unsupported JENKINS_CLI_TRANSPORT=${JENKINS_CLI_TRANSPORT}" >&2
      exit 2
      ;;
  esac
}

log "Downloading Jenkins CLI jar"
curl -fsSL "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" -o "${CLI_JAR}"
jenkins_cli version

log "Current plugin versions (before)"
jenkins_cli list-plugins | grep -E '^(kubernetes|kubernetes-client-api|kubernetes-credentials|git|workflow-aggregator|workflow-durable-task-step|durable-task|junit)\b' || true

log "Upgrading Kubernetes plugin bundle in one transaction"
jenkins_cli install-plugin \
  kubernetes \
  kubernetes-client-api \
  kubernetes-credentials \
  credentials \
  plain-credentials \
  ssh-credentials \
  variant \
  jackson2-api \
  gson-api \
  okhttp-api \
  workflow-aggregator \
  workflow-durable-task-step \
  durable-task \
  git \
  junit \
  --restart

log "Waiting for Jenkins to come back"
for i in $(seq 1 90); do
  if curl -fsS "${JENKINS_URL}/login" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

curl -fsSL "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" -o "${CLI_JAR}"
jenkins_cli version

log "Plugin versions (after)"
jenkins_cli list-plugins | grep -E '^(kubernetes|kubernetes-client-api|kubernetes-credentials|git|workflow-aggregator|workflow-durable-task-step|durable-task|junit)\b' || true

cat <<OUT

Repair complete.
Now retry your Jenkins build.
If an old offline agent remains, delete it once from Jenkins UI and re-run.
OUT
