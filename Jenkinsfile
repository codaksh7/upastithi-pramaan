pipeline {
    agent any

    environment {
        DOCKERHUB_USER    = 'docaryan'
        BACKEND_IMAGE     = "${DOCKERHUB_USER}/upastithi-backend"
        FRONTEND_IMAGE    = "${DOCKERHUB_USER}/upastithi-frontend"
        DOCKERHUB_CREDS   = credentials('dockerhub-creds')
    }

    stages {

        stage('Checkout') {
            steps {
                echo 'Pulling code from GitHub...'
                checkout([
                    $class: 'GitSCM',
                    branches: [[name: '*/aryan']],
                    userRemoteConfigs: [[
                        url: 'https://github.com/codaksh7/upastithi-pramaan.git',
                        credentialsId: 'github-creds'
                    ]]
                ])
            }
        }

        stage('Build Backend Image') {
            steps {
                echo 'Building backend Docker image...'
                sh "docker build -t ${BACKEND_IMAGE}:${BUILD_NUMBER} ./backend"
                sh "docker tag ${BACKEND_IMAGE}:${BUILD_NUMBER} ${BACKEND_IMAGE}:latest"
            }
        }

        stage('Build Frontend Image') {
            steps {
                echo 'Building frontend Docker image...'
                sh "docker build -t ${FRONTEND_IMAGE}:${BUILD_NUMBER} ./frontend"
                sh "docker tag ${FRONTEND_IMAGE}:${BUILD_NUMBER} ${FRONTEND_IMAGE}:latest"
            }
        }

        stage('Push to Docker Hub') {
            steps {
                echo 'Pushing images to Docker Hub...'
                sh "echo ${DOCKERHUB_CREDS_PSW} | docker login -u ${DOCKERHUB_CREDS_USR} --password-stdin"
                sh "docker push ${BACKEND_IMAGE}:${BUILD_NUMBER}"
                sh "docker push ${BACKEND_IMAGE}:latest"
                sh "docker push ${FRONTEND_IMAGE}:${BUILD_NUMBER}"
                sh "docker push ${FRONTEND_IMAGE}:latest"
            }
        }

        stage('Install kubectl') {
            steps {
                echo 'Setting up kubectl...'
                sh """
                    if [ ! -f /tmp/kubectl ]; then
                        curl -LO https://dl.k8s.io/release/v1.32.0/bin/linux/amd64/kubectl
                        chmod +x kubectl
                        mv kubectl /tmp/kubectl
                    fi
                    /tmp/kubectl version --client
                """
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                echo 'Deploying to Kubernetes...'
                sh "/tmp/kubectl set image deployment/backend backend=${BACKEND_IMAGE}:${BUILD_NUMBER} --namespace=default"
                sh "/tmp/kubectl set image deployment/frontend frontend=${FRONTEND_IMAGE}:${BUILD_NUMBER} --namespace=default"
                sh "/tmp/kubectl rollout status deployment/backend --namespace=default"
                sh "/tmp/kubectl rollout status deployment/frontend --namespace=default"
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed! App is deployed to Kubernetes.'
        }
        failure {
            echo 'Pipeline failed. Check the logs above.'
        }
    }
}
