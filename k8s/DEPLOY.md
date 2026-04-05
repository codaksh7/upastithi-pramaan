# Kubernetes Deployment Guide — upastithi-pramaan
# Local setup using Minikube

## Prerequisites
Make sure these are installed:
- Docker (already have, since project is Dockerised)
- Minikube  → https://minikube.sigs.k8s.io/docs/start/
- kubectl   → https://kubernetes.io/docs/tasks/tools/

---

## Step 1 — Start Minikube
```bash
minikube start
```

---

## Step 2 — Point Docker to Minikube's daemon
This lets Minikube use images you build locally without a registry.
```bash
eval $(minikube docker-env)
```
⚠️ Run this in EVERY new terminal session before building images.

---

## Step 3 — Build Docker images inside Minikube
```bash
# From the project root (where docker-compose.yml lives)
docker build -t upastithi-backend:latest ./backend
docker build -t upastithi-frontend:latest ./frontend
```

---

## Step 4 — Fill in your Supabase secrets
Open `k8s/backend-secret.yaml` and replace the placeholder values:
```yaml
stringData:
  SUPABASE_URL: "https://xxxx.supabase.co"
  SUPABASE_ANON_KEY: "eyJ..."
  SUPABASE_SERVICE_KEY: "eyJ..."
```

---

## Step 5 — Enable the Ingress addon
```bash
minikube addons enable ingress
```

---

## Step 6 — Apply all Kubernetes files
```bash
kubectl apply -f k8s/backend-secret.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/frontend-service.yaml
kubectl apply -f k8s/ingress.yaml
```

Or apply the whole folder at once:
```bash
kubectl apply -f k8s/
```

---

## Step 7 — Add local hostname
Get Minikube's IP:
```bash
minikube ip
# e.g. 192.168.49.2
```

Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows):
```
192.168.49.2  upastithi.local
```

---

## Step 8 — Open in browser
```
http://upastithi.local        → React frontend
http://upastithi.local/api    → FastAPI backend
http://upastithi.local/api/docs → Swagger UI
```

---

## Useful commands for debugging

```bash
# Check if pods are running
kubectl get pods

# See pod logs
kubectl logs <pod-name>

# Describe a pod (shows errors clearly)
kubectl describe pod <pod-name>

# Check services
kubectl get services

# Check ingress
kubectl get ingress

# Restart a deployment
kubectl rollout restart deployment/backend
kubectl rollout restart deployment/frontend
```

---

## Notes
- `imagePullPolicy: Never` means Kubernetes uses locally built images (fine for Minikube).
- Supabase is cloud-hosted so no database pod is needed.
- To stop everything: `minikube stop`
- To delete everything: `kubectl delete -f k8s/`
