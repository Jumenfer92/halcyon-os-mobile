# Halcyon OS móvil · subirlo a Vercel

Esta carpeta ya es la web completa. No hace falta compilar nada.

## Opción 1 · Desde GitHub
1. Crea un repositorio y sube el contenido de esta carpeta (que `index.html` quede en la raíz).
2. En Vercel: **Add New → Project → Import** ese repositorio.
3. Framework Preset: **Other**. Build Command: vacío. Output Directory: vacío (o `.`).
4. **Deploy**. Cada vez que hagas push se vuelve a publicar.

## Opción 2 · Con la CLI de Vercel (la más rápida)
```
npm i -g vercel
cd halcyon-mobile
vercel          # primera vez: te hace unas preguntas, acepta los valores por defecto
vercel --prod   # publica en tu dominio .vercel.app
```

## Instalar en Android
1. Abre la dirección `https://tu-proyecto.vercel.app` en **Chrome**.
2. A los 10 segundos aparece el aviso **Instala Halcyon OS**. Pulsa **Instalar**.
3. Si en vez de "Instalar" ves "Entendido" con instrucciones, es que Chrome todavía no ha dado permiso para mostrar su diálogo (a veces lo retrasa en la primera visita). Usa el menú ⋮ → **Instalar aplicación**, o recarga la página y espera otra vez.
4. Si dices "Ahora no", el aviso no vuelve a salir en 3 días. Siempre puedes instalarla desde **Ajustes → Instalar en este dispositivo**.

Necesita HTTPS (Vercel ya lo da). En `localhost` también funciona para probar.

## Actualizar
Edita los archivos en `mobile/` del kit y ejecuta `node build.js` en la raíz del kit. El script copia `core.js` y `realm_data.json` y cambia la versión del service worker, para que los móviles descarguen la versión nueva. Luego vuelve a subir `dist/halcyon-mobile`.

Los móviles instalados reciben la actualización la siguiente vez que abren la app con conexión (a veces hace falta cerrarla y abrirla otra vez).
