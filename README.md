# NRD Compras

Sistema de gestión de compras para el ecosistema NRD.

## Descripción

Aplicación web PWA para gestionar las compras de la empresa, incluyendo:
- Gestión de proveedores (crear, editar, eliminar)
- Gestión de órdenes de compra
- Búsqueda y filtrado de proveedores y órdenes
- Visualización de detalles

## Características

- **Gestión de Proveedores**: CRUD completo de proveedores con información de contacto
- **Órdenes de Compra**: Crear y gestionar órdenes de compra a proveedores
- **Búsqueda en tiempo real** de proveedores y órdenes
- **PWA** - Instalable como aplicación móvil
- **Offline-first** con Service Worker
- **Autenticación** integrada con Firebase Auth
- **Tiempo real** con Firebase Realtime Database

## Stack Tecnológico

- JavaScript ES6 nativo (sin frameworks)
- Tailwind CSS (via CDN)
- Firebase Realtime Database
- NRD Data Access Library (para autenticación y otras entidades)

## Estructura

```
nrd-compras/
├── index.html                    # HTML principal
├── app.js                        # Navegación principal
├── auth.js                       # Autenticación
├── modal.js                      # Modales y alertas
├── logger.js                     # Sistema de logging
├── tabs/
│   ├── suppliers.js             # Gestión de proveedores
│   └── purchase-orders.js        # Gestión de órdenes de compra
├── service-worker.js             # PWA
├── manifest.json                 # PWA config
├── styles.css                    # Estilos mínimos
└── tools/
    ├── update-version/           # Scripts de actualización de versión
    ├── generate-icons/           # Generador de iconos
    └── nrd-compras-server/       # Servidor local
```

## Uso

1. Abrir `index.html` en un navegador o servidor local
2. Iniciar sesión con credenciales de Firebase
3. Gestionar proveedores y órdenes de compra desde la interfaz

## Desarrollo Local

Usar el servidor local incluido en `tools/nrd-compras-server/server.sh`:

```bash
./tools/nrd-compras-server/server.sh
```

El servidor se iniciará en `http://localhost:8008`

## Generar Iconos

Para generar iconos personalizados:

```bash
./tools/generate-icons/generate-icon.sh "NRD COMPRAS"
```

## Licencia

Propietario - NRD System
