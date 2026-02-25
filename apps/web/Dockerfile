FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm install
COPY . .
RUN npm --workspace apps/web run build
EXPOSE 3000
CMD ["npm", "--workspace", "apps/web", "run", "start"]