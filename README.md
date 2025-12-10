# 🎯 Empareja2 — Juego interactivo en Instagram

**Empareja2** es una experiencia gamificada creada para ferias y eventos donde los participantes reciben un personaje y deben encontrar a su pareja correspondiente.  
El sistema usa **Instagram Direct** para comunicar asignaciones y validar parejas mediante códigos únicos.
<img width="1901" height="946" alt="image" src="https://github.com/user-attachments/assets/924094e2-89d0-4888-a6b1-551552df34b6" />

---

## 🚀 Tecnologías principales

- **AWS Lambda** — Lógica sin servidor (assign, webhook, validate, create_game)
- **Amazon DynamoDB** — Almacenamiento de partidas y personajes
- **Amazon API Gateway** — API REST para el frontend y validación
- **Meta Graph API (Instagram Direct)** — Envío automático de mensajes e imágenes
- **S3** — Almacenamiento de imágenes de personajes (.png)
- **React + Vite** — Interfaz web del juego

---

## 🧩 Arquitectura básica

Frontend (React) → API Gateway → Lambda Functions → DynamoDB / S3
↓
Meta Graph API (DMs)

yaml
Copiar código

- `/game` → Crea una nueva partida (`Empareja2Game_<gameId>`)
- `/assign` → Asigna un personaje a un jugador
- `/webhook` → Recibe eventos de Instagram (referral con gameId)
- `/validate` → Comprueba y valida parejas por sus códigos

---

## ⚙️ Variables de entorno principales

| Variable | Descripción |
|-----------|--------------|
| `GAME_TABLE_PREFIX` | Prefijo de las tablas de partida (por defecto: `Empareja2Game_`) |
| `MASTER_TABLE` | Tabla maestra de personajes (`Empareja2Characters`) |
| `IG_SENDER_ID` | ID de la app Instagram Messenger |
| `IG_GRAPH_VERSION` | Versión de Graph API (p. ej. `v23.0`) |
| `IG_PAGE_TOKEN` | Token de acceso a la página de Instagram |
| `VERIFY_TOKEN` | Token de verificación para el webhook |
| `CHAR_BUCKET` | Nombre del bucket S3 con las imágenes de personajes |
| `CHAR_REGION` | Región del bucket S3 |

---

## 🧪 Testing rápido en Lambda

Ejemplo de evento de prueba para `/validate`:

```json
{
  "httpMethod": "GET",
  "queryStringParameters": {
    "gameId": "demo1",
    "vc_1": "1234",
    "vc_2": "5678"
  }
}
```

## 📸 Créditos
Desarrollado por Adria Sanchez Puig
Integración completa en AWS + Instagram Direct para experiencias gamificadas.

## 🛡️ Licencia
MIT License © 2025 — Libre para uso y modificación con atribución.