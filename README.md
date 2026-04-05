# Upastithi Pramaan 🎓
> An attendance management system built with a full DevOps pipeline — Docker, Kubernetes, Jenkins CI/CD, and Prometheus + Grafana monitoring.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Nginx |
| Backend | FastAPI (Python) |
| Database | Supabase (cloud-hosted PostgreSQL) |
| Containerisation | Docker + Docker Compose |
| Orchestration | Kubernetes (Minikube) |
| CI/CD | Jenkins |
| Monitoring | Prometheus + Grafana (via Helm) |
| Package Manager | Helm |

---

## 📁 Project Structure

```
upastithi-pramaan/
├── backend/              # FastAPI backend
│   ├── models/
│   ├── routers/
│   ├── utils/
│   ├── main.py
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/             # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── api.js
│   ├── Dockerfile
│   └── nginx.conf
├── k8s/                  # Kubernetes manifests
│   ├── backend-deployment.yaml
│   ├── backend-service.yaml
│   ├── backend-secret.yaml
│   ├── frontend-deployment.yaml
│   ├── frontend-service.yaml
│   ├── ingress.yaml
│   └── jenkins.yaml
├── Jenkinsfile           # CI/CD pipeline definition
├── docker-compose.yml
└── README.md
```

---

## 🚀 DevOps Pipeline

```
git push origin aryan
        ↓
Jenkins detects change (polls every 2 min)
        ↓
Builds Docker images (backend + frontend)
        ↓
Pushes images to Docker Hub
        ↓
Deploys to Kubernetes automatically
        ↓
Prometheus scrapes metrics → Grafana dashboard updates
```

---

## ⚙️ Prerequisites

Make sure these are installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Helm](https://helm.sh/docs/intro/install/)

---

## 🛠️ Setup & Running Locally

### 1. Clone the repo
```bash
git clone https://github.com/codaksh7/upastithi-pramaan.git
cd upastithi-pramaan
git checkout aryan
```

### 2. Add Supabase secrets
Open `k8s/backend-secret.yaml` and fill in your values:
```yaml
stringData:
  SUPABASE_URL: "https://your-project.supabase.co"
  SUPABASE_ANON_KEY: "your-anon-key"
  SUPABASE_SERVICE_KEY: "your-service-key"
```
> ⚠️ Never commit this file with real keys. It is in `.gitignore`.

### 3. Start Minikube
```bash
minikube start
minikube addons enable ingress
```

### 4. Point Docker to Minikube
```bash
# Mac/Linux
eval $(minikube docker-env)

# Windows PowerShell
minikube docker-env | Invoke-Expression
```

### 5. Build Docker images
```bash
docker build -t upastithi-backend:latest ./backend
docker build -t upastithi-frontend:latest ./frontend
```

### 6. Deploy to Kubernetes
```bash
kubectl apply -f k8s/
```

### 7. Install Prometheus + Grafana
```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=admin123
```

### 8. Get service URLs
```bash
minikube service frontend-service --url
minikube service backend-service --url
minikube service jenkins-service -n jenkins --url
```

---

## 🔄 After Every Laptop Restart

Run these in order:

```bash
# Terminal 1 — start cluster
minikube start

# Terminal 2 — keep open always
minikube tunnel

# Terminal 3 — fix Docker permissions for Jenkins
minikube ssh
sudo chmod 666 /var/run/docker.sock
exit

# Get your URLs
minikube service frontend-service --url
minikube service backend-service --url
minikube service jenkins-service -n jenkins --url

# Terminal 4 — Grafana, keep open always
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
```

---

## 🌐 Access the App

| Service | URL |
|---|---|
| Frontend | From `minikube service frontend-service --url` |
| Backend API docs | From `minikube service backend-service --url` + `/docs` |
| Grafana dashboard | http://localhost:3000 (admin / admin123) |
| Jenkins | From `minikube service jenkins-service -n jenkins --url` (admin / admin123) |

---

## 📊 Monitoring

Grafana comes pre-configured with Kubernetes dashboards:

- **Kubernetes / Compute Resources / Cluster** — cluster-wide CPU & memory
- **Kubernetes / Compute Resources / Namespace (Pods)** — per-pod metrics
- **Node Exporter** — host CPU, memory, disk usage

---

## 🔁 CI/CD with Jenkins

The `Jenkinsfile` defines a 5-stage pipeline:

| Stage | What it does |
|---|---|
| Checkout | Pulls latest code from GitHub (`aryan` branch) |
| Build Backend Image | Builds FastAPI Docker image |
| Build Frontend Image | Builds React + Nginx Docker image |
| Push to Docker Hub | Pushes both images to `docaryan` Docker Hub |
| Deploy to Kubernetes | Rolls out new images to the cluster |

Jenkins polls GitHub every 2 minutes and auto-triggers on new commits.

---

## 👥 Roles

The system supports three roles:
- **Student** — mark attendance, view records, raise disputes
- **Faculty** — start/end sessions, override attendance, view analytics
- **Admin** — manage students/faculty, approve devices, view logs

---

## 🛑 Shutdown

```bash
# Stop Minikube (saves resources)
minikube stop
```

---

## 📚 Experiments Covered

| Exp | Topic |
|---|---|
| 7, 8 | Docker + Docker Compose |
| 9, 10 | Kubernetes Basics + Advanced |
| 3, 4, 5, 6 | Jenkins CI/CD Pipeline |
| 15 | Prometheus + Grafana Monitoring |
| 16 | End-to-end DevOps Mini Project |
