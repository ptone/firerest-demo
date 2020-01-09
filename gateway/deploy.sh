api-spec-converter -f openapi_3 -t swagger_2 https://api-demo-public-avzcrpvnta-uc.a.run.app/api/v1/openapi.json > swagger.json
cat swagger.json | node patch-tool.js patches/domain-host.json |  node patch-tool patches/firebase-auth.json | jq . > swagger-patched.json
gcloud endpoints services deploy swagger-patched.json --project ptone-misc 
config=$(gcloud endpoints configs list --service endpoints-gateway.ptone.dev --format=json | jq -r .[0].id)
./gcloud_build_image -s endpoints-gateway.ptone.dev -c ${config} -p ptone-misc
gcloud container images list-tags gcr.io/ptone-misc/endpoints-runtime-serverless --limit=1
# gcloud container images list-tags gcr.io/ptone-misc/endpoints-runtime-serverless --limit=1 --format=json | jq .[0].tags[0]
# "endpoints-gateway.ptone.dev-2020-01-06r1"
gcloud run deploy api-demo-gateway \
--image="gcr.io/ptone-misc/endpoints-runtime-serverless:endpoints-gateway.ptone.dev-${config}" \
    --allow-unauthenticated \
  --set-env-vars=ESPv2_ARGS=--cors_preset=basic \
    --platform managed \
--set-env-vars ENDPOINTS_SERVICE_NAME=endpoints-gateway.ptone.dev \
  --service-account envoy-robot@ptone-misc.iam.gserviceaccount.com \
    --project=ptone-misc