# syntax=docker/dockerfile:1
# Builds the Flutter Customer App as a web bundle served by nginx.
FROM ghcr.io/cirruslabs/flutter:3.19.0 AS build
WORKDIR /app
COPY pubspec.yaml ./
RUN flutter pub get
COPY . .
RUN flutter build web --release

FROM nginx:alpine
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
