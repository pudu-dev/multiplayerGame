# 🎮 Multiplayer Game

## 📌 Overview
Proyecto enfocado en el aprendizaje de arquitectura multiplayer en tiempo real, combinando renderizado 3D en el cliente con lógica autoritativa en el servidor.

---

## 🧠 Arquitectura

**Modelo híbrido:**
- Server Authority (autoridad del servidor)
- Client-side Prediction (predicción del cliente)

Esto permite:
- Mayor precisión en el estado del juego
- Reducción de latencia percibida
- Sincronización consistente entre jugadores

---

##  Aruitectura actual:

###  Cliente
- React
- Three.js STACK

###  Servidor (actual)
- Python
- FastAPI
- WebSockets

###  Base de datos
- en Desarrollo

##  Arquitectura anterior:

### Cliente(anterior)
- React + Three.js socket.io configuration

### Servidor(anterior)
- Node.js
- Socket.IO
---

## 🌍 Características

- 🧩 Generación procedural de mapas
- 🚶 Movimiento Kinemático (no basado en físicas)
- 🔄 Sincronización en tiempo real cliente-servidor
- 🎥 Sistema de cámara dinámico
- 🎮 Base para juego multiplayer escalable
---

## 🧪 Estado del proyecto

> 🚧 Proyecto personal en desarrollo enfocado en aprendizaje y experimentación.
---


## 🎯 Objetivo

> Explorar e implementar:
- Networking en tiempo real
- Predicción y reconciliación
- Arquitecturas y mecanicas escalables para juegos multiplayer
- Integración cliente-servidor eficiente
---