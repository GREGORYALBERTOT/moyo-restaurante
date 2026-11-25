# Moyo

Sistema web para gestionar pedidos, cocina y caja en un restaurante de Moyobamba. La interfaz está desarrollada con React y TypeScript; los datos se guardan en PostgreSQL de Neon y el acceso utiliza Neon Auth con verificación de correo.

La aplicación inicia sin productos, mesas, pedidos ni usuarios de ejemplo. El propietario configura su restaurante y habilita las cuentas del equipo. Los permisos se comprueban en el servidor para cada consulta y operación.

## Demostración

- [Storyboard del servicio](anexos/01-storyboard.png)
- [Evidencias con datos simulados](anexos/02-evidencias.png)
- [Roadmap del proyecto](anexos/03-roadmap.png)

## Iniciar en tu computadora

1. Instala Node.js 22 o posterior.
2. Prepara una base de datos PostgreSQL en Neon con el [esquema de Moyo](database/001_initial.sql) y habilita Neon Auth en la misma rama.
3. Copia `.env.example` a `.env` y completa las variables con los valores de esa rama. Genera una clave de configuración privada para activar la primera cuenta administradora y permite el origen local en Neon Auth.
4. Copia el valor público de `NEON_AUTH_BASE_URL` al campo `authUrl` en `config.js`.
5. Desde la carpeta del proyecto, instala las dependencias y arranca la aplicación.

```sh
npm ci
npm run dev
```

La web escucha en `http://127.0.0.1:5500` y la API en `http://127.0.0.1:5501`. Detén ambos servicios con `Ctrl+C`.

## Ejecutar con Live Server

Live Server sirve la interfaz; la API debe ejecutarse también para acceder a los datos:

1. Abre la carpeta del proyecto en Visual Studio Code e instala la extensión recomendada **Live Server**, de Ritwick Dey.
2. En la terminal de VS Code, ejecuta `npm ci` si aún no instalaste las dependencias y después `npm run api`.
3. Haz clic derecho sobre el archivo `index.html` de la raíz y selecciona **Open with Live Server**.
4. Abre `http://127.0.0.1:5500`. El archivo `config.js` conecta esa interfaz con la API local del puerto 5501.

No ejecutes `npm run dev` y Live Server simultáneamente en el puerto 5500. `npm run dev` ya sirve la interfaz y la API; con Live Server sólo necesitas `npm run api` en la terminal.

El archivo `assets/app.js` incluido permite abrir la interfaz sin compilarla primero. Si modificas los archivos de `src`, ejecuta `npm run build` y recarga Live Server. Conserva `index.html`, `config.js`, `styles.css` y `assets` en la misma estructura de carpetas.

Esta configuración local utiliza `localhost` o `127.0.0.1`. Para acceder desde otros dispositivos, publica la aplicación con su API o configura una dirección de API accesible y los orígenes permitidos correspondientes.

## Crear la primera cuenta administradora

No hay usuarios ni contraseñas predeterminadas.

1. Abre la web y selecciona **Crear una cuenta**.
2. Ingresa tu nombre, un correo al que tengas acceso y una contraseña de al menos 12 caracteres.
3. Si el restaurante aún no está activado, ingresa la **clave de configuración del propietario**. Es el valor de `OWNER_SETUP_TOKEN` en el archivo `.env` local o en las variables privadas del despliegue. No es tu contraseña de acceso y no debe compartirse con el personal.
4. Revisa tu correo e ingresa el código de verificación. Puedes solicitar otro código si el anterior venció; revisa también la carpeta de spam.
5. La API comprueba la clave y activa la primera cuenta administradora. La clave sólo permite esta activación inicial.

Si el correo ya fue verificado pero la activación no se completó, vuelve a ingresar con tu correo, contraseña y clave de configuración. Registrar una cuenta por sí solo no concede permisos de administración.

## Dar acceso al equipo

En **Administración → Equipo y accesos**, el administrador registra el correo de cada integrante y le asigna su rol. Después, cada trabajador crea su cuenta con ese mismo correo y completa la verificación. Una cuenta sin acceso asignado muestra una pantalla de espera; no puede consultar ni modificar los datos del restaurante.

| Rol | Funciones |
| --- | --- |
| Administrador | Configurar carta, mesas, equipo y restaurante; consultar operaciones y acceder al servicio |
| Mesero | Registrar pedidos y confirmar entregas desde salón |
| Cocina | Consultar comandas, iniciar la preparación y marcar los pedidos listos o rechazados |
| Caja | Cobrar pedidos entregados y consultar operaciones |

El menú lateral separa **Salón** (Mesas del salón), **Cocina** (Comandas) y **Caja** (Cobros). **Administración** reúne Carta, Mesas, Equipo, Operaciones y Restaurante. Las opciones visibles dependen de los permisos del usuario.

## Configurar y atender

1. Crea las mesas y registra los productos, categorías, precios y disponibilidad de la carta.
2. En salón, selecciona una mesa libre y registra productos, cantidades e indicaciones.
3. Confirma el pedido para enviarlo a cocina. Cada mesa mantiene un único pedido activo; no se amplían pedidos ya enviados.
4. En comandas, inicia la preparación y marca el pedido como listo. Si no puede prepararse, registra el motivo de rechazo.
5. Desde salón, confirma la entrega del pedido listo.
6. En caja, registra el pago completo del pedido entregado. Para efectivo, ingresa el monto recibido y revisa el vuelto. Para tarjeta o Yape, verifica la operación externa antes de registrar el cobro.
7. Después del pago, la mesa queda libre y la operación permanece en el historial.

