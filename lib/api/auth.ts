import { api } from "@/lib/api/client";
import type {
  LoginRequest,
  LoginResponse,
  FirebaseLoginRequest,
  FirebaseLoginResponse,
  RegisterRequest,
  SetPasswordRequest,
  SignupVerificationPending,
  VerifySignupRequest,
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

  /** The account itself, or — when email is set up — a code to confirm first. */
  register: (data: RegisterRequest) =>
    api.post<UserOut | SignupVerificationPending>("/auth/register", data, { skipAuth: true }),

  verifySignup: (data: VerifySignupRequest) =>
    api.post<UserOut>("/auth/register/verify", data, { skipAuth: true }),

  resendSignupCode: (email: string) =>
    api.post<Omit<SignupVerificationPending, "verification">>(
      "/auth/register/resend", { email }, { skipAuth: true },
    ),

  refresh: (refreshToken: string) =>
    api.post<{ access_token: string }>(
      "/auth/refresh",
      { refresh_token: refreshToken },
      { skipAuth: true },
    ),

  logout: (refreshToken: string) =>
    api.post<void>("/auth/logout", { refresh_token: refreshToken }, { skipAuth: true }),

  me: () => api.get<UserOut>("/auth/me"),

  /** Add a password to this account (e.g. a Google account), or change it. */
  setPassword: (data: SetPasswordRequest) =>
    api.post<{ has_password: boolean }>("/auth/password", data),

  createApiKey: (data: CreateAPIKeyRequest) =>
    api.post<CreateAPIKeyResponse>("/auth/keys", data),

  listApiKeys: () => api.get<APIKeyOut[]>("/auth/keys"),

  revokeApiKey: (keyId: string) => api.delete<void>(`/auth/keys/${keyId}`),
};
