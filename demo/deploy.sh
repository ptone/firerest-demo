
docker build -t gcr.io/ptone-misc/api-demo .
docker push gcr.io/ptone-misc/api-demo
gcloud run deploy -q --async --image gcr.io/ptone-misc/api-demo api-demo --no-allow-unauthenticated
gcloud run deploy -q --async --image gcr.io/ptone-misc/api-demo api-demo-pulic --allow-unauthenticated