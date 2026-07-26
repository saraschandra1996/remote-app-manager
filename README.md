# remote-app-manager

Prerequisites: A fresh Ubuntu 22.04 or 24.04 server with root or sudo access and an active internet connection.

**Step 1:** System Update & Basic Tools
First, ensure the server's package index is up to date and install Git.

Bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get install -y git curl

**Step 2:** Install Docker & Docker Compose
Install the official Docker engine and the Compose plugin.

Bash
# Add Docker's official GPG key and repository
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker to start on boot
sudo systemctl enable docker
sudo systemctl start docker

**Step 3:** Clone the Repository
Pull your code onto the new server.

Bash
git clone <YOUR_GIT_REPOSITORY_URL>
cd remote-app-manager

**Step 4:** Create Volume Directories & Set Permissions
Because Docker containers run as root by default, we must create the persistent directories on the host machine manually and open their permissions. This prevents the SQLite "write-protected" database crash and ensures file uploads work immediately.

Bash
# Create the directories
mkdir -p data
mkdir -p uploads

# Grant full read/write/execute permissions to prevent container lockouts
sudo chmod -R 777 data/
sudo chmod -R 777 uploads/

**Step 5:** Build and Launch the Application
Use Docker Compose to build the images and spin up the Redis, Backend, Celery Worker, and Frontend containers in detached mode.

Bash
docker compose up -d --build

**Step 6:** Verify Deployment
Check the status of your containers to ensure they are healthy and running.

Bash
docker compose ps
Once all containers show as "Started" or "Healthy", open a web browser and navigate to the new server's IP address (e.g., http://<SERVER_IP>). The application will be live, empty, and ready to receive its first file upload.
