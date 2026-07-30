pipeline {
  agent {
    kubernetes {
      label 'weasley-ci'
      defaultContainer 'docker'
      yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: weasley-ci-agent
spec:
  serviceAccountName: jenkins
  containers:
    - name: docker
      image: docker:27.1.2-cli
      command: ['cat']
      tty: true
      env:
        - name: DOCKER_HOST
          value: tcp://localhost:2375
    - name: dind
      image: docker:27.1.2-dind
      securityContext:
        privileged: true
      args:
        - --host=tcp://0.0.0.0:2375
        - --tls=false
        - --insecure-registry=local-registry.registry.svc.cluster.local:5000
      env:
        - name: DOCKER_TLS_CERTDIR
          value: ""
    - name: node
      image: node:20-alpine
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
        container('docker') {
          sh '''
            set -eu

            TAG="${IMAGE_TAG:-$BUILD_NUMBER}"
            REGISTRY="${REGISTRY_HOST}"

            BACKEND_IMAGE="${REGISTRY}/weasley-backend:${TAG}"
            FRONTEND_IMAGE="${REGISTRY}/weasley-frontend:${TAG}"

            docker version

            docker build -t "${BACKEND_IMAGE}" backend/
            docker build -t "${FRONTEND_IMAGE}" frontend/

            docker push "${BACKEND_IMAGE}"
            docker push "${FRONTEND_IMAGE}"

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
