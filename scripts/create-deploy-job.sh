#!/usr/bin/env bash
set -euo pipefail

JENKINS_URL="${JENKINS_URL:-http://afed20e8af8bb4ccab37e5eb8214ce8f-2110692466.il-central-1.elb.amazonaws.com:8080}"
JOB_NAME="weasley-clock-deploy"
REPO_URL="https://github.com/aviaddia/weasley-clock.git"
GIT_BRANCH="main"
JENKINSFILE_PATH="Jenkinsfile-deploy"

ALLOW_INSECURE_HTTP="${ALLOW_INSECURE_HTTP:-true}"
UPDATE_EXISTING="${UPDATE_EXISTING:-true}"
RUN_BUILD="${RUN_BUILD:-false}"
JENKINS_CLI_MODE="${JENKINS_CLI_MODE:--http}"

JENKINS_URL="${JENKINS_URL%/}"

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

command -v curl >/dev/null 2>&1 || fail "curl is required."
command -v java >/dev/null 2>&1 || fail "Java is required."

[[ -n "${JENKINS_USER_ID:-}" ]] ||
    fail "Set JENKINS_USER_ID to your Jenkins username."

if [[ -z "${JENKINS_API_TOKEN:-}" ]]; then
    read -r -s -p "Jenkins API token for ${JENKINS_USER_ID}: " JENKINS_API_TOKEN
    printf '\n'
fi

[[ -n "$JENKINS_API_TOKEN" ]] || fail "The Jenkins API token must not be empty."

work_directory="$(mktemp -d)"
cli_jar="${work_directory}/jenkins-cli.jar"
auth_file="${work_directory}/jenkins-auth"
job_config="${work_directory}/job-config.xml"

cleanup() {
    rm -rf "$work_directory"
    unset JENKINS_API_TOKEN 2>/dev/null || true
}
trap cleanup EXIT

chmod 700 "$work_directory"
printf '%s:%s' "$JENKINS_USER_ID" "$JENKINS_API_TOKEN" > "$auth_file"
chmod 600 "$auth_file"
unset JENKINS_API_TOKEN

printf 'Downloading Jenkins CLI from %s...\n' "$JENKINS_URL"
curl \
    --fail --silent --show-error --location \
    --connect-timeout 10 --retry 2 \
    "${JENKINS_URL}/jnlpJars/jenkins-cli.jar" \
    --output "$cli_jar"

cat > "$job_config" <<XML
<?xml version='1.1' encoding='UTF-8'?>
<flow-definition>
  <actions/>
  <description>CD pipeline for Weasley Clock. Deploys backend and frontend to EKS via Helm using images from the local registry.</description>
  <keepDependencies>false</keepDependencies>
  <properties/>
  <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition">
    <scm class="hudson.plugins.git.GitSCM">
      <configVersion>2</configVersion>
      <userRemoteConfigs>
        <hudson.plugins.git.UserRemoteConfig>
          <url>${REPO_URL}</url>
        </hudson.plugins.git.UserRemoteConfig>
      </userRemoteConfigs>
      <branches>
        <hudson.plugins.git.BranchSpec>
          <name>*/${GIT_BRANCH}</name>
        </hudson.plugins.git.BranchSpec>
      </branches>
      <doGenerateSubmoduleConfigurations>false</doGenerateSubmoduleConfigurations>
      <submoduleCfg class="empty-list"/>
      <extensions/>
    </scm>
    <scriptPath>${JENKINSFILE_PATH}</scriptPath>
    <lightweight>true</lightweight>
  </definition>
  <triggers/>
  <disabled>false</disabled>
</flow-definition>
XML

jenkins_cli() {
    java -jar "$cli_jar" \
        -s "$JENKINS_URL" \
        "$JENKINS_CLI_MODE" \
        -auth "@${auth_file}" \
        "$@"
}

printf 'Verifying Jenkins authentication...\n'
jenkins_cli who-am-i

if jenkins_cli get-job "$JOB_NAME" >/dev/null 2>&1; then
    if [[ "$UPDATE_EXISTING" == "true" ]]; then
        printf 'Updating existing Jenkins job: %s\n' "$JOB_NAME"
        jenkins_cli update-job "$JOB_NAME" < "$job_config"
    else
        fail "Job '${JOB_NAME}' already exists. Set UPDATE_EXISTING=true to update it."
    fi
else
    printf 'Creating Jenkins job: %s\n' "$JOB_NAME"
    jenkins_cli create-job "$JOB_NAME" < "$job_config"
fi

printf '\nJob "%s" is ready at: %s/job/%s/\n' "$JOB_NAME" "$JENKINS_URL" "$JOB_NAME"
printf 'Pipeline loads Jenkinsfile-deploy from: %s (branch: %s)\n' "$REPO_URL" "$GIT_BRANCH"

if [[ "$RUN_BUILD" == "true" ]]; then
    printf 'Starting first build...\n'
    jenkins_cli build "$JOB_NAME" -s -v
else
    printf 'Job created. It will be triggered by the CI job or manually.\n'
fi
