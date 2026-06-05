const jwt = require('jsonwebtoken');
const crypto = require('crypto');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  JWT_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️ AVISO: JWT_SECRET não definido. Gerado segredo temporário (senhas/sessões serão invalidadas no restart).');
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// Middleware to check if user has required profile
function requirePerfil(...perfis) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    // Admin has access to everything
    if (req.user.perfil === 'admin' || perfis.includes(req.user.perfil)) {
      return next();
    }
    return res.status(403).json({ error: 'Acesso negado' });
  };
}

module.exports = { authMiddleware, requirePerfil, JWT_SECRET };
