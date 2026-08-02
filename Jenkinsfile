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
            defaultValue: 'weasley-clock-cd',
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
                            sh 'npm ci'
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
                            sh 'npm test'
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
                            sh 'npm ci'
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
                            sh 'npm test'
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
            agent { label 'workshop-agent-large' }
            stages {
                stage('Prepare') {
                    steps {
                        deleteDir()
                        unstash 'source'
                    }
                }
                stage('Build Backend Image') {
                    steps {
                        dir('backend') {
                            sh """
                                docker build \
                                  --tag ${env.BACKEND_IMAGE}:${BUILD_NUMBER} \
                                  --tag ${env.BACKEND_IMAGE}:latest \
                                  .
                            """
                        }
                    }
                }
                stage('Build Frontend Image') {
                    steps {
                        dir('frontend') {
                            sh """
                                docker build \
                                  --tag ${env.FRONTEND_IMAGE}:${BUILD_NUMBER} \
                                  --tag ${env.FRONTEND_IMAGE}:latest \
                                  .
                            """
                        }
                    }
                }
                stage('Push to Local Registry') {
                    steps {
                        sh """#!/usr/bin/env bash
set -euo pipefail

REGISTRY="${params.LOCAL_REGISTRY}"

# Tag and push backend
docker tag ${env.BACKEND_IMAGE}:${BUILD_NUMBER} \$REGISTRY/${env.BACKEND_IMAGE}:${BUILD_NUMBER}
docker tag ${env.BACKEND_IMAGE}:latest \$REGISTRY/${env.BACKEND_IMAGE}:latest
docker push \$REGISTRY/${env.BACKEND_IMAGE}:${BUILD_NUMBER}
docker push \$REGISTRY/${env.BACKEND_IMAGE}:latest

# Tag and push frontend
docker tag ${env.FRONTEND_IMAGE}:${BUILD_NUMBER} \$REGISTRY/${env.FRONTEND_IMAGE}:${BUILD_NUMBER}
docker tag ${env.FRONTEND_IMAGE}:latest \$REGISTRY/${env.FRONTEND_IMAGE}:latest
docker push \$REGISTRY/${env.FRONTEND_IMAGE}:${BUILD_NUMBER}
docker push \$REGISTRY/${env.FRONTEND_IMAGE}:latest

echo "Pushed images to \$REGISTRY"
"""
                    }
                }
            }
            post {
                always {
                    sh """
                        docker image rm -f ${env.BACKEND_IMAGE}:${BUILD_NUMBER} || true
                        docker image rm -f ${env.BACKEND_IMAGE}:latest || true
                        docker image rm -f ${env.FRONTEND_IMAGE}:${BUILD_NUMBER} || true
                        docker image rm -f ${env.FRONTEND_IMAGE}:latest || true
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
                    def registry = params.LOCAL_REGISTRY
                    build(
                        job: params.CD_JOB_NAME,
                        wait: true,
                        propagate: true,
                        parameters: [
                            booleanParam(name: 'USE_LOCAL_REGISTRY_LATEST', value: true),
                            string(name: 'APP_NAME', value: 'weasley-clock'),
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
