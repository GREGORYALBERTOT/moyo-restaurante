// Public connection settings only. Database passwords belong exclusively in .env.
window.MOYO_CONFIG = {
  // Copia aquí la URL pública de Neon Auth del entorno que vas a usar.
  authUrl: '',
  apiUrl: ['localhost', '127.0.0.1'].includes(location.hostname) ? 'http://127.0.0.1:5501' : ''
};