Los importes se calculan como centavos enteros. Cada pedido conserva el nombre y precio de los productos al momento de registrarse; editar la carta no modifica cuentas anteriores. El historial permite consultar los detalles y filtrar las operaciones. Los cambios de otros usuarios se consultan desde la API y se guardan centralizadamente en Neon.

El sistema registra pagos, pero no procesa transacciones bancarias. No incluye inventario, reservas, delivery, ampliación de pedidos enviados, división de cuentas, pagos parciales ni facturación electrónica.

## Variables de entorno

Los secretos pertenecen al servidor. El archivo público `config.js` sólo contiene la URL de Neon Auth y la dirección de la API; nunca debe incluir conexiones de base de datos ni la clave del propietario.

| Variable privada del servidor | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión agrupada a PostgreSQL en Neon para la API |
| `DATABASE_URL_UNPOOLED` | Conexión directa para operaciones administrativas y migraciones |
| `NEON_AUTH_BASE_URL` | URL de Neon Auth de la rama utilizada |
| `NEON_AUTH_JWKS_URL` | URL de las claves públicas para verificar los tokens de acceso |
| `OWNER_SETUP_TOKEN` | Clave secreta para activar al primer administrador |
| `ALLOWED_ORIGINS` | Orígenes de interfaz autorizados, separados por comas |

La base de datos y la configuración de Auth deben corresponder al mismo entorno. No reemplaces una conexión por una de otra rama sin revisar ambas configuraciones. Autoriza los orígenes que utilizarás para acceder a la aplicación en Neon Auth.

## Publicar en Netlify

La aplicación necesita **Netlify Functions** además de los archivos estáticos. Subir solamente `dist` mediante arrastrar y soltar no instala la API. Publica el proyecto completo desde un repositorio Git o desde la CLI.

Ajustes en `netlify.toml`

| Ajuste | Valor |
| --- | --- |
| Comando de compilación | `npm run build` |
| Directorio de publicación | `dist` |
| Directorio de funciones | `netlify/functions` |
| Ruta de la API | `/api/*` |

### Desde un repositorio

1. Sube el código a un repositorio sin incluir `.env`, `.local`, `.netlify` ni `node_modules`.
2. Conecta el repositorio a un proyecto de Netlify.
3. Configura las variables del servidor en Netlify, con disponibilidad para **Functions**. Guarda los valores de conexión y `OWNER_SETUP_TOKEN` como secretos. La conexión directa sólo es necesaria donde ejecutes tareas administrativas o migraciones.
4. Verifica que `config.js` apunte a la URL pública de Neon Auth del mismo entorno. Autoriza el dominio del sitio en Neon Auth y revisa `ALLOWED_ORIGINS` si utilizas una API en otro dominio.
5. Ejecuta el despliegue y comprueba que tanto la interfaz como `/api/status` respondan correctamente.

### Desde la CLI

Inicia sesión en la CLI de Netlify, vincula la carpeta y selecciona tu proyecto.

```sh
npx netlify-cli login
npx netlify-cli link
npm run build
npx netlify-cli deploy --dir=dist --functions=netlify/functions
```

El último comando genera un despliegue de revisión. Una vez configuradas las variables privadas y comprobado el resultado, utiliza el mismo comando con `--prod` para publicar en producción.

La carpeta `.netlify` permanece excluida de Git. La cabecera `noindex` está configurada porque esta es una herramienta interna del restaurante; no restringe quién puede visitar la pantalla de acceso. El acceso a los datos depende de la sesión verificada y de los permisos comprobados por la API.

## Base de datos

Aplica `database/001_initial.sql` a una base de datos nueva en la misma rama de Neon que usarás para Auth. El archivo crea el esquema de pedidos, mesas, productos y permisos. Revisa las migraciones aplicadas antes de reutilizar una base de datos existente.

La API del servidor ejecuta las consultas a PostgreSQL. Guarda las credenciales de conexión en las variables de entorno del servidor.

## Desarrollo y comprobaciones

```sh
npm run check
npm test
npm run build
```

La compilación actualiza `assets/app.js` y prepara `dist`. Las pruebas usan datos controlados de `tests`. Para incluir la prueba de integración con PostgreSQL, define `TEST_DATABASE_URL` con una conexión a una base de datos desechable y ejecuta `npm test -- --integration`.

| Archivo | Uso |
| --- | --- |
| `index.html` | Entrada para Live Server y la web publicada |
| `config.js` | Configuración pública de Auth y API |
| `src/app.tsx` | Interfaces de servicio y administración |
| `src/AuthScreen.tsx` | Acceso, registro y verificación de correo |
| `src/api.ts` | Cliente de API autenticado |
| `src/store.ts` | Tipos y reglas de los pedidos, productos, mesas y pagos |
| `netlify/functions/api.ts` | API y comprobación de permisos en el servidor |
| `database/001_initial.sql` | Esquema de PostgreSQL |
| `scripts/serve.mjs` | Inicio local de interfaz y API |
| `scripts/api-server.mjs` | Inicio de la API para usar con Live Server |
| `netlify.toml` | Compilación, funciones y publicación |

La verificación completa de correo requiere que una persona registre su correo real y utilice el código que reciba. No se incluyen cuentas compartidas ni accesos que omitan esa verificación.
