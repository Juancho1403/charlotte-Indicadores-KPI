<!-- @format -->

# Guía Paso a Paso para Ejecutar el Proyecto (Para Principiantes)

Esta guía está diseñada para ayudarte a configurar y ejecutar este proyecto en tu computadora, asumiendo que **no tienes nada instalado** previamente.

El proyecto es una API simple construida con **Node.js**, **Express** y **Prisma** (para conectar con la base de datos).

---

## Paso 1: Instalar las Herramientas Necesarias

Antes de empezar, necesitas instalar tres programas fundamentales.

1.  **Node.js**: Es el entorno que permite ejecutar JavaScript fuera del navegador.

    -   Ve a [nodejs.org](https://nodejs.org/).
    -   Descarga la versión **LTS** (Recommended for Most Users).
    -   Instálalo aceptando todas las opciones por defecto.

2.  **Git**: Es la herramienta para gestionar el código y descargarlo.

    -   Ve a [git-scm.com](https://git-scm.com/).
    -   Descarga la versión para Windows/Mac/Linux.
    -   Durante la instalación, puedes dejar todo por defecto, pero asegúrate de seleccionar "Git Bash Here" si te lo pregunta (útil para Windows).

3.  **VS Code** (Opcional pero recomendado): Es el editor de código que usaremos.
    -   Ve a [code.visualstudio.com](https://code.visualstudio.com/) e instálalo.

> **Verificación**: Abre una terminal (PowerShell en Windows o Terminal en Mac) y escribe `node -v` y `git --version`. Deberían salirte unos números de versión.

---

## Paso 2: Descargar (Clonar) el Proyecto

1.  Crea una carpeta en tu computadora donde quieras guardar el proyecto (por ejemplo, en `Documentos/Proyectos`).
2.  Abre esa carpeta con **VS Code**.
3.  En VS Code, abre la terminal integrada: Menú `Terminal` > `New Terminal`.
4.  Escribe el siguiente comando para descargar el código:

```bash
git clone https://github.com/Juancho1403/charlotte-Indicadores-KPI.git
```

5.  Una vez descargado, entra en la carpeta del proyecto:

```bash
cd charlotte-Indicadores-KPI
```

_(Nota: Si el nombre de la carpeta es diferente, usa `cd nombre-de-la-carpeta`)_

---

## Paso 3: Instalar las Dependencias

El proyecto necesita varias librerías para funcionar (como Express y Prisma). Para instalarlas automáticamente, ejecuta en la terminal:

```bash
npm install
```

Verás que aparece una carpeta llamada `node_modules`. ¡Eso es buena señal!

---

## Paso 4: Configurar la Base de Datos

Este proyecto usa **PostgreSQL**, pero no necesitas instalar ni crear nada.

1.  **Contacta al Líder de Módulo** para solicitar las credenciales de acceso (el contenido del archivo `.env`).
2.  En VS Code, busca la carpeta del proyecto y crea un nuevo archivo llamado `.env` (punto env).
3.  Abre el archivo `.env` y pega exactamente el contenido que te proporcionaron.

---

## Paso 5: Generar el Cliente de Prisma

No necesitas ejecutar migraciones (el líder de módulo se encarga de mantener la base de datos actualizada). Solo necesitas generar el cliente para que el código funcione.

Ejecuta en la terminal:

```bash
npx prisma generate
```

Esto preparará las herramientas internas del proyecto para conectarse a la base de datos.

---

## Paso 6: Ejecutar el Proyecto

¡Ya casi estamos! Ahora vamos a encender el servidor.

Como estás en una versión moderna de Node.js, usaremos un comando especial para que lea tu archivo `.env` automáticamente.

Ejecuta en la terminal:

```bash
npm run dev
```

Si ves un mensaje como este:
`🚀 Server ready at: http://localhost:3000`

¡Felicidades! 🎉 Tu proyecto está funcionando.

### ¿Cómo probarlo?

Abre tu navegador y entra a: [http://localhost:3000/api](http://localhost:3000/api)
Deberías ver un mensaje `{"up":true}`.

---

## Resumen de Comandos

Cada vez que quieras trabajar en el proyecto:

1.  Abre VS Code.
2.  Abre la terminal.
3.  Ejecuta: `npm run dev`
