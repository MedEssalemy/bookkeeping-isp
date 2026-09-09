FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# --legacy-peer-deps works around a Tiptap peer-dependency version conflict
# in package.json (extension-underline pins a newer @tiptap/core than the
# other extensions declare) — unrelated to this merge, pre-existing in the repo.
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5173

# --host so the Vite dev server is reachable from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
