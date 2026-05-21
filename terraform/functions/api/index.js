const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const env = {
  usersTableName: process.env.USERS_TABLE_NAME,
  ensemblesTableName: process.env.ENSEMBLES_TABLE_NAME,
  membershipsTableName: process.env.MEMBERSHIPS_TABLE_NAME,
  uploadsTableName: process.env.UPLOADS_TABLE_NAME,
  uploadsBucketName: process.env.UPLOADS_BUCKET_NAME,
};

const response = (statusCode, body) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
};

const getClaims = (event) =>
  event.requestContext?.authorizer?.jwt?.claims || {};

const getUserId = (event) => getClaims(event).sub || "";

const ensureUser = (event, targetUserId) => {
  const userId = getUserId(event);
  if (!userId) {
    return { ok: false, response: response(401, { message: "Missing authenticated user" }) };
  }

  if (targetUserId && targetUserId !== userId) {
    return {
      ok: false,
      response: response(403, { message: "You can only access your own records" }),
    };
  }

  return { ok: true, userId };
};

const nowIso = () => new Date().toISOString();

const safeProfile = (item) =>
  item
    ? {
        userId: item.userId,
        email: item.email,
        displayName: item.displayName ?? "",
        photoKey: item.photoKey ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeEnsemble = (item) =>
  item
    ? {
        ensembleId: item.ensembleId,
        ownerId: item.ownerId,
        name: item.name,
        description: item.description ?? "",
        logoKey: item.logoKey ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const routeKey = (event) =>
  event.routeKey || `${event.requestContext?.http?.method ?? "GET"} ${event.rawPath ?? ""}`;

const health = () =>
  response(200, {
    ok: true,
    service: "ensembleflow-api",
  });

const getProfile = async (event) => {
  const userId = event.pathParameters?.userId || getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const result = await ddb.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: { userId },
    }),
  );

  return response(200, {
    profile: safeProfile(result.Item),
  });
};

const upsertProfile = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const userId = event.pathParameters?.userId || getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: { userId },
    }),
  );

  const current = existing.Item || {};
  const item = {
    userId,
    email: body.email || current.email || getClaims(event).email || "",
    displayName: body.displayName ?? current.displayName ?? "",
    photoKey: body.photoKey ?? current.photoKey ?? "",
    createdAt: current.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.usersTableName,
      Item: item,
    }),
  );

  return response(200, {
    profile: safeProfile(item),
  });
};

const listEnsembles = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.ensemblesTableName,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: {
        ":ownerId": userId,
      },
    }),
  );

  return response(200, {
    ensembles: (result.Items || []).map(safeEnsemble),
  });
};

const getEnsemble = async (event) => {
  const ensembleId = event.pathParameters?.ensembleId;
  if (!ensembleId) {
    return response(400, { message: "Missing ensembleId" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.ensemblesTableName,
      Key: { ensembleId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Ensemble not found" });
  }

  const auth = ensureUser(event, result.Item.ownerId);
  if (!auth.ok) return auth.response;

  return response(200, {
    ensemble: safeEnsemble(result.Item),
  });
};

const createEnsemble = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const ensembleId = body.ensembleId || crypto.randomUUID();
  const item = {
    ensembleId,
    ownerId: auth.userId,
    name: body.name || "",
    description: body.description || "",
    logoKey: body.logoKey || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.ensemblesTableName,
      Item: item,
    }),
  );

  return response(201, {
    ensemble: safeEnsemble(item),
  });
};

const updateEnsemble = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const ensembleId = event.pathParameters?.ensembleId;
  if (!ensembleId) {
    return response(400, { message: "Missing ensembleId" });
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.ensemblesTableName,
      Key: { ensembleId },
    }),
  );

  if (!existing.Item) {
    return response(404, { message: "Ensemble not found" });
  }

  const auth = ensureUser(event, existing.Item.ownerId);
  if (!auth.ok) return auth.response;

  const item = {
    ...existing.Item,
    name: body.name ?? existing.Item.name,
    description: body.description ?? existing.Item.description ?? "",
    logoKey: body.logoKey ?? existing.Item.logoKey ?? "",
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.ensemblesTableName,
      Item: item,
    }),
  );

  return response(200, {
    ensemble: safeEnsemble(item),
  });
};

const presignUpload = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const fileName = String(body.fileName || "upload").replace(/[^a-zA-Z0-9._-]/g, "-");
  const contentType = body.contentType || "application/octet-stream";
  const fileType = body.fileType || "unknown";
  const ensembleId = body.ensembleId || "";
  const uploadId = crypto.randomUUID();
  const keyParts = [
    "uploads",
    auth.userId,
    ensembleId || "personal",
    `${uploadId}-${fileName}`,
  ];
  const fileKey = keyParts.join("/");

  const command = new PutObjectCommand({
    Bucket: env.uploadsBucketName,
    Key: fileKey,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });

  const item = {
    uploadId,
    ownerId: auth.userId,
    ensembleId,
    fileKey,
    fileType,
    contentType,
    createdAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.uploadsTableName,
      Item: item,
    }),
  );

  return response(201, {
    uploadId,
    fileKey,
    uploadUrl,
  });
};

exports.handler = async (event) => {
  const key = routeKey(event);

  if (key === "GET /health") return health();
  if (key === "GET /profiles") return getProfile(event);
  if (key === "POST /profiles") return upsertProfile(event);
  if (key === "GET /profiles/{userId}") return getProfile(event);
  if (key === "PUT /profiles/{userId}") return upsertProfile(event);
  if (key === "GET /ensembles") return listEnsembles(event);
  if (key === "POST /ensembles") return createEnsemble(event);
  if (key === "GET /ensembles/{ensembleId}") return getEnsemble(event);
  if (key === "PUT /ensembles/{ensembleId}") return updateEnsemble(event);
  if (key === "POST /uploads/presign") return presignUpload(event);

  return response(404, {
    message: "Not found",
    route: key,
  });
};
