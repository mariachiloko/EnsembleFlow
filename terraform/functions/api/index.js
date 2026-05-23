const crypto = require("crypto");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  GetCommand,
  DeleteCommand,
  PutCommand,
  TransactWriteCommand,
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
  sectionsTableName: process.env.SECTIONS_TABLE_NAME,
  uploadsTableName: process.env.UPLOADS_TABLE_NAME,
  assignmentsTableName: process.env.ASSIGNMENTS_TABLE_NAME,
  submissionsTableName: process.env.SUBMISSIONS_TABLE_NAME,
  commentsTableName: process.env.COMMENTS_TABLE_NAME,
  invitationsTableName: process.env.INVITATIONS_TABLE_NAME,
  notificationsTableName: process.env.NOTIFICATIONS_TABLE_NAME,
  uploadsBucketName: process.env.UPLOADS_BUCKET_NAME,
  usernamesTableName: process.env.USERNAMES_TABLE_NAME,
  directorEmailAllowlist: String(process.env.DIRECTOR_EMAIL_ALLOWLIST || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
};

const privilegedRoles = new Set(["director", "co_director", "leader"]);
const blockedMembershipStatuses = new Set(["blocked"]);

const isDirectorEmail = (email) => {
  if (!email) {
    return false;
  }

  return env.directorEmailAllowlist.includes(String(email).trim().toLowerCase());
};

const normalizeMembershipRole = (role, allowPrivilegedRoles) => {
  const requestedRole = typeof role === "string" && role.trim() ? role.trim() : "member";

  if (privilegedRoles.has(requestedRole)) {
    return allowPrivilegedRoles ? requestedRole : "member";
  }

  return requestedRole;
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

const expiresInDays = (days) => Math.floor(Date.now() / 1000) + days * 24 * 60 * 60;

const normalizeUsername = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "");

  return normalized;
};

const isBlockedMembership = (membership) =>
  Boolean(membership && blockedMembershipStatuses.has(String(membership.status || "").toLowerCase()));

const safeProfile = (item) =>
  item
    ? {
        userId: item.userId,
        email: item.email,
        username: item.username ?? "",
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

const safeEnsembleWithCode = (item) =>
  item
    ? {
        ...safeEnsemble(item),
        accessCode: item.accessCode ?? "",
      }
    : null;

const safeSection = (item) =>
  item
    ? {
        sectionId: item.sectionId,
        ensembleId: item.ensembleId,
        ownerId: item.ownerId,
        name: item.name,
        description: item.description ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeMembership = (item) =>
  item
    ? {
        userId: item.userId,
        ensembleId: item.ensembleId,
        role: item.role ?? "member",
        status: item.status ?? "active",
        sectionId: item.sectionId ?? "",
        sectionName: item.sectionName ?? "",
        joinedAt: item.joinedAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeAssignment = (item) =>
  item
    ? {
        assignmentId: item.assignmentId,
        ownerId: item.ownerId,
        ensembleId: item.ensembleId,
        title: item.title,
        description: item.description ?? "",
        dueDate: item.dueDate ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeSubmission = (item) =>
  item
    ? {
        submissionId: item.submissionId,
        assignmentId: item.assignmentId,
        ownerId: item.ownerId,
        ensembleId: item.ensembleId ?? "",
        sectionId: item.sectionId ?? "",
        videoKey: item.videoKey ?? "",
        notes: item.notes ?? "",
        reviewStatus: item.reviewStatus ?? "pending",
        feedback: item.feedback ?? "",
        expiresAt: item.expiresAt ? String(item.expiresAt) : "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeComment = (item) =>
  item
    ? {
        commentId: item.commentId,
        submissionId: item.submissionId,
        authorId: item.authorId,
        body: item.body ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeInvitation = (item) =>
  item
    ? {
        inviteCode: item.inviteCode,
        ensembleId: item.ensembleId,
        createdBy: item.createdBy,
        inviteeEmail: item.inviteeEmail ?? "",
        inviteeUserId: item.inviteeUserId ?? "",
        role: item.role ?? "member",
        sectionId: item.sectionId ?? "",
        sectionName: item.sectionName ?? "",
        status: item.status ?? "pending",
        acceptedBy: item.acceptedBy ?? "",
        acceptedAt: item.acceptedAt ?? "",
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    : null;

const safeNotification = (item) =>
  item
    ? {
        userId: item.userId,
        notificationId: item.notificationId,
        type: item.type ?? "info",
        entityType: item.entityType ?? "",
        entityId: item.entityId ?? "",
        message: item.message ?? "",
        isRead: Boolean(item.isRead),
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

const getEnsembleRecord = async (ensembleId) => {
  if (!ensembleId) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.ensemblesTableName,
      Key: { ensembleId },
    }),
  );

  return result.Item || null;
};

const getEnsembleByAccessCode = async (accessCode) => {
  if (!accessCode) {
    return null;
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.ensemblesTableName,
      IndexName: "accessCode-index",
      KeyConditionExpression: "accessCode = :accessCode",
      ExpressionAttributeValues: {
        ":accessCode": accessCode,
      },
    }),
  );

  return (result.Items || [])[0] || null;
};

const requireOwnedEnsemble = async (event, ensembleId) => {
  const ensemble = await getEnsembleRecord(ensembleId);

  if (!ensemble) {
    return {
      ok: false,
      response: response(404, { message: "Ensemble not found" }),
    };
  }

  const auth = ensureUser(event, ensemble.ownerId);
  if (!auth.ok) return auth.response;

  return { ok: true, userId: auth.userId, ensemble };
};

const getMembershipRecord = async (userId, ensembleId) => {
  if (!userId || !ensembleId) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.membershipsTableName,
      Key: { userId, ensembleId },
    }),
  );

  return result.Item || null;
};

