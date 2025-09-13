# UK Flood Data Service

This document outlines the architecture and implementation of the UK Flood Data Service, a containerized Python application that provides flood risk data from the Environment Agency API.

## Architecture

The service is designed as a modular component within the larger Prospect application. It consists of:

- **A Python Flask server:** `local-flood.py` provides a RESTful API endpoint (`/flood`) that accepts a bounding box (`bbox`) and an optional site polygon (`site`) as query parameters.
- **A Docker container:** The Flask server is containerized using Docker, with dependencies managed by Conda. This ensures a consistent and reproducible environment.
- **Docker Compose:** The `docker-compose.yml` file orchestrates the flood service alongside the main Next.js application, enabling seamless communication between the two.

This modular, container-based approach serves as a design basis for future server-side API calls and processing. It allows for the independent development, deployment, and scaling of individual services, and provides a clear separation of concerns between the frontend and backend components.

## Implementation Details

### Data Fetching and Processing

The `local-flood.py` script performs the following steps:

1.  **Receives a request:** The Flask server receives a GET request to the `/flood` endpoint with `bbox` and optional `site` parameters.
2.  **Fetches data:** It queries the Environment Agency's Flood Map for Planning API using the provided bounding box.
3.  **Processes data:** The GeoJSON response is processed using GeoPandas:
    - The data is clipped to the specified bounding box.
    - If a site polygon is provided, the data is further clipped to the site's boundaries.
4.  **Calculates statistics:** The script calculates the number of high, medium, and low-risk flood zones within the processed area.
5.  **Returns a response:** The processed GeoJSON data and flood risk statistics are returned as a JSON response.

### Docker Configuration

- **`Dockerfile`:** Defines the Docker image for the flood service. It uses a Miniconda base image and installs the necessary Python dependencies (Flask, GeoPandas, Requests, Shapely) via Conda.
- **`Dockerfile.nextjs`:** Defines the Docker image for the Next.js application, optimized for production.
- **`docker-compose.yml`:** Defines the multi-container Docker application. It sets up two services: `nextjs` and `flood`. The `flood` service is built from the `Dockerfile` and exposes port 5000, while the `nextjs` service is built from `Dockerfile.nextjs` and exposes port 3000.

### API Integration

The Next.js application communicates with the flood service via the `/api/uk-geoai/flood` API route. This route makes a `fetch` request to the flood service's `/flood` endpoint (e.g., `http://localhost:5000/flood?bbox=...`) and returns the response to the client. This provides a clean separation between the frontend and the data processing backend.
