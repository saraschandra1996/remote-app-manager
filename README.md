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
```
---

### Step 2: Install Docker & Docker Compose
Install the official Docker engine and the Compose plugin directly from Docker's repositories.

# Add Docker's official GPG key and repository
```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker
```
### Step 3: Clone the Repository
Pull the application code onto your new server. (Replace the URL with your actual Git repository URL).

```bash
git clone <YOUR_GIT_REPOSITORY_URL>
cd remote-app-manager
```

### Step 4: Create Volume Directories & Set Permissions
Because Docker containers run as root by default, you must create the persistent directories on the host machine manually and open their permissions. This ensures the SQLite database and installer uploads are not locked out or overwritten during rebuilds.

```bash
# Create the required persistent directories
mkdir -p data
mkdir -p uploads

# Grant full read/write/execute permissions 
sudo chmod -R 777 data/
sudo chmod -R 777 uploads/
```
#### Tip: To avoid typing sudo every time you run Docker commands, add your user to the docker group
```bash
sudo usermod -aG docker $USER
```

### Step 5: Build and Launch the Application
Use Docker Compose to build the images and spin up the Redis, Backend, Celery Worker, and Frontend containers in detached mode.

```bash
docker compose up -d --build
```

### Step 6: Verify Deployment
Check the status of your containers to ensure they are properly initialized and healthy.

```bash
docker compose ps
```
Once all containers show as Started or Healthy, open a web browser and navigate to the new server's IP address (e.g., http://<SERVER_IP>). The application will be live and ready for your first deployment task.