const getSectionRecord = async (sectionId) => {
  if (!sectionId) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.sectionsTableName,
      Key: { sectionId },
    }),
  );

  return result.Item || null;
};

const getAssignmentRecord = async (assignmentId) => {
  if (!assignmentId) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.assignmentsTableName,
      Key: { assignmentId },
    }),
  );

  return result.Item || null;
};

const getSubmissionRecord = async (submissionId) => {
  if (!submissionId) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.submissionsTableName,
      Key: { submissionId },
    }),
  );

  return result.Item || null;
};

const getInvitationRecord = async (inviteCode) => {
  if (!inviteCode) {
    return null;
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.invitationsTableName,
      Key: { inviteCode },
    }),
  );

  return result.Item || null;
};

const createNotification = async ({ userId, type, entityType, entityId, message }) => {
  if (!userId) {
    return null;
  }

  const notificationId = crypto.randomUUID();
  const item = {
    userId,
    notificationId,
    type,
    entityType,
    entityId,
    message,
    isRead: false,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.notificationsTableName,
      Item: item,
    }),
  );

  return item;
};

const buildUploadKey = ({ userId, ensembleId, uploadId, fileName, fileType }) => {
  if (fileType === "submission-video") {
    return ["submissions", ensembleId || "general", `${uploadId}-${fileName}`].join("/");
  }

  if (fileType === "profile-photo") {
    return ["profiles", userId, `${uploadId}-${fileName}`].join("/");
  }

  if (fileType === "ensemble-logo") {
    return ["ensembles", ensembleId || "general", `${uploadId}-${fileName}`].join("/");
  }

  return ["uploads", userId, ensembleId || "personal", `${uploadId}-${fileName}`].join("/");
};

const hasManagementAccess = (access) =>
  Boolean(
    access?.ok &&
      (access.isOwner ||
        privilegedRoles.has(access.membership?.role ?? "") ||
        access.isDirectorAccount),
  );

const getEnsembleAccess = async (event, ensembleId) => {
  const ensemble = await getEnsembleRecord(ensembleId);

  if (!ensemble) {
    return {
      ok: false,
      response: response(404, { message: "Ensemble not found" }),
    };
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  if (ensemble.ownerId === auth.userId) {
    return {
      ok: true,
      userId: auth.userId,
      ensemble,
      membership: null,
      isOwner: true,
      isDirectorAccount: isDirectorEmail(getClaims(event).email || ""),
    };
  }

  const membership = await getMembershipRecord(auth.userId, ensembleId);
  if (!membership) {
    return {
      ok: false,
      response: response(403, { message: "You can only access your ensembles" }),
    };
  }

  if (isBlockedMembership(membership)) {
    return {
      ok: false,
      response: response(403, { message: "Your membership is blocked for this ensemble" }),
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    ensemble,
    membership,
    isOwner: false,
    isDirectorAccount: isDirectorEmail(getClaims(event).email || ""),
  };
};

const requireManagementAccess = async (event, ensembleId) => {
  const access = await getEnsembleAccess(event, ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return {
      ok: false,
      response: response(403, { message: "You can only manage ensembles you administer" }),
    };
  }

  return access;
};

const canAccessSubmission = (access, submission) => {
  if (!access?.ok || !submission) {
    return false;
  }

  if (access.isOwner || submission.ownerId === access.userId) {
    return true;
  }

  if (privilegedRoles.has(access.membership?.role ?? "")) {
    return true;
  }

  return Boolean(
    access.membership?.sectionId &&
      submission.sectionId &&
      access.membership.sectionId === submission.sectionId,
  );
};

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
    isDirectorAccount: isDirectorEmail(getClaims(event).email || result.Item?.email || ""),
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
  const nextUsername = normalizeUsername(body.username || current.username || getClaims(event).email?.split("@")[0] || "");
  if (!nextUsername) {
    return response(400, { message: "Username is required." });
  }

  const currentUsername = normalizeUsername(current.username || "");
  const item = {
    userId,
    email: current.email || getClaims(event).email || "",
    username: nextUsername,
    displayName: body.displayName ?? current.displayName ?? "",
    photoKey: body.photoKey ?? current.photoKey ?? "",
    createdAt: current.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  const transactItems = [];

  if (!currentUsername || currentUsername !== nextUsername) {
    transactItems.push({
      Put: {
        TableName: env.usernamesTableName,
        Item: {
          username: nextUsername,
          userId,
          createdAt: current.createdAt || nowIso(),
          updatedAt: nowIso(),
        },
        ConditionExpression: "attribute_not_exists(username)",
      },
    });
  }

  transactItems.push({
    Put: {
      TableName: env.usersTableName,
      Item: item,
    },
  });

  if (currentUsername && currentUsername !== nextUsername) {
    transactItems.push({
      Delete: {
        TableName: env.usernamesTableName,
        Key: { username: currentUsername },
      },
    });
  }

  try {
    await ddb.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      }),
    );
  } catch (error) {
    if (error?.name === "ConditionalCheckFailedException") {
      return response(409, { message: "Username already exists." });
    }

    throw error;
  }

  return response(200, {
    profile: safeProfile(item),
  });
};

