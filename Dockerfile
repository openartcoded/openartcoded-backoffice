FROM node:22-alpine AS builder
WORKDIR /usr/src/app
COPY package.json ./
RUN npm i
COPY . .
RUN npm run build

FROM nginx:stable-alpine
LABEL maintainer="contact@bittich.be"
COPY replace_placeholder.sh /
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY mime.types /etc/nginx/mime.types
EXPOSE 80

ENTRYPOINT [ "sh", "/replace_placeholder.sh" ]
CMD ["nginx", "-g", "daemon off;"]
