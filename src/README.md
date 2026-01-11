
## Architecture Diagram (detailed)

The diagram below shows the primary components and the typical order lifecycle. Numbers on arrows map to the step descriptions that follow.

```
                                +---------------------------+
                                |        Client (UI)        |
                                |  - REST requests (POST)   |
                                |  - WebSocket connections  |
                                +------------+--------------+
                                                            |
                                                            | 1. Submit order (REST / WS)
                                                            v
       +----------------+   2a  +-----------------------------+   2b   +-----------+
       |  HTTP Handlers | ----> |  Fastify API Server (routes) | ----> |  Database |
       |  (createOrder) |       |  - validates requests        |       | (Postgres)
       +----------------+       |  - delegates to services     |       +-----------+
                                                            +--------------+--------------+
                                                                                          |
                                                                                          | 3. Service creates order record, enqueues job
                                                                                          v
                                                                        +-----------------------+
                                                                        |   OrderService + Repo |
                                                                        |  - createOrder()      |
                                                                        |  - updateOrder()      |
                                                                        +-----------+-----------+
                                                                                                |
                                                                                                | addJob(orderExecutionJob)
                                                                                                v
                                                                          +-------------------------+
                                                                          |     QueueManager       |
                                                                          |   (BullMQ Queue add)   |
                                                                          +-----------+-------------+
                                                                                                  |
                                                                                                  | 4. Job queued in Redis
                                                                                                  v
                                                                          +-------------------------+
                                                                          |     Worker Process      |
                                                                          |  (BullMQ Worker pickup) |
                                                                          +-----------+-------------+
                                                                                                  |
                                                                                                  | 5. Worker -> ExecutionService.processOrderExecutionJob()
                                                                                                  v
                                                        +--------------------------------------------+
                                                        |                ExecutionService           |
                                                        |  - fetch order from DB                      |
                                                        |  - getBestQuote via DexService             |
                                                        |  - execute swap on selected DEX via gateway|
                                                        |  - update order status & history           |
                                                        +----------------+---------------------------+
                                                                                           |                    |
                                           6. fetch quotes         |                    | 7. update DB and notify
                                                 (parallel)            |                    v
                                                                                           v              +------------------+
                                                                         +----------------+     | WebSocketService  |
                                                                         |    DexService  |     | - register conn   |
                                                                         |  - call DEXs    |     | - push updates    |
                                                                         |  - compare     |     +------------------+
                                                                         +--------+-------+
                                                                                           |
                                                                                           |  calls
                                                                                           v
                                                                  +-----------------------------+
                                                                  |  DEX Gateways (Raydium,...) |
                                                                  |  - getQuote(), executeSwap()|
                                                                  +-----------------------------+

```

High-level step mapping:
- 1: Client submits an order via REST or WebSocket.
- 2a: HTTP handler receives request, Fastify routes to handler which delegates to `OrderService`.
- 2b: The handler/service may persist an initial order record in Postgres.
- 3: `OrderService` enqueues an execution job via `QueueManager` (BullMQ).
- 4: QueueManager writes the job to Redis; worker(s) will pick it up.
- 5: Worker picks up the job and calls `ExecutionService.processOrderExecutionJob()`.
- 6: `ExecutionService` asks `DexService` for quotes (parallel), picks the best, then calls the corresponding `DexGateway` to execute the swap.
- 7: On success/failure the `ExecutionService` updates the database and uses `WebSocketService` to push real-time updates back to the client.

Components in short:
- `Fastify API Server` - exposes REST endpoints and WebSocket routes; registers handlers in `routes/`.
- `HTTP/WebSocket Handlers` - thin adapters that parse requests and call service layer functions.
- `OrderService` - business logic for creating/validating orders and orchestrating persistence and queueing.
- `QueueManager` / `Worker` - BullMQ queue management and background workers that execute jobs.
- `ExecutionService` - core orchestration for executing orders end-to-end (quote → swap → update).
- `DexService` & `DexGateways` - fetch quotes from multiple DEXs, and perform swaps via provider-specific logic.
- `Repository` (Postgres) - persists orders, status, and history.
- `WebSocketService` - manages active WS connections and pushes order updates.
- `EventManager` - application-level events and listeners for decoupled extensions (metrics, auditing).
- `common/` - shared `Logger`, `errors`, and `utils` used across modules.

Notes:
- The flow is intentionally decoupled: handlers → services → queue → worker → services → gateways → repo → websocket. This lets you scale workers independently from the API.
- `DexService.getAllQuotes()` runs gateway calls in parallel and returns `allQuotes` and `comparisonData` used by the UI or logs.
- Retries, backoff, and job lifecycle are handled by BullMQ configuration in `QueueManager` and the worker options.

---