const listEnsembles = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const [ownedResult, membershipsResult] = await Promise.all([
    ddb.send(
    new QueryCommand({
      TableName: env.ensemblesTableName,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: {
        ":ownerId": userId,
      },
    })),
    ddb.send(
      new QueryCommand({
        TableName: env.membershipsTableName,
        KeyConditionExpression: "userId = :userId",
        ExpressionAttributeValues: {
          ":userId": userId,
        },
      }),
    ),
  ]);

  const ownedEnsembles = ownedResult.Items || [];
  const memberEnsembleIds = new Set((membershipsResult.Items || []).map((item) => item.ensembleId).filter(Boolean));
  const memberEnsembleIdsArray = [...memberEnsembleIds].filter(
    (ensembleId) => !ownedEnsembles.some((ensemble) => ensemble.ensembleId === ensembleId),
  );

  const memberEnsembles = await Promise.all(
    memberEnsembleIdsArray.map(async (ensembleId) => {
      const item = await getEnsembleRecord(ensembleId);
      return item;
    }),
  );

  return response(200, {
    ensembles: [...ownedEnsembles, ...memberEnsembles.filter(Boolean)].map(safeEnsemble),
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

  const access = await getEnsembleAccess(event, result.Item.ensembleId);
  if (!access.ok) return access.response;

  const ensemble = safeEnsemble(result.Item);
  if (hasManagementAccess(access)) {
    ensemble.accessCode = result.Item.accessCode || "";
  }

  return response(200, {
    ensemble,
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
  const accessCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const item = {
    ensembleId,
    ownerId: auth.userId,
    name: body.name || "",
    description: body.description || "",
    logoKey: body.logoKey || "",
    accessCode,
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
    accessCode,
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

const listSections = async (event) => {
  const ensembleId = event.queryStringParameters?.ensembleId;
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  let query;
  if (ensembleId) {
    const access = await getEnsembleAccess(event, ensembleId);
    if (!access.ok) return access.response;

    query = new QueryCommand({
      TableName: env.sectionsTableName,
      IndexName: "ensembleId-index",
      KeyConditionExpression: "ensembleId = :ensembleId",
      ExpressionAttributeValues: {
        ":ensembleId": ensembleId,
      },
    });
  } else {
    query = new QueryCommand({
      TableName: env.sectionsTableName,
      IndexName: "ownerId-index",
      KeyConditionExpression: "ownerId = :ownerId",
      ExpressionAttributeValues: {
        ":ownerId": userId,
      },
    });
  }

  const result = await ddb.send(query);

  return response(200, {
    sections: (result.Items || []).map(safeSection),
  });
};

const getSection = async (event) => {
  const sectionId = event.pathParameters?.sectionId;
  if (!sectionId) {
    return response(400, { message: "Missing sectionId" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.sectionsTableName,
      Key: { sectionId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Section not found" });
  }

  const access = await getEnsembleAccess(event, result.Item.ensembleId);
  if (!access.ok) return access.response;

  return response(200, {
    section: safeSection(result.Item),
  });
};

const createSection = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const ensembleAccess = await requireManagementAccess(event, body.ensembleId || "");
  if (!ensembleAccess.ok) return ensembleAccess.response;

  const sectionId = body.sectionId || crypto.randomUUID();
  const item = {
    sectionId,
    ensembleId: ensembleAccess.ensemble.ensembleId,
    ownerId: ensembleAccess.userId,
    name: body.name || "",
    description: body.description || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.sectionsTableName,
      Item: item,
    }),
  );

  return response(201, {
    section: safeSection(item),
  });
};

const updateSection = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const sectionId = event.pathParameters?.sectionId;
  if (!sectionId) {
    return response(400, { message: "Missing sectionId" });
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.sectionsTableName,
      Key: { sectionId },
    }),
  );

  if (!existing.Item) {
    return response(404, { message: "Section not found" });
  }

  const access = await getEnsembleAccess(event, existing.Item.ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return response(403, { message: "You can only manage sections in your ensembles" });
  }

  const item = {
    ...existing.Item,
    name: body.name ?? existing.Item.name ?? "",
    description: body.description ?? existing.Item.description ?? "",
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.sectionsTableName,
      Item: item,
    }),
  );

  return response(200, {
    section: safeSection(item),
  });
};

