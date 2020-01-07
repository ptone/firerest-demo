
docker build -t gcr.io/ptone-misc/api-demo .
docker push gcr.io/ptone-misc/api-demo
gcloud run deploy -q --set-env-vars=LOG_LEVEL=debug --async --image gcr.io/ptone-misc/api-demo api-demo --no-allow-unauthenticated
gcloud run deploy -q --set-env-vars=LOG_LEVEL=debug --async --image gcr.io/ptone-misc/api-demo api-demo-public --allow-unauthenticated