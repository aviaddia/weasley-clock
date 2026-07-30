pipeline {
  agent {
    kubernetes {
      defaultContainer 'node'
      yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: weasley-ci-agent
spec:
  serviceAccountName: jenkins
  containers:
    - name: node
      image: node:20-alpine
      command: ['cat']
      tty: true
    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command: ['cat']
      tty: true
'''
    }
  }

  parameters {
    string(name: 'REGISTRY_HOST', defaultValue: 'local-registry.registry.svc.cluster.local:5000', description: 'In-cluster registry host:port')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Optional explicit tag; empty uses BUILD_NUMBER')
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Unit Tests') {
      parallel {
        stage('Backend Tests') {
          steps {
            container('node') {
              dir('backend') {
                sh 'npm ci'
                sh 'npm run test:ci'
              }
            }
          }
          post {
            always {
              junit 'backend/test-results/junit.xml'
            }
          }
        }

        stage('Frontend Tests') {
          steps {
            container('node') {
              dir('frontend') {
                sh 'npm ci'
                sh 'npm run test:ci'
              }
            }
          }
          post {
            always {
              junit 'frontend/test-results/junit.xml'
            }
          }
        }
      }
    }

    stage('Build And Push To Local Registry') {
      steps {
        container('kaniko') {
          sh '''
            set -eu

            TAG="${IMAGE_TAG:-$BUILD_NUMBER}"
            REGISTRY="${REGISTRY_HOST}"

            BACKEND_IMAGE="${REGISTRY}/weasley-backend:${TAG}"
            FRONTEND_IMAGE="${REGISTRY}/weasley-frontend:${TAG}"

            /kaniko/executor \
              --context "$WORKSPACE/backend" \
              --dockerfile "$WORKSPACE/backend/Dockerfile" \
              --destination "${BACKEND_IMAGE}" \
              --insecure \
              --skip-tls-verify \
              --insecure-pull

            /kaniko/executor \
              --context "$WORKSPACE/frontend" \
              --dockerfile "$WORKSPACE/frontend/Dockerfile" \
              --destination "${FRONTEND_IMAGE}" \
              --insecure \
              --skip-tls-verify \
              --insecure-pull

            mkdir -p image-artifacts
            echo "${BACKEND_IMAGE}" > image-artifacts/backend-image.txt
            echo "${FRONTEND_IMAGE}" > image-artifacts/frontend-image.txt
          '''
        }
      }
    }
  }

  post {
    success {
      echo 'CI complete: tests passed and images pushed to local in-cluster registry.'
    }
    always {
      script {
        try {
          archiveArtifacts artifacts: 'image-artifacts/*.txt', onlyIfSuccessful: false
        } catch (err) {
          echo "Skipping artifact archive (no workspace context): ${err.message}"
        }
      }
    }
  }
}