const listMemberships = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const ensembleId = event.queryStringParameters?.ensembleId;

  if (ensembleId) {
    const access = await getEnsembleAccess(event, ensembleId);
    if (!access.ok) return access.response;

    if (hasManagementAccess(access)) {
      const result = await ddb.send(
        new QueryCommand({
          TableName: env.membershipsTableName,
          IndexName: "ensembleId-index",
          KeyConditionExpression: "ensembleId = :ensembleId",
          ExpressionAttributeValues: {
            ":ensembleId": ensembleId,
          },
        }),
      );

      return response(200, {
        memberships: (result.Items || []).map(safeMembership),
      });
    }

    const currentMembership = access.membership;
    const result = await ddb.send(
      new QueryCommand({
        TableName: env.membershipsTableName,
        IndexName: "ensembleId-index",
        KeyConditionExpression: "ensembleId = :ensembleId",
        ExpressionAttributeValues: {
          ":ensembleId": ensembleId,
        },
      }),
    );

    return response(200, {
      memberships: (result.Items || [])
        .filter((item) => !currentMembership?.sectionId || item.sectionId === currentMembership.sectionId)
        .map(safeMembership),
    });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.membershipsTableName,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );

  return response(200, {
    memberships: (result.Items || []).map(safeMembership),
  });
};

const getMembership = async (event) => {
  const userId = event.pathParameters?.userId;
  const ensembleId = event.pathParameters?.ensembleId;
  if (!userId || !ensembleId) {
    return response(400, { message: "Missing membership key" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.membershipsTableName,
      Key: { userId, ensembleId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Membership not found" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  if (auth.userId !== userId) {
    const access = await getEnsembleAccess(event, ensembleId);
    if (!access.ok) return access.response;

    if (!hasManagementAccess(access)) {
      return response(403, { message: "You can only access memberships you manage" });
    }
  }

  return response(200, {
    membership: safeMembership(result.Item),
  });
};

const createMembership = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const ensembleAccess = await requireManagementAccess(event, body.ensembleId || "");
  if (!ensembleAccess.ok) return ensembleAccess.response;

  const sectionId = body.sectionId || "";
  let sectionName = body.sectionName || "";

  if (sectionId) {
    const section = await ddb.send(
      new GetCommand({
        TableName: env.sectionsTableName,
        Key: { sectionId },
      }),
    );

    if (!section.Item) {
      return response(404, { message: "Section not found" });
    }

    if (section.Item.ensembleId !== ensembleAccess.ensemble.ensembleId) {
      return response(400, { message: "Section does not belong to the selected ensemble" });
    }

    sectionName = section.Item.name || sectionName;
  }

  const item = {
    userId: body.userId || "",
    ensembleId: ensembleAccess.ensemble.ensembleId,
    role: normalizeMembershipRole(body.role, true),
    status: "active",
    sectionId,
    sectionName,
    joinedAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.membershipsTableName,
      Item: item,
    }),
  );

  return response(201, {
    membership: safeMembership(item),
  });
};

const updateMembership = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const userId = event.pathParameters?.userId;
  const ensembleId = event.pathParameters?.ensembleId;
  if (!userId || !ensembleId) {
    return response(400, { message: "Missing membership key" });
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.membershipsTableName,
      Key: { userId, ensembleId },
    }),
  );

  if (!existing.Item) {
    return response(404, { message: "Membership not found" });
  }

  const ensembleAccess = await requireManagementAccess(event, ensembleId);
  if (!ensembleAccess.ok) return ensembleAccess.response;

  let sectionName = body.sectionName ?? existing.Item.sectionName ?? "";
  let sectionId = body.sectionId ?? existing.Item.sectionId ?? "";

  if (sectionId) {
    const section = await ddb.send(
      new GetCommand({
        TableName: env.sectionsTableName,
        Key: { sectionId },
      }),
    );

    if (!section.Item) {
      return response(404, { message: "Section not found" });
    }

    if (section.Item.ensembleId !== ensembleId) {
      return response(400, { message: "Section does not belong to the selected ensemble" });
    }

    sectionName = section.Item.name || sectionName;
  }

  const item = {
    ...existing.Item,
    role: body.role ?? existing.Item.role ?? "member",
    status: body.status ?? existing.Item.status ?? "active",
    sectionId,
    sectionName,
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.membershipsTableName,
      Item: item,
    }),
  );

  return response(200, {
    membership: safeMembership(item),
  });
};

const listInvitations = async (event) => {
  const ensembleId = event.queryStringParameters?.ensembleId || "";
  if (!ensembleId) {
    return response(400, { message: "Missing ensembleId" });
  }

  const access = await getEnsembleAccess(event, ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return response(403, { message: "You can only view join requests for ensembles you manage" });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.invitationsTableName,
      IndexName: "ensembleId-index",
      KeyConditionExpression: "ensembleId = :ensembleId",
      ExpressionAttributeValues: {
        ":ensembleId": ensembleId,
      },
    }),
  );

  return response(200, {
    invitations: (result.Items || []).map(safeInvitation),
  });
};

