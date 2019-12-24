
docker build -t gcr.io/ptone-misc/api-demo .
docker push gcr.io/ptone-misc/api-demo
gcloud run deploy --image gcr.io/ptone-misc/api-demo api-demo