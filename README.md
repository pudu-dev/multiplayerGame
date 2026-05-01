# Multiplayer Game

## Overview:
Proyecto enfocado en el aprendizaje de arquitectura multiplayer en tiempo real, combinando renderizado 3D en el cliente con lógica autoritativa en el servidor.
---

## Características

-  Generación procedural de mapas
-  Sistema de transicion de escena y mapas
-  Movimiento Kinemático (no basado en físicas)
-  Sincronización en tiempo real cliente-servidor
-  Sistema de cámara dinámico
---

## Estado del proyecto

> 🚧 !Proyecto personal en desarrollo enfocado en aprendizaje y experimentación. 🚧
---

## Objetivo

> Explorar e implementar:
- Networking en tiempo real
- Predicción y reconciliación
- Arquitecturas y mecanicas escalables para juegos multiplayer
- Integración cliente-servidor eficiente
---

## Arquitectura:

**Modelo híbrido:**
- Server Authority (autoridad del servidor)
- Client-side Prediction (predicción del cliente)

Esto permite:
- Mayor precisión en el estado del juego
- Reducción de latencia percibida
- Sincronización consistente entre jugadores

---

## Tech Stack actual:

### Cliente
- React
- Three.js STACK

### Servidor
- Python
- FastAPI
- WebSockets

### Base de datos
- en Desarrollo

## Tech Stack anterior(migrada):

### Cliente
- React + Three.js socket.io configuration

### Servidor
- Node.js
- Socket.IO
---


<!--               _     
                  | |
 _ __   _   _   __| | _   _
|  _ \ | | | | / _  || | | |
| |_) || |_| || (_| || |_| |
|  __/  \__ _| \__ _| \__ _|
| |
| | Creado, Programado y Diseñado por:
|_| @Benjamin Maldonado
    benjaminmaldonadobarrales@gmail.com
    https://pudu-dev.vercel.app/
-->