const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  const routeKey = event.routeKey || `${event.requestContext?.http?.method ?? "GET"} ${event.rawPath ?? ""}`;

  if (routeKey === "GET /health") {
    return response(200, {
      ok: true,
      service: "ensembleflow-api",
    });
  }

  const scaffoldedRoutes = new Set([
    "POST /profiles",
    "GET /profiles/{userId}",
    "PUT /profiles/{userId}",
    "POST /ensembles",
    "GET /ensembles/{ensembleId}",
    "PUT /ensembles/{ensembleId}",
    "POST /uploads/presign",
  ]);

  if (scaffoldedRoutes.has(routeKey)) {
    return response(501, {
      message: "This route is scaffolded and will be implemented in the next phase.",
      route: routeKey,
    });
  }

  return response(404, {
    message: "Not found",
    route: routeKey,
  });
};