const createInvitation = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const ensemble = await getEnsembleByAccessCode(body.ensembleCode || body.accessCode || "");
  if (!ensemble) {
    return response(404, { message: "Ensemble code not found" });
  }

  const access = await getEnsembleAccess(event, ensemble.ensembleId);
  const requestorProfile = await ddb.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: { userId: auth.userId },
    }),
  );
  const requestorEmail = requestorProfile.Item?.email || getClaims(event).email || "";

  let inviteeUserId = auth.userId;
  let inviteeEmail = requestorEmail;

  if (body.inviteeUserId || body.inviteeEmail) {
    if (!hasManagementAccess(access)) {
      return response(403, { message: "You can only invite other users if you manage the ensemble" });
    }

    inviteeUserId = body.inviteeUserId || "";
    inviteeEmail = body.inviteeEmail || "";
  }

  const inviteCode = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  const item = {
    inviteCode,
    ensembleId: ensemble.ensembleId,
    createdBy: auth.userId,
    inviteeEmail,
    inviteeUserId,
    role: normalizeMembershipRole(body.role, hasManagementAccess(access)),
    sectionId: body.sectionId || "",
    sectionName: body.sectionName || "",
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.invitationsTableName,
      Item: item,
    }),
  );

  if (ensemble.ownerId !== auth.userId) {
    await createNotification({
      userId: ensemble.ownerId,
      type: "join_request",
      entityType: "ensemble",
      entityId: ensemble.ensembleId,
      message: "A member requested access to the ensemble.",
    });
  }

  return response(201, {
    invitation: safeInvitation(item),
  });
};

const acceptInvitation = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const inviteCode = body.inviteCode || "";
  if (!inviteCode) {
    return response(400, { message: "Missing inviteCode" });
  }

  const invitation = await getInvitationRecord(inviteCode);
  if (!invitation) {
    return response(404, { message: "Join request not found" });
  }

  if (invitation.status && invitation.status !== "pending") {
    return response(409, { message: "Join request already handled" });
  }
  const ensemble = await getEnsembleRecord(invitation.ensembleId);
  if (!ensemble) {
    return response(404, { message: "Ensemble not found" });
  }

  const access = await getEnsembleAccess(event, invitation.ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return response(403, { message: "You can only approve join requests for ensembles you manage" });
  }

  const targetUserId = invitation.inviteeUserId || invitation.createdBy;
  const targetProfile = await ddb.send(
    new GetCommand({
      TableName: env.usersTableName,
      Key: { userId: targetUserId },
    }),
  );
  const targetEmail = targetProfile.Item?.email || invitation.inviteeEmail || "";
  if (invitation.inviteeEmail && targetEmail && invitation.inviteeEmail !== targetEmail) {
    return response(403, { message: "The join request email does not match the selected account" });
  }

  const existingMembership = await getMembershipRecord(targetUserId, invitation.ensembleId);
  if (existingMembership && isBlockedMembership(existingMembership)) {
    return response(403, { message: "This account is blocked from the ensemble" });
  }
  const membershipItem = {
    userId: targetUserId,
    ensembleId: invitation.ensembleId,
    role: normalizeMembershipRole(invitation.role, hasManagementAccess(access)),
    status: "active",
    sectionId: invitation.sectionId || existingMembership?.sectionId || "",
    sectionName: invitation.sectionName || existingMembership?.sectionName || "",
    joinedAt: existingMembership?.joinedAt || nowIso(),
    updatedAt: nowIso(),
  };

  await Promise.all([
    ddb.send(
      new PutCommand({
        TableName: env.membershipsTableName,
        Item: membershipItem,
      }),
    ),
    ddb.send(
      new PutCommand({
        TableName: env.invitationsTableName,
        Item: {
          ...invitation,
          status: "accepted",
          acceptedBy: auth.userId,
          acceptedAt: nowIso(),
          updatedAt: nowIso(),
        },
      }),
    ),
  ]);

  if (ensemble.ownerId !== targetUserId) {
    await createNotification({
      userId: targetUserId,
      type: "join_request",
      entityType: "ensemble",
      entityId: ensemble.ensembleId,
      message: "Your ensemble request was approved.",
    });
  }

  return response(200, {
    membership: safeMembership(membershipItem),
  });
};

const deleteMembership = async (event) => {
  const userId = event.pathParameters?.userId;
  const ensembleId = event.pathParameters?.ensembleId;
  if (!userId || !ensembleId) {
    return response(400, { message: "Missing membership key" });
  }

  const access = await getEnsembleAccess(event, ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return response(403, { message: "You can only remove members from ensembles you manage" });
  }

  await ddb.send(
    new DeleteCommand({
      TableName: env.membershipsTableName,
      Key: { userId, ensembleId },
    }),
  );

  return response(200, { ok: true });
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
  const fileKey = buildUploadKey({
    userId: auth.userId,
    ensembleId,
    uploadId,
    fileName,
    fileType,
  });

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

const listAssignments = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const ensembleId = event.queryStringParameters?.ensembleId;
  let result;

  if (ensembleId) {
    const access = await getEnsembleAccess(event, ensembleId);
    if (!access.ok) return access.response;

    result = await ddb.send(
      new QueryCommand({
        TableName: env.assignmentsTableName,
        IndexName: "ensembleId-index",
        KeyConditionExpression: "ensembleId = :ensembleId",
        ExpressionAttributeValues: {
          ":ensembleId": ensembleId,
        },
      }),
    );
  } else {
    result = await ddb.send(
      new QueryCommand({
        TableName: env.assignmentsTableName,
        IndexName: "ownerId-index",
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: {
          ":ownerId": userId,
        },
      }),
    );
  }

  return response(200, {
    assignments: (result.Items || []).map(safeAssignment),
  });
};

