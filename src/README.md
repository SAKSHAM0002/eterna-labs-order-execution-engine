
- 1: Client submits an order via REST or WebSocket.
- 2a: HTTP handler receives request, Fastify routes to handler which delegates to `OrderService`.
- 2b: The handler/service may persist an initial order record in Postgres.
- 3: `OrderService` enqueues an execution job via `QueueManager` (BullMQ).
- 4: QueueManager writes the job to Redis; worker(s) will pick it up.
- 5: Worker picks up the job and calls `ExecutionService.processOrderExecutionJob()`.
- 6: `ExecutionService` asks `DexService` for quotes (parallel), picks the best, then calls the corresponding `DexGateway` to execute the swap.
- 7: On success/failure the `ExecutionService` updates the database and uses `WebSocketService` to push real-time updates back to the client.

## Architecture Diagram (ASCII)

Below is a clean, systematic ASCII diagram that describes the main components and the typical order lifecycle. Numbered arrows correspond to the step mapping below.

```
					    +---------------------------+
					    |        Client (UI)        |
					    |  (REST POST / WebSocket)  |
					    +------------+--------------+
								  |
								  | 1) Submit order
								  v
		  +---------------+        +--------------------+        +------------+
		  | HTTP Handlers |  --->  | Fastify API Server  |  ---> |  Database  |
		  | (request pars)|        | (routes, validation)|       | (Postgres) |
		  +-------+-------+        +---------+-----------+        +-----+------+
				|                          |                          ^
				|                          |                          |
				|                          | 2) Persist initial order | 7) Updates (status/history)
				|                          v                          |
				|                 +--------------------+              |
				|                 |   OrderService     |              |
				|                 | - validate request |              |
				|                 | - create order     |              |
				|                 | - enqueue job      |              |
				|                 +---------+----------+              |
				|                           |                         |
				| 3) Enqueue job            |                         |
				| ------------------------->|                         |
								    +----v----+                       |
								    | Queue   |                       |
								    |Manager  |                       |
								    |(BullMQ) |                       |
								    +----+----+                       |
									    | 4) Job queued (Redis)       |
									    v                             |
								    +----+----+                       |
								    | Worker  |------------------+-----
								    | Process | 5) picks up job
								    +----+----+
									    |
									    | 6) ExecutionService.processOrderExecutionJob()
									    v
					   +---------------------------------------+
					   |           ExecutionService           |
					   | - fetch order from DB                 |
					   | - request quotes from DexService      |
					   | - select best route & execute swap    |
					   | - update order status & history       |
					   +----------------+----------------------+
									|               |
				   fetch quotes     |               | notify / push
									v               v
							    +-----------+    +--------------+
							    | DexService|    | WebSocketSvc |
							    | (agg)     |    | (push updates)|
							    +-----+-----+    +--------------+
									|
									| calls
									v
							+---------------------------+
							|   DEX Gateways (Raydium,  |
							|   Meteora, ...)           |
							| - getQuote(), executeSwap()|
							+---------------------------+

Legend:
- Arrow labels: numbers indicate steps in the high-level mapping below.
- Parallel calls: `DexService` fetches quotes from multiple gateways in parallel and returns `allQuotes` and comparison data.
```

High-level step mapping:
- 1: Client submits an order via REST or WebSocket.
- 2: Fastify handler validates and persists an initial order record via `OrderService`.
- 3: `OrderService` enqueues an execution job via `QueueManager` (BullMQ).
- 4: Job is stored in Redis; workers subscribe to the queue.
- 5: Worker picks up the job and invokes `ExecutionService.processOrderExecutionJob()`.
- 6: `ExecutionService` uses `DexService` to fetch quotes (parallel), selects the best, executes the swap via a `DexGateway`, and handles retries/backoff.
- 7: On completion/failure, `ExecutionService` updates the DB and notifies clients via `WebSocketService`.
- 1: Client submits an order via REST or WebSocket.
- 2a: HTTP handler receives request, Fastify routes to handler which delegates to `OrderService`.
- 2b: The handler/service may persist an initial order record in Postgres.
- 3: `OrderService` enqueues an execution job via `QueueManager` (BullMQ).
- 4: QueueManager writes the job to Redis; worker(s) will pick it up.
- 5: Worker picks up the job and calls `ExecutionService.processOrderExecutionJob()`.
- 6: `ExecutionService` asks `DexService` for quotes (parallel), picks the best, then calls the corresponding `DexGateway` to execute the swap.
- 7: On success/failure the `ExecutionService` updates the database and uses `WebSocketService` to push real-time updates back to the client.
---

## Directory structure & responsibilities

A concise reference of the folders under `src/` and their primary responsibilities.

- `common/`: Shared utilities used across the app — logging (`logger`), custom errors (`errors`), and small helpers (`utils`).
- `order-execution-engine/`: Core application code and entry point (`index.ts`).
	- `config/`: Environment loading and validation, constants, and connection config (Postgres/Redis).
	- `dbschema/`: SQL migration scripts and schema artifacts.
	- `eventmanager/`: App-level event emitter and listeners for decoupled side effects.
	- `gateway/`: DEX gateway adapters and implementations (Raydium, Meteora) exposing `getQuote()` and `executeSwap()`.
	- `handler/`: HTTP and WebSocket handlers that adapt requests into service calls.
	- `model/`: TypeScript types and interfaces (orders, jobs, quotes, transactions, repository interfaces).
	- `queue/`: BullMQ integration — `QueueManager`, job options, and worker processors.
	- `repository/`: Data access layer (Postgres) — connection and repository implementations for orders/history.
	- `routes/`: Fastify route registration mapping endpoints to handler functions.
	- `services/`: Business logic (OrderService, DexService, ExecutionService, WebSocketService) — single-responsibility services used by handlers and workers.
	- `utils/`: Engine-specific helpers and constants.
	- `test-concurrent-orders.html`: Small test UI for stress/functional testing via API/WebSocket.

Use this section as a quick lookup when navigating the codebase — one line per directory to keep it focused and scannable.
