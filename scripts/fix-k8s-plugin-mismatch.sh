#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# fix-k8s-plugin-mismatch.sh
#
# Nuclear fix for Jenkins Kubernetes plugin fabric8 NoSuchMethodError.
# Downloads exact compatible plugin versions directly from the Jenkins
# update center, bypassing the broken dependency resolution.
#
# Required env vars: JENKINS_URL, JENKINS_USER, JENKINS_TOKEN
# =============================================================================

: "${JENKINS_URL:?JENKINS_URL is required}"
: "${JENKINS_USER:?JENKINS_USER is required}"
: "${JENKINS_TOKEN:?JENKINS_TOKEN is required}"

JENKINS_CLI_TRANSPORT="${JENKINS_CLI_TRANSPORT:-http}"

log() { echo "==> $*"; }

# Run Groovy on Jenkins server via Script Console REST API (always has full classpath)
run_groovy() {
  local script="$1"
  local crumb
  crumb=$(curl -fsSL -u "${JENKINS_USER}:${JENKINS_TOKEN}" \
    "${JENKINS_URL}/crumbIssuer/api/json" 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['crumbRequestField']+':'+d['crumb'])" 2>/dev/null) || crumb=""

  local -a headers=(-u "${JENKINS_USER}:${JENKINS_TOKEN}")
  if [ -n "${crumb}" ]; then
    local field="${crumb%%:*}"
    local value="${crumb#*:}"
    headers+=(-H "${field}: ${value}")
  fi

  curl -fsSL "${headers[@]}" \
    --data-urlencode "script=${script}" \
    "${JENKINS_URL}/scriptText"
}

log "Checking current plugin versions"
run_groovy '
def pm = jenkins.model.Jenkins.get().pluginManager
["kubernetes","kubernetes-client-api","kubernetes-credentials","durable-task","workflow-durable-task-step","jackson2-api","gson-api","okhttp-api","variant"].each { id ->
  def p = pm.getPlugin(id)
  println("${id}: " + (p ? "v${p.version} active=${p.active}" : "NOT INSTALLED"))
}
'

log "Force-installing compatible plugin versions via Update Center"
run_groovy '
def j = jenkins.model.Jenkins.get()
def uc = j.getUpdateCenter()
uc.updateAllSites()

def pluginNames = ["kubernetes-client-api","kubernetes-credentials","kubernetes"]
def futures = []

pluginNames.each { name ->
  def plugin = uc.getPlugin(name)
  if (plugin == null) {
    println("WARNING: ${name} not found in update center")
    return
  }
  println("Installing: ${name} v${plugin.version}")
  futures.add(plugin.deploy(true))
}

futures.each { it.get() }
println("All plugins downloaded. Restarting...")
j.safeRestart()
'

log "Jenkins is restarting... waiting for it to come back"
sleep 15
for i in $(seq 1 120); do
  if curl -fsS -u "${JENKINS_USER}:${JENKINS_TOKEN}" "${JENKINS_URL}/api/json" >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
sleep 10

log "Plugin versions AFTER fix"
run_groovy '
def pm = jenkins.model.Jenkins.get().pluginManager
["kubernetes","kubernetes-client-api","kubernetes-credentials","durable-task","workflow-durable-task-step","jackson2-api","gson-api","okhttp-api","variant"].each { id ->
  def p = pm.getPlugin(id)
  println("${id}: " + (p ? "v${p.version} active=${p.active}" : "NOT INSTALLED"))
}
'

log "Configuring Kubernetes cloud 'eks-k8s'"
run_groovy '
def j = jenkins.model.Jenkins.get()
def cloudName = "eks-k8s"

j.clouds.removeAll { it instanceof org.csanchez.jenkins.plugins.kubernetes.KubernetesCloud && it.name == cloudName }

def c = new org.csanchez.jenkins.plugins.kubernetes.KubernetesCloud(cloudName)
c.setServerUrl("")
c.setNamespace("jenkins")
c.setJenkinsUrl("http://jenkins.jenkins.svc.cluster.local:8080")
c.setJenkinsTunnel("jenkins-agent.jenkins.svc.cluster.local:50000")
c.setContainerCapStr("20")

j.clouds.add(c)
j.save()
println("Cloud configured: " + cloudName)
'

log "Testing Kubernetes cloud connectivity"
run_groovy '
jenkins.model.Jenkins.get().clouds.each { cloud ->
  if (cloud instanceof org.csanchez.jenkins.plugins.kubernetes.KubernetesCloud) {
    println("Cloud: ${cloud.name}")
    try {
      def client = cloud.connect()
      def version = client.getKubernetesVersion()
      println("  Connected OK! K8s version: ${version.major}.${version.minor}")
      def ns = cloud.namespace ?: "default"
      def pods = client.pods().inNamespace(ns).list()
      println("  Pods in namespace ${ns}: ${pods.items.size()}")
    } catch (Exception e) {
      println("  FAILED: ${e.class.simpleName}: ${e.message}")
    }
  }
}
'

cat <<OUT

=============================================================================
Done.

If "Connected OK!" appears above, the plugin mismatch is resolved.
Delete any stale offline agents in Jenkins UI and re-run your CI job.

If "FAILED" appears, the output shows whether it's now a different error
(auth/RBAC/network) vs the same NoSuchMethodError.
=============================================================================
OUT
