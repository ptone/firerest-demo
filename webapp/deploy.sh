docker build -t gcr.io/ptone-misc/demo-frontend .
docker push gcr.io/ptone-misc/demo-frontend
gcloud run deploy --image gcr.io/ptone-misc/demo-frontend demo-frontend

