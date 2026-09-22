CURRENT_DIR=$(shell pwd)

# Имя образа берётся из имени папки — в CI это имя репозитория,
# поэтому ghcr-путь совпадает с image.repository в k8s/values.yaml.
APP=$(shell basename ${CURRENT_DIR})

REGISTRY=ghcr.io
TAG=latest
ENV_TAG=latest
PROJECT_NAME=ucode-io
DOCKERFILE=Dockerfile

build-image:
	docker build --rm -t ${REGISTRY}/${PROJECT_NAME}/${APP}:${TAG} . -f ${DOCKERFILE}
	docker tag ${REGISTRY}/${PROJECT_NAME}/${APP}:${TAG} ${REGISTRY}/${PROJECT_NAME}/${APP}:${ENV_TAG}

push-image:
	docker push ${REGISTRY}/${PROJECT_NAME}/${APP}:${TAG}
	docker push ${REGISTRY}/${PROJECT_NAME}/${APP}:${ENV_TAG}

clear-image:
	docker rmi ${REGISTRY}/${PROJECT_NAME}/${APP}:${TAG}
	docker rmi ${REGISTRY}/${PROJECT_NAME}/${APP}:${ENV_TAG}
