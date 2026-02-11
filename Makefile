.PHONY: serve build deploy

serve:
	npm run dev

build:
	npm run build

deploy: build
	cp -r dist/* ~/tobeva/tobeva.com/static/loft