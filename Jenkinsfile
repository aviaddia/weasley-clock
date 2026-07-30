pipeline {
  agent any

  parameters {
    string(name: 'IMAGE_REGISTRY',  defaultValue: 'your-ecr-account.dkr.ecr.eu-west-1.amazonaws.com', description: 'Container image registry')
    string(name: 'AWS_REGION',      defaultValue: 'eu-west-1',  description: 'AWS region for ECR auth')
    string(name: 'EKS_CLUSTER',     defaultValue: 'my-cluster', description: 'EKS cluster name')
    string(name: 'HELM_NAMESPACE',  defaultValue: 'weasley',    description: 'Kubernetes namespace')
    string(name: 'HELM_RELEASE',    defaultValue: 'weasley-clock', description: 'Helm release name')
  }

  environment {
    IMAGE_TAG     = "${env.BUILD_NUMBER}"
    BACKEND_IMG   = "${params.IMAGE_REGISTRY}/weasley-backend:${env.BUILD_NUMBER}"
    FRONTEND_IMG  = "${params.IMAGE_REGISTRY}/weasley-frontend:${env.BUILD_NUMBER}"
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // ── Build Docker images ────────────────────────────────────
    stage('Build Backend') {
      steps {
        dir('backend') {
          sh "docker build -t ${env.BACKEND_IMG} ."
        }
      }
    }

    stage('Build Frontend') {
      steps {
        dir('frontend') {
          sh "docker build -t ${env.FRONTEND_IMG} ."
        }
      }
    }

    // ── Push to ECR ────────────────────────────────────────────
    stage('Push Images') {
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

    // ── Deploy to EKS via Helm ─────────────────────────────────
    stage('Deploy') {
      steps {
        withCredentials([[
          $class: 'AmazonWebServicesCredentialsBinding',
          credentialsId: 'aws-ecr-credentials'
        ]]) {
          sh """
            aws eks update-kubeconfig \
              --region ${params.AWS_REGION} \
              --name ${params.EKS_CLUSTER}

            kubectl create namespace ${params.HELM_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -

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
      echo "Deployed weasley-clock:${env.IMAGE_TAG} to ${params.EKS_CLUSTER}"
    }
    failure {
      echo 'Build or deploy failed – check logs above.'
    }
    always {
      // Clean up local images to save disk space on the build agent
      sh """
        docker rmi ${env.BACKEND_IMG}  || true
        docker rmi ${env.FRONTEND_IMG} || true
      """
    }
  }
}
