import { api } from "@/lib/api/client";
import type {
  LoginRequest,
  LoginResponse,
  FirebaseLoginRequest,
  FirebaseLoginResponse,
  RegisterRequest,
  UserOut,
  APIKeyOut,
  CreateAPIKeyRequest,
  CreateAPIKeyResponse,
} from "@/types/api";

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<LoginResponse>("/auth/login", data, { skipAuth: true }),

  firebaseLogin: (data: FirebaseLoginRequest) =>
    api.post<FirebaseLoginResponse>("/auth/firebase-login", data, { skipAuth: true }),

  register: (data: RegisterRequest) =>
    api.post<UserOut>("/auth/register", data, { skipAuth: true }),

  refresh: (refreshToken: string) =>
    api.post<{ access_token: string }>(
      "/auth/refresh",
      { refresh_token: refreshToken },
      { skipAuth: true },
    ),

  logout: (refreshToken: string) =>
    api.post<void>("/auth/logout", { refresh_token: refreshToken }, { skipAuth: true }),

  me: () => api.get<UserOut>("/auth/me"),

  createApiKey: (data: CreateAPIKeyRequest) =>
    api.post<CreateAPIKeyResponse>("/auth/keys", data),

  listApiKeys: () => api.get<APIKeyOut[]>("/auth/keys"),

  revokeApiKey: (keyId: string) => api.delete<void>(`/auth/keys/${keyId}`),
};
