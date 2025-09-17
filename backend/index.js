// index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const app = express();
dotenv.config();

/* ---------------- CORS ---------------- */
const DEFAULT_ORIGINS = ['http://localhost:5173'];
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ORIGINS = ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : DEFAULT_ORIGINS;

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // mismo host / curl sin Origin
    if (ORIGINS.includes(origin) || /localhost:\d+$/i.test(origin)) return cb(null, true);
    return cb(new Error(`CORS: Origin ${origin} no permitido`));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// CORS para todas las rutas
app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

/* ----------- Middlewares ------------ */
app.use(express.json({ limit: '1mb' }));
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

/* ======= IMPORTS DE RUTAS ======= */
const proveedoresRoutes = require('./src/routes/proveedores.routes');
const authRoutes = require('./src/routes/auth.routes');
const usuariosRoutes = require('./src/routes/usuarios.routes');
const materiasPrimasRoutes = require('./src/routes/materiasPrimas.routes');
const lotesMateriaPrimaRoutes = require('./src/routes/lotesMateriaPrima.routes');
const movimientosMpRoutes = require('./src/routes/movimientosMateriaPrima.routes');
const recetasRoutes = require('./src/routes/recetas.routes');
const recetaProductoMapRoutes = require('./src/routes/recetaProductoMap.routes');
const productosRoutes = require('./src/routes/productos.routes');
const produccionRoutes = require('./src/routes/produccion.routes');
const categoriasRecetaRoutes = require('./src/routes/categoriasReceta.routes');
const empaquesRoutes = require('./src/routes/empaques.routes');
const { api: ptApiRoutes, alias: ptAliasRoutes } = require('./src/routes/pt.routes');
const cultivosRoutes = require('./src/routes/cultivos.routes');

/* ======= HOTFIX/DEBUG (ANTES de montar routers) ======= */
const { authenticateToken } = require('./src/middlewares/auth');
const materiasPrimasCtrl = require('./src/controllers/materiasPrimas.controller');

// a) confirmar versión
app.get('/api/__ping', (_req, res) => {
  res.json({ ok: true, source: 'index-debug', ts: new Date().toISOString() });
});

// b) ver headers básicos
app.get('/api/__headers', (req, res) => {
  res.json({
    origin: req.headers.origin || null,
    authorization_present: !!req.headers.authorization,
    authorization_sample: (req.headers.authorization || '').slice(0, 25) + '…',
    host: req.headers.host,
    referer: req.headers.referer || null,
  });
});

// c) quién soy (rol/permisos reales que ve el backend)
app.get('/api/__whoami', authenticateToken, (req, res) => {
  const safe = { ...req.user };
  delete safe.contrasena;
  res.json({
    user: safe,
    role: safe?.rol || null,
    roleNorm: safe?.rolNorm || null,
    permissions: req.permissions || [],
    ts: new Date().toISOString(),
  });
});

// d) HOTFIX: lectura de MPs – solo requiere estar autenticado (PRODUCCION entra)
app.get('/api/materias-primas', authenticateToken, materiasPrimasCtrl.listarMateriasPrimas);

// e) ping de MPs para confirmar que este archivo es el que corre
app.get('/api/materias-primas/__ping', (_req, res) => {
  res.json({ ok: true, source: 'index-mp-hotfix', ts: new Date().toISOString() });
});

/* ====== Montaje de rutas normales ====== */
// Alias que espera el frontend (con /api)
app.use('/api/stock-pt', ptAliasRoutes);
// Alias adicional sin /api
app.use('/stock-pt', ptAliasRoutes);
// API formal de PT
app.use('/api/pt', ptApiRoutes);

// Empaques / Productos / Recetas / Producción
app.use('/api/empaques', empaquesRoutes);
app.use('/api/produccion', produccionRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/recetas', recetasRoutes);
app.use('/api/recetas', recetaProductoMapRoutes);
app.use('/api/categorias-receta', categoriasRecetaRoutes);
app.use('/api/cultivos', cultivosRoutes);

// Auth y maestros
app.use('/api/auth', authRoutes);
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/materias-primas', materiasPrimasRoutes);
app.use('/api/lotes-materia-prima', lotesMateriaPrimaRoutes);
app.use('/api/movimientos-mp', movimientosMpRoutes);

// Healthchecks
app.get('/healthz', (_req, res) => res.json({ ok: true }));
app.get('/', (_req, res) => res.send('API funcionando 🚀'));

/* ------ 404 y manejador de errores --- */
app.use((req, res, _next) => {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err?.message || err);
  res.status(500).json({ message: err?.message || 'Error interno del servidor' });
});

/* --------------- Server -------------- */
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`CORS orígenes permitidos: ${ORIGINS.join(', ')}`);
});