const getAssignment = async (event) => {
  const assignmentId = event.pathParameters?.assignmentId;
  if (!assignmentId) {
    return response(400, { message: "Missing assignmentId" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.assignmentsTableName,
      Key: { assignmentId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Assignment not found" });
  }

  const access = await getEnsembleAccess(event, result.Item.ensembleId);
  if (!access.ok) return access.response;

  return response(200, {
    assignment: safeAssignment(result.Item),
  });
};

const createAssignment = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const ensembleAccess = await requireManagementAccess(event, body.ensembleId || "");
  if (!ensembleAccess.ok) return ensembleAccess.response;

  const assignmentId = body.assignmentId || crypto.randomUUID();
  const item = {
    assignmentId,
    ownerId: auth.userId,
    ensembleId: ensembleAccess.ensemble.ensembleId,
    title: body.title || "",
    description: body.description || "",
    dueDate: body.dueDate || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.assignmentsTableName,
      Item: item,
    }),
  );

  return response(201, {
    assignment: safeAssignment(item),
  });
};

const updateAssignment = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const assignmentId = event.pathParameters?.assignmentId;
  if (!assignmentId) {
    return response(400, { message: "Missing assignmentId" });
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.assignmentsTableName,
      Key: { assignmentId },
    }),
  );

  if (!existing.Item) {
    return response(404, { message: "Assignment not found" });
  }

  const access = await getEnsembleAccess(event, existing.Item.ensembleId);
  if (!access.ok) return access.response;
  if (!hasManagementAccess(access)) {
    return response(403, { message: "You can only manage assignments in your ensembles" });
  }

  const item = {
    ...existing.Item,
    ensembleId: body.ensembleId ?? existing.Item.ensembleId ?? "",
    title: body.title ?? existing.Item.title ?? "",
    description: body.description ?? existing.Item.description ?? "",
    dueDate: body.dueDate ?? existing.Item.dueDate ?? "",
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.assignmentsTableName,
      Item: item,
    }),
  );

  return response(200, {
    assignment: safeAssignment(item),
  });
};

const listSubmissions = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const ensembleId = event.queryStringParameters?.ensembleId;
  const assignmentId = event.queryStringParameters?.assignmentId;
  const sectionId = event.queryStringParameters?.sectionId;

  let result;
  let access = null;

  if (ensembleId) {
    access = await getEnsembleAccess(event, ensembleId);
    if (!access.ok) return access.response;

    result = await ddb.send(
      new QueryCommand({
        TableName: env.submissionsTableName,
        IndexName: "ensembleId-index",
        KeyConditionExpression: "ensembleId = :ensembleId",
        ExpressionAttributeValues: {
          ":ensembleId": ensembleId,
        },
      }),
    );
  } else if (sectionId) {
    const section = await getSectionRecord(sectionId);
    if (!section) {
      return response(404, { message: "Section not found" });
    }

    access = await getEnsembleAccess(event, section.ensembleId);
    if (!access.ok) return access.response;

    if (!access.isOwner && access.membership?.sectionId !== sectionId && !privilegedRoles.has(access.membership?.role ?? "")) {
      return response(403, { message: "You can only access submissions from your section" });
    }

    result = await ddb.send(
      new QueryCommand({
        TableName: env.submissionsTableName,
        IndexName: "sectionId-index",
        KeyConditionExpression: "sectionId = :sectionId",
        ExpressionAttributeValues: {
          ":sectionId": sectionId,
        },
      }),
    );
  } else if (assignmentId) {
    const assignment = await getAssignmentRecord(assignmentId);
    if (!assignment) {
      return response(404, { message: "Assignment not found" });
    }

    access = await getEnsembleAccess(event, assignment.ensembleId);
    if (!access.ok) return access.response;

    result = await ddb.send(
      new QueryCommand({
        TableName: env.submissionsTableName,
        IndexName: "assignmentId-index",
        KeyConditionExpression: "assignmentId = :assignmentId",
        ExpressionAttributeValues: {
          ":assignmentId": assignmentId,
        },
      }),
    );
  } else {
    result = await ddb.send(
      new QueryCommand({
        TableName: env.submissionsTableName,
        IndexName: "ownerId-index",
        KeyConditionExpression: "ownerId = :ownerId",
        ExpressionAttributeValues: {
          ":ownerId": userId,
        },
      }),
    );
  }

  const visibleItems = access
    ? (result.Items || []).filter((item) => canAccessSubmission(access, item))
    : result.Items || [];

  return response(200, {
    submissions: visibleItems.map(safeSubmission),
  });
};

