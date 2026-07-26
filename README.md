# Remote App Manager

Remote App Manager is a robust, Dockerized web application built with React, Flask, and Celery. It allows administrators to perform parallel, remote installations and uninstallations of `.exe` and `.msi` applications across multiple Windows hosts using WinRM. It features real-time progress tracking, job cancellation, CSV auditing, and automated registry discovery.

## 🚀 Deployment Guide (Fresh Server)

These instructions will guide you through deploying this application on a brand-new Linux (Ubuntu/Debian) server.

### Prerequisites
* A fresh Ubuntu 22.04 or 24.04 server.
* Root or `sudo` privileges.
* An active internet connection.

---

### Step 1: System Update & Basic Tools
First, ensure the server's package index is up to date and install Git.

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl
'''
---

Step 2: Install Docker & Docker Compose
Install the official Docker engine and the Compose plugin directly from Docker's repositories.

# Add Docker's official GPG key and repository
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL [https://download.docker.com/linux/ubuntu/gpg](https://download.docker.com/linux/ubuntu/gpg) -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] [https://download.docker.com/linux/ubuntu](https://download.docker.com/linux/ubuntu) \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker
