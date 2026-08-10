import * as logger from "firebase-functions/logger";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { MemberMappingError } from "../services/memberMapper";
import {
  lookupPosMemberForUser,
  MemberLocalPersistenceError,
  MemberRemoteApiError,
  registerPosMemberForUser,
  updatePosMemberProfileForUser,
} from "./functions";
import { MemberInputError } from "./memberPolicy";

const MEMBER_CALLABLE_OPTIONS = {
  region: "asia-southeast1",
  cors: true,
  timeoutSeconds: 60,
  maxInstances: 20,
};

export function throwMemberCallableError(
  error: unknown,
  callableName: string,
  userId: string,
): never {
  if (error instanceof HttpsError) throw error;
  if (error instanceof MemberInputError) {
    throw new HttpsError("invalid-argument", error.message);
  }
  if (error instanceof MemberRemoteApiError) {
    throw new HttpsError(
      error.remoteCode === null
        ? "unavailable"
        : error.isNotFound
          ? "not-found"
          : "failed-precondition",
      error.message,
      { action: error.action, remoteCode: error.remoteCode },
    );
  }
  if (error instanceof MemberMappingError) {
    throw new HttpsError("data-loss", error.message);
  }
  if (error instanceof MemberLocalPersistenceError) {
    logger.error(`[${callableName}] Local persistence failed after remote success`, {
      userId,
      error: error.message,
    });
    throw new HttpsError("internal", error.message);
  }

  logger.error(`[${callableName}] Unexpected member operation failure`, {
    userId,
    error,
  });
  throw new HttpsError(
    "internal",
    "Không thể xử lý yêu cầu thành viên. Vui lòng thử lại.",
  );
}

export const lookupPosMember = onCall(
  MEMBER_CALLABLE_OPTIONS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để tra cứu thành viên.",
      );
    }
    try {
      return await lookupPosMemberForUser(request.auth.uid, request.data);
    } catch (error: unknown) {
      return throwMemberCallableError(error, "lookupPosMember", request.auth.uid);
    }
  },
);

export const registerPosMember = onCall(
  MEMBER_CALLABLE_OPTIONS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để đăng ký thành viên.",
      );
    }
    try {
      return await registerPosMemberForUser(request.auth.uid, request.data);
    } catch (error: unknown) {
      return throwMemberCallableError(error, "registerPosMember", request.auth.uid);
    }
  },
);

export const updatePosMemberProfile = onCall(
  MEMBER_CALLABLE_OPTIONS,
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Bạn phải đăng nhập để cập nhật thành viên.",
      );
    }
    try {
      return await updatePosMemberProfileForUser(request.auth.uid, request.data);
    } catch (error: unknown) {
      return throwMemberCallableError(
        error,
        "updatePosMemberProfile",
        request.auth.uid,
      );
    }
  },
);
