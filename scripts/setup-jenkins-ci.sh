#!/usr/bin/env bash
set -euo pipefail

# Run from Linux EC2 with kubectl access to EKS.
# Required env vars:
#   JENKINS_URL       (example: http://<elb>:8080)
#   JENKINS_USER      (example: admin)
#   JENKINS_TOKEN     (API token)
# Optional env vars:
#   JENKINS_NAMESPACE (default: jenkins)
#   AGENT_NAMESPACE   (default: jenkins)
#   JOB_NAME          (default: weasley-clock-ci)
#   REPO_URL          (default: https://github.com/aviaddia/weasley-clock.git)
#   BRANCH            (default: main)

: "${JENKINS_URL:?JENKINS_URL is required}"
: "${JENKINS_USER:?JENKINS_USER is required}"
: "${JENKINS_TOKEN:?JENKINS_TOKEN is required}"

JENKINS_NAMESPACE="${JENKINS_NAMESPACE:-jenkins}"
AGENT_NAMESPACE="${AGENT_NAMESPACE:-jenkins}"
JOB_NAME="${JOB_NAME:-weasley-clock-ci}"
REPO_URL="${REPO_URL:-https://github.com/aviaddia/weasley-clock.git}"
BRANCH="${BRANCH:-main}"
JENKINS_CLI_TRANSPORT="${JENKINS_CLI_TRANSPORT:-http}"
CLI_JAR="/tmp/jenkins-cli.jar"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

log() {
  echo "==> $*"
}

jenkins_cli() {
  case "${JENKINS_CLI_TRANSPORT}" in
    http)
      java -jar "${CLI_JAR}" -http -s "${JENKINS_URL}" -auth "${JENKINS_USER}:${JENKINS_TOKEN}" "$@"
      ;;
    websocket)
      java -jar "${CLI_JAR}" -webSocket -s "${JENKINS_URL}" -auth "${JENKINS_USER}:${JENKINS_TOKEN}" "$@"
      ;;
    *)
      echo "Unsupported JENKINS_CLI_TRANSPORT='${JENKINS_CLI_TRANSPORT}'. Use 'http' or 'websocket'." >&2
      exit 2
      ;;
  esac
}

log "Applying in-cluster local registry resources"
kubectl apply -f "${SCRIPT_DIR}/local-registry.yaml"
kubectl -n registry rollout status deployment/local-registry --timeout=120s

log "Applying Jenkins agent RBAC"
kubectl apply -f "${SCRIPT_DIR}/jenkins-agent-rbac.yaml"

log "Configuring EKS nodes to trust local registry (for CD image pulls)"
kubectl apply -f "${SCRIPT_DIR}/enable-local-registry-on-nodes.yaml"
kubectl -n kube-system rollout status daemonset/configure-local-registry --timeout=180s

log "Downloading Jenkins CLI jar"
curl -fsSL "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" -o "${CLI_JAR}"
jenkins_cli version

log "Installing required Jenkins plugins (idempotent)"
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
  --restart || true

log "Waiting for Jenkins to restart"
sleep 45
curl -fsSL "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" -o "${CLI_JAR}"
jenkins_cli version

log "Configuring Kubernetes cloud in Jenkins"
jenkins_cli groovy = <<GROOVY
import jenkins.model.Jenkins
import org.csanchez.jenkins.plugins.kubernetes.KubernetesCloud

def j = Jenkins.get()
def cloudName = "eks-k8s"

j.clouds.removeAll { it instanceof KubernetesCloud && it.name == cloudName }

def c = new KubernetesCloud(cloudName)
c.setServerUrl("")
c.setNamespace("${AGENT_NAMESPACE}")
c.setJenkinsUrl("http://jenkins.${JENKINS_NAMESPACE}.svc.cluster.local:8080")
c.setJenkinsTunnel("jenkins-agent.${JENKINS_NAMESPACE}.svc.cluster.local:50000")
c.setContainerCapStr("20")

j.clouds.add(c)
j.save()
println("Configured cloud: " + cloudName)
GROOVY

log "Creating or updating pipeline job"
JOB_XML=$(cat <<XML
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job">
  <description>CI for Weasley Clock: tests + build + push to local in-cluster registry</description>
  <keepDependencies>false</keepDependencies>
  <properties>
    <org.jenkinsci.plugins.workflow.job.properties.DisableConcurrentBuildsJobProperty/>
  </properties>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
    <scm class="hudson.plugins.git.GitSCM" plugin="git">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${REPO_URL}</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/${BRANCH}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <extensions/>
    </scm>
    <scriptPath>Jenkinsfile</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
XML
)

if jenkins_cli get-job "${JOB_NAME}" >/dev/null 2>&1; then
  printf "%s" "${JOB_XML}" | jenkins_cli update-job "${JOB_NAME}"
  log "Updated job: ${JOB_NAME}"
else
  printf "%s" "${JOB_XML}" | jenkins_cli create-job "${JOB_NAME}"
  log "Created job: ${JOB_NAME}"
fi

log "Triggering initial build"
jenkins_cli build "${JOB_NAME}" -s -v

cat <<OUT

Done.
Jenkins job: ${JENKINS_URL}/job/${JOB_NAME}
Registry API: http://local-registry.registry.svc.cluster.local:5000/v2/_catalog

For your CD pipeline, use image names:
  local-registry.registry.svc.cluster.local:5000/weasley-backend:<tag>
  local-registry.registry.svc.cluster.local:5000/weasley-frontend:<tag>
OUT
