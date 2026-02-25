FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm install
COPY . .
RUN npm --workspace apps/api run prisma:generate && npm --workspace apps/api run build
EXPOSE 4000
CMD ["sh", "-c", "npm --workspace apps/api run prisma:migrate && npm --workspace apps/api run seed && npm --workspace apps/api run start"]