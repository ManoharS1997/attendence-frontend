## 🎨 Architecture & CI/CD Overview

![Image](https://miro.medium.com/v2/resize%3Afit%3A2000/1%2AWytnwm9mpIceQ0JLbODMUQ.jpeg)

![Image](https://media2.dev.to/dynamic/image/width%3D1600%2Cheight%3D900%2Cfit%3Dcover%2Cgravity%3Dauto%2Cformat%3Dauto/https%3A%2F%2Fdev-to-uploads.s3.amazonaws.com%2Fuploads%2Farticles%2Fkxykad3xg0a798cr3w97.png)

![Image](https://miro.medium.com/v2/resize%3Afit%3A1400/1%2A1JUNzVO5cSMsgD5FSLl4UQ.png)

---

# 🚀 Attendance Frontend

### CI/CD Enabled • Dockerized • Production-Oriented

A modern **Attendance Management Frontend** built with **React (Vite)** and deployed using a **Jenkins CI/CD pipeline** with **Docker** on a Linux server.
This repository focuses on **real-world deployment practices**, not just UI development.

---

## ✨ Highlights

* ⚙️ Jenkins Pipeline as Code (CI/CD)
* 🐳 Dockerized frontend deployment
* 🚀 One-click deployment via Jenkins
* 🔄 Rollback-ready container strategy
* 🌐 Accessible via browser after deployment
* 🧠 Designed with production mindset

---

## 🛠 Tech Stack

| Layer     | Technology            |
| --------- | --------------------- |
| Frontend  | React + Vite          |
| CI/CD     | Jenkins               |
| Container | Docker                |
| OS        | Linux                 |
| Cloud     | AWS EC2 (or Linux VM) |
| Access    | Browser (HTTP)        |

---

## 🧱 Architecture Summary

* Developer pushes code to GitHub
* Jenkins pipeline is triggered automatically
* Docker image is built
* Frontend runs inside a container
* Application is served to users via browser

```
Developer → GitHub → Jenkins → Docker → Linux Server → Browser
```

---

## 🔁 CI/CD Pipeline Flow

1. Checkout frontend source code
2. Build Docker image
3. Stop & remove old container
4. Run new container
5. Application becomes accessible instantly

This pipeline ensures **consistent and repeatable deployments**.

---

## 🚀 Deployment Details

* Frontend runs inside a Docker container
* Jenkins handles build & deployment
* Container runs on port **5173**
* No manual server intervention required

---

## ❤️ Health Validation

Frontend availability is validated by checking HTTP response from the application URL after deployment.

This ensures:

* Container started successfully
* Application is reachable
* Deployment is valid

---

## 🔄 Rollback Strategy

If deployment fails:

* Current container is stopped
* Previous container image can be redeployed
* Downtime is minimized

This mirrors **real production safety practices**.

---

## 📁 Repository Structure

```
attendance-frontend/
├── src/
├── public/
├── scripts/
│   ├── healthchecks.sh
│   └── rollback.sh
├── Jenkinsfile
├── Dockerfile
└── README.md
```

---

## 📌 Known Improvements (Planned)

* Replace dev server with Nginx-based production build
* Optimize Docker image using multi-stage builds
* Improve frontend health check granularity

> These are intentionally documented to show **engineering awareness and roadmap thinking**.

---

## 🎯 Why This Project

This repository was created to demonstrate:

* CI/CD ownership for frontend applications
* Docker-based deployment practices
* Production-oriented thinking beyond UI development

It complements the **Attendance Backend CI/CD project** to form a **complete full-stack DevOps setup**.
