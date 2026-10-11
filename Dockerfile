# Vaneform MCP server (stdio). Set VANEFORM_API_KEY to enable tool calls.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
RUN npm ci --ignore-scripts
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY skills ./skills
ENTRYPOINT ["node", "dist/bin/vaneform-mcp.js"]