const getSubmission = async (event) => {
  const submissionId = event.pathParameters?.submissionId;
  if (!submissionId) {
    return response(400, { message: "Missing submissionId" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.submissionsTableName,
      Key: { submissionId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Submission not found" });
  }

  const access = await getEnsembleAccess(event, result.Item.ensembleId);
  if (!access.ok) return access.response;

  if (!canAccessSubmission(access, result.Item)) {
    return response(403, { message: "You can only access your own submissions" });
  }

  return response(200, {
    submission: safeSubmission(result.Item),
  });
};

const createSubmission = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const assignment = await getAssignmentRecord(body.assignmentId || "");

  if (!assignment) {
    return response(404, { message: "Assignment not found" });
  }

  const access = await getEnsembleAccess(event, assignment.ensembleId);
  if (!access.ok) return access.response;

  let sectionId = body.sectionId || access.membership?.sectionId || "";
  let sectionRecord = null;

  if (sectionId) {
    sectionRecord = await getSectionRecord(sectionId);
    if (!sectionRecord) {
      return response(404, { message: "Section not found" });
    }

    if (sectionRecord.ensembleId !== assignment.ensembleId) {
      return response(400, { message: "Section does not belong to the selected ensemble" });
    }

    if (
      !access.isOwner &&
      access.membership?.sectionId &&
      access.membership.sectionId !== sectionId &&
      access.membership.role !== "director" &&
      access.membership.role !== "leader"
    ) {
      return response(403, { message: "You can only submit for your section" });
    }
  }

  const submissionId = body.submissionId || crypto.randomUUID();
  const item = {
    submissionId,
    assignmentId: assignment.assignmentId,
    ensembleId: assignment.ensembleId,
    ownerId: auth.userId,
    sectionId,
    videoKey: body.videoKey || "",
    notes: body.notes || "",
    reviewStatus: "pending",
    feedback: "",
    expiresAt: expiresInDays(21),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.submissionsTableName,
      Item: item,
    }),
  );

  const sectionMembers = sectionId
    ? await ddb.send(
        new QueryCommand({
          TableName: env.membershipsTableName,
          IndexName: "ensembleId-index",
          KeyConditionExpression: "ensembleId = :ensembleId",
          ExpressionAttributeValues: {
            ":ensembleId": assignment.ensembleId,
          },
        }),
      )
    : null;

  const notificationTargets = new Set();
  if (assignment.ownerId !== auth.userId) {
    notificationTargets.add(assignment.ownerId);
  }
  if (sectionMembers?.Items?.length) {
    sectionMembers.Items.filter((membership) => !sectionId || membership.sectionId === sectionId).forEach(
      (membership) => {
        if (membership.userId !== auth.userId) {
          notificationTargets.add(membership.userId);
        }
      },
    );
  }

  await Promise.all(
    [...notificationTargets].map((recipientId) =>
      createNotification({
        userId: recipientId,
        type: "submission",
        entityType: "submission",
        entityId: item.submissionId,
        message: `${getClaims(event).email || "A member"} submitted a practice video.`,
      }),
    ),
  );

  return response(201, {
    submission: safeSubmission(item),
  });
};

const updateSubmission = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const submissionId = event.pathParameters?.submissionId;
  if (!submissionId) {
    return response(400, { message: "Missing submissionId" });
  }

  const existing = await ddb.send(
    new GetCommand({
      TableName: env.submissionsTableName,
      Key: { submissionId },
    }),
  );

  if (!existing.Item) {
    return response(404, { message: "Submission not found" });
  }

  const assignment = await getAssignmentRecord(existing.Item.assignmentId);
  if (!assignment) {
    return response(404, { message: "Assignment not found" });
  }

  const access = await getEnsembleAccess(event, assignment.ensembleId);
  if (!access.ok) return access.response;

  if (!canAccessSubmission(access, existing.Item)) {
    return response(403, { message: "You can only update your own submissions" });
  }

  const isOwner = existing.Item.ownerId === access.userId;
  const isReviewer = access.isOwner || privilegedRoles.has(access.membership?.role ?? "");

  if (!isOwner && !isReviewer) {
    return response(403, { message: "You can only update your own submissions" });
  }

  const item = {
    ...existing.Item,
    videoKey: body.videoKey ?? existing.Item.videoKey ?? "",
    notes: body.notes ?? existing.Item.notes ?? "",
    reviewStatus: body.reviewStatus ?? existing.Item.reviewStatus ?? "pending",
    feedback: isReviewer ? body.feedback ?? existing.Item.feedback ?? "" : existing.Item.feedback ?? "",
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.submissionsTableName,
      Item: item,
    }),
  );

  if (isReviewer && existing.Item.ownerId !== access.userId) {
    await createNotification({
      userId: existing.Item.ownerId,
      type: "feedback",
      entityType: "submission",
      entityId: item.submissionId,
      message: "Your submission received feedback.",
    });
  }

  return response(200, {
    submission: safeSubmission(item),
  });
};

const listComments = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const submissionId = event.queryStringParameters?.submissionId;
  if (!submissionId) {
    return response(400, { message: "Missing submissionId" });
  }

  const submission = await getSubmissionRecord(submissionId);
  if (!submission) {
    return response(404, { message: "Submission not found" });
  }

  const access = await getEnsembleAccess(event, submission.ensembleId);
  if (!access.ok) return access.response;

  if (!canAccessSubmission(access, submission)) {
    return response(403, { message: "You can only access comments on submissions you can see" });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.commentsTableName,
      KeyConditionExpression: "submissionId = :submissionId",
      ExpressionAttributeValues: {
        ":submissionId": submissionId,
      },
    }),
  );

  return response(200, {
    comments: (result.Items || []).map(safeComment),
  });
};

