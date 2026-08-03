pipeline {
    agent none

    options {
        skipDefaultCheckout(true)
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '30'))
        timeout(time: 30, unit: 'MINUTES')
    }

    parameters {
        string(
            name: 'REPO_URL',
            defaultValue: 'https://github.com/aviaddia/weasley-clock.git',
            description: 'Application repository URL'
        )
        string(
            name: 'GIT_BRANCH',
            defaultValue: 'main',
            description: 'Branch to build'
        )
        string(
            name: 'LOCAL_REGISTRY',
            defaultValue: 'local-registry.registry.svc.cluster.local:5000',
            description: 'Local Docker registry address'
        )
        booleanParam(
            name: 'TRIGGER_CD',
            defaultValue: true,
            description: 'Trigger CD job after successful build'
        )
        string(
            name: 'CD_JOB_NAME',
            defaultValue: 'weasley-clock-deploy',
            description: 'Downstream CD job name'
        )
    }

    environment {
        BACKEND_IMAGE  = "weasley-clock-backend"
        FRONTEND_IMAGE = "weasley-clock-frontend"
    }

    stages {
        stage('Checkout') {
            agent { label 'workshop-agent-small' }
            steps {
                deleteDir()
                git url: params.REPO_URL, branch: params.GIT_BRANCH
                sh 'git --no-pager log -1 --pretty=format:"Commit: %H%nAuthor: %an%nMessage: %s%n"'
                stash name: 'source', includes: '**'
            }
        }

        stage('Backend CI') {
            agent { label 'workshop-agent-small' }
            stages {
                stage('Backend Install') {
                    steps {
                        deleteDir()
                        unstash 'source'
                        dir('backend') {
                            sh '''#!/usr/bin/env bash
set -euo pipefail
if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi
'''
                        }
                    }
                }
                stage('Backend Lint') {
                    steps {
                        dir('backend') {
                            sh 'npx --yes eslint . --no-eslintrc --env node --env es2021 --parser-options=ecmaVersion:2021 || echo "Lint completed with warnings"'
                        }
                    }
                }
                stage('Backend Unit Tests') {
                    steps {
                        dir('backend') {
                            catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                                sh 'npm test'
                            }
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'backend/test-results/junit.xml'
                        }
                    }
                }
            }
        }

        stage('Frontend CI') {
            agent { label 'workshop-agent-small' }
            stages {
                stage('Frontend Install') {
                    steps {
                        deleteDir()
                        unstash 'source'
                        dir('frontend') {
                            sh '''#!/usr/bin/env bash
set -euo pipefail
if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi
'''
                        }
                    }
                }
                stage('Frontend Lint') {
                    steps {
                        dir('frontend') {
                            sh 'npx --yes eslint . --no-eslintrc --env browser --env es2021 --parser-options=ecmaVersion:2021,ecmaFeatures:{jsx:true} || echo "Lint completed with warnings"'
                        }
                    }
                }
                stage('Frontend Unit Tests') {
                    steps {
                        dir('frontend') {
                            catchError(buildResult: 'UNSTABLE', stageResult: 'FAILURE') {
                                sh 'npm test'
                            }
                        }
                    }
                    post {
                        always {
                            junit allowEmptyResults: true, testResults: 'frontend/test-results/junit.xml'
                        }
                    }
                }
            }
        }

        stage('Build & Push Docker Images') {
            agent {
                kubernetes {
                    defaultContainer 'kaniko'
                    yaml '''
apiVersion: v1
kind: Pod
spec:
  serviceAccountName: jenkins
  containers:
        - name: kaniko
            image: gcr.io/kaniko-project/executor:v1.23.2-debug
            command:
                - /busybox/tail
            args:
                - "-f"
                - "/dev/null"
            tty: true
            resources:
                requests:
                    cpu: "500m"
                    memory: "1Gi"
                limits:
                    cpu: "2000m"
                    memory: "4Gi"
'''
                }
            }
            steps {
                deleteDir()
                unstash 'source'
                container('kaniko') {
                    sh """#!/busybox/sh
set -eu

echo "Kaniko PID1: \$(tr '\\0' ' ' </proc/1/cmdline)"

echo Building backend image with Kaniko
/kaniko/executor \
  --context \"${WORKSPACE}/backend\" \
  --dockerfile \"${WORKSPACE}/backend/Dockerfile\" \
  --destination \"${params.LOCAL_REGISTRY}/${env.BACKEND_IMAGE}:${BUILD_NUMBER}\" \
  --destination \"${params.LOCAL_REGISTRY}/${env.BACKEND_IMAGE}:latest\" \
  --insecure \
  --skip-tls-verify \
  --insecure-pull

echo Building frontend image with Kaniko
/kaniko/executor \
  --context \"${WORKSPACE}/frontend\" \
  --dockerfile \"${WORKSPACE}/frontend/Dockerfile\" \
  --destination \"${params.LOCAL_REGISTRY}/${env.FRONTEND_IMAGE}:${BUILD_NUMBER}\" \
  --destination \"${params.LOCAL_REGISTRY}/${env.FRONTEND_IMAGE}:latest\" \
  --insecure \
  --skip-tls-verify \
  --insecure-pull
"""
                }
            }
        }

        stage('Trigger CD') {
            agent none
            when {
                expression { params.TRIGGER_CD }
            }
            steps {
                script {
                    build(
                        job: params.CD_JOB_NAME,
                        wait: true,
                        propagate: true,
                        parameters: [
                            string(name: 'IMAGE_REGISTRY', value: params.LOCAL_REGISTRY),
                            string(name: 'IMAGE_TAG', value: "${BUILD_NUMBER}"),
                            string(name: 'K8S_NAMESPACE', value: 'production'),
                            string(name: 'AWS_REGION', value: 'il-central-1'),
                            string(name: 'EKS_CLUSTER_NAME', value: 'jenkins-workshop')
                        ]
                    )
                }
            }
        }
    }

    post {
        success {
            echo "CI completed successfully. Images pushed to local registry."
        }
        unsuccessful {
            echo "CI failed. Review the failed stage output."
        }
    }
}
