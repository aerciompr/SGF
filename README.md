# SGF-JFAL

Sistema de Gerenciamento de Filas - Justiça Federal em Alagoas

## Arquitetura

- **Frontend**: HTML/CSS/JS vanilla servido por Nginx
- **Backend**: Node.js/Express REST API
- **Banco de Dados**: PostgreSQL 16
- **Deploy**: Docker Compose (3 containers)

## Módulos

| Módulo | URL | Perfil de Acesso |
|---|---|---|
| Hub | `/` | Público |
| Admin | `/admin.html` | admin |
| Recepção | `/recepcao.html` | recepcao |
| Perito | `/perito.html` | perito |
| Conciliador | `/conciliador.html` | conciliador |
| Display TV | `/display.html` | Público |

## Credenciais Padrão

| Login | Senha | Perfil |
|---|---|---|
| admin | admin123 | Administrador |
| recepcao | recepcao123 | Recepção |
| perito | perito123 | Perito |
| conciliador | conciliador123 | Conciliador |

> ⚠️ Altere as senhas padrão no painel Admin → Gerenciar Usuários antes de usar em produção.

## Deploy com Docker Compose

```bash
# Subir todos os serviços
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

Acesse: `http://localhost:8080`

## Desenvolvimento Local

```bash
# 1. Subir apenas o PostgreSQL
docker-compose up -d db

# 2. Backend
cd backend
npm install
npm run dev

# 3. Frontend (em outro terminal)
cd frontend
npx http-server -p 8888 -c-1 --proxy http://localhost:3000
```

## Variáveis de Ambiente

| Variável | Default | Descrição |
|---|---|---|
| DB_HOST | localhost | Host PostgreSQL |
| DB_PORT | 5432 | Porta PostgreSQL |
| DB_NAME | sgf_jfal | Nome do banco |
| DB_USER | sgf | Usuário do banco |
| DB_PASS | sgf123 | Senha do banco |
| JWT_SECRET | (dev default) | Secret para JWT |
| PORT | 3000 | Porta do backend |