const createComment = async (event) => {
  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const auth = ensureUser(event);
  if (!auth.ok) return auth.response;

  const submission = await getSubmissionRecord(body.submissionId || "");
  if (!submission) {
    return response(404, { message: "Submission not found" });
  }

  const access = await getEnsembleAccess(event, submission.ensembleId);
  if (!access.ok) return access.response;

  if (!canAccessSubmission(access, submission)) {
    return response(403, { message: "You can only comment on submissions you can see" });
  }

  const commentId = crypto.randomUUID();
  const item = {
    submissionId: submission.submissionId,
    commentId,
    authorId: auth.userId,
    body: body.body || body.message || "",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.commentsTableName,
      Item: item,
    }),
  );

  const recipients = new Set();
  if (submission.ownerId !== auth.userId) {
    recipients.add(submission.ownerId);
  }
  if (access.ensemble.ownerId !== auth.userId) {
    recipients.add(access.ensemble.ownerId);
  }

  await Promise.all(
    [...recipients].map((recipientId) =>
      createNotification({
        userId: recipientId,
        type: "comment",
        entityType: "submission",
        entityId: submission.submissionId,
        message: "A new comment was added to a submission.",
      }),
    ),
  );

  return response(201, {
    comment: safeComment(item),
  });
};

const listNotifications = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const result = await ddb.send(
    new QueryCommand({
      TableName: env.notificationsTableName,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    }),
  );

  return response(200, {
    notifications: (result.Items || []).map(safeNotification),
  });
};

const updateNotification = async (event) => {
  const userId = getUserId(event);
  const auth = ensureUser(event, userId);
  if (!auth.ok) return auth.response;

  const notificationId = event.pathParameters?.notificationId;
  if (!notificationId) {
    return response(400, { message: "Missing notificationId" });
  }

  const result = await ddb.send(
    new GetCommand({
      TableName: env.notificationsTableName,
      Key: { userId, notificationId },
    }),
  );

  if (!result.Item) {
    return response(404, { message: "Notification not found" });
  }

  const body = parseBody(event);
  if (body === null) {
    return response(400, { message: "Invalid JSON body" });
  }

  const item = {
    ...result.Item,
    isRead: body.isRead ?? true,
    updatedAt: nowIso(),
  };

  await ddb.send(
    new PutCommand({
      TableName: env.notificationsTableName,
      Item: item,
    }),
  );

  return response(200, {
    notification: safeNotification(item),
  });
};

exports.handler = async (event) => {
  const key = routeKey(event);

  if (key === "GET /health") return health();
  if (key === "GET /profiles") return getProfile(event);
  if (key === "GET /session") return getProfile(event);
  if (key === "POST /profiles") return upsertProfile(event);
  if (key === "GET /profiles/{userId}") return getProfile(event);
  if (key === "PUT /profiles/{userId}") return upsertProfile(event);
  if (key === "GET /ensembles") return listEnsembles(event);
  if (key === "POST /ensembles") return createEnsemble(event);
  if (key === "GET /ensembles/{ensembleId}") return getEnsemble(event);
  if (key === "PUT /ensembles/{ensembleId}") return updateEnsemble(event);
  if (key === "POST /uploads/presign") return presignUpload(event);
  if (key === "GET /sections") return listSections(event);
  if (key === "POST /sections") return createSection(event);
  if (key === "GET /sections/{sectionId}") return getSection(event);
  if (key === "PUT /sections/{sectionId}") return updateSection(event);
  if (key === "GET /memberships") return listMemberships(event);
  if (key === "POST /memberships") return createMembership(event);
  if (key === "GET /memberships/{userId}/{ensembleId}") return getMembership(event);
  if (key === "PUT /memberships/{userId}/{ensembleId}") return updateMembership(event);
  if (key === "DELETE /memberships/{userId}/{ensembleId}") return deleteMembership(event);
  if (key === "GET /assignments") return listAssignments(event);
  if (key === "POST /assignments") return createAssignment(event);
  if (key === "GET /assignments/{assignmentId}") return getAssignment(event);
  if (key === "PUT /assignments/{assignmentId}") return updateAssignment(event);
  if (key === "GET /submissions") return listSubmissions(event);
  if (key === "POST /submissions") return createSubmission(event);
  if (key === "GET /submissions/{submissionId}") return getSubmission(event);
  if (key === "PUT /submissions/{submissionId}") return updateSubmission(event);
  if (key === "GET /comments") return listComments(event);
  if (key === "POST /comments") return createComment(event);
  if (key === "GET /invitations") return listInvitations(event);
  if (key === "POST /invitations") return createInvitation(event);
  if (key === "POST /invitations/accept") return acceptInvitation(event);
  if (key === "GET /notifications") return listNotifications(event);
  if (key === "PUT /notifications/{notificationId}") return updateNotification(event);

  return response(404, {
    message: "Not found",
    route: key,
  });
};
