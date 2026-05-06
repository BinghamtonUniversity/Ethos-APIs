# Ethos APIs Static Deployment

This project is a modified static Scalar-based API catalog. It can be deployed to a standard web server that can serve HTML, JavaScript, JSON, YAML, and static folders.

## Required Files

Deploy the application files together so the relative paths continue to work. The deployed directory should include:

```text
catalog.html
catalog.css
catalog.js
scalar-manifest.json
scalar-search-index.json
ethosapis/
OA3 Client Libraries/
```

## Initial Server Deployment

Choose a webroot location:

```text
/var/www/ethos-apis
```

Clone the repository into that location:

```sh
cd /var/www
git clone https://github.com/BinghamtonUniversity/Ethos-APIs.git ethos-apis
```

Choose the user that will run the deployment cron job, then make that user the owner of the deployed repository. Replace `deploy:deploy` with the correct user and group for the server:

```sh
sudo chown -R deploy:deploy /var/www/ethos-apis
```

## Nginx

Create an Nginx config similar to this:

```nginx
server {
    listen 80;
    server_name ethosapis.binghamton.edu;

    root /var/www/ethos-apis;
    index catalog.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

Enable the site and reload Nginx:

```sh
sudo nginx -t
sudo systemctl reload nginx
```

## Daily Git-Based Updates

The recommended production setup is for the deployed server to match the repository. Use a deployment script that fetches the latest `main` branch and resets the webroot to that version.

Create the deployment script:

```sh
sudo nano /usr/local/bin/update-ethos-apis
```

Script contents:

```sh
#!/usr/bin/env bash
set -e

cd /var/www/ethos-apis
git fetch origin
git reset --hard origin/main
```

Make it executable:

```sh
sudo chmod +x /usr/local/bin/update-ethos-apis
```

Create the deployment log file and make it writable by the cron user. Replace `deploy:deploy` with the same user and group used for the deployed repository:

```sh
sudo touch /var/log/ethos-apis-deploy.log
sudo chown deploy:deploy /var/log/ethos-apis-deploy.log
```

Open the crontab for the deployment:

```sh
crontab -e
```

Schedule it to run every day at 3:00 AM:

```cron
0 3 * * * /usr/local/bin/update-ethos-apis >> /var/log/ethos-apis-deploy.log 2>&1
```

This keeps production synchronized with the repository and discards any server-side file changes during each update.

## Note
- The page loads Scalar from `https://cdn.jsdelivr.net/npm/@scalar/api-reference`.
