FROM node:20-alpine

# Definir o diretório de trabalho
WORKDIR /app

# Copiar os arquivos de dependência do backend
COPY backend/package*.json ./backend/

# Instalar dependências
RUN cd backend && npm install --production

# Copiar o restante do código (backend e frontend)
COPY backend ./backend
COPY frontend ./frontend

# Definir variáveis de ambiente padrão
ENV NODE_ENV=production
ENV SQLITE_PATH=/app/backend/data/sgf_jfal.db

# Criar o diretório de dados
RUN mkdir -p /app/backend/data

# Expor a porta 3000
EXPOSE 3000

# Iniciar o servidor
CMD ["node", "backend/server.js"]
