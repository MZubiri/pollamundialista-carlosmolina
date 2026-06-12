# Polla Mundialista 2026 🏆

Aplicación web unificada para gestionar y visualizar la **Polla Mundialista 2026**, construida con **React (Vite)** en el frontend, **Express (Node.js)** en el backend y **SQLite** como base de datos. Listo para ser desplegado en **Oracle Cloud** usando **Coolify**.

---

## 🚀 Cómo Iniciar en Desarrollo Local

Para ejecutar el proyecto localmente en tu computadora:

1. **Instalar Dependencias**:
   Instala tanto las herramientas de desarrollo como las del servidor:
   ```bash
   npm install
   ```

2. **Ejecutar el Servidor de Desarrollo**:
   Ejecuta el frontend de Vite y el backend de Express concurrentemente con un solo comando:
   ```bash
   npm run dev
   ```
   *   El **Frontend** estará disponible en: [http://localhost:5173](http://localhost:5173)
   *   El **Backend** correrá en: [http://localhost:3001](http://localhost:3001) (las peticiones `/api` desde el frontend se redirigen automáticamente a través de un proxy).

---

## 📦 Ejecución en Producción Local

Si deseas probar el build de producción en tu máquina local:

1. **Compilar el Frontend**:
   Genera los archivos optimizados listos para servir:
   ```bash
   npm run build
   ```

2. **Iniciar el Servidor**:
   Arranca el servidor de Express en modo de producción, el cual servirá tanto la API REST como los archivos estáticos compilados en la carpeta `dist/`:
   ```bash
   npm run start
   ```
   Accede en tu navegador a: [http://localhost:3001](http://localhost:3001)

---

## ☁️ Despliegue en Coolify (Oracle Cloud)

Para desplegar este proyecto en tu servidor de Oracle Cloud usando Coolify, sigue estos pasos:

1. **Subir a Git**: Sube esta carpeta (`APP/`) a un repositorio privado de GitHub o GitLab.
2. **Crear Recurso en Coolify**:
   *   En el panel de Coolify, selecciona **Create New Resource** -> **Public/Private Repository**.
   *   Selecciona tu repositorio y la rama principal (ej. `main`).
3. **Configurar el tipo de Build**:
   *   Coolify detectará el archivo `Dockerfile` en la raíz automáticamente. Configura el tipo de build como **Dockerfile**.
4. **Configurar Variables de Entorno (Environment Variables)**:
   *   Añade las variables necesarias en el apartado de variables de Coolify:
       *   `PORT=3001` (Puerto interno expuesto por el contenedor).
       *   `FOOTBALL_API_KEY` = *[Tu clave de API de Football-Data.org]* (opcional, para actualización en tiempo real).
5. **Configurar Almacenamiento Persistente (Opcional pero Recomendado)**:
   *   Dado que SQLite guarda la base de datos en un archivo local (`/app/db/database.db`), si el contenedor se reinicia o se redespliega sin volumen persistente, se perderán las correcciones manuales realizadas.
   *   En la pestaña **Storage** de la aplicación en Coolify, añade una montura persistente:
       *   **Source**: `polla-db-volume` (o cualquier nombre de volumen de Docker).
       *   **Destination**: `/app/db`
   *   *Nota*: La primera vez que se monte el volumen, asegúrate de copiar el archivo `db/database.db` inicial dentro de ese volumen para tener la base de datos semilla.
6. **Desplegar**: Haz clic en **Deploy** en Coolify. ¡Listo! Coolify te proporcionará una URL pública segura (`https://...`).

---

## ⚽ Sincronización en Tiempo Real y Actualización Manual

*   **Sincronización Automática**: El sistema cuenta con soporte para conectarse con la API de [Football-Data.org](https://www.football-data.org/) para descargar resultados reales. Regístrate para obtener una API key gratuita e incorpórala como variable de entorno `FOOTBALL_API_KEY`. Haz clic en **Sincronizar Resultados** en el banner superior para actualizar la tabla.
*   **Actualización Manual (Admin)**: Si no deseas usar la API o necesitas corregir un resultado, ingresa al **Panel Admin** -> **Resultados Reales**. Podrás escribir los goles de local y visitante para cada partido individualmente y guardarlos. Al guardar, el marcador general se recalculará instantáneamente.
