pipeline {
  agent any

  parameters {
    string(name: 'IMAGE_REGISTRY', defaultValue: 'your-ecr-account.dkr.ecr.eu-west-1.amazonaws.com', description: 'Container image registry (ECR URL)')
    string(name: 'AWS_REGION',     defaultValue: 'eu-west-1',     description: 'AWS region for ECR / EKS')
    string(name: 'EKS_CLUSTER',    defaultValue: 'my-cluster',    description: 'EKS cluster name')
    string(name: 'HELM_NAMESPACE', defaultValue: 'weasley',       description: 'Kubernetes namespace')
    string(name: 'HELM_RELEASE',   defaultValue: 'weasley-clock', description: 'Helm release name')
    booleanParam(name: 'SKIP_DEPLOY', defaultValue: false,        description: 'Build & test only – skip ECR push and EKS deploy')
  }

  environment {
    IMAGE_TAG    = "${env.BUILD_NUMBER}"
    BACKEND_IMG  = "${params.IMAGE_REGISTRY}/weasley-backend:${env.BUILD_NUMBER}"
    FRONTEND_IMG = "${params.IMAGE_REGISTRY}/weasley-frontend:${env.BUILD_NUMBER}"
    // JUnit XML destinations (written inside workspace)
    BACKEND_TEST_RESULTS  = "backend/test-results"
    FRONTEND_TEST_RESULTS = "frontend/test-results"
  }

  options {
    timeout(time: 30, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
  }

  stages {

    // ── 1. Checkout ────────────────────────────────────────────
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // ── 2. Unit Tests (parallel, run inside Docker – no Node needed on agent) ──
    stage('Unit Tests') {
      parallel {

        stage('Backend Tests') {
          steps {
            sh """
              mkdir -p ${BACKEND_TEST_RESULTS}
              docker run --rm \
                -v "\${WORKSPACE}/backend:/app" \
                -w /app \
                -e JEST_JUNIT_OUTPUT_DIR=/app/test-results \
                -e JEST_JUNIT_OUTPUT_NAME=junit.xml \
                node:20-alpine \
                sh -c "npm ci && npm run test:ci"
            """
          }
          post {
            always {
              junit "${BACKEND_TEST_RESULTS}/junit.xml"
            }
          }
        }

        stage('Frontend Tests') {
          steps {
            sh """
              mkdir -p ${FRONTEND_TEST_RESULTS}
              docker run --rm \
                -v "\${WORKSPACE}/frontend:/app" \
                -w /app \
                node:20-alpine \
                sh -c "npm ci && npm run test:ci"
            """
          }
          post {
            always {
              junit "${FRONTEND_TEST_RESULTS}/junit.xml"
            }
          }
        }

      }
    }

    // ── 3. Build Docker Images (parallel) ─────────────────────
    stage('Build Images') {
      parallel {

        stage('Build Backend') {
          steps {
            sh "docker build -t ${env.BACKEND_IMG} backend/"
          }
        }

        stage('Build Frontend') {
          steps {
            sh "docker build -t ${env.FRONTEND_IMG} frontend/"
          }
        }

      }
    }

    // ── 4. Push to ECR ─────────────────────────────────────────
    stage('Push to ECR') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-ecr-credentials'
        ]]) {
          sh """
            aws ecr get-login-password --region ${params.AWS_REGION} \
              | docker login --username AWS --password-stdin ${params.IMAGE_REGISTRY}
            docker push ${env.BACKEND_IMG}
            docker push ${env.FRONTEND_IMG}
          """
        }
      }
    }

    // ── 5. Deploy to EKS via Helm ──────────────────────────────
    stage('Deploy to EKS') {
      when {
        expression { !params.SKIP_DEPLOY }
      }
      steps {
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-ecr-credentials'
        ]]) {
          sh """
            aws eks update-kubeconfig \
              --region ${params.AWS_REGION} \
              --name ${params.EKS_CLUSTER}

            kubectl create namespace ${params.HELM_NAMESPACE} \
              --dry-run=client -o yaml | kubectl apply -f -

            helm upgrade --install ${params.HELM_RELEASE} ./helm \
              --namespace ${params.HELM_NAMESPACE} \
              --set imageRegistry=${params.IMAGE_REGISTRY} \
              --set imageTag=${env.IMAGE_TAG} \
              --atomic \
              --timeout 5m
          """
        }
      }
    }

  }

  post {
    success {
      script {
        if (!params.SKIP_DEPLOY) {
          echo "✔ Deployed weasley-clock:${env.IMAGE_TAG} → ${params.EKS_CLUSTER}/${params.HELM_NAMESPACE}"
        } else {
          echo "✔ Build & tests passed (deploy skipped)"
        }
      }
    }
    failure {
      echo '✘ Pipeline failed – check test results and logs above.'
    }
    always {
      // Free disk space on the build agent
      sh """
        docker rmi ${env.BACKEND_IMG}  || true
        docker rmi ${env.FRONTEND_IMG} || true
      """
    }
  }
}
